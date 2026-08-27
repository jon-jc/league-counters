import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { opggTierListSchema } from "./schema";
import type { OpggTierList } from "./types";

const OPGG_FILE = path.join(process.cwd(), "data", "opgg", "lane-meta.json");

/**
 * Load op.gg's lane meta, or null if it has never been ingested.
 *
 * Returning null rather than throwing keeps the site usable when this source is
 * missing: the tier list falls back to the Riot-sourced ranking, which is a
 * degraded view rather than a broken page.
 */
export const loadOpggTierList = cache(async (): Promise<OpggTierList | null> => {
  let raw: string;
  try {
    raw = await readFile(OPGG_FILE, "utf8");
  } catch {
    return null;
  }

  const parsed = opggTierListSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    console.error("Invalid op.gg lane meta:", parsed.error.issues.slice(0, 3));
    return null;
  }
  return parsed.data as OpggTierList;
});
