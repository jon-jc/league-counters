/** Riot's `teamPosition` values — the only role signal we trust from match-v5. */
export const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "ADC",
  UTILITY: "Support",
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function resolveRole(value: string | undefined | null): Role | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (isRole(upper)) return upper;
  const aliases: Record<string, Role> = {
    MID: "MIDDLE",
    ADC: "BOTTOM",
    BOT: "BOTTOM",
    SUPPORT: "UTILITY",
    SUP: "UTILITY",
    JG: "JUNGLE",
  };
  return aliases[upper] ?? null;
}

/** Ranked queues we aggregate. */
export const QUEUES = {
  420: { label: "Ranked Solo/Duo", short: "Solo/Duo" },
  440: { label: "Ranked Flex", short: "Flex" },
} as const;

export type QueueId = keyof typeof QUEUES;
export const DEFAULT_QUEUE: QueueId = 420;

export function isQueueId(value: number): value is QueueId {
  return value in QUEUES;
}

/**
 * Rank brackets. Each bracket is a floor — "emerald_plus" means Emerald and
 * everything above it, which is how ladder sampling actually works.
 */
export const BRACKETS = {
  all: { label: "All ranks", short: "All" },
  gold_plus: { label: "Gold+", short: "Gold+" },
  platinum_plus: { label: "Platinum+", short: "Plat+" },
  emerald_plus: { label: "Emerald+", short: "Emerald+" },
  diamond_plus: { label: "Diamond+", short: "Diamond+" },
  master_plus: { label: "Master+", short: "Master+" },
} as const;

export type Bracket = keyof typeof BRACKETS;
export const DEFAULT_BRACKET: Bracket = "emerald_plus";

export function isBracket(value: string): value is Bracket {
  return value in BRACKETS;
}

/** Riot tier names ordered from lowest to highest. */
export const TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;
export type RankTier = (typeof TIERS)[number];

/** Which Riot tiers a bracket includes. */
export const BRACKET_TIERS: Record<Bracket, readonly RankTier[]> = {
  all: TIERS,
  gold_plus: TIERS.slice(TIERS.indexOf("GOLD")),
  platinum_plus: TIERS.slice(TIERS.indexOf("PLATINUM")),
  emerald_plus: TIERS.slice(TIERS.indexOf("EMERALD")),
  diamond_plus: TIERS.slice(TIERS.indexOf("DIAMOND")),
  master_plus: TIERS.slice(TIERS.indexOf("MASTER")),
};

/**
 * "16.15.802.4387" (match-v5 gameVersion) -> "16.15".
 * Data Dragon versions like "16.16.1" reduce the same way.
 */
export function toPatch(gameVersion: string): string {
  const parts = gameVersion.split(".");
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : gameVersion;
}
