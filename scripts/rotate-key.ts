/**
 * Installs a new Riot API key everywhere it is needed, in one step.
 *
 *   npm run key:rotate
 *
 * Paste the key when prompted (input is not echoed), or pipe it in:
 *
 *   echo "RGAPI-..." | npm run key:rotate
 *
 * It validates the key against Riot before storing it anywhere, writes it to
 * .env.local, and updates the repository's RIOT_API_KEY secret through the gh
 * CLI so the scheduled workflow picks it up. The key is never echoed, never
 * passed as a command-line argument, and never written to shell history.
 *
 * Riot has no endpoint for issuing keys, so generating one stays manual:
 * https://developer.riotgames.com/ -> Regenerate API Key.
 */
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { checkKey, looksLikeRiotKey } from "../src/lib/riot/key-status";

const ENV_FILE = ".env.local";

function fail(message: string): never {
  console.error(`\nerror: ${message}`);
  process.exit(1);
}

/** Read the key from a pipe, or from the terminal without echoing it. */
async function readKey(): Promise<string> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString("utf8").trim();
  }

  let muted = false;
  const muffled = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });

  const rl = createInterface({ input: process.stdin, output: muffled, terminal: true });
  const answer = new Promise<string>((resolve) =>
    rl.question("Paste the new Riot API key (input hidden): ", (value) => {
      rl.close();
      process.stdout.write("\n");
      resolve(value.trim());
    }),
  );
  muted = true;
  return answer;
}

/** Replace RIOT_API_KEY in .env.local, preserving everything else. */
async function writeEnvFile(key: string): Promise<void> {
  let existing = "";
  try {
    existing = await readFile(ENV_FILE, "utf8");
  } catch {
    existing = "# Local secrets. Gitignored — never commit this file.\n";
  }

  const line = `RIOT_API_KEY=${key}`;
  const updated = /^RIOT_API_KEY=.*$/m.test(existing)
    ? existing.replace(/^RIOT_API_KEY=.*$/m, line)
    : `${existing.replace(/\s*$/, "")}\n${line}\n`;

  await writeFile(ENV_FILE, updated, "utf8");
}

/** Push the key to the repo secret via gh, passing it on stdin, never in argv. */
async function setRepoSecret(key: string): Promise<boolean> {
  try {
    const child = execFile("gh", ["secret", "set", "RIOT_API_KEY"]);
    child.stdin?.end(key);
    await new Promise<void>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`gh exited with ${code}`)),
      );
    });
    return true;
  } catch (error) {
    console.warn(`\nCould not update the repository secret: ${(error as Error).message}`);
    console.warn("Set it yourself with:  gh secret set RIOT_API_KEY");
    return false;
  }
}

const key = await readKey();
if (!key) fail("no key provided");
if (!looksLikeRiotKey(key)) {
  fail('that does not look like a Riot key (expected "RGAPI-" followed by a UUID)');
}

process.stdout.write("Validating against Riot… ");
const check = await checkKey(key);
if (check.status !== "valid") {
  console.log("failed");
  fail(`${check.message} (HTTP ${check.httpStatus || "no response"})`);
}
console.log("ok");

await writeEnvFile(key);
console.log(`Wrote ${ENV_FILE}`);

const pushed = await setRepoSecret(key);
if (pushed) console.log("Updated the RIOT_API_KEY repository secret");

// The key is live in both places, so there is nothing further to do. Whether
// it needs replacing again depends on its tier: personal and production keys
// do not expire, development keys lapse 24 hours after they are issued.
console.log("\nDone. Scheduled ingests will use it from their next run.");
