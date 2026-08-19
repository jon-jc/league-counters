import { describe, expect, it } from "vitest";
import { addMatch, createAccumulator, fromSnapshot, toSnapshot } from "@/lib/ingest/aggregate";
import type { RiotMatch } from "@/lib/riot/types";
import type { Snapshot } from "@/lib/data/types";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
const TARGET = { queue: 420, patch: "16.16" };

/** Blue team wins by default; champion ids are 100+index / 200+index. */
function buildMatch(overrides: Partial<RiotMatch["info"]> = {}): RiotMatch {
  const participants = ROLES.flatMap((role, index) => [
    { championId: 100 + index, teamId: 100, teamPosition: role, win: true },
    { championId: 200 + index, teamId: 200, teamPosition: role, win: false },
  ]);

  return {
    metadata: { matchId: "NA1_1" },
    info: {
      gameVersion: "16.16.500.1234",
      queueId: 420,
      gameDuration: 1800,
      endOfGameResult: "GameComplete",
      participants,
      teams: [
        { teamId: 100, bans: [{ championId: 900 }, { championId: -1 }] },
        { teamId: 200, bans: [{ championId: 900 }, { championId: 901 }] },
      ],
      ...overrides,
    },
  };
}

describe("addMatch", () => {
  it("counts a complete ranked match", () => {
    const acc = createAccumulator();
    expect(addMatch(acc, buildMatch(), TARGET)).toEqual({ counted: true });
    expect(acc.matches).toBe(1);
  });

  it("records wins per champion and role", () => {
    const acc = createAccumulator();
    addMatch(acc, buildMatch(), TARGET);

    const blueTop = acc.champions.get(100)!;
    expect(blueTop.byRole.get("TOP")).toEqual({ games: 1, wins: 1 });

    const redTop = acc.champions.get(200)!;
    expect(redTop.byRole.get("TOP")).toEqual({ games: 1, wins: 0 });
  });

  it("records each lane matchup from both sides", () => {
    const acc = createAccumulator();
    addMatch(acc, buildMatch(), TARGET);

    expect(acc.matchups.get("100:200:TOP")).toEqual({
      championId: 100,
      opponentId: 200,
      role: "TOP",
      games: 1,
      wins: 1,
    });
    expect(acc.matchups.get("200:100:TOP")).toEqual({
      championId: 200,
      opponentId: 100,
      role: "TOP",
      games: 1,
      wins: 0,
    });
  });

  it("counts a ban once per team that banned it, ignoring -1", () => {
    const acc = createAccumulator();
    addMatch(acc, buildMatch(), TARGET);

    expect(acc.champions.get(900)!.bans).toBe(2);
    expect(acc.champions.get(901)!.bans).toBe(1);
    expect(acc.champions.has(-1)).toBe(false);
  });

  it.each([
    ["queue", { queueId: 440 }, "queue"],
    ["patch", { gameVersion: "16.15.100.1" }, "patch"],
    ["remake by result", { endOfGameResult: "Abort_Unexpected" }, "incomplete"],
    ["remake by duration", { gameDuration: 240 }, "short"],
  ] as const)("rejects on %s", (_label, override, reason) => {
    const acc = createAccumulator();
    const result = addMatch(acc, buildMatch(override), TARGET);
    expect(result).toEqual({ counted: false, reason });
    expect(acc.matches).toBe(0);
  });

  it("rejects a match where a position could not be classified", () => {
    const match = buildMatch();
    match.info.participants[3]!.teamPosition = "";

    const acc = createAccumulator();
    expect(addMatch(acc, match, TARGET)).toEqual({ counted: false, reason: "positions" });
    // Nothing partial should have been written.
    expect(acc.champions.size).toBe(0);
    expect(acc.matchups.size).toBe(0);
  });

  it("accumulates across matches", () => {
    const acc = createAccumulator();
    addMatch(acc, buildMatch(), TARGET);
    addMatch(acc, buildMatch(), TARGET);

    expect(acc.matches).toBe(2);
    expect(acc.champions.get(100)!.byRole.get("TOP")).toEqual({ games: 2, wins: 2 });
    expect(acc.matchups.get("100:200:TOP")!.games).toBe(2);
  });
});

describe("snapshot round trip", () => {
  const meta = {
    platform: "NA1",
    queue: 420,
    bracket: "master_plus",
    patch: "16.16",
    generatedAt: "2026-08-18T00:00:00.000Z",
    source: "riot",
  } as const;

  it("survives serialise then re-hydrate without drift", () => {
    const acc = createAccumulator();
    addMatch(acc, buildMatch(), TARGET);
    addMatch(acc, buildMatch(), TARGET);

    const snapshot = toSnapshot(acc, meta);
    const restored = toSnapshot(fromSnapshot(snapshot as Snapshot), meta);

    expect(restored).toEqual(snapshot);
  });

  it("keeps counting from a restored snapshot rather than restarting", () => {
    const first = createAccumulator();
    addMatch(first, buildMatch(), TARGET);
    const snapshot = toSnapshot(first, meta) as Snapshot;

    const resumed = fromSnapshot(snapshot);
    addMatch(resumed, buildMatch(), TARGET);

    expect(resumed.matches).toBe(2);
    expect(resumed.champions.get(100)!.byRole.get("TOP")).toEqual({ games: 2, wins: 2 });
  });

  it("omits roles with no games", () => {
    const acc = createAccumulator();
    addMatch(acc, buildMatch(), TARGET);

    const snapshot = toSnapshot(acc, meta);
    const top = snapshot.champions.find((c) => c.championId === 100)!;
    expect(Object.keys(top.byRole)).toEqual(["TOP"]);
  });
});
