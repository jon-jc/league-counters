/** Do the score weights actually weight what they claim to? */
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildRoleRows } from "../../src/lib/data/metrics";
import type { Snapshot } from "../../src/lib/data/types";

const snapshot = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "global", "420-master_plus.json"), "utf8"),
).snapshot as Snapshot;

const rows = buildRoleRows(snapshot, "BOTTOM");
const wr = rows.map((r) => r.adjustedWinRate);
const pres = rows.map((r) => r.presence);
const sd = (v: number[]) => {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
};
const spread = (v: number[]) => `${(Math.min(...v) * 100).toFixed(1)}%..${(Math.max(...v) * 100).toFixed(1)}%`;

console.log("BOTTOM, after shrinkage:");
console.log(`  win rate  range ${spread(wr)}  sd ${(sd(wr) * 100).toFixed(2)}pp`);
console.log(`  presence  range ${spread(pres)}  sd ${(sd(pres) * 100).toFixed(2)}pp`);
console.log("");
console.log("How far the extremes sit from the mean, in standard deviations:");
const zWr = (x: number) => (x - wr.reduce((a, b) => a + b, 0) / wr.length) / sd(wr);
const zP = (x: number) => (x - pres.reduce((a, b) => a + b, 0) / pres.length) / sd(pres);
console.log(`  best win rate   z = ${zWr(Math.max(...wr)).toFixed(2)}  -> weighted 0.72 = ${(0.72 * zWr(Math.max(...wr))).toFixed(2)}`);
console.log(`  most contested  z = ${zP(Math.max(...pres)).toFixed(2)}  -> weighted 0.28 = ${(0.28 * zP(Math.max(...pres))).toFixed(2)}`);
console.log("");
console.log("Skew (0 = symmetric; large = a long tail a z-score cannot represent):");
const skew = (v: number[]) => {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const s = sd(v);
  return v.reduce((a, b) => a + ((b - m) / s) ** 3, 0) / v.length;
};
console.log(`  win rate ${skew(wr).toFixed(2)}   presence ${skew(pres).toFixed(2)}`);
