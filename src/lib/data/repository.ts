import "server-only";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import {
  DEFAULT_BRACKET,
  DEFAULT_QUEUE,
  type Bracket,
  type QueueId,
} from "@/lib/lol/constants";
import {
  DEFAULT_PLATFORM,
  isGlobal,
  type PlatformId,
  type RegionId,
} from "@/lib/lol/regions";
import { snapshotMetaSchema, snapshotSchema } from "./schema";
import { bestOf } from "./select";
import { mergeSnapshots } from "./merge";
import type { Snapshot, SnapshotDescriptor } from "./types";



const SNAPSHOT_ROOT = path.join(process.cwd(), "data", "snapshots");
/** Where `npm run build:global` leaves the precomputed all-regions merge. */
const GLOBAL_ROOT = path.join(process.cwd(), "data", "global");

export function snapshotPath(
  platform: PlatformId,
  queue: QueueId,
  bracket: Bracket,
): string {
  return path.join(SNAPSHOT_ROOT, platform, `${queue}-${bracket}.json`);
}

async function readSnapshotFile(file: string): Promise<Snapshot | null> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return null;
  }

  const parsed = snapshotSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    console.error(`Invalid snapshot at ${file}:`, parsed.error.issues.slice(0, 3));
    return null;
  }
  return parsed.data as Snapshot;
}

/** Read just the header of a snapshot, for building the index cheaply. */
async function readSnapshotMeta(file: string): Promise<SnapshotDescriptor | null> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return null;
  }

  try {
    const parsed = snapshotMetaSchema.safeParse(JSON.parse(raw).meta);
    return parsed.success ? (parsed.data as SnapshotDescriptor) : null;
  } catch {
    return null;
  }
}

/**
 * Load one snapshot. Returns null when that region/bracket has never been
 * ingested — callers render an empty state rather than inventing numbers.
 */
export const loadSnapshot = cache(
  async (
    platform: PlatformId,
    queue: QueueId = DEFAULT_QUEUE,
    bracket: Bracket = DEFAULT_BRACKET,
  ): Promise<Snapshot | null> => readSnapshotFile(snapshotPath(platform, queue, bracket)),
);

/**
 * Load the best snapshot for a request.
 *
 * When the visitor explicitly picked a bracket they get exactly that, thin or
 * not — substituting data they did not ask for is worse than showing the truth
 * about what they did. When the bracket is merely a default, the region's best
 * available snapshot wins instead, so a region part-way through its first
 * ingest does not greet everyone with an almost-empty page.
 *
 * Falls back across bracket, then platform, so a deep link never dead-ends.
 */
export const resolveSnapshot = cache(
  async (
    region: RegionId,
    queue: QueueId = DEFAULT_QUEUE,
    bracket: Bracket = DEFAULT_BRACKET,
    bracketExplicit = true,
  ): Promise<Snapshot | null> => {
    const available = await listSnapshots();

    if (isGlobal(region)) {
      const merged = await loadGlobalSnapshot(queue, bracket);
      if (merged) return merged;
      // Nothing to merge — fall through and serve a single region instead.
    }

    const platform = isGlobal(region) ? DEFAULT_PLATFORM : region;

    if (bracketExplicit) {
      const exact = await loadSnapshot(platform, queue, bracket);
      if (exact) return exact;
    } else {
      const best = bestOf(available.filter((s) => s.platform === platform && s.queue === queue));
      if (best) return loadSnapshot(best.platform, best.queue, best.bracket);
    }

    const samePlatform = bestOf(
      available.filter((s) => s.platform === platform && s.queue === queue),
    );
    if (samePlatform) {
      return loadSnapshot(samePlatform.platform, samePlatform.queue, samePlatform.bracket);
    }

    const fallback =
      bestOf(available.filter((s) => s.platform === DEFAULT_PLATFORM)) ?? bestOf(available);
    return fallback
      ? loadSnapshot(fallback.platform, fallback.queue, fallback.bracket)
      : null;
  },
);

/**
 * Every snapshot on disk, newest first. Read by walking the directory rather
 * than trusting an index file, so a partial ingest can never advertise data
 * that is not actually there.
 */
