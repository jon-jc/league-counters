import type { Bracket, QueueId, Role } from "@/lib/lol/constants";
import type { PlatformId } from "@/lib/lol/regions";

/** Where a snapshot's numbers came from. */
export type SnapshotSource = "riot" | "seed";

export interface SnapshotMeta {
  platform: PlatformId;
  queue: QueueId;
  bracket: Bracket;
  /** Minor patch, e.g. "16.16". */
  patch: string;
  /** Distinct matches aggregated into this snapshot. */
  matches: number;
  generatedAt: string;
  source: SnapshotSource;
}

/** Per-role tallies for one champion. */
export interface RoleTally {
  games: number;
  wins: number;
}

/** Raw counts for one champion in one snapshot. Rates are derived, never stored. */
export interface ChampionTally {
  championId: number;
  /** Times banned across both teams. */
  bans: number;
  byRole: Partial<Record<Role, RoleTally>>;
}

/** One champion-vs-champion lane pairing. `wins` is from `championId`'s side. */
export interface MatchupTally {
  championId: number;
  opponentId: number;
  role: Role;
  games: number;
  wins: number;
}

/** Games and wins for one option (an item, a keystone, a spell pair). */
export interface OptionCount {
  games: number;
  wins: number;
}

/**
 * What players actually built on a champion in a role.
 *
 * Only the leading options are stored. Keeping every component item would
 * multiply the snapshot size for rows nobody reads, and the tail is noise at
 * these sample sizes anyway.
 */
export interface BuildTally {
  championId: number;
  role: Role;
  /** Participants that carried usable build data. */
  games: number;
  /** Legendary items, keyed by item id. */
  items: Record<string, OptionCount>;
  /** Upgraded boots, keyed by item id. */
  boots: Record<string, OptionCount>;
  /** Keystone rune, keyed by perk id. */
  keystones: Record<string, OptionCount>;
  /** Secondary rune tree, keyed by style id. */
  secondaryStyles: Record<string, OptionCount>;
  /** Summoner spell pairs, keyed by the two ids sorted and joined with "-". */
  spells: Record<string, OptionCount>;
}

export interface Snapshot {
  meta: SnapshotMeta;
  champions: ChampionTally[];
  matchups: MatchupTally[];
  /** Absent on snapshots written before builds were tracked. */
  builds?: BuildTally[];
}

/** An entry in the snapshot index, used to populate region/bracket pickers. */
export interface SnapshotDescriptor {
  platform: PlatformId;
  queue: QueueId;
  bracket: Bracket;
  patch: string;
  matches: number;
  generatedAt: string;
  source: SnapshotSource;
}
