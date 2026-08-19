import { BRACKET_TIERS, type Bracket, type QueueId, type RankTier } from "@/lib/lol/constants";
import type { PlatformId } from "@/lib/lol/regions";
import type { RiotClient } from "@/lib/riot/client";

const DIVISIONS = ["I", "II", "III", "IV"] as const;
const APEX: Record<string, "challenger" | "grandmaster" | "master"> = {
  CHALLENGER: "challenger",
  GRANDMASTER: "grandmaster",
  MASTER: "master",
};

export interface SampleOptions {
  platform: PlatformId;
  queue: QueueId;
  bracket: Bracket;
  /** How many player ids to end up with. */
  limit: number;
  onProgress?: (message: string) => void;
}

/**
 * Collect player ids across the tiers a bracket covers.
 *
 * Tiers are gathered separately and then interleaved, so a bracket like
 * "emerald_plus" is not dominated by Emerald purely because that ladder is
 * enormously larger than Challenger.
 */
export async function samplePuuids(
  client: RiotClient,
  { platform, queue, bracket, limit, onProgress }: SampleOptions,
): Promise<string[]> {
  const tiers = BRACKET_TIERS[bracket];
  const perTier: string[][] = [];

  for (const tier of tiers) {
    const apex = APEX[tier];
    try {
      if (apex) {
        const puuids = await client.apexLeague(platform, queue, apex);
        if (puuids.length > 0) perTier.push(shuffle(puuids));
        onProgress?.(`  ${tier}: ${puuids.length} players`);
        continue;
      }

      const collected: string[] = [];
      for (const division of DIVISIONS) {
        const puuids = await client.leagueEntries(platform, queue, tier as RankTier, division);
        collected.push(...puuids);
        // One page per division is plenty — each returns ~200 players.
        if (collected.length >= limit * 4) break;
      }
      if (collected.length > 0) perTier.push(shuffle(collected));
      onProgress?.(`  ${tier}: ${collected.length} players`);
    } catch (error) {
      // A tier can legitimately be empty on small shards early in a split.
      onProgress?.(`  ${tier}: unavailable (${(error as Error).message})`);
    }
  }

  return interleave(perTier).slice(0, limit);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Round-robin across the buckets so every tier is represented. */
function interleave<T>(buckets: T[][]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...buckets.map((b) => b.length));
  for (let i = 0; i < longest; i += 1) {
    for (const bucket of buckets) {
      const item = bucket[i];
      if (item !== undefined) out.push(item);
    }
  }
  return out;
}
