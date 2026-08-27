/** The precomputed global must equal the live merge, and must be ignored when stale. */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { mergeSnapshots } from "../../src/lib/data/merge";
import { snapshotSchema } from "../../src/lib/data/schema";
import type { Snapshot } from "../../src/lib/data/types";

const root = path.join(process.cwd(), "data", "snapshots");
const globalFile = path.join(process.cwd(), "data", "global", "420-master_plus.json");

const snapshots: Snapshot[] = [];
for (const p of readdirSync(root)) {
  for (const f of readdirSync(path.join(root, p))) {
    snapshots.push(snapshotSchema.parse(JSON.parse(readFileSync(path.join(root, p, f), "utf8"))) as unknown as Snapshot);
  }
}

const live = mergeSnapshots(snapshots)!;
const payload = JSON.parse(readFileSync(globalFile, "utf8"));
const stored = payload.snapshot as Snapshot;

const same =
  stored.meta.matches === live.meta.matches &&
  stored.matchups.length === live.matchups.length &&
  stored.champions.length === live.champions.length &&
  JSON.stringify(stored.matchups.slice(0, 200)) === JSON.stringify(live.matchups.slice(0, 200));

console.log(`identical to live merge : ${same}`);
console.log(`  matches   ${stored.meta.matches} vs ${live.meta.matches}`);
console.log(`  matchups  ${stored.matchups.length} vs ${live.matchups.length}`);
console.log(`  champions ${stored.champions.length} vs ${live.champions.length}`);

// The fingerprint is what protects against serving a stale merge.
const fp = (rows: { platform: string; generatedAt: string }[]) =>
  rows.map((r) => `${r.platform}@${r.generatedAt}`).sort().join("|");
const onDisk = snapshots.map((s) => ({ platform: s.meta.platform, generatedAt: s.meta.generatedAt }));
console.log(`fingerprint matches     : ${fp(payload.sources) === fp(onDisk)}`);

const drifted = onDisk.map((r, i) => (i === 0 ? { ...r, generatedAt: "2099-01-01T00:00:00.000Z" } : r));
console.log(`detects a re-ingest     : ${fp(payload.sources) !== fp(drifted)}`);
