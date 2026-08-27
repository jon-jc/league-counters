/** Looks for champions ranked highly in roles they barely play. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildRoleRows } from "../../src/lib/data/metrics";
import { ROLES } from "../../src/lib/lol/constants";
import type { Snapshot } from "../../src/lib/data/types";

const file = path.join(process.cwd(), "data", "global", "420-master_plus.json");
const snapshot = JSON.parse(readFileSync(file, "utf8")).snapshot as Snapshot;

console.log(`snapshot: ${snapshot.meta.matches} matches\n`);

for (const role of ROLES) {
  const rows = buildRoleRows(snapshot, role);
  const top = rows.slice(0, 6);
  console.log(`${role}`);
  for (const r of top) {
    console.log(
      `  ${String(r.rank).padStart(2)} id=${String(r.championId).padStart(4)} ${r.tier.padEnd(2)}` +
        ` wr=${(r.winRate * 100).toFixed(1)}%` +
        ` pick=${(r.pickRate * 100).toFixed(2)}%` +
        ` ban=${(r.banRate * 100).toFixed(1)}%` +
        ` presence=${(r.presence * 100).toFixed(1)}%` +
        ` games=${r.games}`,
    );
  }
  console.log("");
}
