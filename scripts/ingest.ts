/**
 * Aggregates real ranked matches from the Riot API into a snapshot.
 *
 *   npm run ingest -- --region KR --bracket master_plus --matches 300
 *
 * Runs are additive: a checkpoint of already-seen match ids lives in
 * data/.cache, so repeated short runs accumulate into a real sample over the
 * life of a patch rather than starting over.
 *
 * Requires RIOT_API_KEY (read from .env.local or the environment).
 */
import { runIngest } from "../src/lib/ingest/run";
import { DEFAULT_BRACKET, DEFAULT_QUEUE, isBracket, isQueueId } from "../src/lib/lol/constants";
import { isPlatformId, type PlatformId } from "../src/lib/lol/regions";
import type { Bracket, QueueId } from "../src/lib/lol/constants";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fine — the key may come from the real environment instead (CI).
}

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1) return process.argv[index + 1];
  return fallback;
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

const apiKey = process.env.RIOT_API_KEY;
if (!apiKey) {
  fail("RIOT_API_KEY is not set. Add it to .env.local or the environment.");
}

const regionArg = (arg("region") ?? "NA1").toUpperCase();
if (!isPlatformId(regionArg)) fail(`unknown region "${regionArg}"`);
const platform: PlatformId = regionArg;

const bracketArg = arg("bracket") ?? DEFAULT_BRACKET;
if (!isBracket(bracketArg)) fail(`unknown bracket "${bracketArg}"`);
const bracket: Bracket = bracketArg;

const queueArg = Number(arg("queue") ?? DEFAULT_QUEUE);
if (!isQueueId(queueArg)) fail(`unsupported queue "${queueArg}"`);
const queue: QueueId = queueArg;

const matchBudget = Number(arg("matches") ?? 200);
const playerSample = Number(arg("players") ?? 40);
const matchesPerPlayer = Number(arg("per-player") ?? 20);

const started = Date.now();

const result = await runIngest({
  platform,
  queue,
  bracket,
  matchBudget,
  playerSample,
  matchesPerPlayer,
  apiKey,
  log: (message) => console.log(message),
});

const elapsed = ((Date.now() - started) / 1000).toFixed(0);
const skippedTotal = Object.values(result.skipped).reduce((a, b) => a + b, 0);

console.log("");
console.log(`Done in ${elapsed}s`);
console.log(`  matches counted this run : ${result.added}`);
console.log(`  matches in snapshot      : ${result.snapshot.meta.matches}`);
console.log(`  champions tracked        : ${result.snapshot.champions.length}`);
console.log(`  matchup rows             : ${result.snapshot.matchups.length}`);
console.log(`  skipped                  : ${skippedTotal} ${JSON.stringify(result.skipped)}`);
console.log(`  written to               : ${result.file}`);
