import type { Role } from "@/lib/lol/constants";
import type { ChampionTally, MatchupTally, Snapshot } from "./types";

/**
 * Pseudo-games added at a 50% win rate before computing a rate.
 *
 * Ranked samples are wildly uneven — a pick with 12 games and a pick with
 * 12,000 should not sit next to each other on a raw win-rate axis. Shrinking
 * toward the 50% prior pulls thin samples back to the middle, so a 9-3 record
 * stops outranking a genuinely strong champion with real volume.
 */
const CHAMPION_PRIOR = 150;

/** Matchup samples are far thinner than champion samples, so they shrink harder. */
const MATCHUP_PRIOR = 40;

/** Below this, a row is treated as noise and hidden rather than ranked. */
export const MIN_CHAMPION_GAMES = 20;
export const MIN_MATCHUP_GAMES = 8;

export function shrunkWinRate(wins: number, games: number, prior = CHAMPION_PRIOR): number {
  if (games <= 0) return 0.5;
  return (wins + 0.5 * prior) / (games + prior);
}

export function rawWinRate(wins: number, games: number): number {
  return games > 0 ? wins / games : 0;
}

/**
 * Wilson score interval half-width at 95% confidence — how much we should
 * distrust a given win rate. Drives the confidence dots in the UI.
 */
export function wilsonMargin(wins: number, games: number): number {
  if (games <= 0) return 0.5;
  const z = 1.96;
  const p = wins / games;
  const denom = 1 + (z * z) / games;
  const margin = (z * Math.sqrt((p * (1 - p)) / games + (z * z) / (4 * games * games))) / denom;
  return margin;
}

export type Confidence = "high" | "medium" | "low";

export function confidenceFor(games: number): Confidence {
  if (games >= 400) return "high";
  if (games >= 100) return "medium";
  return "low";
}

/* ---------- Derived per-champion rows ---------- */

export interface ChampionRow {
  championId: number;
  role: Role;
  games: number;
  wins: number;
  winRate: number;
  /** Shrunk win rate — what ranking is actually based on. */
  adjustedWinRate: number;
  pickRate: number;
  banRate: number;
  /** pickRate + banRate: how often the champion touches a game at all. */
  presence: number;
  confidence: Confidence;
  margin: number;
  score: number;
  tier: TierGrade;
  /** 1-based rank within the role. */
  rank: number;
}

export const TIER_GRADES = ["S+", "S", "A", "B", "C", "D"] as const;
export type TierGrade = (typeof TIER_GRADES)[number];

/** Cumulative share of ranked champions that falls at or above each grade. */
const TIER_CUTOFFS: [TierGrade, number][] = [
  ["S+", 0.04],
  ["S", 0.14],
  ["A", 0.32],
  ["B", 0.58],
  ["C", 0.82],
  ["D", 1],
];

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 1;
  const variance = values.reduce((acc, v) => acc + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance) || 1;
}

/**
 * Rank every champion that plays `role` in this snapshot.
 *
 * Score blends how well a champion wins with how contested it is, both as
 * z-scores within the role, so roles with naturally flatter win rates (support)
 * are not permanently outranked by swingy ones (jungle).
 */
