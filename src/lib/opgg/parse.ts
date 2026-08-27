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
      if (char === "(") depth++;
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
