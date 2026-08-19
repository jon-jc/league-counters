import { ROLES, isRole, toPatch, type Role } from "@/lib/lol/constants";
import type { RiotMatch } from "@/lib/riot/types";
import type {
  BuildTally,
  ChampionTally,
  MatchupTally,
  OptionCount,
  Snapshot,
  SnapshotMeta,
} from "@/lib/data/types";

/** Games shorter than this are remakes, not decided games. */
const MIN_GAME_SECONDS = 300;

interface RoleCounts {
  games: number;
  wins: number;
}

interface ChampionAccumulator {
  bans: number;
  byRole: Map<Role, RoleCounts>;
}

interface BuildAccumulator {
  games: number;
  items: Map<number, OptionCount>;
  boots: Map<number, OptionCount>;
  keystones: Map<number, OptionCount>;
  secondaryStyles: Map<number, OptionCount>;
  spells: Map<string, OptionCount>;
}

export interface Accumulator {
  /** Distinct matches folded in. */
  matches: number;
  champions: Map<number, ChampionAccumulator>;
  /** Keyed `championId:opponentId:role`. */
  matchups: Map<string, MatchupTally>;
  /** Keyed `championId:role`. */
  builds: Map<string, BuildAccumulator>;
}

/**
 * Tells the aggregator which item ids are worth recording. Without it every
 * component would be tallied, which buries the actual build under Dagger and
 * Ruby Crystal.
 */
export interface ItemClassifier {
  legendary: Set<number>;
  boots: Set<number>;
}

function bump<K>(map: Map<K, OptionCount>, key: K, win: boolean): void {
  const entry = map.get(key) ?? { games: 0, wins: 0 };
  entry.games += 1;
  if (win) entry.wins += 1;
  map.set(key, entry);
}

/** Serialise the leading options only; the tail is noise at these samples. */
function topOf(map: Map<number | string, OptionCount>, limit: number): Record<string, OptionCount> {
  return Object.fromEntries(
    [...map.entries()]
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, limit)
      .map(([key, value]) => [String(key), value]),
  );
}

export function createAccumulator(): Accumulator {
  return { matches: 0, champions: new Map(), matchups: new Map(), builds: new Map() };
}

/** Re-hydrate an accumulator from a stored snapshot so ingests can resume. */
export function fromSnapshot(snapshot: Snapshot): Accumulator {
  const champions = new Map<number, ChampionAccumulator>();
  for (const champion of snapshot.champions) {
    const byRole = new Map<Role, RoleCounts>();
    for (const role of ROLES) {
      const tally = champion.byRole[role];
      if (tally) byRole.set(role, { games: tally.games, wins: tally.wins });
    }
    champions.set(champion.championId, { bans: champion.bans, byRole });
  }

  const matchups = new Map<string, MatchupTally>();
  for (const matchup of snapshot.matchups) {
    matchups.set(matchupKey(matchup.championId, matchup.opponentId, matchup.role), {
      ...matchup,
    });
  }

  const builds = new Map<string, BuildAccumulator>();
  for (const build of snapshot.builds ?? []) {
    const toMap = <K extends number | string>(
      record: Record<string, OptionCount>,
      cast: (key: string) => K,
    ) => new Map<K, OptionCount>(Object.entries(record).map(([k, v]) => [cast(k), { ...v }]));

    builds.set(buildKey(build.championId, build.role), {
      games: build.games,
      items: toMap(build.items, Number),
      boots: toMap(build.boots, Number),
      keystones: toMap(build.keystones, Number),
      secondaryStyles: toMap(build.secondaryStyles, Number),
      spells: toMap(build.spells, String),
    });
  }

  return { matches: snapshot.meta.matches, champions, matchups, builds };
}

function buildKey(championId: number, role: Role): string {
  return `${championId}:${role}`;
}

function matchupKey(championId: number, opponentId: number, role: Role): string {
  return `${championId}:${opponentId}:${role}`;
}

function championEntry(acc: Accumulator, championId: number): ChampionAccumulator {
  let entry = acc.champions.get(championId);
  if (!entry) {
    entry = { bans: 0, byRole: new Map() };
    acc.champions.set(championId, entry);
  }
  return entry;
}

export type RejectReason = "queue" | "patch" | "incomplete" | "short" | "positions";

export interface AddMatchResult {
  counted: boolean;
  reason?: RejectReason;
}

/**
 * Fold one match into the accumulator.
 *
 * Rejects anything that would pollute the numbers: wrong queue, a different
 * patch, remakes, and matches where Riot could not classify all ten positions
 * (which happens on disconnects and would otherwise invent lane matchups).
 */
