/**
 * Generates a deterministic placeholder dataset so the site renders before —
 * and between — real ingestion runs.
 *
 * Champion identities, roles and class tags are real (pulled from Data Dragon);
 * the win/pick/ban counts are synthesised from a seeded PRNG. Every snapshot it
 * writes is tagged `source: "seed"`, and the UI labels those as sample data.
 *
 *   npm run seed
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getChampions, getLatestVersion, type Champion } from "../src/lib/lol/ddragon";
import { ROLES, toPatch, type Role } from "../src/lib/lol/constants";
import type { PlatformId } from "../src/lib/lol/regions";
import type { ChampionTally, MatchupTally, Snapshot } from "../src/lib/data/types";
import { hashSeed, mulberry32, normal } from "./lib/rng";
import { CHAMPION_LANES } from "./lib/champion-roles";

const OUT_ROOT = path.join(process.cwd(), "data", "snapshots");

/** Region, seed offset, and how many matches the fake ingest "sampled". */
const TARGETS: { platform: PlatformId; matches: number }[] = [
  { platform: "NA1", matches: 48_000 },
  { platform: "EUW1", matches: 61_000 },
  { platform: "KR", matches: 74_000 },
  { platform: "BR1", matches: 26_000 },
  { platform: "EUN1", matches: 22_000 },
];

/** Rough affinity of each Riot class tag for each position. */
const TAG_WEIGHTS: Record<string, Partial<Record<Role, number>>> = {
  Marksman: { BOTTOM: 8, MIDDLE: 1 },
  Support: { UTILITY: 9 },
  Mage: { MIDDLE: 6, UTILITY: 2, TOP: 1 },
  Assassin: { MIDDLE: 5, JUNGLE: 3, TOP: 1 },
  Fighter: { TOP: 6, JUNGLE: 3, MIDDLE: 1 },
  Tank: { TOP: 5, UTILITY: 3, JUNGLE: 2 },
};

/** Weight each lane for a champion: curated lanes first, class tags as fallback. */
function roleWeights(champion: Champion): Partial<Record<Role, number>> {
  const weights: Partial<Record<Role, number>> = {};

  const lanes = CHAMPION_LANES[champion.ddragonId];
  if (lanes) {
    weights[lanes[0]] = 1;
    if (lanes[1]) weights[lanes[1]] = 0.34;
  } else {
    // Champion released after the lane map was written — approximate from tags.
    for (const tag of champion.tags) {
      for (const [role, weight] of Object.entries(TAG_WEIGHTS[tag] ?? {})) {
        weights[role as Role] = (weights[role as Role] ?? 0) + weight / 9;
      }
    }
  }

  // Everyone gets a sliver everywhere — off-role picks exist in real data too,
  // they just sit below MIN_ROLE_SHARE and get dropped.
  for (const role of ROLES) weights[role] = (weights[role] ?? 0) + 0.02;
  return weights;
}

/**
 * A champion only counts as "played" in a role once a real share of its games
 * land there. Without this every champion shows up in every lane, which is not
 * what a ranked ladder looks like.
 */
const MIN_ROLE_SHARE = 0.12;
const MIN_ROLE_GAMES = 120;
/** Opponents tracked per champion-role, most contested first. */
const MAX_OPPONENTS = 28;

function buildSnapshot(
  platform: PlatformId,
  matches: number,
  patch: string,
  champions: Champion[],
): Snapshot {
  const rand = mulberry32(hashSeed(`${platform}:${patch}`));

  /** Intrinsic strength per champion on this shard, in win-rate points. */
  const strength = new Map<number, number>(
    champions.map((c) => [c.id, normal(rand, 0, 0.022)]),
  );
  /** How contested the champion is, driving pick and ban volume. */
  const popularity = new Map<number, number>(
    champions.map((c) => [c.id, Math.max(0.28, normal(rand, 1, 0.55))]),
  );

  const tallies: ChampionTally[] = [];
  const matchups: MatchupTally[] = [];
  const roleRosters = new Map<Role, number[]>(ROLES.map((r) => [r, []]));

  for (const champion of champions) {
    const weights = roleWeights(champion);
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const pop = popularity.get(champion.id)!;
    // Expected appearances for this champion across the sample.
    const appearances = (matches * 10 * pop) / champions.length;

    const byRole: ChampionTally["byRole"] = {};
    for (const role of ROLES) {
      const share = (weights[role] ?? 0) / totalWeight;
      if (share < MIN_ROLE_SHARE) continue;
      const games = Math.round(appearances * share * (0.75 + rand() * 0.5));
      if (games < MIN_ROLE_GAMES) continue;

      const wr = 0.5 + strength.get(champion.id)! + normal(rand, 0, 0.008);
      byRole[role] = { games, wins: Math.round(games * Math.max(0.35, Math.min(0.65, wr))) };
      roleRosters.get(role)!.push(champion.id);
    }

    const banPressure = Math.max(0, normal(rand, 0, 1) + (pop - 1) * 1.6);
    tallies.push({
      championId: champion.id,
      bans: Math.round(matches * 0.012 * banPressure),
      byRole,
    });
  }

  const strengthOf = (id: number) => strength.get(id) ?? 0;

  for (const tally of tallies) {
    for (const role of ROLES) {
      const own = tally.byRole[role];
      if (!own) continue;

      const opponents = roleRosters
        .get(role)!
        .filter((id) => id !== tally.championId)
        .sort((a, b) => (popularity.get(b) ?? 0) - (popularity.get(a) ?? 0))
        .slice(0, MAX_OPPONENTS);

      for (const opponentId of opponents) {
        const games = Math.round((own.games / opponents.length) * (0.5 + rand() * 1.4));
        if (games < 12) continue;

        // Matchup edge: strength gap plus a stable per-pairing quirk.
        const quirk = normal(mulberry32(hashSeed(`${tally.championId}:${opponentId}:${role}`)), 0, 0.035);
        const wr = 0.5 + (strengthOf(tally.championId) - strengthOf(opponentId)) * 0.9 + quirk;
        matchups.push({
          championId: tally.championId,
          opponentId,
          role,
          games,
          wins: Math.round(games * Math.max(0.28, Math.min(0.72, wr))),
        });
      }
    }
  }

  return {
    meta: {
      platform,
      queue: 420,
      bracket: "emerald_plus",
      patch,
      matches,
      generatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      source: "seed",
    },
    champions: tallies,
    matchups,
  };
}

async function main() {
  const [version, champions] = await Promise.all([getLatestVersion(), getChampions()]);
  const patch = toPatch(version);
  console.log(`Data Dragon ${version} -> patch ${patch}, ${champions.length} champions`);

  for (const { platform, matches } of TARGETS) {
    const snapshot = buildSnapshot(platform, matches, patch, champions);
    const dir = path.join(OUT_ROOT, platform);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${snapshot.meta.queue}-${snapshot.meta.bracket}.json`);
    await writeFile(file, `${JSON.stringify(snapshot)}\n`, "utf8");
    console.log(
      `  ${platform.padEnd(5)} ${snapshot.champions.length} champions, ` +
        `${snapshot.matchups.length} matchups -> ${path.relative(process.cwd(), file)}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
