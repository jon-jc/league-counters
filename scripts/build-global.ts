/**
 * Precomputes the all-regions snapshot.
 *
 *   npm run build:global
 *
 * The global view is the site's default, and merging every region on each
 * request costs CPU proportional to the total data collected — fine at a few
 * thousand matches, not fine as the pipeline keeps accumulating. This writes
 * the merge once, after ingestion, so serving it is a single file read like any
 * other region.
 *
 * The output records which snapshots it was built from and when each was
 * generated. The reader compares that against the snapshots actually on disk
 * and falls back to merging live if they disagree, so a stale file can never be
 * served as current.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mergeSnapshots } from "../src/lib/data/merge";
import { snapshotSchema } from "../src/lib/data/schema";
import type { Snapshot } from "../src/lib/data/types";
import { DEFAULT_BRACKET, DEFAULT_QUEUE } from "../src/lib/lol/constants";

const SNAPSHOT_ROOT = path.join(process.cwd(), "data", "snapshots");
export const GLOBAL_ROOT = path.join(process.cwd(), "data", "global");

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return (index === -1 ? undefined : process.argv[index + 1]) ?? fallback;
}

const queue = arg("queue", String(DEFAULT_QUEUE));
const bracket = arg("bracket", DEFAULT_BRACKET);
const fileName = `${queue}-${bracket}.json`;

const platforms = await readdir(SNAPSHOT_ROOT).catch(() => [] as string[]);
const snapshots: Snapshot[] = [];

for (const platform of platforms) {
  const file = path.join(SNAPSHOT_ROOT, platform, fileName);
  try {
    const parsed = snapshotSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
    if (parsed.success) snapshots.push(parsed.data as Snapshot);
    else console.warn(`skipping ${platform}: failed validation`);
  } catch {
    // That region has no snapshot for this queue and bracket.
  }
}

if (snapshots.length === 0) {
  console.log("No snapshots to merge — nothing written.");
} else {
  // Only merge snapshots on the newest shared patch; mixing patches would be a
  // silent correctness bug, and the reader applies the same rule.
  const patch = snapshots
    .map((s) => s.meta.patch)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
  const onPatch = snapshots.filter((s) => s.meta.patch === patch);

  const merged = mergeSnapshots(onPatch);
  if (!merged) {
    console.log("Nothing to merge — nothing written.");
  } else {
    const payload = {
      /** What this was built from, so the reader can tell if it went stale. */
      sources: onPatch
        .map((s) => ({ platform: s.meta.platform, generatedAt: s.meta.generatedAt }))
        .sort((a, b) => a.platform.localeCompare(b.platform)),
      snapshot: merged,
    };

    await mkdir(GLOBAL_ROOT, { recursive: true });
    await writeFile(path.join(GLOBAL_ROOT, fileName), `${JSON.stringify(payload)}\n`, "utf8");

    console.log(
      `Merged ${onPatch.length} regions on patch ${patch}: ` +
        `${merged.meta.matches} matches, ${merged.matchups.length} matchup rows -> ` +
        `${path.relative(process.cwd(), path.join(GLOBAL_ROOT, fileName))}`,
    );
  }
}
