import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DataNotice } from "@/components/ui/data-notice";
import { SnapshotFilters } from "@/components/filters/snapshot-filters";
import { FallbackNotice } from "@/components/ui/fallback-notice";
import { ChampionGrid, type ChampionGridItem } from "@/components/champion/champion-grid";
import { championSquareUrl, getChampionIndex } from "@/lib/lol/ddragon";
import { availableBrackets, availablePlatforms, resolveSnapshot } from "@/lib/data/repository";
import { buildRoleRows, primaryRole } from "@/lib/data/metrics";
import { parseSnapshotQuery, type RawSearchParams } from "@/lib/data/query";
import { ROLES } from "@/lib/lol/constants";

export const metadata: Metadata = {
  title: "Champions",
  description:
    "Every League of Legends champion with their current role, win rate and tier for the live patch.",
};

/** Data Dragon and snapshots both change on a patch cadence, not per request. */
export const revalidate = 900;

export default async function ChampionsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseSnapshotQuery(await searchParams);
  const [index, snapshot, platforms] = await Promise.all([
    getChampionIndex(),
    resolveSnapshot(query.platform, query.queue, query.bracket, query.bracketExplicit),
    availablePlatforms(),
  ]);

  // Controls describe the snapshot on screen, not the one that was requested.
  const shown = snapshot
    ? {
        platform: snapshot.meta.platform,
        queue: snapshot.meta.queue,
        bracket: snapshot.meta.bracket,
      }
    : { platform: query.platform, queue: query.queue, bracket: query.bracket };
  const brackets = await availableBrackets(shown.platform);

  // Rank once per role, then look each champion up in its own primary role.
  const rankings = new Map<number, { winRate: number; tier: ChampionGridItem["tier"] }>();
  if (snapshot) {
    for (const role of ROLES) {
      for (const row of buildRoleRows(snapshot, role)) {
        const tally = snapshot.champions.find((c) => c.championId === row.championId);
        if (tally && primaryRole(tally) === role) {
          rankings.set(row.championId, { winRate: row.winRate, tier: row.tier });
        }
      }
    }
  }

  const champions: ChampionGridItem[] = index.all.map((champion) => {
    const tally = snapshot?.champions.find((c) => c.championId === champion.id);
    const ranked = rankings.get(champion.id);
    return {
      id: champion.id,
      slug: champion.slug,
      name: champion.name,
      title: champion.title,
      tags: champion.tags,
      icon: championSquareUrl(champion, index.version),
      role: tally ? primaryRole(tally) : null,
      winRate: ranked?.winRate ?? null,
      tier: ranked?.tier ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Roster"
        title="Champions"
        description={`All ${champions.length} champions, with the role each is most played in and how it is performing on the live patch.`}
      />

      <SnapshotFilters
        platform={shown.platform}
        queue={shown.queue}
        bracket={shown.bracket}
        role={query.role}
        availablePlatforms={platforms}
        availableBrackets={brackets}
        showRoles={false}
      />

      {snapshot ? (
        <>
          <FallbackNotice
            requested={query}
            actual={{ platform: snapshot.meta.platform, bracket: snapshot.meta.bracket }}
          />
          <DataNotice meta={snapshot.meta} />
          <ChampionGrid champions={champions} />
        </>
      ) : champions.length > 0 ? (
        <ChampionGrid champions={champions} />
      ) : (
        <EmptyState
          icon={<Users className="size-8" />}
          title="Roster unavailable"
          description="Champion metadata could not be loaded from Riot's Data Dragon CDN. Try again shortly."
        />
      )}
    </div>
  );
}
