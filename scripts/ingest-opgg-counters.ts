/**
 * Pulls op.gg's counter matchups for every champion-lane they track.
 *
 *   npm run ingest:opgg:counters
 *
 * Reads data/opgg/lane-meta.json to decide what to ask for — there is no point
 * querying a champion in a lane op.gg does not rank — then writes
 * data/opgg/counters.json.
 *
 * op.gg returns three best and three worst matchups per champion-lane, so this
 * is not a full matchup table. It is the extremes, each backed by hundreds or
 * thousands of games, which is what the Riot pipeline cannot reach: a lane
 * pairing gains one game per match, so most pairings never clear the sample
 * floor no matter how long ingestion runs.
 *
 * Needs no API key.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  fetchChampionCounters,
  OPGG_LANE_BY_ROLE,
  toOpggChampionName,
} from "../src/lib/opgg/client";
import { opggCountersSchema, opggTierListSchema } from "../src/lib/opgg/schema";
import type { OpggMatchupRow } from "../src/lib/opgg/types";
import { getChampionIndex } from "../src/lib/lol/ddragon";
import { resolveRole, type Role } from "../src/lib/lol/constants";

const DIR = path.join(process.cwd(), "data", "opgg");
const IN_FILE = path.join(DIR, "lane-meta.json");
const OUT_FILE = path.join(DIR, "counters.json");

/** Requests in flight. Kept low deliberately — this is someone else's endpoint. */
const CONCURRENCY = 3;
/** Pause between requests on a worker, for the same reason. */
const DELAY_MS = 120;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const laneMeta = opggTierListSchema.parse(JSON.parse(await readFile(IN_FILE, "utf8")));
  const index = await getChampionIndex();

  /* One task per champion-lane op.gg ranks. */
  const tasks = laneMeta.rows.map((row) => ({
    championId: row.championId,
    role: row.role,
    name: index.byId.get(row.championId)?.name ?? "",
  }));

  console.log(`Fetching counters for ${tasks.length} champion-lanes from op.gg...`);

  /* Keyed by champion-role-opponent, so the same pairing arriving from both
     the graded counters and the raw summary keeps whichever carries more
     games. op.gg occasionally lists a pairing with no games behind it; those
     would render as a 0% matchup, so they are dropped. */
  const pairings = new Map<string, OpggMatchupRow>();
  const failures: string[] = [];
  let done = 0;

  function record(championId: number, role: Role, opponentId: number, games: number, wins: number) {
    if (championId === opponentId || games <= 0) return;
    const key = `${championId}:${role}:${opponentId}`;
    const existing = pairings.get(key);
    if (existing && existing.games >= games) return;
    pairings.set(key, { championId, role, opponentId, games, wins });
  }

  async function worker() {
    for (;;) {
      const task = tasks.shift();
      if (!task) return;

      if (!task.name) {
        failures.push(`${task.championId}/${task.role} (unknown to Data Dragon)`);
        continue;
      }

      try {
        const counters = await fetchChampionCounters(
          toOpggChampionName(task.name),
          OPGG_LANE_BY_ROLE[task.role],
        );

        for (const counter of [...counters.strong, ...counters.weak]) {
          record(task.championId, task.role, counter.opponentId, counter.play, counter.win);
        }

        /* The summary block covers every position the champion plays, not only
           the one queried, and is what op.gg points to when the graded
           counters are too thin — so it is read on every response, not kept
           as a retry. */
        for (const group of counters.byPosition) {
          const role = resolveRole(group.position);
          if (!role) continue;
          for (const counter of group.counters) {
            record(task.championId, role, counter.opponentId, counter.play, counter.win);
          }
        }
      } catch (error) {
        failures.push(
          `${task.name}/${task.role}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      done++;
      if (done % 25 === 0) console.log(`  ${done} done, ${pairings.size} pairings`);
      await sleep(DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const reported = pairings.size;

  /* A pairing describes both champions: if Nasus won 184 of 412 top lanes into
     Sett, Sett won the other 228 of that same 412. op.gg only ever reports one
     side, so mirroring every row fills the opponent's counter list for free.
     A mirrored row never displaces a directly reported one, which may carry a
     larger sample. */
  for (const row of [...pairings.values()]) {
    const key = `${row.opponentId}:${row.role}:${row.championId}`;
    const existing = pairings.get(key);
    if (existing && existing.games >= row.games) continue;
    pairings.set(key, {
      championId: row.opponentId,
      role: row.role,
      opponentId: row.championId,
      games: row.games,
      wins: row.games - row.wins,
    });
  }

  const rows = [...pairings.values()];
  const covered = new Set(rows.map((row) => `${row.championId}:${row.role}`));

  /* A handful of upstream hiccups is tolerable — the file is still a large
     improvement over nothing. Wholesale failure is not, and usually means the
     endpoint or its schema moved. */
  if (rows.length === 0) {
    throw new Error("op.gg returned no counter matchups at all — refusing to write an empty file");
  }

  const payload = {
    meta: {
      fetchedAt: new Date().toISOString(),
      championRoles: laneMeta.rows.length,
      covered: covered.size,
    },
    rows: rows.sort(
      (a, b) =>
        a.championId - b.championId ||
        a.role.localeCompare(b.role) ||
        b.games - a.games,
    ),
  };

  const validated = opggCountersSchema.safeParse(payload);
  if (!validated.success) {
    throw new Error(
      `refusing to write an invalid file: ${JSON.stringify(validated.error.issues.slice(0, 3))}`,
    );
  }

  await mkdir(DIR, { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(payload, null, 1)}\n`, "utf8");

  console.log(
    `\nWrote ${rows.length} pairings (${reported} reported, ${rows.length - reported} mirrored) ` +
      `covering ${covered.size} champion-lanes to data/opgg/counters.json`,
  );
  if (failures.length > 0) {
    console.log(`\n${failures.length} champion-lane(s) failed:`);
    for (const failure of failures.slice(0, 15)) console.log(`  ${failure}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
