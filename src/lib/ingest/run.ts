import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getItemCatalogue, getLatestVersion } from "@/lib/lol/ddragon";
import { toPatch, type Bracket, type QueueId } from "@/lib/lol/constants";
import type { PlatformId } from "@/lib/lol/regions";
import { RiotClient } from "@/lib/riot/client";
import { snapshotSchema } from "@/lib/data/schema";
import type { Snapshot } from "@/lib/data/types";
import {
  addMatch,
  createAccumulator,
  fromSnapshot,
  toSnapshot,
  type RejectReason,
} from "./aggregate";
import { samplePuuids } from "./sample";

const SNAPSHOT_ROOT = path.join(process.cwd(), "data", "snapshots");
/**
 * Checkpoints are committed, not cached.
 *
 * A scheduled runner gets a clean filesystem every run. If the seen-id set
 * lived in an ignored cache directory, every run would re-fetch the same recent
 * matches and fold them in a second time, inflating every count. Keeping the
 * checkpoint in the repo alongside the snapshot is what makes repeated runs
 * genuinely additive.
 */
const CHECKPOINT_ROOT = path.join(process.cwd(), "data", "checkpoints");

/** Match ids already folded in, so repeated runs accumulate instead of double-counting. */
interface Checkpoint {
  patch: string;
  seen: string[];
}

/**
 * Matches between writes to disk.
 *
 * A development key sustains roughly 50 requests a minute, so a few thousand
 * matches is an hours-long run. Flushing periodically means an interrupted run
 * keeps everything it had already aggregated, and the checkpoint stays in step
 * with the snapshot so nothing is counted twice on resume.
 */
const FLUSH_EVERY = 100;

export interface IngestOptions {
  platform: PlatformId;
  queue: QueueId;
  bracket: Bracket;
  /** Upper bound on matches fetched this run. */
  matchBudget: number;
  /** How many ladder players to pull match history from. */
  playerSample: number;
  /** Match ids requested per player. */
  matchesPerPlayer: number;
  apiKey: string;
  log?: (message: string) => void;
}

export interface IngestResult {
  snapshot: Snapshot;
  added: number;
  skipped: Record<RejectReason | "duplicate", number>;
  patch: string;
  file: string;
}

function snapshotFile(platform: PlatformId, queue: QueueId, bracket: Bracket): string {
  return path.join(SNAPSHOT_ROOT, platform, `${queue}-${bracket}.json`);
}