export function addMatch(
  acc: Accumulator,
  match: RiotMatch,
  target: { queue: number; patch: string },
  items?: ItemClassifier,
): AddMatchResult {
  const { info } = match;

  if (info.queueId !== target.queue) return { counted: false, reason: "queue" };
  if (toPatch(info.gameVersion) !== target.patch) return { counted: false, reason: "patch" };
  if (info.endOfGameResult && info.endOfGameResult !== "GameComplete") {
    return { counted: false, reason: "incomplete" };
  }
  if (info.gameDuration < MIN_GAME_SECONDS) return { counted: false, reason: "short" };

  const participants = info.participants.filter((p) => isRole(p.teamPosition));
  if (participants.length !== 10) return { counted: false, reason: "positions" };

  for (const participant of participants) {
    const role = participant.teamPosition as Role;
    const entry = championEntry(acc, participant.championId);
    const counts = entry.byRole.get(role) ?? { games: 0, wins: 0 };
    counts.games += 1;
    if (participant.win) counts.wins += 1;
    entry.byRole.set(role, counts);

    if (items) recordBuild(acc, participant, role, items);
  }

  for (const team of info.teams) {
    for (const ban of team.bans) {
      if (ban.championId > 0) championEntry(acc, ban.championId).bans += 1;
    }
  }

  // Pair the two players who filled each position, one per team.
  for (const role of ROLES) {
    const inRole = participants.filter((p) => p.teamPosition === role);
    const blue = inRole.find((p) => p.teamId === 100);
    const red = inRole.find((p) => p.teamId === 200);
    if (!blue || !red) continue;

    recordMatchup(acc, blue.championId, red.championId, role, blue.win);
    recordMatchup(acc, red.championId, blue.championId, role, red.win);
  }

  acc.matches += 1;
  return { counted: true };
}

/**
 * Fold one participant's items, runes and spells into the build tally.
 *
 * Only finished items are recorded — components are filtered by the caller's
 * classifier — and boots are kept apart so a build shows one pair rather than
 * competing with legendary items for the same slots.
 */
function recordBuild(
  acc: Accumulator,
  participant: RiotMatch["info"]["participants"][number],
  role: Role,
  items: ItemClassifier,
): void {
  const key = buildKey(participant.championId, role);
  let build = acc.builds.get(key);
  if (!build) {
    build = {
      games: 0,
      items: new Map(),
      boots: new Map(),
      keystones: new Map(),
      secondaryStyles: new Map(),
      spells: new Map(),
    };
    acc.builds.set(key, build);
  }

  const win = participant.win;
  build.games += 1;

  const inventory = [
    participant.item0,
    participant.item1,
    participant.item2,
    participant.item3,
    participant.item4,
    participant.item5,
  ];
  // A slot reads 0 when empty, and duplicates would double-count a build.
  for (const itemId of new Set(inventory.filter((id): id is number => !!id))) {
    if (items.boots.has(itemId)) bump(build.boots, itemId, win);
    else if (items.legendary.has(itemId)) bump(build.items, itemId, win);
  }

  const keystone = participant.perks?.styles?.[0]?.selections?.[0]?.perk;
  if (keystone) bump(build.keystones, keystone, win);

  const secondary = participant.perks?.styles?.[1]?.style;
  if (secondary) bump(build.secondaryStyles, secondary, win);

  const { summoner1Id, summoner2Id } = participant;
  if (summoner1Id && summoner2Id) {
    // Order in the payload is arbitrary, so sort to keep one key per pair.
    const pair = [summoner1Id, summoner2Id].sort((a, b) => a - b).join("-");
    bump(build.spells, pair, win);
  }
}

function recordMatchup(
  acc: Accumulator,
  championId: number,
  opponentId: number,
  role: Role,
  win: boolean,
): void {
  const key = matchupKey(championId, opponentId, role);
  const existing = acc.matchups.get(key);
  if (existing) {
    existing.games += 1;
    if (win) existing.wins += 1;
    return;
  }
  acc.matchups.set(key, { championId, opponentId, role, games: 1, wins: win ? 1 : 0 });
}

/** Serialise the accumulator into a storable snapshot. */
export function toSnapshot(
  acc: Accumulator,
  meta: Omit<SnapshotMeta, "matches">,
): Snapshot {
  const champions: ChampionTally[] = [...acc.champions.entries()]
    .map(([championId, entry]) => {
      const byRole: ChampionTally["byRole"] = {};
      for (const [role, counts] of entry.byRole) {
        if (counts.games > 0) byRole[role] = { games: counts.games, wins: counts.wins };
      }
      return { championId, bans: entry.bans, byRole };
    })
    .sort((a, b) => a.championId - b.championId);

  const matchups = [...acc.matchups.values()].sort(
    (a, b) =>
      a.championId - b.championId ||
      a.role.localeCompare(b.role) ||
      a.opponentId - b.opponentId,
  );

  /* Caps chosen so a snapshot stays small while still showing a real build:
     a full item set plus alternatives, one boot choice with rivals, and the
     handful of rune and spell lines anyone actually runs. */
  const builds: BuildTally[] = [...acc.builds.entries()]
    .map(([key, build]) => {
      const [championId, role] = key.split(":") as [string, Role];
      return {
        championId: Number(championId),
        role,
        games: build.games,
        items: topOf(build.items, 14),
        boots: topOf(build.boots, 4),
        keystones: topOf(build.keystones, 5),
        secondaryStyles: topOf(build.secondaryStyles, 4),
        spells: topOf(build.spells, 4),
      };
    })
    .filter((build) => build.games > 0)
    .sort((a, b) => a.championId - b.championId || a.role.localeCompare(b.role));

  return {
    meta: { ...meta, matches: acc.matches },
    champions,
    matchups,
    ...(builds.length > 0 ? { builds } : {}),
  };
}
