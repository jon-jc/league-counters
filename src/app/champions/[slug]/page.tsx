import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { ChampionHero } from "@/components/champion/champion-hero";
import { ChampionRoleTabs } from "@/components/champion/champion-role-tabs";
import { StatTiles } from "@/components/champion/stat-tiles";
import { ChampionBuildPanels } from "@/components/champion/champion-build";
import { CounterList } from "@/components/matchup/counter-list";
import { MatchupTable } from "@/components/matchup/matchup-table";
import { SnapshotFilters } from "@/components/filters/snapshot-filters";
import { DataNotice } from "@/components/ui/data-notice";
import { MetricsLegend } from "@/components/ui/metrics-legend";
import { FallbackNotice } from "@/components/ui/fallback-notice";
import { EmptyState } from "@/components/ui/empty-state";
import {
  championSplashUrl,
  championSquareUrl,
  getChampionIndex,
} from "@/lib/lol/ddragon";
import {
  availableBrackets,
  availablePlatforms,
  resolveSnapshot,
} from "@/lib/data/repository";
import { buildRoleRows, rolesFor } from "@/lib/data/metrics";
import { buildMatchupDisplayRows } from "@/lib/data/rows";
import { buildChampionBuild } from "@/lib/data/builds";
import { parseSnapshotQuery, type RawSearchParams } from "@/lib/data/query";
import { ROLE_LABELS, type Role } from "@/lib/lol/constants";
import { PLATFORMS } from "@/lib/lol/regions";

export const revalidate = 900;


/** Counter lists never show more than this many opponents per side. */
const COUNTER_LIMIT = 6;

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const index = await getChampionIndex();
  return index.all.map((champion) => ({ slug: champion.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const index = await getChampionIndex();
  const champion = index.bySlug.get(slug);
  if (!champion) return { title: "Champion not found" };

  return {
    title: `${champion.name} counters & matchups`,
    description: `Who counters ${champion.name}, who ${champion.name} beats, and how it is performing this patch — win rate, pick rate and every tracked lane matchup.`,
    openGraph: {
      title: `${champion.name} counters & matchups`,
      description: `Lane matchups and current standing for ${champion.name}, ${champion.title}.`,
      images: [{ url: championSplashUrl(champion) }],
    },
  };
}

export default async function ChampionPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<RawSearchParams>;
}) {
  const [{ slug }, rawSearch] = await Promise.all([params, searchParams]);
  const query = parseSnapshotQuery(rawSearch);

  const index = await getChampionIndex();
  const champion = index.bySlug.get(slug);
  if (!champion) notFound();

  const [snapshot, platforms] = await Promise.all([
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

  const tally = snapshot?.champions.find((c) => c.championId === champion.id);
  const playedRoles: Role[] = tally ? rolesFor(tally) : [];
  // Honour ?role= only when the champion is actually played there.
  const activeRole =
    query.role && playedRoles.includes(query.role) ? query.role : (playedRoles[0] ?? null);

  const row =
    snapshot && activeRole
      ? buildRoleRows(snapshot, activeRole).find((r) => r.championId === champion.id)
      : undefined;

  const matchups =
    snapshot && activeRole
      ? buildMatchupDisplayRows(snapshot, index, champion.id, activeRole)
      : [];

  const build =
    snapshot && activeRole
      ? await buildChampionBuild(snapshot, champion.id, activeRole)
      : null;

  /* Split by sign, not by position in the list. Taking the head and tail
     regardless would put a losing matchup under "Strong against" whenever a
     champion has fewer favourable lanes than the limit — which is exactly what
     happened to Jinx, listed as over-performing into a -1.2% matchup. */
  const worst = matchups.filter((row) => row.delta < 0).slice(0, COUNTER_LIMIT);
  const best = matchups
    .filter((row) => row.delta > 0)
    .reverse()
    .slice(0, COUNTER_LIMIT);

  const thinHint =
    "No lane pairing has enough games yet on this snapshot. Matchups need far more volume than rankings, so try a region with a larger sample.";
  const weakHint = matchups.length
    ? "Nothing best this champion by a meaningful margin on this snapshot."
    : thinHint;
  const strongHint = matchups.length
    ? "This champion does not over-perform into anything on this snapshot."
    : thinHint;

  const roleLabel = activeRole ? ROLE_LABELS[activeRole] : "";

  return (
    <>
      <ChampionHero
        champion={champion}
        splash={championSplashUrl(champion)}
        icon={championSquareUrl(champion, index.version)}
      >
        <SnapshotFilters
          platform={shown.platform}
          queue={shown.queue}
          bracket={shown.bracket}
          role={activeRole}
          availablePlatforms={platforms}
          availableBrackets={brackets}
          showRoles={false}
        />
      </ChampionHero>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        {tally && activeRole && (
          <ChampionRoleTabs
            roles={playedRoles.map((role) => ({
              role,
              games: tally.byRole[role]?.games ?? 0,
            }))}
            active={activeRole}
          />
        )}

        <FallbackNotice requested={query} actual={shown} />

        {snapshot && <DataNotice meta={snapshot.meta} />}

        {row && activeRole ? (
          <>
            {/* Counters lead. Someone opening a champion page mid-select wants
                the matchup before the aggregate stat line. */}
            <div className="grid gap-4 lg:grid-cols-2">
              <CounterList
                tone="weak"
                rows={worst}
                role={roleLabel}
                emptyHint={weakHint}
              />
              <CounterList
                tone="strong"
                rows={best}
                role={roleLabel}
                emptyHint={strongHint}
              />
            </div>

            <StatTiles row={row} roleLabel={roleLabel} />

            {build && <ChampionBuildPanels build={build} roleLabel={roleLabel} />}

            <MetricsLegend variant="matchup" />

            {matchups.length > 0 && <MatchupTable rows={matchups} />}
          </>
        ) : (
          <EmptyState
            icon={<BarChart3 className="size-8" />}
            title={`No ranked data for ${champion.name}`}
            description={`${champion.name} has not appeared in enough ${PLATFORMS[shown.platform].label} games in this snapshot to rank. Try a different region or rank bracket.`}
          />
        )}
      </div>
    </>
  );
}
