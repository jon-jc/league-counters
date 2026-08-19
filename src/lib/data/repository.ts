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
 * platform, then to the default platform, so a deep link never dead-ends.
 */
export const resolveSnapshot = cache(
  async (
    platform: PlatformId,
    queue: QueueId = DEFAULT_QUEUE,
    bracket: Bracket = DEFAULT_BRACKET,
  ): Promise<Snapshot | null> => {
    const exact = await loadSnapshot(platform, queue, bracket);
    if (exact) return exact;

    const available = await listSnapshots();

    const samePlatform = available.find((s) => s.platform === platform && s.queue === queue);
    if (samePlatform) {
      return loadSnapshot(samePlatform.platform, samePlatform.queue, samePlatform.bracket);
    }

    const fallback =
      available.find((s) => s.platform === DEFAULT_PLATFORM) ?? available[0];
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
