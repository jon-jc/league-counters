import { describe, expect, it } from "vitest";
import { MIN_VIABLE_MATCHES, bestOf, fallbackRank } from "@/lib/data/select";
import type { SnapshotDescriptor } from "@/lib/data/types";

function descriptor(overrides: Partial<SnapshotDescriptor>): SnapshotDescriptor {
  return {
    platform: "NA1",
    queue: 420,
    bracket: "emerald_plus",
    patch: "16.16",
    matches: 1000,
    generatedAt: "2026-08-18T00:00:00.000Z",
    source: "seed",
    ...overrides,
  };
}

describe("fallbackRank", () => {
  it("ranks a viable real snapshot above everything else", () => {
    const real = descriptor({ source: "riot", matches: 5000 });
    const seed = descriptor({ source: "seed", matches: 50_000 });
    expect(fallbackRank(real)).toBeGreaterThan(fallbackRank(seed));
  });

  it("ranks viable seed data above a real snapshot too thin to render", () => {
    const thinReal = descriptor({ source: "riot", matches: MIN_VIABLE_MATCHES - 1 });
    const seed = descriptor({ source: "seed", matches: 40_000 });
    expect(fallbackRank(seed)).toBeGreaterThan(fallbackRank(thinReal));
  });
});

describe("bestOf", () => {
  it("returns undefined when there is nothing to choose from", () => {
    expect(bestOf([])).toBeUndefined();
  });

  it("does not simply pick the newest snapshot", () => {
    // The regression: a 15-match ingest published minutes ago rendered as an
    // empty page while a rich snapshot sat right next to it.
    const fresh = descriptor({
      source: "riot",
      matches: 15,
      bracket: "master_plus",
      generatedAt: "2026-08-18T12:00:00.000Z",
    });
    const rich = descriptor({
      source: "seed",
      matches: 48_000,
      bracket: "emerald_plus",
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(bestOf([fresh, rich])?.bracket).toBe("emerald_plus");
  });

  it("breaks ties on sample size", () => {
    const small = descriptor({ source: "riot", matches: 1000, bracket: "diamond_plus" });
    const large = descriptor({ source: "riot", matches: 9000, bracket: "master_plus" });
    expect(bestOf([small, large])?.bracket).toBe("master_plus");
  });

  it("leaves the input array untouched", () => {
    const list = [
      descriptor({ matches: 10, bracket: "master_plus" }),
      descriptor({ matches: 9000, bracket: "gold_plus" }),
    ];
    bestOf(list);
    expect(list[0]!.bracket).toBe("master_plus");
  });
});
