/** Flags champions missing from the curated lane map, and map keys Riot doesn't know. */
import { getChampions } from "../../src/lib/lol/ddragon";
import { CHAMPION_LANES } from "../lib/champion-roles";

const champions = await getChampions();
const ids = new Set(champions.map((c) => c.ddragonId));
const keys = Object.keys(CHAMPION_LANES);

const unmapped = champions.filter((c) => !(c.ddragonId in CHAMPION_LANES));
const unknown = keys.filter((k) => !ids.has(k));

console.log(`champions: ${champions.length}, mapped: ${keys.length}`);
console.log(`unmapped (fall back to tags): ${unmapped.map((c) => `${c.ddragonId} (${c.name})`).join(", ") || "none"}`);
console.log(`unknown map keys (typos): ${unknown.join(", ") || "none"}`);
