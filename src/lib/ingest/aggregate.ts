import { ROLES, isRole, toPatch, type Role } from "@/lib/lol/constants";
import type { RiotMatch } from "@/lib/riot/types";
import type { ChampionTally, MatchupTally, Snapshot, SnapshotMeta } from "@/lib/data/types";

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

export interface Accumulator {
  /** Distinct matches folded in. */
  matches: number;
  champions: Map<number, ChampionAccumulator>;
  /** Keyed `championId:opponentId:role`. */
  matchups: Map<string, MatchupTally>;
}

export function createAccumulator(): Accumulator {
  return { matches: 0, champions: new Map(), matchups: new Map() };
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

  return { matches: snapshot.meta.matches, champions, matchups };
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

  return { meta: { ...meta, matches: acc.matches }, champions, matchups };
}