function checkpointFile(platform: PlatformId, queue: QueueId, bracket: Bracket): string {
  return path.join(CHECKPOINT_ROOT, platform, `${queue}-${bracket}.json`);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * Sample the ladder, fold new matches into the existing snapshot, and write it
 * back.
 *
 * Runs are additive and resumable: a checkpoint of seen match ids means a
 * short run every few hours accumulates into a real sample over a patch, which
 * is the only way to build meaningful volume under a development key's
 * 100-requests-per-two-minutes budget.
 */
export async function runIngest(options: IngestOptions): Promise<IngestResult> {
  const { platform, queue, bracket, matchBudget, playerSample, matchesPerPlayer } = options;
  const log = options.log ?? (() => {});

  const patch = toPatch(await getLatestVersion());
  log(`Patch ${patch} · ${platform} · ${bracket} · queue ${queue}`);

  /* Fetched once per run so the aggregator can tell a finished item from a
     component without carrying a copy of the item catalogue itself. */
  const itemCatalogue = await getItemCatalogue();
  const items = { legendary: itemCatalogue.legendary, boots: itemCatalogue.boots };
  log(`Item catalogue: ${items.legendary.size} legendary, ${items.boots.size} boots`);

  const client = new RiotClient({
    apiKey: options.apiKey,
    onRetry: ({ status, waitSeconds }) =>
      log(`  rate limited (${status}), waiting ${waitSeconds}s`),
  });

  const file = snapshotFile(platform, queue, bracket);
  const statePath = checkpointFile(platform, queue, bracket);

  // Only resume from data on the same patch — the meta shifts between them.
  const existingRaw = await readJson<unknown>(file);
  const existing = existingRaw ? snapshotSchema.safeParse(existingRaw) : null;
  const reusable =
    existing?.success && existing.data.meta.patch === patch && existing.data.meta.source === "riot"
      ? (existing.data as Snapshot)
      : null;

  const checkpoint = await readJson<Checkpoint>(statePath);
  const seen = new Set(checkpoint?.patch === patch ? checkpoint.seen : []);

  const acc = reusable ? fromSnapshot(reusable) : createAccumulator();
  log(
    reusable
      ? `Resuming from ${reusable.meta.matches} matches (${seen.size} ids seen)`
      : "Starting a fresh snapshot for this patch",
  );

  log(`Sampling up to ${playerSample} players`);
  const puuids = await samplePuuids(client, {
    platform,
    queue,
    bracket,
    limit: playerSample,
    onProgress: log,
  });
  log(`Sampled ${puuids.length} players`);

  const skipped: IngestResult["skipped"] = {
    duplicate: 0,
    queue: 0,
    patch: 0,
    incomplete: 0,
    short: 0,
    positions: 0,
  };

  const queued: string[] = [];
  for (const puuid of puuids) {
    if (queued.length >= matchBudget) break;
    try {
      const ids = await client.matchIds(platform, puuid, queue, matchesPerPlayer);
      for (const id of ids) {
        if (seen.has(id)) {
          skipped.duplicate += 1;
          continue;
        }
        seen.add(id);
        queued.push(id);
      }
    } catch (error) {
      log(`  match ids failed: ${(error as Error).message}`);
    }
  }

  const targets = queued.slice(0, matchBudget);
  log(`Fetching ${targets.length} new matches`);

  const meta = { platform, queue, bracket, patch, source: "riot" as const };

  /* Write the snapshot and its checkpoint together. Order matters: the
     checkpoint may only claim ids whose matches are already in the snapshot on
     disk, or a crash between the two writes would drop games while still
     marking them seen. */
  const flush = async (counted: Set<string>) => {
    const current = toSnapshot(acc, { ...meta, generatedAt: new Date().toISOString() });

    /* Never publish an empty snapshot. A region whose ladder could not be
       reached — a dead shard, an expired key — would otherwise leave a file
       claiming zero matches, which is enough for the site to offer that region
       in the picker and then render nothing. No file at all is the honest
       state, and the next run starts clean. */
    if (current.meta.matches === 0) return current;

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(current)}\n`, "utf8");

    await mkdir(path.dirname(statePath), { recursive: true });
    const state: Checkpoint = { patch, seen: [...counted].slice(-50_000) };
    await writeFile(statePath, JSON.stringify(state), "utf8");

    return current;
  };

  let added = 0;
  /* Only ids actually folded in belong in the checkpoint. Ids that were merely
     queued must stay unclaimed, so an interrupted run refetches them. */
  const processed = new Set(checkpoint?.patch === patch ? checkpoint.seen : []);

  for (const [position, matchId] of targets.entries()) {
    try {
      const match = await client.match(platform, matchId);
      const result = addMatch(acc, match, { queue, patch }, items);
      if (result.counted) added += 1;
      else if (result.reason) skipped[result.reason] += 1;
      // Seen either way — a rejected match stays rejected, so never refetch it.
      processed.add(matchId);
    } catch (error) {
      log(`  ${matchId} failed: ${(error as Error).message}`);
    }

    if ((position + 1) % FLUSH_EVERY === 0) {
      await flush(processed);
      log(`  ${position + 1}/${targets.length} fetched, ${added} counted, saved`);
    } else if ((position + 1) % 25 === 0) {
      log(`  ${position + 1}/${targets.length} fetched, ${added} counted`);
    }
  }

  const snapshot = await flush(processed);
  if (snapshot.meta.matches === 0) {
    log("No matches could be aggregated — leaving the snapshot unwritten.");
  }

  return { snapshot, added, skipped, patch, file };
}
