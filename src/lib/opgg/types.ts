import type { Role } from "@/lib/lol/constants";

/**
 * op.gg's lane meta, translated into this project's vocabulary.
 *
 * Champion names and lane names are resolved to championIds and Roles at
 * ingest time, so nothing downstream has to know how op.gg spells things.
 * Counts are stored raw and rates derived at render, matching how Riot
 * snapshots work — and because op.gg rounds `win_rate` to two decimals while
 * reporting exact `play` and `win`, so deriving is strictly more precise.
 */
export interface OpggTierRow {
  championId: number;
  role: Role;
  /** 0 is the strongest bucket, 5 the weakest. op.gg's own grading. */
  tier: number;
  /** 1-based position within the lane, as op.gg ranked it. */
  rank: number;
  games: number;
  wins: number;
  pickRate: number;
  /**
   * Per champion rather than per lane — op.gg repeats one value across every
   * lane a champion appears in, because a ban removes it from the whole game.
   */
  banRate: number;
  /** Share of this champion's games played in this lane. */
  roleRate: number;
  kda: number;
}

export interface OpggMeta {
  /** When this was pulled from op.gg. Their payload carries no patch number. */
  fetchedAt: string;
  /**
   * Champion-appearances behind the dataset, summed across every lane — not a
   * match count. Ten champions play each match, and op.gg lists only the
   * champions with real volume in a lane, so this does not divide cleanly back
   * into matches. Displayed as "champion games" for that reason.
   */
  championGames: number;
  champions: number;
}

export interface OpggTierList {
  meta: OpggMeta;
  rows: OpggTierRow[];
}

/**
 * One lane pairing from op.gg, in the same shape Riot-derived matchups use.
 *
 * `wins` is from `championId`'s side, matching `MatchupTally`, so the existing
 * delta scoring works against these rows unchanged.
 */
export interface OpggMatchupRow {
  championId: number;
  role: Role;
  opponentId: number;
  games: number;
  wins: number;
}

export interface OpggCounters {
  meta: {
    fetchedAt: string;
    /** Champion-lanes queried. */
    championRoles: number;
    /** Champion-lanes that came back with at least one pairing. */
    covered: number;
  };
  rows: OpggMatchupRow[];
}
