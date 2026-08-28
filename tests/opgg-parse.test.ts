import { describe, expect, it } from "vitest";
import { OpggParseError, parseLaneMeta } from "@/lib/opgg/parse";

/**
 * op.gg's MCP returns an undocumented positional format, so these tests pin
 * the two things that would corrupt the tier list without looking broken:
 * reading values off the wrong field, and silently dropping rows.
 */

const HEADER =
  "class LolListLaneMetaChampions: data\n" +
  "class Data: positions\n" +
  "class Positions: top,mid\n" +
  "class Top: champion,is_rip,play,win,win_rate,pick_rate,role_rate,ban_rate,kda,tier,rank\n\n";

const PAYLOAD =
  HEADER +
  'LolListLaneMetaChampions(Data(Positions([Top("Nasus",false,22754,11617,0.51,0.09,0.72,0.49,1.69,0,1),' +
  'Top("Dr. Mundo",false,6000,3060,0.51,0.02,0.61,0.01,2.1,3,2)],' +
  '[Top("Kai\'Sa",false,10000,5200,0.52,0.04,0.35,0.06,2.4,1,1)])))';

describe("parseLaneMeta", () => {
  it("keys rows by the declared position order, not the request order", () => {
    const meta = parseLaneMeta(PAYLOAD);
    expect(Object.keys(meta)).toEqual(["top", "mid"]);
    expect(meta.top).toHaveLength(2);
    expect(meta.mid).toHaveLength(1);
  });

  it("maps every value to the field the payload declares", () => {
    const nasus = parseLaneMeta(PAYLOAD).top?.[0];
    expect(nasus).toEqual({
      champion: "Nasus",
      isRip: false,
      play: 22754,
      win: 11617,
      winRate: 0.51,
      pickRate: 0.09,
      roleRate: 0.72,
      banRate: 0.49,
      kda: 1.69,
      tier: 0,
      rank: 1,
    });
  });

  it("keeps names containing quotes, spaces and dots intact", () => {
    const meta = parseLaneMeta(PAYLOAD);
    expect(meta.top?.[1]?.champion).toBe("Dr. Mundo");
    expect(meta.mid?.[0]?.champion).toBe("Kai'Sa");
  });

  /* The whole reason field order is read from the payload: op.gg adding or
     moving a column must not shift every value by one. win_rate and pick_rate
     are adjacent and both plausible small decimals, so a silent shift would
     produce a wrong tier list that looks entirely normal. */
  it("follows a reordered field declaration instead of fixed offsets", () => {
    const reordered =
      "class Positions: top\n" +
      "class Top: champion,rank,tier,play,win,win_rate,pick_rate,role_rate,ban_rate,kda,is_rip\n\n" +
      'Positions([Top("Nasus",1,0,22754,11617,0.51,0.09,0.72,0.49,1.69,false)])';

    const row = parseLaneMeta(reordered).top?.[0];
    expect(row?.rank).toBe(1);
    expect(row?.tier).toBe(0);
    expect(row?.play).toBe(22754);
    expect(row?.banRate).toBe(0.49);
  });

  it("rejects a payload whose tuples do not match the declaration", () => {
    const short =
      "class Positions: top\n" +
      "class Top: champion,play,win,tier,rank\n\n" +
      'Positions([Top("Nasus",22754,11617,0)])';
    expect(() => parseLaneMeta(short)).toThrow(OpggParseError);
  });

  it("rejects a payload with fewer lane arrays than declared positions", () => {
    const missing =
      "class Positions: top,mid,jungle\n" +
      "class Top: champion,play,win,tier,rank\n\n" +
      'Positions([Top("Nasus",22754,11617,0,1)])';
    expect(() => parseLaneMeta(missing)).toThrow(/lane arrays/);
  });

  it("rejects a response whose shape changed entirely", () => {
    expect(() => parseLaneMeta('{"positions":{"top":[]}}')).toThrow(OpggParseError);
  });
});
