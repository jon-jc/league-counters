import type { Confidence, TierGrade } from "./metrics";
import { buildRoleRows } from "./metrics";
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
