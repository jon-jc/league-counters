/**
 * op.gg's MCP does not answer in JSON.
 *
 * `tools/call` requires a `desired_output_fields` list, and what comes back is
 * a compact positional format that looks like Python reprs — a few class
 * declarations naming the field order, then nested tuples carrying only values:
 *
 *   class Positions: top,mid,jungle,adc,support
 *   class Top: champion,is_rip,play,win,win_rate,pick_rate,role_rate,ban_rate,kda,tier,rank
 *
 *   LolListLaneMetaChampions(Data(Positions([Top("Nasus",false,22754,...)],[...])))
 *
 * The saving grace is that the payload declares its own field order, so this
 * parser reads the declarations rather than hard-coding offsets. If op.gg adds
 * a column or reorders one, the mapping follows automatically instead of
 * silently shifting every value by one — which, with `win_rate` and `pick_rate`
 * adjacent and both plausible small decimals, would corrupt the tier list
 * without anything looking obviously wrong.
 *
 * Everything here is pure string handling so it can be tested against captured
 * payloads without touching the network.
 */

/** One champion in one lane, exactly as op.gg reports it. */
export interface LaneMetaRow {
  champion: string;
  isRip: boolean;
  play: number;
  win: number;
  /** Rounded to two decimals by op.gg. Prefer `win / play`. */
  winRate: number;
  pickRate: number;
  /** Share of this champion's games played in this lane. */
  roleRate: number;
  /** Per champion, not per lane — the same value repeats across its lanes. */
  banRate: number;
  kda: number;
  /** 0 is the strongest bucket, 5 the weakest. */
  tier: number;
  /** 1-based position within the lane. */
  rank: number;
}

/** Lane name as op.gg spells it (`top`, `mid`, `jungle`, `adc`, `support`). */
export type LaneMeta = Record<string, LaneMetaRow[]>;

export class OpggParseError extends Error {
  constructor(message: string) {
    super(`op.gg payload: ${message}`);
    this.name = "OpggParseError";
  }
}

/** `class Top: champion,is_rip,...` -> { Top: ["champion", "is_rip", ...] }. */
function readClassDeclarations(text: string): Record<string, string[]> {
  const classes: Record<string, string[]> = {};
  for (const line of text.split("\n")) {
    if (!line.startsWith("class ")) continue;
    const separator = line.indexOf(": ");
    if (separator === -1) continue;
    const name = line.slice(6, separator).trim();
    const fields = line
      .slice(separator + 2)
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean);
    if (name && fields.length > 0) classes[name] = fields;
  }
  return classes;
}

/**
 * The balanced contents of `Name(...)`, or null if absent.
 *
 * Needed because a payload can carry sibling nodes with their own arrays —
 * `FieldDiagnostics(["data.counters_meta"], "...")` turns up whenever a
 * requested field does not match — and counting top-level groups across the
 * whole response would then read a diagnostic array as if it were data.
 */
function extractCall(text: string, name: string): string | null {
  const opener = `${name}(`;
  const start = text.indexOf(opener);
  if (start === -1) return null;

  let depth = 1;
  let inString = false;
  for (let i = start + opener.length; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "(") depth++;
    else if (char === ")") {
      depth--;
      if (depth === 0) return text.slice(start + opener.length, i);
    }
  }
  return null;
}

/**
 * Split the top-level `[...]` groups, one per lane.
 *
 * Done by walking characters rather than matching brackets with a regex,
 * because champion names are quoted strings that may contain anything.
 */
function readTopLevelGroups(text: string): string[] {
  const groups: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (char === "]") {
      depth--;
      if (depth === 0 && start !== -1) groups.push(text.slice(start + 1, i));
    }
  }
  return groups;
}

/** Coerce one positional value: `false` -> boolean, `0.51` -> number, else string. */
function coerce(raw: string): string | number | boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "" || raw === "None" || raw === "null") return 0;
  const asNumber = Number(raw);
  return Number.isNaN(asNumber) ? raw : asNumber;
}

/** Read every `ClassName(...)` tuple in a chunk, zipped against its field order. */
function readTuples(
  chunk: string,
  className: string,
  fields: string[],
): Record<string, string | number | boolean>[] {
  const rows: Record<string, string | number | boolean>[] = [];
  const opener = `${className}(`;
  let cursor = chunk.indexOf(opener);

  while (cursor !== -1) {
    let i = cursor + opener.length;
    const parts: string[] = [];
    let current = "";
    let depth = 1;
    let inString = false;

    for (; i < chunk.length; i++) {
      const char = chunk[i];
      if (inString) {
        if (char === '"') inString = false;
        else current += char;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "(" || char === "[") depth++;
      else if (char === "]") depth--;
      else if (char === ")") {
        depth--;
        if (depth === 0) break;
      }
      if (depth === 1 && char === ",") {
        parts.push(current);
        current = "";
        continue;
      }
      current += char;
    }
    parts.push(current);

    if (parts.length !== fields.length) {
      throw new OpggParseError(
        `${className} tuple has ${parts.length} values but ${fields.length} fields were declared`,
      );
    }

    const row: Record<string, string | number | boolean> = {};
    fields.forEach((field, index) => {
      row[field] = coerce(parts[index] ?? "");
    });
    rows.push(row);

    cursor = chunk.indexOf(opener, i);
  }

  return rows;
}

