import type { Confidence, TierGrade } from "./metrics";
import { buildMatchupRows, buildRoleRows } from "./metrics";
import type { Role } from "@/lib/lol/constants";
import { ROLES } from "@/lib/lol/constants";
import type { ChampionIndex } from "@/lib/lol/ddragon";
import { championSquareUrl } from "@/lib/lol/ddragon";
import type { Snapshot } from "./types";

/** One ranked champion-in-role, flattened for rendering. */
export interface TierRow {
  rank: number;
  championId: number;
  name: string;
  slug: string;
  icon: string;
  role: Role;
  tier: TierGrade;
  winRate: number;
  pickRate: number;
  banRate: number;
  games: number;
  confidence: Confidence;
}

/**
 * Rank a snapshot for one role, or across all roles at once.
 *
 * Scores are z-scores computed within a role, so the combined view stays
 * comparable — it is not a single global sort over mismatched distributions.
 */
export function buildTierRows(
  snapshot: Snapshot,
  index: ChampionIndex,
  role: Role | null,
): TierRow[] {
  const roles = role ? [role] : ROLES;
  const rows: (TierRow & { score: number })[] = [];

  for (const current of roles) {
    for (const row of buildRoleRows(snapshot, current)) {
      const champion = index.byId.get(row.championId);
      if (!champion) continue; // champion released after this snapshot's patch

      rows.push({
        rank: row.rank,
        championId: row.championId,
        name: champion.name,
        slug: champion.slug,
        icon: championSquareUrl(champion, index.version),
        role: current,
        tier: row.tier,
        winRate: row.winRate,
        pickRate: row.pickRate,
        banRate: row.banRate,
        games: row.games,
        confidence: row.confidence,
        score: row.score,
      });
    }
  }

  if (role) return rows.map(({ score: _score, ...rest }) => rest);

  return rows
    .sort((a, b) => b.score - a.score)
    .map(({ score: _score, ...rest }, position) => ({ ...rest, rank: position + 1 }));
}

/** One opponent in a lane matchup, flattened for rendering. */
export interface MatchupDisplayRow {
  opponentId: number;
  name: string;
  slug: string;
  icon: string;
  role: Role;
  /** The opponent's own tier in this role, when it has enough games to rank. */
  tier: TierGrade | null;
  games: number;
  winRate: number;
  /** Win rate in this lane minus the champion's baseline in the role. */
  delta: number;
  confidence: Confidence;
}

/**
 * Every tracked opponent for a champion in a role, hardest matchup first.
 * Sorted by delta, so the list reads as "who actually beats this champion".
 */
export function buildMatchupDisplayRows(
  snapshot: Snapshot,
  index: ChampionIndex,
  championId: number,
  role: Role,
): MatchupDisplayRow[] {
  /* Rank the role once and reuse it, so each opponent can carry its own tier.
     Knowing a hard matchup is also an S-tier pick is most of the context. */
  const tierByChampion = new Map(
    buildRoleRows(snapshot, role).map((row) => [row.championId, row.tier] as const),
  );

  return buildMatchupRows(snapshot, championId, role).flatMap((row) => {
    const opponent = index.byId.get(row.opponentId);
    if (!opponent) return [];
    return [
      {
        opponentId: row.opponentId,
        name: opponent.name,
        slug: opponent.slug,
        icon: championSquareUrl(opponent, index.version),
        role: row.role,
        tier: tierByChampion.get(row.opponentId) ?? null,
        games: row.games,
        winRate: row.winRate,
        delta: row.delta,
        confidence: row.confidence,
      },
    ];
  });
}
