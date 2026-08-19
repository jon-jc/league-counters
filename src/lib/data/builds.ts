import {
  getItemCatalogue,
  getRuneCatalogue,
  getSummonerSpells,
  itemIconUrl,
  runeIconUrl,
  spellIconUrl,
} from "@/lib/lol/ddragon";
import type { Role } from "@/lib/lol/constants";
import { confidenceFor, rawWinRate, type Confidence } from "./metrics";
import type { BuildTally, OptionCount, Snapshot } from "./types";

/**
 * Games a single option needs before it is shown at all.
 *
 * One player's off-meta experiment should not appear next to a champion's
 * actual build, and at these sample sizes anything thinner is exactly that.
 */
const MIN_OPTION_GAMES = 5;

/** Below this the whole build section is withheld rather than shown as noise. */
export const MIN_BUILD_GAMES = 20;

export interface BuildOption {
  id: string;
  name: string;
  icon: string;
  games: number;
  winRate: number;
  /** Share of this champion's builds that included the option. */
  pickRate: number;
  confidence: Confidence;
}

export interface SpellPairOption extends Omit<BuildOption, "icon"> {
  spells: { name: string; icon: string }[];
}

export interface ChampionBuild {
  games: number;
  items: BuildOption[];
  boots: BuildOption[];
  keystones: BuildOption[];
  secondaryStyles: BuildOption[];
  spells: SpellPairOption[];
}

function toOptions(
  counts: Record<string, OptionCount>,
  total: number,
  resolve: (id: string) => { name: string; icon: string } | null,
  limit: number,
): BuildOption[] {
  return Object.entries(counts)
    .filter(([, count]) => count.games >= MIN_OPTION_GAMES)
    .sort((a, b) => b[1].games - a[1].games)
    .slice(0, limit)
    .flatMap(([id, count]) => {
      const meta = resolve(id);
      // An id Data Dragon no longer knows about — a removed item, usually.
      if (!meta) return [];
      return [
        {
          id,
          name: meta.name,
          icon: meta.icon,
          games: count.games,
          winRate: rawWinRate(count.wins, count.games),
          pickRate: total > 0 ? count.games / total : 0,
          confidence: confidenceFor(count.games),
        },
      ];
    });
}

/**
 * Turn the stored counts into something renderable, resolving every id against
 * Data Dragon. Returns null when the champion has too few games in the role for
 * a build to mean anything.
 */
export async function buildChampionBuild(
  snapshot: Snapshot,
  championId: number,
  role: Role,
): Promise<ChampionBuild | null> {
  const tally: BuildTally | undefined = snapshot.builds?.find(
    (build) => build.championId === championId && build.role === role,
  );
  if (!tally || tally.games < MIN_BUILD_GAMES) return null;

  const [itemCatalogue, runeCatalogue, spellCatalogue] = await Promise.all([
    getItemCatalogue(),
    getRuneCatalogue(),
    getSummonerSpells(),
  ]);
  const version = itemCatalogue.version;

  const resolveItem = (id: string) => {
    const meta = itemCatalogue.byId.get(Number(id));
    return meta ? { name: meta.name, icon: itemIconUrl(meta.id, version) } : null;
  };
  const resolveRune = (id: string) => {
    const meta = runeCatalogue.runes.get(Number(id));
    return meta ? { name: meta.name, icon: runeIconUrl(meta.icon) } : null;
  };
  const resolveStyle = (id: string) => {
    const meta = runeCatalogue.styles.get(Number(id));
    return meta ? { name: meta.name, icon: runeIconUrl(meta.icon) } : null;
  };

  const spells: SpellPairOption[] = Object.entries(tally.spells)
    .filter(([, count]) => count.games >= MIN_OPTION_GAMES)
    .sort((a, b) => b[1].games - a[1].games)
    .slice(0, 3)
    .flatMap(([pair, count]) => {
      const resolved = pair.split("-").map((id) => spellCatalogue.get(Number(id)));
      if (resolved.some((spell) => !spell)) return [];
      return [
        {
          id: pair,
          name: resolved.map((spell) => spell!.name).join(" + "),
          spells: resolved.map((spell) => ({
            name: spell!.name,
            icon: spellIconUrl(spell!.image, version),
          })),
          games: count.games,
          winRate: rawWinRate(count.wins, count.games),
          pickRate: tally.games > 0 ? count.games / tally.games : 0,
          confidence: confidenceFor(count.games),
        },
      ];
    });

  return {
    games: tally.games,
    items: toOptions(tally.items, tally.games, resolveItem, 8),
    boots: toOptions(tally.boots, tally.games, resolveItem, 3),
    keystones: toOptions(tally.keystones, tally.games, resolveRune, 4),
    secondaryStyles: toOptions(tally.secondaryStyles, tally.games, resolveStyle, 3),
    spells,
  };
}
