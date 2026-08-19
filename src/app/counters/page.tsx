import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Swords } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DataNotice } from "@/components/ui/data-notice";
import { FallbackNotice } from "@/components/ui/fallback-notice";
import { MetricsLegend } from "@/components/ui/metrics-legend";
import { SnapshotFilters } from "@/components/filters/snapshot-filters";
import { CounterFinder } from "@/components/matchup/counter-finder";
import { CounterList } from "@/components/matchup/counter-list";
import { MatchupTable } from "@/components/matchup/matchup-table";
import { ChampionAvatar } from "@/components/champion/champion-avatar";
import { ChampionRoleTabs } from "@/components/champion/champion-role-tabs";
import { championSquareUrl, getChampionIndex } from "@/lib/lol/ddragon";
import { availableBrackets, availablePlatforms, resolveSnapshot } from "@/lib/data/repository";
import { rolesFor } from "@/lib/data/metrics";
import { buildMatchupDisplayRows } from "@/lib/data/rows";
import { parseSnapshotQuery, type RawSearchParams } from "@/lib/data/query";
import { ROLE_LABELS, type Role } from "@/lib/lol/constants";
import { PLATFORMS } from "@/lib/lol/regions";

export const revalidate = 900;

/** How many opponents each side of the spread shows. */
const COUNTER_LIMIT = 8;

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ?? null;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}): Promise<Metadata> {
  const raw = await searchParams;
  const slug = first(raw.champion);
  if (!slug) {
    return {
      title: "Champion counters",
      description:
        "Find who counters any League of Legends champion, scored from real ranked games by win-rate delta against the champion's own baseline.",
    };
  }

  const index = await getChampionIndex();
  const champion = index.bySlug.get(slug);
  if (!champion) return { title: "Champion counters" };

  return {
    title: `Who counters ${champion.name}?`,
    description: `The champions that beat ${champion.name} in lane, and the ones ${champion.name} beats, from real ranked games.`,
  };
}

export default async function CountersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const query = parseSnapshotQuery(raw);
  const slug = first(raw.champion);

  const index = await getChampionIndex();
  const [snapshot, platforms] = await Promise.all([
    resolveSnapshot(query.platform, query.queue, query.bracket, query.bracketExplicit),
    availablePlatforms(),
  ]);

  const shown = snapshot
    ? {
        platform: snapshot.meta.platform,
        queue: snapshot.meta.queue,
        bracket: snapshot.meta.bracket,
      }
    : { platform: query.platform, queue: query.queue, bracket: query.bracket };
  const brackets = await availableBrackets(shown.platform);

  const pickerChampions = index.all.map((c) => ({
    slug: c.slug,
    name: c.name,
    icon: championSquareUrl(c, index.version),
  }));

  const champion = slug ? (index.bySlug.get(slug) ?? null) : null;
  const tally =
    snapshot && champion
      ? snapshot.champions.find((c) => c.championId === champion.id)
      : undefined;
  const playedRoles: Role[] = tally ? rolesFor(tally) : [];
  const activeRole =
    query.role && playedRoles.includes(query.role) ? query.role : (playedRoles[0] ?? null);

  const matchups =
    snapshot && champion && activeRole
      ? buildMatchupDisplayRows(snapshot, index, champion.id, activeRole)
      : [];

  /* Split by sign, not by position in the list. Taking the head and tail
     regardless would put a losing matchup under "Strong against" whenever a
     champion has fewer favourable lanes than the limit — which is exactly what
     happened to Jinx, listed as over-performing into a -1.2% matchup. */
  const beatenBy = matchups.filter((row) => row.delta < 0).slice(0, COUNTER_LIMIT);
  const beats = matchups
    .filter((row) => row.delta > 0)
    .reverse()
    .slice(0, COUNTER_LIMIT);

  const thinHint =
    "No lane pairing has enough games yet on this snapshot. Matchups need far more volume than rankings, so try a region with a larger sample.";
  const weakHint = matchups.length
    ? "Nothing beats this champion by a meaningful margin on this snapshot."
    : thinHint;
  const strongHint = matchups.length
    ? "This champion does not over-perform into anything on this snapshot."
    : thinHint;
  const roleLabel = activeRole ? ROLE_LABELS[activeRole] : "";

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Counter picks"
        title={champion ? `Who counters ${champion.name}?` : "Find a counter pick"}
        description={
          champion
            ? `Every opponent scored against ${champion.name}'s own win rate in the role, so a champion that merely holds even still shows as a losing lane.`
            : "Pick the champion you are up against. Every matchup is scored by win-rate delta against that champion's own baseline, not by raw win rate."
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-start">
        <div className="space-y-4">
          <CounterFinder
            champions={pickerChampions}
            champion={slug}
            role={activeRole}
            region={shown.platform}
            size="hero"
          />
          <SnapshotFilters
            platform={shown.platform}
            queue={shown.queue}
            bracket={shown.bracket}
            role={activeRole}
            availablePlatforms={platforms}
            availableBrackets={brackets}
            showRoles={false}
          />
        </div>

        <div className="space-y-4">
          <FallbackNotice requested={query} actual={shown} />
          {snapshot && <DataNotice meta={snapshot.meta} />}

          {!champion ? (
            <EmptyState
              icon={<Swords className="size-8" />}
              title="Pick a champion to counter"
              description="Choose the champion you are laning against and this page will show which picks beat them, which they beat, and how many games back each one."
            />
          ) : !activeRole || matchups.length === 0 ? (
            <EmptyState
              icon={<Swords className="size-8" />}
              title={`No matchup data for ${champion.name} yet`}
              description={`${champion.name} has not appeared in enough ${PLATFORMS[shown.platform].label} games on this snapshot to score its lanes. Try another region.`}
            />
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-card border border-line bg-surface/60 px-4 py-3">
                <ChampionAvatar
                  src={championSquareUrl(champion, index.version)}
                  alt=""
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold">{champion.name}</p>
                  <p className="text-xs text-fg-subtle">
                    {roleLabel} · {matchups.length} scored matchups
                  </p>
                </div>
                <Link
                  href={`/champions/${champion.slug}?role=${activeRole}` as Route}
                  className="inline-flex shrink-0 items-center gap-1 text-xs text-accent hover:underline"
                >
                  Full profile
                  <ArrowRight className="size-3" />
                </Link>
              </div>

              {tally && playedRoles.length > 1 && (
                <ChampionRoleTabs
                  roles={playedRoles.map((r) => ({
                    role: r,
                    games: tally.byRole[r]?.games ?? 0,
                  }))}
                  active={activeRole}
                />
              )}

              <div className="grid gap-4 xl:grid-cols-2">
                <CounterList tone="weak" rows={beatenBy} role={roleLabel} emptyHint={weakHint} />
                <CounterList tone="strong" rows={beats} role={roleLabel} emptyHint={strongHint} />
              </div>

              <MetricsLegend variant="matchup" />
              <MatchupTable rows={matchups} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
