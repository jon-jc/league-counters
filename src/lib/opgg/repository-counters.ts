import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { opggCountersSchema } from "./schema";
import type { OpggCounters } from "./types";

const COUNTERS_FILE = path.join(process.cwd(), "data", "opgg", "counters.json");

/**
 * Load op.gg's counter matchups, or null if they have never been ingested.
 *
 * Null rather than a throw, for the same reason as the tier list: a missing
 * source should degrade the page to the other source, not break it.
 */
export const loadOpggCounters = cache(async (): Promise<OpggCounters | null> => {
  let raw: string;
  try {
    raw = await readFile(COUNTERS_FILE, "utf8");
  } catch {
    return null;
  }

  const parsed = opggCountersSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    console.error("Invalid op.gg counters:", parsed.error.issues.slice(0, 3));
    return null;
  }
  return parsed.data as OpggCounters;
});
