/** How many champions actually get a usable counter list in the global view. */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { mergeSnapshots } from "../../src/lib/data/merge";
import { buildMatchupRows, primaryRole, rolesFor } from "../../src/lib/data/metrics";
import type { Snapshot } from "../../src/lib/data/types";

const root = path.join(process.cwd(), "data", "snapshots");
const snapshots: Snapshot[] = [];
for (const platform of readdirSync(root)) {
  for (const file of readdirSync(path.join(root, platform))) {
    if (!file.includes("master_plus")) continue;
    snapshots.push(JSON.parse(readFileSync(path.join(root, platform, file), "utf8")));
  }
}

const merged = mergeSnapshots(snapshots)!;
const buckets = { none: 0, thin: 0, usable: 0, rich: 0 };
let withRole = 0;

for (const champion of merged.champions) {
  const role = primaryRole(champion);
  if (!role) continue;
  withRole += 1;
  const rows = buildMatchupRows(merged, champion.championId, role);
  if (rows.length === 0) buckets.none += 1;
  else if (rows.length < 4) buckets.thin += 1;
  else if (rows.length < 10) buckets.usable += 1;
  else buckets.rich += 1;
}

console.log(`champions with a primary role : ${withRole}`);
console.log(`  no scored lanes             : ${buckets.none}`);
console.log(`  1-3 scored lanes            : ${buckets.thin}`);
console.log(`  4-9 scored lanes            : ${buckets.usable}`);
console.log(`  10+ scored lanes            : ${buckets.rich}`);
const answered = buckets.thin + buckets.usable + buckets.rich;
console.log(`champions that answer "who counters me": ${answered}/${withRole} (${((answered / withRole) * 100).toFixed(0)}%)`);
console.log(`roles covered across all champions: ${new Set(merged.matchups.filter((m) => m.games >= 8).map((m) => m.role)).size}/5`);
