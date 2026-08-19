import { describe, expect, it } from "vitest";
import {
  classifyKeyStatus,
  isUsable,
  looksLikeRiotKey,
  needsRotation,
} from "@/lib/riot/key-status";

describe("classifyKeyStatus", () => {
  it.each([
    [200, "valid"],
    [401, "expired"],
    [403, "forbidden"],
    [429, "rate-limited"],
    [500, "unavailable"],
    [503, "unavailable"],
    [0, "unavailable"],
  ] as const)("maps HTTP %i to %s", (status, expected) => {
    expect(classifyKeyStatus(status)).toBe(expected);
  });

  it("treats an expired development key as expired, not as an outage", () => {
    // Riot answers a lapsed key with 401 "Unknown apikey".
    expect(classifyKeyStatus(401)).toBe("expired");
  });
});

describe("isUsable", () => {
  it("allows ingestion while merely rate limited", () => {
    // Being throttled is not a reason to skip a run; the limiter handles it.
    expect(isUsable("rate-limited")).toBe(true);
    expect(isUsable("valid")).toBe(true);
  });

  it("blocks ingestion when the key does not work", () => {
    expect(isUsable("expired")).toBe(false);
    expect(isUsable("forbidden")).toBe(false);
  });

  it("blocks ingestion when Riot cannot be reached", () => {
    expect(isUsable("unavailable")).toBe(false);
  });
});

describe("needsRotation", () => {
  it("asks for a new key only when the key itself is the problem", () => {
    expect(needsRotation("expired")).toBe(true);
    expect(needsRotation("forbidden")).toBe(true);
  });

  it("does not blame the key for a Riot outage", () => {
    // Otherwise every Riot incident raises an issue telling someone to rotate.
    expect(needsRotation("unavailable")).toBe(false);
    expect(needsRotation("rate-limited")).toBe(false);
    expect(needsRotation("valid")).toBe(false);
  });
});

describe("looksLikeRiotKey", () => {
  it("accepts a well-formed development key", () => {
    expect(looksLikeRiotKey("RGAPI-1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d")).toBe(true);
  });

  it("tolerates surrounding whitespace from a paste", () => {
    expect(looksLikeRiotKey("  RGAPI-1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d\n")).toBe(true);
  });

  it.each([
    ["", "empty"],
    ["not-a-key", "not a key at all"],
    ["RGAPI-", "prefix only"],
    ["RGAPI-1a2b3c4d-5e6f-4a7b-8c9d", "truncated"],
    ["1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "missing prefix"],
    ["RGAPI-zzzzzzzz-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "non-hex characters"],
  ])("rejects %j (%s)", (value) => {
    expect(looksLikeRiotKey(value)).toBe(false);
  });
});
