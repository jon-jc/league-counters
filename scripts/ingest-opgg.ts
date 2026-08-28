/**
 * Pulls op.gg's lane tier list through their public MCP endpoint.
 *
 *   npm run ingest:opgg
 *
 * Writes data/opgg/lane-meta.json, translated into this project's vocabulary:
 * champion display names resolved to Riot championIds, op.gg lanes resolved to
 * Riot team positions, rates left as rates and counts left as counts.
 *
 * Unlike the Riot ingest this is a single request and takes about a second, so
 * it is not incremental — each run replaces the file wholesale.
 *
 * Needs no API key. op.gg's endpoint is unauthenticated.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchLaneMeta, OPGG_LANES, type OpggLane } from "../src/lib/opgg/client";
import { opggTierListSchema } from "../src/lib/opgg/schema";
import type { OpggTierRow } from "../src/lib/opgg/types";
import { championSlug, getChampionIndex } from "../src/lib/lol/ddragon";
import type { Role } from "../src/lib/lol/constants";

const OUT_DIR = path.join(process.cwd(), "data", "opgg");
const OUT_FILE = path.join(OUT_DIR, "lane-meta.json");

/** op.gg's lane names -> Riot's `teamPosition` values. */
const LANE_TO_ROLE: Record<OpggLane, Role> = {
  top: "TOP",
  mid: "MIDDLE",
  jungle: "JUNGLE",
  adc: "BOTTOM",
  support: "UTILITY",
};

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

async function main() {
  console.log("Fetching lane meta from op.gg MCP...");
  const laneMeta = await fetchLaneMeta();

  const index = await getChampionIndex();
  console.log(`Data Dragon ${index.version}: ${index.all.length} champions`);

  const rows: OpggTierRow[] = [];
  const unresolved = new Set<string>();

  for (const lane of OPGG_LANES) {
    const laneRows = laneMeta[lane];
    if (!laneRows || laneRows.length === 0) {
      fail(`op.gg returned no rows for ${lane}`);
    }

    for (const row of laneRows) {
      const champion = index.bySlug.get(championSlug(row.champion));
      if (!champion) {
        unresolved.add(row.champion);
        continue;
      }

      rows.push({
        championId: champion.id,
        role: LANE_TO_ROLE[lane],
        tier: row.tier,
        rank: row.rank,
        games: row.play,
        wins: row.win,
        pickRate: row.pickRate,
        banRate: row.banRate,
        roleRate: row.roleRate,
        kda: row.kda,
      });
    }

    console.log(`  ${lane.padEnd(8)} ${laneRows.length} champions`);
  }

  /* A name we cannot resolve is a champion silently missing from the tier
     list, which is invisible in the output — so it stops the run instead. The
     usual cause is a champion released since the cached Data Dragon build. */
  if (unresolved.size > 0) {
    fail(
      `could not resolve ${unresolved.size} champion name(s) to Riot ids: ` +
        [...unresolved].join(", "),
    );
  }

  const championIds = new Set(rows.map((row) => row.championId));
  const payload = {
    meta: {
      fetchedAt: new Date().toISOString(),
      championGames: rows.reduce((sum, row) => sum + row.games, 0),
      champions: championIds.size,
    },
    rows,
  };

  /* Validate what we are about to write with the same schema the site reads
     it back through, so a shape problem surfaces here rather than as an empty
     tier list in production. */
  const validated = opggTierListSchema.safeParse(payload);
  if (!validated.success) {
    fail(`refusing to write an invalid file: ${JSON.stringify(validated.error.issues.slice(0, 3))}`);
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(payload, null, 1)}\n`, "utf8");

  console.log(
    `\nWrote ${rows.length} rows for ${championIds.size} champions ` +
      `(${payload.meta.championGames.toLocaleString()} champion games) ` +
      `to data/opgg/lane-meta.json`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
