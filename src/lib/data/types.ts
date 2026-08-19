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

export interface Snapshot {
  meta: SnapshotMeta;
  champions: ChampionTally[];
  matchups: MatchupTally[];
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
