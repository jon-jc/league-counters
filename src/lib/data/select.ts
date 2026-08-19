import type { SnapshotDescriptor } from "./types";

/**
 * Matches a snapshot needs before a fallback will offer it.
 *
 * Ranking hides champions under 20 games in a role. A champion picked in 5% of
 * a role's games only clears that around 200 matches, so a snapshot thinner
 * than this renders as an empty page — worse than falling back to something
 * with actual content.
 */
export const MIN_VIABLE_MATCHES = 300;

/**
 * How good a substitute a snapshot makes when the requested one is missing.
 * Higher is better: enough volume to render at all, then real data over seed.
 */
export function fallbackRank(snapshot: SnapshotDescriptor): number {
  return (
    (snapshot.matches >= MIN_VIABLE_MATCHES ? 4 : 0) + (snapshot.source === "riot" ? 2 : 0)
  );
}

/** The best substitute among candidates, or undefined if there are none. */
export function bestOf(candidates: SnapshotDescriptor[]): SnapshotDescriptor | undefined {
  return [...candidates].sort(
    (a, b) => fallbackRank(b) - fallbackRank(a) || b.matches - a.matches,
  )[0];
}
