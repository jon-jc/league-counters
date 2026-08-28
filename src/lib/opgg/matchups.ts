import {
  confidenceFor,
  MATCHUP_PRIOR,
  rawWinRate,
  shrunkWinRate,
  TIER_GRADES,
  type TierGrade,
} from "@/lib/data/metrics";
import type { MatchupDisplayRow } from "@/lib/data/rows";
import type { Role } from "@/lib/lol/constants";
import type { ChampionIndex } from "@/lib/lol/ddragon";
import { championSquareUrl } from "@/lib/lol/ddragon";
import type { OpggCounters, OpggTierList } from "./types";

/**
 * Lane matchups from op.gg, scored the same way this site scores its own.
 *
 * A counter is a delta, not a win rate — how a champion performs in one lane
 * against how it performs in that role overall. That definition is this
 * project's, so the baseline has to come from the same source as the matchup:
 * op.gg's win rate for the champion in that lane, never the Riot-aggregated
 * one. Mixing the two would measure the gap between two datasets and call it
 * a counter.
 */
export function buildOpggMatchupRows(
  counters: OpggCounters,
  laneMeta: OpggTierList,
  index: ChampionIndex,
  championId: number,
  role: Role,
): MatchupDisplayRow[] {
  const baselineRow = laneMeta.rows.find(
    (row) => row.championId === championId && row.role === role,
  );
  if (!baselineRow || baselineRow.games === 0) return [];

  const baseline = shrunkWinRate(baselineRow.wins, baselineRow.games);

  /* Every opponent's own grade in this lane, so a hard matchup can also show
     that it is an S-tier pick — most of the context on the page. */
  const tierByChampion = new Map<number, TierGrade>(
    laneMeta.rows
      .filter((row) => row.role === role)
      .map((row) => [
        row.championId,
        TIER_GRADES[Math.min(Math.max(row.tier, 0), TIER_GRADES.length - 1)] ?? "D",
      ]),
  );

  return counters.rows
    .filter((row) => row.championId === championId && row.role === role)
    .flatMap<MatchupDisplayRow>((row) => {
      const opponent = index.byId.get(row.opponentId);
      if (!opponent) return [];

      const adjustedWinRate = shrunkWinRate(row.wins, row.games, MATCHUP_PRIOR);
      return [
        {
          opponentId: row.opponentId,
          name: opponent.name,
          slug: opponent.slug,
          icon: championSquareUrl(opponent, index.version),
          role,
          tier: tierByChampion.get(row.opponentId) ?? null,
          games: row.games,
          winRate: rawWinRate(row.wins, row.games),
          delta: adjustedWinRate - baseline,
          confidence: confidenceFor(row.games),
        },
      ];
    })
    .sort((a, b) => a.delta - b.delta);
}

/** Roles op.gg ranks a champion in, most-played first. */
export function opggRolesFor(laneMeta: OpggTierList, championId: number): Role[] {
  return laneMeta.rows
    .filter((row) => row.championId === championId)
    .sort((a, b) => b.games - a.games)
    .map((row) => row.role);
}

/** Games op.gg reports for a champion in a role, for the role tabs. */
export function opggRoleGames(laneMeta: OpggTierList, championId: number, role: Role): number {
  return (
    laneMeta.rows.find((row) => row.championId === championId && row.role === role)?.games ?? 0
  );
}
