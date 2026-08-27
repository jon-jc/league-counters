/** Compares serving the global view precomputed versus merged per request. */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { mergeSnapshots } from "../../src/lib/data/merge";
import { snapshotMetaSchema, snapshotSchema } from "../../src/lib/data/schema";
import type { Snapshot } from "../../src/lib/data/types";

const root = path.join(process.cwd(), "data", "snapshots");
const files: string[] = [];
for (const p of readdirSync(root)) {
  for (const f of readdirSync(path.join(root, p))) files.push(path.join(root, p, f));
}

// --- old path: index by full validation, then load and merge every region ---
let t = Date.now();
for (const f of files) snapshotSchema.safeParse(JSON.parse(readFileSync(f, "utf8")));
const oldIndex = Date.now() - t;

t = Date.now();
const loaded = files.map((f) => snapshotSchema.parse(JSON.parse(readFileSync(f, "utf8"))) as unknown as Snapshot);
const oldLoad = Date.now() - t;

t = Date.now();
mergeSnapshots(loaded);
const oldMerge = Date.now() - t;

// --- new path: index by meta only, then read one precomputed file ---
t = Date.now();
for (const f of files) snapshotMetaSchema.safeParse(JSON.parse(readFileSync(f, "utf8")).meta);
const newIndex = Date.now() - t;

t = Date.now();
const payload = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "global", "420-master_plus.json"), "utf8"),
);
snapshotSchema.parse(payload.snapshot);
const newLoad = Date.now() - t;

const before = oldIndex + oldLoad + oldMerge;
const after = newIndex + newLoad;
console.log(`before: index ${oldIndex}ms + load ${oldLoad}ms + merge ${oldMerge}ms = ${before}ms`);
console.log(`after : index ${newIndex}ms + read ${newLoad}ms = ${after}ms`);
console.log(`saved : ${before - after}ms  (${(((before - after) / before) * 100).toFixed(0)}% less CPU per global request)`);
