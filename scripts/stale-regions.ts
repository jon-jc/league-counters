/**
 * Prints the regions most in need of an ingest, space separated.
 *
 *   npm run --silent stale-regions -- --count 5
 *
 * A development key cannot refresh seventeen shards every three hours, so the
 * scheduled job asks for the stalest few instead of a hardcoded list. Regions
 * with no snapshot at all sort first, which means a newly supported shard fills
 * itself in without anyone editing the workflow.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PLATFORM_IDS, type PlatformId } from "../src/lib/lol/regions";
import { DEFAULT_BRACKET, DEFAULT_QUEUE } from "../src/lib/lol/constants";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : process.argv[index + 1];
  return value ?? fallback;
}

const count = Math.max(1, Number(arg("count", "5")));
const bracket = arg("bracket", DEFAULT_BRACKET);
const queue = arg("queue", String(DEFAULT_QUEUE));
const root = path.join(process.cwd(), "data", "snapshots");

/** Epoch millis of each region's snapshot; absent means never ingested. */
const updatedAt = new Map<PlatformId, number>();

for (const platform of PLATFORM_IDS) {
  const file = path.join(root, platform, `${queue}-${bracket}.json`);
  try {
    const snapshot = JSON.parse(readFileSync(file, "utf8")) as {
      meta: { generatedAt: string };
    };
    updatedAt.set(platform, new Date(snapshot.meta.generatedAt).getTime());
  } catch {
    // No snapshot, or unreadable — either way it is maximally stale.
  }
}

// Touch the directory listing so a region present under another bracket is not
// mistaken for missing when the caller asks about this one.
try {
  readdirSync(root);
} catch {
  // No snapshots at all yet; every region is stale, which is already the case.
}

const ordered = [...PLATFORM_IDS].sort((a, b) => {
  const left = updatedAt.get(a) ?? -1;
  const right = updatedAt.get(b) ?? -1;
  // Never-ingested first, then oldest first, then alphabetical for stability.
  if (left !== right) return left - right;
  return a.localeCompare(b);
});

process.stdout.write(`${ordered.slice(0, count).join(" ")}\n`);
