/** Ad-hoc sanity check over a generated snapshot: schema, tier spread, matchups. */
import { readFileSync } from "node:fs";
import { snapshotSchema } from "../../src/lib/data/schema";
import { buildMatchupRows, buildRoleRows } from "../../src/lib/data/metrics";
import type { Snapshot } from "../../src/lib/data/types";

const file = process.argv[2] ?? "data/snapshots/KR/420-emerald_plus.json";
const parsed = snapshotSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
console.log("schema valid:", parsed.success);
if (!parsed.success) {
  console.log(JSON.stringify(parsed.error.issues.slice(0, 3), null, 2));
  process.exit(1);
}

const snap = parsed.data as Snapshot;
console.log("meta:", JSON.stringify(snap.meta));

const rows = buildRoleRows(snap, "MIDDLE");
console.log("MIDDLE ranked:", rows.length);
const spread: Record<string, number> = {};
for (const r of rows) spread[r.tier] = (spread[r.tier] ?? 0) + 1;
console.log("tier spread:", JSON.stringify(spread));
console.log(
  "top 5:",
  rows
    .slice(0, 5)
    .map((r) => `${r.championId} wr=${(r.winRate * 100).toFixed(1)}% pr=${(r.pickRate * 100).toFixed(1)}% ${r.tier}`)
    .join(" | "),
);

const first = rows[0];
if (first) {
  const mus = buildMatchupRows(snap, first.championId, "MIDDLE");
  console.log(
    `matchups for ${first.championId}: ${mus.length} | worst ${(mus[0]!.delta * 100).toFixed(2)}% | best ${(mus[mus.length - 1]!.delta * 100).toFixed(2)}%`,
  );
}
