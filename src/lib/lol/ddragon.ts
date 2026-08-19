const DDRAGON = "https://ddragon.leagueoflegends.com";

/** Static champion metadata, normalised out of Data Dragon's raw shape. */
export interface Champion {
  /** Numeric championId used by match-v5 (e.g. 266). */
  id: number;
  /** Data Dragon string id used for asset paths (e.g. "MonkeyKing"). */
  ddragonId: string;
  /** URL segment derived from the display name (e.g. "wukong"). */
  slug: string;
  name: string;
  title: string;
  /** Riot's class tags, e.g. ["Fighter", "Tank"]. */
  tags: string[];
  /** Resource bar: "Mana", "Energy", "None"... */
  partype: string;
  difficulty: number;
}

interface DDragonChampion {
  key: string;
  id: string;
  name: string;
  title: string;
  tags: string[];
  partype: string;
  info: { difficulty: number };
}

/** "Kai'Sa" -> "kaisa", "Dr. Mundo" -> "dr-mundo", "Nunu & Willump" -> "nunu-willump". */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ddragonFetch<T>(path: string, revalidate: number): Promise<T> {
  const res = await fetch(`${DDRAGON}${path}`, { next: { revalidate } });
  if (!res.ok) {
    throw new Error(`Data Dragon ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/** Newest Data Dragon build, e.g. "16.16.1". Cached for an hour. */
export async function getLatestVersion(): Promise<string> {
  const versions = await ddragonFetch<string[]>("/api/versions.json", 3600);
  const latest = versions[0];
  if (!latest) throw new Error("Data Dragon returned no versions");
  return latest;
}

let championCache: { version: string; champions: Champion[] } | null = null;

/** Every champion, sorted by name. Memoised per process, revalidated hourly. */
export async function getChampions(): Promise<Champion[]> {
  const version = await getLatestVersion();
  if (championCache?.version === version) return championCache.champions;

  const payload = await ddragonFetch<{ data: Record<string, DDragonChampion> }>(
    `/cdn/${version}/data/en_US/champion.json`,
    3600,
  );

  const champions = Object.values(payload.data)
    .map<Champion>((c) => ({
      id: Number(c.key),
      ddragonId: c.id,
      slug: slugify(c.name),
      name: c.name,
      title: c.title,
      tags: c.tags ?? [],
      partype: c.partype,
      difficulty: c.info?.difficulty ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  championCache = { version, champions };
  return champions;
}

export interface ChampionIndex {
  version: string;
  all: Champion[];
  byId: Map<number, Champion>;
  bySlug: Map<string, Champion>;
}

/** Champion lookup tables — the shape every page actually wants. */
export async function getChampionIndex(): Promise<ChampionIndex> {
  const [version, all] = await Promise.all([getLatestVersion(), getChampions()]);
  return {
    version,
    all,
    byId: new Map(all.map((c) => [c.id, c])),
    bySlug: new Map(all.map((c) => [c.slug, c])),
  };
}

/* ---------- Asset URLs ---------- */

export function championSquareUrl(champion: Champion, version: string): string {
  return `${DDRAGON}/cdn/${version}/img/champion/${champion.ddragonId}.png`;
}

/** Wide key art (1215x717) — used as the champion page banner. */
export function championSplashUrl(champion: Champion, skin = 0): string {
  return `${DDRAGON}/cdn/img/champion/splash/${champion.ddragonId}_${skin}.jpg`;
}
