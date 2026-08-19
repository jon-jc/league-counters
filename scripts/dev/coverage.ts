/** Compares matchup coverage per region against the merged global view. */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { mergeSnapshots } from "../../src/lib/data/merge";
import type { Snapshot } from "../../src/lib/data/types";

const MIN = 8;
const root = path.join(process.cwd(), "data", "snapshots");
const snapshots: Snapshot[] = [];

for (const platform of readdirSync(root)) {
  for (const file of readdirSync(path.join(root, platform))) {
    if (!file.includes("master_plus")) continue;
    snapshots.push(JSON.parse(readFileSync(path.join(root, platform, file), "utf8")));
  }
}

function report(label: string, snapshot: Snapshot) {
  const qualifying = snapshot.matchups.filter((m) => m.games >= MIN);
  const champions = new Set(qualifying.map((m) => m.championId));
  const pairs = new Set(qualifying.map((m) => `${m.championId}:${m.role}`));
  console.log(
    `${label.padEnd(18)} matches=${String(snapshot.meta.matches).padStart(6)}` +
      `  qualifyingMatchups=${String(qualifying.length).padStart(5)}` +
      `  championsWithCounters=${String(champions.size).padStart(4)}` +
      `  championRolesCovered=${String(pairs.size).padStart(4)}`,
  );
}

for (const snapshot of snapshots.sort((a, b) => b.meta.matches - a.meta.matches)) {
  report(snapshot.meta.platform, snapshot);
}

const merged = mergeSnapshots(snapshots);
if (merged) {
  console.log("-".repeat(96));
  report("GLOBAL (merged)", merged);
}
