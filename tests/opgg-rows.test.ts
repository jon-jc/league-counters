import { describe, expect, it } from "vitest";
import { buildOpggTierRows } from "@/lib/opgg/rows";
import type { OpggTierList, OpggTierRow } from "@/lib/opgg/types";
import type { Champion, ChampionIndex } from "@/lib/lol/ddragon";
import type { Role } from "@/lib/lol/constants";

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

function row(overrides: Partial<OpggTierRow> & Pick<OpggTierRow, "championId">): OpggTierRow {
  return {
    role: "TOP" as Role,
    tier: 2,
    rank: 1,
    games: 1000,
    wins: 500,
    pickRate: 0.05,
    banRate: 0.02,
    roleRate: 0.8,
    kda: 2,
    ...overrides,
  };
}

function list(rows: OpggTierRow[]): OpggTierList {
  return {
    meta: { fetchedAt: "2026-08-27T00:00:00.000Z", championGames: 0, champions: rows.length },
    rows,
  };
}

describe("buildOpggTierRows", () => {
  it("maps op.gg's six buckets onto the six grades in order", () => {
    const data = list([
      row({ championId: 1, tier: 0, rank: 1 }),
      row({ championId: 2, tier: 3, rank: 2 }),
      row({ championId: 3, tier: 5, rank: 3 }),
    ]);

    expect(buildOpggTierRows(data, INDEX, "TOP").map((r) => r.tier)).toEqual(["S+", "B", "D"]);
  });

  /* op.gg rounds win_rate to two decimals, so 51.06% and 51.44% both arrive as
     0.51. Deriving from the raw counts is what keeps close rows separable. */
  it("derives win rate from raw counts rather than the rounded field", () => {
    const data = list([row({ championId: 1, games: 22754, wins: 11617 })]);
    const [built] = buildOpggTierRows(data, INDEX, "TOP");
    expect(built?.winRate).toBeCloseTo(11617 / 22754, 10);
    expect(built?.winRate).not.toBe(0.51);
  });

  it("keeps op.gg's own ordering within a lane", () => {
    const data = list([
      row({ championId: 3, tier: 1, rank: 3 }),
      row({ championId: 1, tier: 0, rank: 1 }),
      row({ championId: 2, tier: 1, rank: 2 }),
    ]);

    expect(buildOpggTierRows(data, INDEX, "TOP").map((r) => r.championId)).toEqual([1, 2, 3]);
  });

  it("filters to the requested role", () => {
    const data = list([
      row({ championId: 1, role: "TOP" }),
      row({ championId: 2, role: "JUNGLE" }),
    ]);

    const top = buildOpggTierRows(data, INDEX, "TOP");
    expect(top).toHaveLength(1);
    expect(top[0]?.championId).toBe(1);
  });

  /* Across lanes op.gg supplies no global ordering, only a rank within each.
     Grouping by grade keeps every champion in the bucket op.gg put it in — a
     re-sort on win rate would let a weak pick with a flattering record jump
     above the ones op.gg graded strongest. */
  it("groups the all-roles view by grade, not by win rate", () => {
    const data = list([
      row({ championId: 1, role: "TOP", tier: 4, rank: 1, games: 100, wins: 90 }),
      row({ championId: 2, role: "JUNGLE", tier: 0, rank: 1, games: 100, wins: 51 }),
      row({ championId: 3, role: "MIDDLE", tier: 0, rank: 2, games: 100, wins: 50 }),
    ]);

    const all = buildOpggTierRows(data, INDEX, null);
    expect(all.map((r) => r.championId)).toEqual([2, 3, 1]);
    expect(all.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("drops champions the Data Dragon build does not know", () => {
    const data = list([row({ championId: 1 }), row({ championId: 999 })]);
    expect(buildOpggTierRows(data, INDEX, "TOP")).toHaveLength(1);
  });
});