export function buildRoleRows(snapshot: Snapshot, role: Role): ChampionRow[] {
  const { champions, meta } = snapshot;

  // Two players fill each role per match — one per team.
  const roleGamesTotal = champions.reduce(
    (acc, c) => acc + (c.byRole[role]?.games ?? 0),
    0,
  );
  if (roleGamesTotal === 0) return [];

  const eligible = champions.filter((c) => (c.byRole[role]?.games ?? 0) >= MIN_CHAMPION_GAMES);
  if (eligible.length === 0) return [];

  const partial = eligible.map((champion) => {
    const tally = champion.byRole[role]!;
    const adjustedWinRate = shrunkWinRate(tally.wins, tally.games);
    const pickRate = tally.games / roleGamesTotal;
    // A champion can be banned once per team, so matches is the right base.
    const banRate = meta.matches > 0 ? champion.bans / meta.matches : 0;
    return {
      champion,
      tally,
      adjustedWinRate,
      pickRate,
      banRate,
      presence: pickRate + banRate,
    };
  });

  const wrValues = partial.map((p) => p.adjustedWinRate);
  const presenceValues = partial.map((p) => p.presence);
  const wrMean = mean(wrValues);
  const wrSd = stdDev(wrValues, wrMean);
  const presenceMean = mean(presenceValues);
  const presenceSd = stdDev(presenceValues, presenceMean);

  const scored = partial
    .map((p) => {
      const winZ = (p.adjustedWinRate - wrMean) / wrSd;
      const presenceZ = (p.presence - presenceMean) / presenceSd;
      return { ...p, score: 0.72 * winZ + 0.28 * presenceZ };
    })
    .sort((a, b) => b.score - a.score);

  return scored.map((p, index) => ({
    championId: p.champion.championId,
    role,
    games: p.tally.games,
    wins: p.tally.wins,
    winRate: rawWinRate(p.tally.wins, p.tally.games),
    adjustedWinRate: p.adjustedWinRate,
    pickRate: p.pickRate,
    banRate: p.banRate,
    presence: p.presence,
    confidence: confidenceFor(p.tally.games),
    margin: wilsonMargin(p.tally.wins, p.tally.games),
    score: p.score,
    tier: gradeFor(index / scored.length),
    rank: index + 1,
  }));
}

function gradeFor(percentile: number): TierGrade {
  for (const [grade, cutoff] of TIER_CUTOFFS) {
    if (percentile < cutoff) return grade;
  }
  return "D";
}

/* ---------- Derived matchup rows ---------- */

export interface MatchupRow {
  championId: number;
  opponentId: number;
  role: Role;
  games: number;
  wins: number;
  winRate: number;
  adjustedWinRate: number;
  /**
   * Win rate in this specific lane minus the champion's overall win rate in the
   * role. Positive means the champion over-performs into that opponent.
   * This — not raw win rate — is what makes something a counter.
   */
  delta: number;
  confidence: Confidence;
}

export function buildMatchupRows(
  snapshot: Snapshot,
  championId: number,
  role: Role,
): MatchupRow[] {
  const champion = snapshot.champions.find((c) => c.championId === championId);
  const tally = champion?.byRole[role];
  if (!tally || tally.games === 0) return [];

  const baseline = shrunkWinRate(tally.wins, tally.games);

  return snapshot.matchups
    .filter(
      (m) => m.championId === championId && m.role === role && m.games >= MIN_MATCHUP_GAMES,
    )
    .map<MatchupRow>((m) => {
      const adjustedWinRate = shrunkWinRate(m.wins, m.games, MATCHUP_PRIOR);
      return {
        championId: m.championId,
        opponentId: m.opponentId,
        role: m.role,
        games: m.games,
        wins: m.wins,
        winRate: rawWinRate(m.wins, m.games),
        adjustedWinRate,
        delta: adjustedWinRate - baseline,
        confidence: confidenceFor(m.games),
      };
    })
    .sort((a, b) => a.delta - b.delta);
}

/** Roles a champion is actually played in, most-played first. */
export function rolesFor(tally: ChampionTally): Role[] {
  return (Object.entries(tally.byRole) as [Role, { games: number }][])
    .filter(([, v]) => v.games > 0)
    .sort((a, b) => b[1].games - a[1].games)
    .map(([role]) => role);
}

export function primaryRole(tally: ChampionTally): Role | null {
  return rolesFor(tally)[0] ?? null;
}

/** Index matchups by champion for O(1) lookup on champion pages. */
export function groupMatchupsByChampion(
  matchups: MatchupTally[],
): Map<number, MatchupTally[]> {
  const map = new Map<number, MatchupTally[]>();
  for (const m of matchups) {
    const list = map.get(m.championId);
    if (list) list.push(m);
    else map.set(m.championId, [m]);
  }
  return map;
}
