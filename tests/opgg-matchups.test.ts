import { describe, expect, it } from "vitest";
import { buildOpggMatchupRows, opggRolesFor } from "@/lib/opgg/matchups";
import type { OpggCounters, OpggTierList } from "@/lib/opgg/types";
import type { Champion, ChampionIndex } from "@/lib/lol/ddragon";

function champion(id: number, name: string): Champion {
  return {
    id,
    ddragonId: name,
    slug: name.toLowerCase(),
    name,
    title: "",
    tags: [],
    partype: "Mana",
    difficulty: 1,
  };
}

const CHAMPIONS = [champion(1, "Alpha"), champion(2, "Beta"), champion(3, "Gamma")];
const INDEX: ChampionIndex = {
  version: "16.17.1",
  all: CHAMPIONS,
  byId: new Map(CHAMPIONS.map((c) => [c.id, c])),
  bySlug: new Map(CHAMPIONS.map((c) => [c.slug, c])),
};

/** Alpha wins 55% in TOP overall; 30% in TOP is a different champion's lane. */
const LANE_META: OpggTierList = {
  meta: { fetchedAt: "2026-08-27T00:00:00.000Z", championGames: 0, champions: 1 },
  rows: [
    {
      championId: 1, role: "TOP", tier: 1, rank: 1,
      games: 10_000, wins: 5_500, pickRate: 0.05, banRate: 0.02, roleRate: 1, kda: 2,
    },
    {
      championId: 2, role: "TOP", tier: 0, rank: 2,
      games: 10_000, wins: 5_000, pickRate: 0.05, banRate: 0.02, roleRate: 1, kda: 2,
    },
    {
      championId: 1, role: "MIDDLE", tier: 3, rank: 5,
      games: 4_000, wins: 2_000, pickRate: 0.02, banRate: 0.02, roleRate: 1, kda: 2,
    },
  ],
};

const COUNTERS: OpggCounters = {
  meta: { fetchedAt: "2026-08-27T00:00:00.000Z", championRoles: 1, covered: 1 },
  rows: [
    // Alpha loses this lane badly relative to its own 55% baseline.
    { championId: 1, role: "TOP", opponentId: 2, games: 2_000, wins: 800 },
    // ...and over-performs in this one.
    { championId: 1, role: "TOP", opponentId: 3, games: 2_000, wins: 1_400 },
  ],
};

describe("buildOpggMatchupRows", () => {
  it("sorts hardest matchup first and gets the delta signs right", () => {
    const rows = buildOpggMatchupRows(COUNTERS, LANE_META, INDEX, 1, "TOP");
    expect(rows.map((r) => r.opponentId)).toEqual([2, 3]);
    expect(rows[0]?.delta).toBeLessThan(0);
    expect(rows[1]?.delta).toBeGreaterThan(0);
  });

  /* A counter is measured against the champion's own win rate, so the baseline
     has to come from the same dataset as the pairing. Scoring op.gg matchups
     against the Riot-aggregated baseline would measure the gap between two
     datasets and label it a counter. */
  it("measures against op.gg's own baseline for that lane", () => {
    const [hardest] = buildOpggMatchupRows(COUNTERS, LANE_META, INDEX, 1, "TOP");
    // 800/2000 shrinks to ~0.402; baseline 5500/10000 shrinks to ~0.549.
    expect(hardest?.delta).toBeCloseTo(0.402 - 0.549, 2);
  });

  it("carries the opponent's own op.gg grade", () => {
    const rows = buildOpggMatchupRows(COUNTERS, LANE_META, INDEX, 1, "TOP");
    expect(rows.find((r) => r.opponentId === 2)?.tier).toBe("S+");
    // Gamma is not ranked in TOP by op.gg, so it has no grade to show.
    expect(rows.find((r) => r.opponentId === 3)?.tier).toBeNull();
  });

  it("returns nothing when op.gg does not rank the champion in that lane", () => {
    expect(buildOpggMatchupRows(COUNTERS, LANE_META, INDEX, 1, "JUNGLE")).toEqual([]);
  });

  it("lists the roles op.gg ranks a champion in, most played first", () => {
    expect(opggRolesFor(LANE_META, 1)).toEqual(["TOP", "MIDDLE"]);
  });
});
