/** How many champions ended up with no role data at all in each snapshot. */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "data", "snapshots");
for (const platform of readdirSync(root)) {
  for (const file of readdirSync(path.join(root, platform))) {
    const snap = JSON.parse(readFileSync(path.join(root, platform, file), "utf8"));
    const empty = snap.champions.filter(
      (c: { byRole: Record<string, unknown> }) => Object.keys(c.byRole).length === 0,
    );
    console.log(
      `${platform.padEnd(5)} champions=${snap.champions.length} withoutRole=${empty.length} matchups=${snap.matchups.length}`,
    );
  }
}
