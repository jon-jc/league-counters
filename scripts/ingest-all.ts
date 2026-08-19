/**
 * Ingests several regions one after another.
 *
 *   npm run ingest:all -- --regions "NA1 EUW1 KR" --bracket emerald_plus --matches 1200
 *
 * Sequential on purpose. The rate limiter tracks only its own requests while
 * the budget belongs to the key, so two ingests running at once each believe
 * they own the whole allowance and spend more time in 429 backoff than
 * fetching. They would also write the same snapshot files.
 */
import { runIngest } from "../src/lib/ingest/run";
import { DEFAULT_BRACKET, DEFAULT_QUEUE, isBracket, isQueueId } from "../src/lib/lol/constants";
import { isPlatformId, type PlatformId } from "../src/lib/lol/regions";
import type { Bracket, QueueId } from "../src/lib/lol/constants";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fine — the key may come from the real environment instead.
}

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1) return process.argv[index + 1];
  return fallback;
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

const apiKey = process.env.RIOT_API_KEY;
if (!apiKey) fail("RIOT_API_KEY is not set");

const regions = (arg("regions") ?? "NA1 EUW1 KR")
  .split(/[\s,]+/)
  .filter(Boolean)
  .map((value) => value.toUpperCase());

for (const region of regions) {
  if (!isPlatformId(region)) fail(`unknown region "${region}"`);
}

const bracketArg = arg("bracket") ?? DEFAULT_BRACKET;
if (!isBracket(bracketArg)) fail(`unknown bracket "${bracketArg}"`);
const bracket: Bracket = bracketArg;

const queueArg = Number(arg("queue") ?? DEFAULT_QUEUE);
if (!isQueueId(queueArg)) fail(`unsupported queue "${queueArg}"`);
const queue: QueueId = queueArg;

const matchBudget = Number(arg("matches") ?? 800);
const playerSample = Number(arg("players") ?? 60);
const matchesPerPlayer = Number(arg("per-player") ?? 30);

const started = Date.now();
const summary: string[] = [];

for (const [index, region] of regions.entries()) {
  const label = `[${index + 1}/${regions.length}] ${region}`;
  console.log(`\n${"=".repeat(60)}\n${label} · ${bracket}\n${"=".repeat(60)}`);

  try {
    const result = await runIngest({
      platform: region as PlatformId,
      queue,
      bracket,
      matchBudget,
      playerSample,
      matchesPerPlayer,
      apiKey: apiKey!,
      log: (message) => console.log(message),
    });
    summary.push(
      `${region.padEnd(5)} +${String(result.added).padStart(5)} this run · ` +
        `${String(result.snapshot.meta.matches).padStart(6)} total · ` +
        `${result.snapshot.matchups.length} matchup rows`,
    );
  } catch (error) {
    // One unhealthy shard must not cost the regions that come after it.
    console.error(`${region} failed: ${(error as Error).message}`);
    summary.push(`${region.padEnd(5)} FAILED — ${(error as Error).message}`);
  }
}

console.log(`\n${"=".repeat(60)}`);
console.log(`All regions done in ${((Date.now() - started) / 60000).toFixed(1)} min`);
for (const line of summary) console.log(`  ${line}`);
