import { ROLES, type Role } from "@/lib/lol/constants";
import type { PlatformId } from "@/lib/lol/regions";
import type {
  BuildTally,
  ChampionTally,
  MatchupTally,
  OptionCount,
  Snapshot,
} from "./types";

function addCounts(
  target: Record<string, OptionCount>,
  source: Record<string, OptionCount>,
): void {
  for (const [key, count] of Object.entries(source)) {
    const existing = target[key];
    if (existing) {
      existing.games += count.games;
      existing.wins += count.wins;
    } else {
      target[key] = { games: count.games, wins: count.wins };
    }
  }
}

/**
 * Sum several regions into one snapshot.
 *
 * Matchup coverage is the scarce thing on this site: a lane pairing gains one
 * game per match, so most pairings sit under the display threshold in any
 * single region even when the region has thousands of matches. Summing regions
 * multiplies the sample for every pairing at once, without another API call.
 *
 * It is a real trade — regional metas genuinely differ, which is why the
 * per-region views remain — but for "who beats this champion" a larger sample
 * beats a locally precise one that has no data at all.
 *
 * Only snapshots on the same patch should be passed in; mixing patches is the
 * one thing this must not silently do.
 */
export function mergeSnapshots(snapshots: Snapshot[]): Snapshot | null {
  if (snapshots.length === 0) return null;
  const [head] = snapshots;
  if (!head) return null;
  if (snapshots.length === 1) return head;

  const champions = new Map<number, ChampionTally>();
  const matchups = new Map<string, MatchupTally>();
  const builds = new Map<string, BuildTally>();
  let matches = 0;
  const regions: PlatformId[] = [];
  let newest = head.meta.generatedAt;

  for (const snapshot of snapshots) {
    matches += snapshot.meta.matches;
    regions.push(snapshot.meta.platform);
    if (snapshot.meta.generatedAt > newest) newest = snapshot.meta.generatedAt;

    for (const champion of snapshot.champions) {
      let entry = champions.get(champion.championId);
      if (!entry) {
        entry = { championId: champion.championId, bans: 0, byRole: {} };
        champions.set(champion.championId, entry);
      }
      entry.bans += champion.bans;
      for (const role of ROLES) {
        const tally = champion.byRole[role];
        if (!tally) continue;
        const current = entry.byRole[role] ?? { games: 0, wins: 0 };
        current.games += tally.games;
        current.wins += tally.wins;
        entry.byRole[role] = current;
      }
    }

    for (const matchup of snapshot.matchups) {
      const key = `${matchup.championId}:${matchup.opponentId}:${matchup.role}`;
      const existing = matchups.get(key);
      if (existing) {
        existing.games += matchup.games;
        existing.wins += matchup.wins;
      } else {
        matchups.set(key, { ...matchup });
      }
    }

    for (const build of snapshot.builds ?? []) {
      const key = `${build.championId}:${build.role}`;
      let existing = builds.get(key);
      if (!existing) {
        existing = {
          championId: build.championId,
          role: build.role as Role,
          games: 0,
          items: {},
          boots: {},
          keystones: {},
          secondaryStyles: {},
          spells: {},
        };
        builds.set(key, existing);
      }
      existing.games += build.games;
      addCounts(existing.items, build.items);
      addCounts(existing.boots, build.boots);
      addCounts(existing.keystones, build.keystones);
      addCounts(existing.secondaryStyles, build.secondaryStyles);
      addCounts(existing.spells, build.spells);
    }
  }

  const mergedBuilds = [...builds.values()].sort(
    (a, b) => a.championId - b.championId || a.role.localeCompare(b.role),
  );

  return {
    meta: {
      ...head.meta,
      matches,
      generatedAt: newest,
      /* Marks this as a cross-region aggregate. Display code keys off this
         rather than meta.platform, which stays a real shard so URLs and
         fallbacks keep working. */
      regions: [...regions].sort(),
    },
    champions: [...champions.values()].sort((a, b) => a.championId - b.championId),
    matchups: [...matchups.values()].sort(
      (a, b) =>
        a.championId - b.championId ||
        a.role.localeCompare(b.role) ||
        a.opponentId - b.opponentId,
    ),
    ...(mergedBuilds.length > 0 ? { builds: mergedBuilds } : {}),
  };
}
