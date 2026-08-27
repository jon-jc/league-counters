import { describe, expect, it } from "vitest";
import {
  MIN_CHAMPION_GAMES,
  buildMatchupRows,
  buildRoleRows,
  confidenceFor,
  primaryRole,
  rolesFor,
  shrunkWinRate,
  wilsonMargin,
} from "@/lib/data/metrics";
import type { ChampionTally, MatchupTally, Snapshot } from "@/lib/data/types";

function snapshotOf(
  champions: ChampionTally[],
  matchups: MatchupTally[] = [],
  matches = 1000,
): Snapshot {
  return {
    meta: {
      platform: "NA1",
      queue: 420,
      bracket: "master_plus",
      patch: "16.16",
      matches,
      generatedAt: "2026-08-18T00:00:00.000Z",
      source: "riot",
    },
    champions,
    matchups,
  };
}

describe("shrunkWinRate", () => {
  it("returns the prior when there are no games", () => {
    expect(shrunkWinRate(0, 0)).toBe(0.5);
  });

  it("pulls a tiny sample hard toward 50%", () => {
    // 9-3 is a 75% raw win rate; it should not survive as one.
    const shrunk = shrunkWinRate(9, 12);
    expect(shrunk).toBeGreaterThan(0.5);
    expect(shrunk).toBeLessThan(0.53);
  });

  it("barely moves a large sample", () => {
    const shrunk = shrunkWinRate(5400, 10000);
    expect(shrunk).toBeGreaterThan(0.535);
    expect(shrunk).toBeLessThan(0.54);
  });

  it("does not let a small hot streak outrank a strong high-volume champion", () => {
    const streak = shrunkWinRate(9, 12);
    const proven = shrunkWinRate(5400, 10000);
    expect(proven).toBeGreaterThan(streak);
  });
});

describe("wilsonMargin", () => {
  it("narrows as the sample grows", () => {
    expect(wilsonMargin(50, 100)).toBeGreaterThan(wilsonMargin(5000, 10000));
  });
});

describe("confidenceFor", () => {
  it.each([
    [1000, "high"],
    [400, "high"],
    [399, "medium"],
    [100, "medium"],
    [99, "low"],
    [0, "low"],
  ])("maps %i games to %s", (games, expected) => {
    expect(confidenceFor(games)).toBe(expected);
  });
});

