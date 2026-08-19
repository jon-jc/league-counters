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
import { DEFAULT_PLATFORM, type PlatformId } from "@/lib/lol/regions";
import { snapshotSchema } from "./schema";
import { bestOf } from "./select";
import type { Snapshot, SnapshotDescriptor } from "./types";



const SNAPSHOT_ROOT = path.join(process.cwd(), "data", "snapshots");

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
 * Load the requested snapshot, falling back to another bracket on the same
 * platform, then to the best snapshot anywhere, so a deep link never dead-ends.
 *
 * An explicit selection is always honoured exactly — if someone picks Master+
 * and it is thin, they get the thin real numbers and an honest empty state.
 * Only the *fallback* prefers a snapshot with enough volume to actually render,
 * since substituting one empty page for another helps nobody.
 */
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
    platform: PlatformId,
    queue: QueueId = DEFAULT_QUEUE,
    bracket: Bracket = DEFAULT_BRACKET,
    bracketExplicit = true,
  ): Promise<Snapshot | null> => {
    const available = await listSnapshots();

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
      const snapshot = await readSnapshotFile(path.join(SNAPSHOT_ROOT, platform, file));
      if (snapshot) descriptors.push({ ...snapshot.meta });
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
  async (platform: PlatformId): Promise<Bracket[]> => {
    const snapshots = await listSnapshots();
    return [...new Set(snapshots.filter((s) => s.platform === platform).map((s) => s.bracket))];
  },
);