export const listSnapshots = cache(async (): Promise<SnapshotDescriptor[]> => {
  let platforms: string[];
  try {
    platforms = await readdir(SNAPSHOT_ROOT);
  } catch {
    return [];
  }

  const descriptors: SnapshotDescriptor[] = [];

  for (const platform of platforms) {
    let files: string[];
    try {
      files = await readdir(path.join(SNAPSHOT_ROOT, platform));
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      /* The index only needs meta, so only meta is validated here. Running the
         full schema over every snapshot just to list them cost more than
         everything else on the page put together, and each snapshot is still
         validated in full when it is actually loaded. */
      const meta = await readSnapshotMeta(path.join(SNAPSHOT_ROOT, platform, file));
      if (meta) descriptors.push(meta);
    }
  }

  return descriptors.sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
  );
});

/** Platforms that actually have data, for populating the region picker. */
export const availablePlatforms = cache(async (): Promise<PlatformId[]> => {
  const snapshots = await listSnapshots();
  return [...new Set(snapshots.map((s) => s.platform))];
});

/** Brackets available for a platform, for the rank picker. */
export const availableBrackets = cache(
  async (region: RegionId): Promise<Bracket[]> => {
    const snapshots = await listSnapshots();
    // The global view can offer any bracket that any region has.
    if (isGlobal(region)) return [...new Set(snapshots.map((s) => s.bracket))];
    return [...new Set(snapshots.filter((s) => s.platform === region).map((s) => s.bracket))];
  },
);

/**
 * Every region on the newest shared patch, summed into one snapshot.
 *
 * Only snapshots on the same patch are merged — combining patches would be a
 * silent correctness bug — so the newest patch that at least one region has is
 * chosen, and regions still behind it are left out of that merge.
 */
export const loadGlobalSnapshot = cache(
  async (
    queue: QueueId = DEFAULT_QUEUE,
    bracket: Bracket = DEFAULT_BRACKET,
  ): Promise<Snapshot | null> => {
    const available = await listSnapshots();
    const candidates = available.filter((s) => s.queue === queue && s.bracket === bracket);
    if (candidates.length === 0) return null;

    const patch = candidates
      .map((s) => s.patch)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
    const onPatch = candidates.filter((s) => s.patch === patch);

    const precomputed = await readPrecomputedGlobal(queue, bracket, onPatch);
    if (precomputed) return precomputed;

    const loaded = await Promise.all(
      onPatch.map((s) => loadSnapshot(s.platform, s.queue, s.bracket)),
    );
    return mergeSnapshots(loaded.filter((s): s is Snapshot => s !== null));
  },
);

/**
 * The merge `npm run build:global` wrote, if it still matches what is on disk.
 *
 * Merging every region per request costs CPU proportional to all the data ever
 * collected, so the result is precomputed after each ingest. The file records
 * which snapshots it came from; if that no longer matches — a region ingested
 * since, or the builder never run — it is ignored and the merge happens live.
 * A stale global view would be worse than a slow one.
 */
async function readPrecomputedGlobal(
  queue: QueueId,
  bracket: Bracket,
  expected: SnapshotDescriptor[],
): Promise<Snapshot | null> {
  let raw: string;
  try {
    raw = await readFile(path.join(GLOBAL_ROOT, `${queue}-${bracket}.json`), "utf8");
  } catch {
    return null;
  }

  let payload: { sources?: { platform: string; generatedAt: string }[]; snapshot?: unknown };
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  const fingerprint = (rows: { platform: string; generatedAt: string }[]) =>
    rows
      .map((r) => `${r.platform}@${r.generatedAt}`)
      .sort()
      .join("|");

  if (!payload.sources || fingerprint(payload.sources) !== fingerprint(expected)) {
    return null;
  }

  const parsed = snapshotSchema.safeParse(payload.snapshot);
  return parsed.success ? (parsed.data as Snapshot) : null;
}

/** Platforms that have a snapshot for this queue and bracket. */
export const globalRegionCount = cache(
  async (queue: QueueId = DEFAULT_QUEUE, bracket: Bracket = DEFAULT_BRACKET): Promise<number> => {
    const available = await listSnapshots();
    return new Set(
      available.filter((s) => s.queue === queue && s.bracket === bracket).map((s) => s.platform),
    ).size;
  },
);