describe("buildRoleRows", () => {
  const many = Array.from({ length: 12 }, (_, index) => ({
    championId: index + 1,
    bans: index * 10,
    byRole: { MIDDLE: { games: 1000, wins: 480 + index * 8 } },
  })) satisfies ChampionTally[];

  it("ranks the strongest champion first", () => {
    const rows = buildRoleRows(snapshotOf(many), "MIDDLE");
    expect(rows[0]!.championId).toBe(12);
    expect(rows[0]!.rank).toBe(1);
  });

  it("assigns tiers in a non-increasing order down the ranking", () => {
    const order = ["S+", "S", "A", "B", "C", "D"];
    const rows = buildRoleRows(snapshotOf(many), "MIDDLE");
    const positions = rows.map((row) => order.indexOf(row.tier));
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });

  it("hides champions below the minimum sample", () => {
    const rows = buildRoleRows(
      snapshotOf([
        ...many,
        {
          championId: 99,
          bans: 0,
          byRole: { MIDDLE: { games: MIN_CHAMPION_GAMES - 1, wins: MIN_CHAMPION_GAMES - 1 } },
        },
      ]),
      "MIDDLE",
    );
    // A 100% win rate on too few games must not appear at all.
    expect(rows.some((row) => row.championId === 99)).toBe(false);
  });

  it("returns nothing for a role nobody plays", () => {
    expect(buildRoleRows(snapshotOf(many), "UTILITY")).toEqual([]);
  });

  it("computes pick rate as a share of that role's games", () => {
    const rows = buildRoleRows(snapshotOf(many), "MIDDLE");
    const total = rows.reduce((sum, row) => sum + row.pickRate, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});

describe("buildMatchupRows", () => {
  const champion: ChampionTally = {
    championId: 1,
    bans: 0,
    byRole: { TOP: { games: 2000, wins: 1000 } },
  };

  const matchups: MatchupTally[] = [
    { championId: 1, opponentId: 2, role: "TOP", games: 500, wins: 150 },
    { championId: 1, opponentId: 3, role: "TOP", games: 500, wins: 400 },
    { championId: 1, opponentId: 4, role: "TOP", games: 2, wins: 2 },
  ];

  it("sorts hardest matchup first", () => {
    const rows = buildMatchupRows(snapshotOf([champion], matchups), 1, "TOP");
    expect(rows[0]!.opponentId).toBe(2);
    expect(rows.at(-1)!.opponentId).toBe(3);
  });

  it("scores delta against the champion's own baseline, not against 50%", () => {
    const rows = buildMatchupRows(snapshotOf([champion], matchups), 1, "TOP");
    const hardest = rows[0]!;
    expect(hardest.delta).toBeLessThan(0);
    expect(hardest.winRate).toBeCloseTo(0.3, 5);
  });

  it("drops matchups below the minimum sample", () => {
    const rows = buildMatchupRows(snapshotOf([champion], matchups), 1, "TOP");
    expect(rows.some((row) => row.opponentId === 4)).toBe(false);
  });

  it("returns nothing when the champion does not play the role", () => {
    expect(buildMatchupRows(snapshotOf([champion], matchups), 1, "JUNGLE")).toEqual([]);
  });
});

describe("rolesFor", () => {
  const tally: ChampionTally = {
    championId: 1,
    bans: 0,
    byRole: {
      TOP: { games: 100, wins: 50 },
      MIDDLE: { games: 900, wins: 450 },
      JUNGLE: { games: 0, wins: 0 },
    },
  };

  it("orders roles by how often they are played", () => {
    expect(rolesFor(tally)).toEqual(["MIDDLE", "TOP"]);
  });

  it("reports the most-played role as primary", () => {
    expect(primaryRole(tally)).toBe("MIDDLE");
  });

  it("returns null when the champion has no games", () => {
    expect(primaryRole({ championId: 2, bans: 0, byRole: {} })).toBeNull();
  });
});

describe("ranking accuracy", () => {
  /* Regressions from a real audit of the live tier list. Each of these put a
     champion at the top of a role it had no business topping. */

  it("charges bans to the roles a champion actually plays", () => {
    // Played almost entirely mid, banned in 50% of games.
    const split: ChampionTally = {
      championId: 1,
      bans: 500,
      byRole: {
        MIDDLE: { games: 760, wins: 380 },
        UTILITY: { games: 40, wins: 20 },
      },
    };
    const filler = Array.from({ length: 10 }, (_, i) => ({
      championId: i + 10,
      bans: 0,
      byRole: {
        MIDDLE: { games: 500, wins: 250 },
        UTILITY: { games: 500, wins: 250 },
      },
    })) satisfies ChampionTally[];

    const snapshot = snapshotOf([split, ...filler], [], 1000);
    const mid = buildRoleRows(snapshot, "MIDDLE").find((r) => r.championId === 1)!;
    const support = buildRoleRows(snapshot, "UTILITY").find((r) => r.championId === 1)!;

    // 95% of its games are mid, so that is where the ban pressure belongs.
    expect(mid.banRate).toBeGreaterThan(0.4);
    expect(support.banRate).toBeLessThan(0.05);
    // Previously both read 50%, which put it top of a role it barely plays.
    expect(support.banRate).toBeLessThan(mid.banRate);
  });

  it("does not let a small sample outrank a large one on a similar record", () => {
    // A 66% win rate over 77 games used to beat 54% over 721.
    const lucky: ChampionTally = {
      championId: 1,
      bans: 0,
      byRole: { TOP: { games: 77, wins: 51 } },
    };
    const proven: ChampionTally = {
      championId: 2,
      bans: 0,
      byRole: { TOP: { games: 721, wins: 388 } },
    };
    const filler = Array.from({ length: 10 }, (_, i) => ({
      championId: i + 10,
      bans: 0,
      byRole: { TOP: { games: 400, wins: 200 } },
    })) satisfies ChampionTally[];

    const rows = buildRoleRows(snapshotOf([lucky, proven, ...filler], [], 2000), "TOP");
    const luckyRank = rows.find((r) => r.championId === 1)!.rank;
    const provenRank = rows.find((r) => r.championId === 2)!.rank;
    expect(provenRank).toBeLessThan(luckyRank);
  });

  it("does not let popularity alone outrank a much better record", () => {
    // Ubiquitous but losing, against modest but winning.
    const popular: ChampionTally = {
      championId: 1,
      bans: 0,
      byRole: { BOTTOM: { games: 2300, wins: 1097 } },
    };
    const strong: ChampionTally = {
      championId: 2,
      bans: 0,
      byRole: { BOTTOM: { games: 1035, wins: 563 } },
    };
    const filler = Array.from({ length: 10 }, (_, i) => ({
      championId: i + 10,
      bans: 0,
      byRole: { BOTTOM: { games: 400, wins: 200 } },
    })) satisfies ChampionTally[];

    const rows = buildRoleRows(snapshotOf([popular, strong, ...filler], [], 5000), "BOTTOM");
    const popularRank = rows.find((r) => r.championId === 1)!.rank;
    const strongRank = rows.find((r) => r.championId === 2)!.rank;
    expect(strongRank).toBeLessThan(popularRank);
  });
});