function asNumber(value: string | number | boolean | undefined, field: string): number {
  if (typeof value !== "number") {
    throw new OpggParseError(`expected a number for ${field}, got ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Turn a `lol_list_lane_meta_champions` payload into rows keyed by lane.
 *
 * Throws rather than returning partial data: a tier list built from a
 * half-understood payload is worse than no tier list, because nothing about it
 * looks broken.
 */
export function parseLaneMeta(text: string): LaneMeta {
  const classes = readClassDeclarations(text);

  const positionOrder = classes.Positions;
  if (!positionOrder) {
    throw new OpggParseError("no `class Positions` declaration — response shape changed");
  }

  /* The row class is whichever one carries `champion`. op.gg reuses a single
     class (`Top`) for all five lanes, so keying off the lane name would only
     find one of them. */
  const rowEntry = Object.entries(classes).find(([, fields]) => fields.includes("champion"));
  if (!rowEntry) {
    throw new OpggParseError("no class declares a `champion` field");
  }
  const [rowClass, rowFields] = rowEntry;

  const groups = readTopLevelGroups(text);
  if (groups.length !== positionOrder.length) {
    throw new OpggParseError(
      `found ${groups.length} lane arrays but ${positionOrder.length} positions were declared`,
    );
  }

  const meta: LaneMeta = {};
  positionOrder.forEach((position, index) => {
    const raw = readTuples(groups[index] ?? "", rowClass, rowFields);
    meta[position] = raw.map((row) => {
      const champion = row.champion;
      if (typeof champion !== "string" || champion === "") {
        throw new OpggParseError(`row in ${position} has no champion name`);
      }
      return {
        champion,
        isRip: row.is_rip === true,
        play: asNumber(row.play, "play"),
        win: asNumber(row.win, "win"),
        winRate: asNumber(row.win_rate, "win_rate"),
        pickRate: asNumber(row.pick_rate, "pick_rate"),
        roleRate: asNumber(row.role_rate, "role_rate"),
        banRate: asNumber(row.ban_rate, "ban_rate"),
        kda: asNumber(row.kda, "kda"),
        tier: asNumber(row.tier, "tier"),
        rank: asNumber(row.rank, "rank"),
      };
    });
  });

  return meta;
}

/* ---------- Champion counter matchups ---------- */

/** One head-to-head lane pairing, from the queried champion's perspective. */
export interface CounterRow {
  opponentId: number;
  opponentName: string;
  /** Games in this pairing. */
  play: number;
  /** Wins for the *queried* champion, not the opponent. */
  win: number;
}

/** Counters op.gg lists for one position, keyed by its own position name. */
export interface PositionCounters {
  /** op.gg's spelling: "TOP", "MID", "JUNGLE", "ADC", "SUPPORT". */
  position: string;
  counters: CounterRow[];
}

export interface ChampionCounters {
  /** Opponents the queried champion beats. */
  strong: CounterRow[];
  /** Opponents that beat the queried champion. */
  weak: CounterRow[];
  /**
   * op.gg's documented fallback for thin samples, covering every position the
   * champion plays rather than only the one queried. Smaller samples than
   * strong/weak, and only the losing side, but it is the difference between a
   * sparse counter list and an empty one.
   */
  byPosition: PositionCounters[];
}

/**
 * Turn a `lol_get_champion_analysis` counters payload into lane pairings.
 *
 * op.gg reuses one class for both arrays and distinguishes them only by
 * position inside `Data(...)`, so the order is read from the `Data` class
 * declaration rather than assumed — getting it backwards would invert every
 * counter on the site, listing a champion's worst matchups as its best.
 *
 * `win` is the queried champion's wins in both arrays, which is what makes
 * these rows drop straight into the same shape Riot-derived matchups use.
 */
export function parseChampionCounters(text: string): ChampionCounters {
  const classes = readClassDeclarations(text);

  const dataFields = classes.Data;
  if (!dataFields) {
    throw new OpggParseError("no `class Data` declaration on the counters response");
  }

  const body = extractCall(text, "Data");
  if (body === null) throw new OpggParseError("counters response has no Data(...) node");

  /* `Data` declares only the fields it actually carries, and not all of them
     are arrays: a champion-lane with too thin a sample drops the empty side
     entirely and adds a `counters_meta` node instead, giving
     `Data([...], CountersMeta("..."))`. So items are matched to field names by
     walking the body in order rather than by counting brackets. */
  const items = readTopLevelItems(body);
  if (items.length !== dataFields.length) {
    throw new OpggParseError(
      `Data declares ${dataFields.length} fields but carries ${items.length} values`,
    );
  }

  const read = (field: string): CounterRow[] => {
    const index = dataFields.indexOf(field);
    if (index === -1) return []; // op.gg omits a side it has no sample for
    const item = items[index];
    if (!item || item.kind !== "array") return [];

    /* The row class is named after whichever side it holds — `StrongCounter`
       or `WeakCounter` — and op.gg reuses one of them for both arrays when
       both are present. Reading the name out of the group itself covers every
       combination without assuming which. */
    const className = detectClassName(item.text);
    if (!className) return [];
    const fields = classes[className];
    if (!fields) {
      throw new OpggParseError(`group for ${field} uses undeclared class ${className}`);
    }

    return readTuples(item.text, className, fields).flatMap((row) => {
      const opponentId = row.champion_id;
      const play = row.play;
      const win = row.win;
      if (typeof opponentId !== "number" || typeof play !== "number" || typeof win !== "number") {
        throw new OpggParseError(`counter row for ${field} is missing champion_id, play or win`);
      }
      const name = row.champion_name;
      return [
        {
          opponentId,
          opponentName: typeof name === "string" ? name : "",
          play,
          win,
        },
      ];
    });
  };

  return {
    strong: read("strong_counters"),
    weak: read("weak_counters"),
    byPosition: readSummaryCounters(text, classes),
  };
}

/**
 * Pull `data.summary.positions[].counters[]` — op.gg's raw, smaller-sample
 * matchups, which they point to explicitly when the graded counters are empty.
 */
function readSummaryCounters(
  text: string,
  classes: Record<string, string[]>,
): PositionCounters[] {
  const summary = extractCall(text, "Summary");
  if (summary === null) return [];

  const positionFields = classes.Position;
  const counterFields = classes.Counter;
  if (!positionFields || !counterFields) return [];

  const items = readTopLevelItems(summary);
  const array = items.find((item) => item.kind === "array");
  if (!array) return [];

  return readTuples(array.text, "Position", positionFields).flatMap((row) => {
    const position = row.name;
    const counters = row.counters;
    if (typeof position !== "string" || typeof counters !== "string") return [];

    const inner = counters.startsWith("[") ? counters.slice(1, -1) : counters;
    const parsed = readTuples(inner, "Counter", counterFields).flatMap((counter) => {
      const opponentId = counter.champion_id;
      const play = counter.play;
      const win = counter.win;
      if (typeof opponentId !== "number" || typeof play !== "number" || typeof win !== "number") {
        return [];
      }
      const name = counter.champion_name;
      return [
        { opponentId, opponentName: typeof name === "string" ? name : "", play, win },
      ];
    });

    return parsed.length > 0 ? [{ position, counters: parsed }] : [];
  });
}

/** One positional value inside a node: an array, a nested node, or a scalar. */
interface TopLevelItem {
  kind: "array" | "node" | "scalar";
  text: string;
}

/**
 * Split a node's body into its positional values, in order.
 *
 * Needed because a declared field is not necessarily an array — counting
 * `[...]` groups alone cannot tell which declared field a group belongs to
 * once optional non-array siblings appear.
 */
function readTopLevelItems(body: string): TopLevelItem[] {
  const items: TopLevelItem[] = [];
  let depth = 0;
  let inString = false;
  let current = "";

  const push = (raw: string) => {
    const value = raw.trim();
    if (value === "") return;
    if (value.startsWith("[")) items.push({ kind: "array", text: value.slice(1, -1) });
    else if (value.endsWith(")")) items.push({ kind: "node", text: value });
    else items.push({ kind: "scalar", text: value });
  };

  for (let i = 0; i < body.length; i++) {
    const char = body[i] ?? "";
    if (inString) {
      if (char === '"') inString = false;
      current += char;
      continue;
    }
    if (char === '"') {
      inString = true;
      current += char;
      continue;
    }
    if (char === "[" || char === "(") depth++;
    else if (char === "]" || char === ")") depth--;
    if (depth === 0 && char === ",") {
      push(current);
      current = "";
      continue;
    }
    current += char;
  }
  push(current);

  return items;
}

/** The class name opening a group, e.g. `StrongCounter(1,2,3),...` -> "StrongCounter". */
function detectClassName(group: string): string | null {
  const open = group.indexOf("(");
  if (open === -1) return null;
  let start = open;
  while (start > 0) {
    const code = group.charCodeAt(start - 1);
    const isWordChar =
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      code === 95;
    if (!isWordChar) break;
    start--;
  }
  const name = group.slice(start, open);
  return name === "" ? null : name;
}
