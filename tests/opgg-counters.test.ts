import { describe, expect, it } from "vitest";
import { parseChampionCounters } from "@/lib/opgg/parse";

/**
 * The counters payload is the fiddliest thing op.gg returns: which arrays are
 * present varies by how much sample they have, one class name is reused for
 * both sides, and a non-array sibling turns up exactly when an array is
 * missing. Getting any of it wrong inverts or drops counters silently.
 */

const BOTH =
  "class LolGetChampionAnalysis: data\n" +
  "class Data: strong_counters,weak_counters\n" +
  "class StrongCounter: champion_id,champion_name,play,win,my_win_rate,counter_win_rate,win_rate\n\n" +
  'LolGetChampionAnalysis(Data([StrongCounter(85,"Kennen",159,95,0.6,0.4,0.6)],' +
  '[StrongCounter(875,"Sett",412,184,0.45,0.55,0.55)]))';

/* When one side is too thin, op.gg drops it from the declaration entirely and
   adds a counters_meta node — so `Data` carries a mix of array and non-array
   values, and the surviving side is named by the declaration, not by order. */
const WEAK_ONLY =
  "class LolGetChampionAnalysis: data\n" +
  "class Data: weak_counters,counters_meta\n" +
  "class WeakCounter: champion_id,play,win\n" +
  "class CountersMeta: message\n\n" +
  'LolGetChampionAnalysis(Data([WeakCounter(75,114,52)],CountersMeta("Insufficient matchup sample.")))';

const STRONG_ONLY =
  "class LolGetChampionAnalysis: data\n" +
  "class Data: strong_counters,counters_meta\n" +
  "class StrongCounter: champion_id,play,win\n" +
  "class CountersMeta: message\n\n" +
  'LolGetChampionAnalysis(Data([StrongCounter(122,135,76)],CountersMeta("Insufficient matchup sample.")))';

const NONE =
  "class LolGetChampionAnalysis: data\n" +
  "class Data: counters_meta\n" +
  "class CountersMeta: message\n\n" +
  'LolGetChampionAnalysis(Data(CountersMeta("Insufficient matchup sample.")))';

const SUMMARY =
  "class LolGetChampionAnalysis: data\n" +
  "class Data: summary,counters_meta\n" +
  "class Summary: positions\n" +
  "class Position: name,counters\n" +
  "class Counter: champion_id,play,win\n" +
  "class CountersMeta: message\n\n" +
  'LolGetChampionAnalysis(Data(Summary([Position("MID",[Counter(711,46,18),Counter(245,67,27)]),' +
  'Position("TOP",[Counter(157,43,17)])]),CountersMeta("Insufficient matchup sample.")))';

describe("parseChampionCounters", () => {
  it("separates the two sides when op.gg reuses one class for both", () => {
    const counters = parseChampionCounters(BOTH);
    expect(counters.strong.map((c) => c.opponentId)).toEqual([85]);
    expect(counters.weak.map((c) => c.opponentId)).toEqual([875]);
  });

  /* `win` is the queried champion's wins on both sides. Reading it as the
     opponent's would invert every counter on the site. */
  it("keeps wins on the queried champion's side", () => {
    const counters = parseChampionCounters(BOTH);
    expect(counters.strong[0]).toMatchObject({ play: 159, win: 95 });
    expect(counters.weak[0]).toMatchObject({ play: 412, win: 184 });
    expect((counters.weak[0]!.win / counters.weak[0]!.play)).toBeLessThan(0.5);
  });

  it("reads the surviving side by name when the other is dropped", () => {
    const weak = parseChampionCounters(WEAK_ONLY);
    expect(weak.weak.map((c) => c.opponentId)).toEqual([75]);
    expect(weak.strong).toEqual([]);

    const strong = parseChampionCounters(STRONG_ONLY);
    expect(strong.strong.map((c) => c.opponentId)).toEqual([122]);
    expect(strong.weak).toEqual([]);
  });

  it("returns nothing rather than throwing when there are no counters at all", () => {
    expect(parseChampionCounters(NONE)).toEqual({ strong: [], weak: [], byPosition: [] });
  });

  /* The summary fallback nests an array inside a tuple, so splitting a tuple
     on commas without tracking brackets would shred it. */
  it("reads the per-position fallback, including its nested arrays", () => {
    const { byPosition } = parseChampionCounters(SUMMARY);
    expect(byPosition.map((group) => group.position)).toEqual(["MID", "TOP"]);
    expect(byPosition[0]?.counters).toEqual([
      { opponentId: 711, opponentName: "", play: 46, win: 18 },
      { opponentId: 245, opponentName: "", play: 67, win: 27 },
    ]);
    expect(byPosition[1]?.counters).toHaveLength(1);
  });

  it("does not confuse the graded counters with the fallback", () => {
    const summaryOnly = parseChampionCounters(SUMMARY);
    expect(summaryOnly.strong).toEqual([]);
    expect(summaryOnly.weak).toEqual([]);

    const bothOnly = parseChampionCounters(BOTH);
    expect(bothOnly.byPosition).toEqual([]);
  });
});
