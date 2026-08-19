import { describe, expect, it } from "vitest";
import { mergeSnapshots } from "@/lib/data/merge";
import type { Snapshot } from "@/lib/data/types";

function snapshotOf(
  platform: "NA1" | "KR",
  overrides: Partial<Snapshot> = {},
  matches = 1000,
): Snapshot {
  return {
    meta: {
      platform,
      queue: 420,
      bracket: "master_plus",
      patch: "16.16",
      matches,
      generatedAt: platform === "KR" ? "2026-08-19T10:00:00.000Z" : "2026-08-19T08:00:00.000Z",
      source: "riot",
    },
    champions: [],
    matchups: [],
    ...overrides,
  };
}

describe("mergeSnapshots", () => {
  it("returns null when given nothing", () => {
    expect(mergeSnapshots([])).toBeNull();
  });

  it("returns a lone snapshot untouched", () => {
    const only = snapshotOf("NA1");
    expect(mergeSnapshots([only])).toBe(only);
  });

  it("sums matches and records which regions contributed", () => {
    const merged = mergeSnapshots([snapshotOf("NA1", {}, 1000), snapshotOf("KR", {}, 1500)])!;
    expect(merged.meta.matches).toBe(2500);
    expect(merged.meta.regions).toEqual(["KR", "NA1"]);
  });

  it("reports the newest generatedAt of its inputs", () => {
    const merged = mergeSnapshots([snapshotOf("NA1"), snapshotOf("KR")])!;
    expect(merged.meta.generatedAt).toBe("2026-08-19T10:00:00.000Z");
  });

  it("adds the same lane pairing across regions", () => {
    // The whole point: neither region clears an 8-game floor alone; together they do.
    const a = snapshotOf("NA1", {
      matchups: [{ championId: 1, opponentId: 2, role: "TOP", games: 5, wins: 3 }],
    });
    const b = snapshotOf("KR", {
      matchups: [{ championId: 1, opponentId: 2, role: "TOP", games: 6, wins: 2 }],
    });

    const merged = mergeSnapshots([a, b])!;
    expect(merged.matchups).toHaveLength(1);
    expect(merged.matchups[0]).toMatchObject({ games: 11, wins: 5 });
  });

  it("keeps distinct pairings apart", () => {
    const a = snapshotOf("NA1", {
      matchups: [{ championId: 1, opponentId: 2, role: "TOP", games: 5, wins: 3 }],
    });
    const b = snapshotOf("KR", {
      // Same champions, different lane — not the same matchup.
      matchups: [{ championId: 1, opponentId: 2, role: "MIDDLE", games: 6, wins: 2 }],
    });
    expect(mergeSnapshots([a, b])!.matchups).toHaveLength(2);
  });

  it("sums champion games, wins and bans per role", () => {
    const a = snapshotOf("NA1", {
      champions: [{ championId: 1, bans: 10, byRole: { TOP: { games: 100, wins: 55 } } }],
    });
    const b = snapshotOf("KR", {
      champions: [
        {
          championId: 1,
          bans: 5,
          byRole: { TOP: { games: 50, wins: 20 }, MIDDLE: { games: 30, wins: 15 } },
        },
      ],
    });

    const merged = mergeSnapshots([a, b])!;
    const champion = merged.champions[0]!;
    expect(champion.bans).toBe(15);
    expect(champion.byRole.TOP).toEqual({ games: 150, wins: 75 });
    expect(champion.byRole.MIDDLE).toEqual({ games: 30, wins: 15 });
  });

  it("does not mutate the inputs", () => {
    const a = snapshotOf("NA1", {
      champions: [{ championId: 1, bans: 10, byRole: { TOP: { games: 100, wins: 55 } } }],
    });
    const b = snapshotOf("KR", {
      champions: [{ championId: 1, bans: 5, byRole: { TOP: { games: 50, wins: 20 } } }],
    });

    mergeSnapshots([a, b]);
    expect(a.champions[0]!.bans).toBe(10);
    expect(a.champions[0]!.byRole.TOP).toEqual({ games: 100, wins: 55 });
  });

  it("sums build options across regions", () => {
    const a = snapshotOf("NA1", {
      builds: [
        {
          championId: 1,
          role: "TOP",
          games: 40,
          items: { "3153": { games: 30, wins: 18 } },
          boots: {},
          keystones: {},
          secondaryStyles: {},
          spells: {},
        },
      ],
    });
    const b = snapshotOf("KR", {
      builds: [
        {
          championId: 1,
          role: "TOP",
          games: 25,
          items: { "3153": { games: 20, wins: 9 }, "3031": { games: 12, wins: 7 } },
          boots: {},
          keystones: {},
          secondaryStyles: {},
          spells: {},
        },
      ],
    });

    const build = mergeSnapshots([a, b])!.builds![0]!;
    expect(build.games).toBe(65);
    expect(build.items["3153"]).toEqual({ games: 50, wins: 27 });
    expect(build.items["3031"]).toEqual({ games: 12, wins: 7 });
  });
});
