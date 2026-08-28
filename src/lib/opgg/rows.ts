import { confidenceFor, TIER_GRADES, type TierGrade } from "@/lib/data/metrics";
import type { TierRow } from "@/lib/data/rows";
import type { Role } from "@/lib/lol/constants";
import type { ChampionIndex } from "@/lib/lol/ddragon";
import { championSquareUrl } from "@/lib/lol/ddragon";
import type { OpggTierList } from "./types";

/**
 * op.gg grades on a six-bucket scale, 0 (strongest) through 5, which lines up
 * one-for-one with this site's S+ through D pills. So the mapping is positional
 * and lossless — no re-grading, no re-ranking. Their tier list is shown as
 * theirs, in this site's visual language.
 */
function gradeFor(tier: number): TierGrade {
  return TIER_GRADES[Math.min(Math.max(tier, 0), TIER_GRADES.length - 1)] ?? "D";
}

/**
 * Flatten op.gg's lane meta into the same rows the Riot-sourced tier list
 * renders, so every downstream component works against one shape.
 *
 * Win rate is derived from raw counts rather than taken from op.gg's own
 * `win_rate` field, which is rounded to two decimals — 51.06% and 51.44% both
 * arrive as 0.51, which would flatten the sort and lose real separation.
 */
export function buildOpggTierRows(
  data: OpggTierList,
  index: ChampionIndex,
  role: Role | null,
): TierRow[] {
  const rows = data.rows
    .filter((row) => (role ? row.role === role : true))
    .flatMap<TierRow>((row) => {
      const champion = index.byId.get(row.championId);
      if (!champion) return []; // champion newer than the cached Data Dragon build

      return [
        {
          rank: row.rank,
          championId: row.championId,
          name: champion.name,
          slug: champion.slug,
          icon: championSquareUrl(champion, index.version),
          role: row.role,
          tier: gradeFor(row.tier),
          winRate: row.games > 0 ? row.wins / row.games : 0,
          pickRate: row.pickRate,
          banRate: row.banRate,
          games: row.games,
          confidence: confidenceFor(row.games),
        },
      ];
    });

  if (role) return rows.sort((a, b) => a.rank - b.rank);

  /* Across all lanes op.gg gives no global ordering, only a rank within each.
     Grouping by grade first and using their in-lane rank to break ties keeps
     every row in the bucket op.gg put it in, which a re-sort on win rate would
     not — a C-tier pick with a flattering record would jump the S-tier ones. */
  return rows
    .sort((a, b) => {
      const byTier = TIER_GRADES.indexOf(a.tier) - TIER_GRADES.indexOf(b.tier);
      return byTier !== 0 ? byTier : a.rank - b.rank;
    })
    .map((row, position) => ({ ...row, rank: position + 1 }));
}
