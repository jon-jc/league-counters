/** Riot platform routing values (the shard a summoner's account lives on). */
export const PLATFORMS = {
  NA1: { label: "North America", short: "NA", route: "americas" },
  EUW1: { label: "EU West", short: "EUW", route: "europe" },
  EUN1: { label: "EU Nordic & East", short: "EUNE", route: "europe" },
  KR: { label: "Korea", short: "KR", route: "asia" },
  JP1: { label: "Japan", short: "JP", route: "asia" },
  BR1: { label: "Brazil", short: "BR", route: "americas" },
  LA1: { label: "LAT North", short: "LAN", route: "americas" },
  LA2: { label: "LAT South", short: "LAS", route: "americas" },
  OC1: { label: "Oceania", short: "OCE", route: "sea" },
  TR1: { label: "Türkiye", short: "TR", route: "europe" },
  RU: { label: "Russia", short: "RU", route: "europe" },
  ME1: { label: "Middle East", short: "ME", route: "europe" },
  SG2: { label: "Singapore", short: "SG", route: "sea" },
  TW2: { label: "Taiwan", short: "TW", route: "sea" },
  VN2: { label: "Vietnam", short: "VN", route: "sea" },
  /* PH2 and TH2 are deliberately absent. Their hosts refuse connections
     outright — not 404, not 401, no TCP connection at all, with or without a
     key — so they cannot ever hold data. Listing them only put two permanently
     disabled entries in the region picker. */
} as const satisfies Record<string, { label: string; short: string; route: RegionalRoute }>;

export type PlatformId = keyof typeof PLATFORMS;

/** Regional routing values used by match-v5 and account-v1. */
export type RegionalRoute = "americas" | "europe" | "asia" | "sea";

export const PLATFORM_IDS = Object.keys(PLATFORMS) as PlatformId[];

export const DEFAULT_PLATFORM: PlatformId = "NA1";

export function isPlatformId(value: string): value is PlatformId {
  return value in PLATFORMS;
}

/** Accepts either a platform id ("NA1") or its short label ("na"). */
export function resolvePlatform(value: string | undefined | null): PlatformId {
  if (!value) return DEFAULT_PLATFORM;
  const upper = value.toUpperCase();
  if (isPlatformId(upper)) return upper;
  const byShort = PLATFORM_IDS.find((id) => PLATFORMS[id].short === upper);
  return byShort ?? DEFAULT_PLATFORM;
}

export function platformHost(platform: PlatformId): string {
  return `https://${platform.toLowerCase()}.api.riotgames.com`;
}

export function routeHost(platform: PlatformId): string {
  return `https://${PLATFORMS[platform].route}.api.riotgames.com`;
}

/**
 * A pseudo-region meaning "every shard summed together".
 *
 * It is deliberately not a member of PLATFORMS: there is no such Riot host, and
 * nothing may ever try to call one. It exists only as a view over snapshots
 * that were each ingested from a real shard.
 */
export const GLOBAL_REGION = "GLOBAL" as const;
export type RegionId = PlatformId | typeof GLOBAL_REGION;

export function isGlobal(region: RegionId): region is typeof GLOBAL_REGION {
  return region === GLOBAL_REGION;
}

/** Accepts a platform id, a short label, or "global". */
export function resolveRegion(value: string | undefined | null): RegionId {
  if (!value) return DEFAULT_PLATFORM;
  if (value.toUpperCase() === GLOBAL_REGION) return GLOBAL_REGION;
  return resolvePlatform(value);
}

export function regionLabel(region: RegionId): string {
  return isGlobal(region) ? "All regions" : PLATFORMS[region].label;
}

export function regionShort(region: RegionId): string {
  return isGlobal(region) ? "Global" : PLATFORMS[region].short;
}

/**
 * What a visitor sees before choosing anything.
 *
 * The global aggregate, because matchup coverage is what the site is for and
 * summing regions is the difference between roughly 700 scored lanes and over
 * 3,000. Per-region views stay one click away for anyone who wants their own
 * shard's meta.
 */
export const DEFAULT_REGION: RegionId = GLOBAL_REGION;
