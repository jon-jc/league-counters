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

/**
 * "Kai'Sa" -> "kaisa", "Dr. Mundo" -> "dr-mundo", "Nunu & Willump" -> "nunu-willump".
 *
 * Exported because it doubles as the join key for other sources: op.gg reports
 * champions by display name, and normalising both sides the same way is what
 * makes those names line up with Riot's ids without a hand-kept lookup table.
 */
export function championSlug(name: string): string {
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
      slug: championSlug(c.name),
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

/* ---------- Items, runes and summoner spells ---------- */

export interface ItemMeta {
  id: number;
  name: string;
  goldTotal: number;
  tags: string[];
}

export interface ItemCatalogue {
  version: string;
  byId: Map<number, ItemMeta>;
  /** Finished items worth showing as a build. */
  legendary: Set<number>;
  /** Upgraded boots, kept apart so a build shows one pair rather than five. */
  boots: Set<number>;
}

/**
 * Cheap components would swamp any "most built items" list, so the catalogue
 * pre-classifies what counts. Anything under this is a part, not a build.
 */
const LEGENDARY_GOLD_FLOOR = 2000;
/** Boots of Speed costs 300; every upgrade is far above this. */
const BOOTS_GOLD_FLOOR = 900;

let itemCache: ItemCatalogue | null = null;

export async function getItemCatalogue(): Promise<ItemCatalogue> {
  const version = await getLatestVersion();
  if (itemCache?.version === version) return itemCache;

  const payload = await ddragonFetch<{
    data: Record<
      string,
      { name: string; gold: { total: number; purchasable: boolean }; tags?: string[] }
    >;
  }>(`/cdn/${version}/data/en_US/item.json`, 86_400);

  const byId = new Map<number, ItemMeta>();
  const legendary = new Set<number>();
  const boots = new Set<number>();

  for (const [rawId, item] of Object.entries(payload.data)) {
    const id = Number(rawId);
    const tags = item.tags ?? [];
    byId.set(id, { id, name: item.name, goldTotal: item.gold.total, tags });

    if (!item.gold.purchasable) continue;
    if (tags.includes("Consumable") || tags.includes("Trinket")) continue;

    if (tags.includes("Boots")) {
      if (item.gold.total >= BOOTS_GOLD_FLOOR) boots.add(id);
    } else if (item.gold.total >= LEGENDARY_GOLD_FLOOR) {
      legendary.add(id);
    }
  }

  itemCache = { version, byId, legendary, boots };
  return itemCache;
}

export function itemIconUrl(itemId: number, version: string): string {
  return `${DDRAGON}/cdn/${version}/img/item/${itemId}.png`;
}

export interface RuneMeta {
  id: number;
  name: string;
  icon: string;
}

export interface RuneCatalogue {
  /** Keystones and every lesser rune, by perk id. */
  runes: Map<number, RuneMeta>;
  /** Rune trees, by style id. */
  styles: Map<number, RuneMeta>;
}

let runeCache: { version: string; catalogue: RuneCatalogue } | null = null;

export async function getRuneCatalogue(): Promise<RuneCatalogue> {
  const version = await getLatestVersion();
  if (runeCache?.version === version) return runeCache.catalogue;

  const payload = await ddragonFetch<
    {
      id: number;
      name: string;
      icon: string;
      slots: { runes: { id: number; name: string; icon: string }[] }[];
    }[]
  >(`/cdn/${version}/data/en_US/runesReforged.json`, 86_400);

  const runes = new Map<number, RuneMeta>();
  const styles = new Map<number, RuneMeta>();

  for (const style of payload) {
    styles.set(style.id, { id: style.id, name: style.name, icon: style.icon });
    for (const slot of style.slots) {
      for (const rune of slot.runes) {
        runes.set(rune.id, { id: rune.id, name: rune.name, icon: rune.icon });
      }
    }
  }

  const catalogue = { runes, styles };
  runeCache = { version, catalogue };
  return catalogue;
}

/** Rune art lives at a version-less path, unlike everything else. */
export function runeIconUrl(icon: string): string {
  return `${DDRAGON}/cdn/img/${icon}`;
}

export interface SpellMeta {
  key: number;
  name: string;
  image: string;
}

let spellCache: { version: string; spells: Map<number, SpellMeta> } | null = null;

export async function getSummonerSpells(): Promise<Map<number, SpellMeta>> {
  const version = await getLatestVersion();
  if (spellCache?.version === version) return spellCache.spells;

  const payload = await ddragonFetch<{
    data: Record<string, { key: string; name: string; image: { full: string } }>;
  }>(`/cdn/${version}/data/en_US/summoner.json`, 86_400);

  const spells = new Map<number, SpellMeta>();
  for (const spell of Object.values(payload.data)) {
    spells.set(Number(spell.key), {
      key: Number(spell.key),
      name: spell.name,
      image: spell.image.full,
    });
  }

  spellCache = { version, spells };
  return spells;
}

export function spellIconUrl(image: string, version: string): string {
  return `${DDRAGON}/cdn/${version}/img/spell/${image}`;
}
