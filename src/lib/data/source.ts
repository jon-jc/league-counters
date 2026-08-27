/**
 * Which dataset the tier list is ranked from.
 *
 * These are genuinely different products, not two views of one thing:
 *
 * - `opgg` is op.gg's own lane meta, pulled through their public MCP endpoint.
 *   Their grading, their ranking, their sample — millions of champion games
 *   covering every champion in every lane they list. Shown as theirs.
 * - `riot` is this site's own ranking, aggregated from ranked matches pulled
 *   from Riot's API and scored by the model documented on /methodology.
 *
 * Both are kept because they answer different questions. op.gg has the volume
 * to grade every champion; the Riot pipeline is the only one of the two that
 * can be inspected, filtered by region and rank, and is what powers counters.
 */
export const TIER_SOURCES = ["opgg", "riot"] as const;
export type TierSource = (typeof TIER_SOURCES)[number];

/**
 * op.gg leads because it is the more complete tier list: every champion in
 * every lane, on a sample this pipeline cannot match on a personal API key.
 */
export const DEFAULT_TIER_SOURCE: TierSource = "opgg";

export const TIER_SOURCE_LABELS: Record<TierSource, string> = {
  opgg: "op.gg",
  riot: "Our data",
};

export function isTierSource(value: string): value is TierSource {
  return (TIER_SOURCES as readonly string[]).includes(value);
}

export function resolveTierSource(value: string | null | undefined): TierSource {
  if (value && isTierSource(value)) return value;
  return DEFAULT_TIER_SOURCE;
}
