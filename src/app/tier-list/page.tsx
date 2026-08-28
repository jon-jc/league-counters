import type { Metadata } from "next";
import { ListOrdered } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DataNotice } from "@/components/ui/data-notice";
import { OpggNotice } from "@/components/ui/opgg-notice";
import { MetricsLegend } from "@/components/ui/metrics-legend";
import { FallbackNotice } from "@/components/ui/fallback-notice";
import { SnapshotFilters } from "@/components/filters/snapshot-filters";
import { SourceToggle } from "@/components/filters/source-toggle";
import { TierListView } from "@/components/tier-list/tier-list-view";
import { getChampionIndex } from "@/lib/lol/ddragon";
import {
  availableBrackets,
  availablePlatforms,
  resolveSnapshot,
} from "@/lib/data/repository";
import { loadOpggTierList } from "@/lib/opgg/repository";
import { buildOpggTierRows } from "@/lib/opgg/rows";
import { buildTierRows } from "@/lib/data/rows";
import { parseSnapshotQuery, type RawSearchParams } from "@/lib/data/query";
import { ROLE_LABELS } from "@/lib/lol/constants";
import { GLOBAL_REGION, regionLabel, regionShort } from "@/lib/lol/regions";

export const revalidate = 900;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}): Promise<Metadata> {
  const { platform, role, source } = parseSnapshotQuery(await searchParams);
  const scope = role ? `${ROLE_LABELS[role]} tier list` : "Champion tier list";

  if (source === "opgg") {
    return {
      title: `${scope} — op.gg meta`,
      description: `Live ${scope.toLowerCase()} sourced from op.gg's lane meta, covering every champion in every lane.`,
    };
  }

  return {
    title: `${scope} — ${regionShort(platform)}`,
    description: `Live ${scope.toLowerCase()} for ${regionLabel(platform)}, ranked by win rate and presence from aggregated ranked matches.`,
  };
}

export default async function TierListPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseSnapshotQuery(await searchParams);

  /* op.gg's lane meta is a single global file with no region or rank
     dimension, so the Riot snapshot is only resolved when it is what will
     actually be rendered. */
  const wantsOpgg = query.source === "opgg";
  const [index, opgg] = await Promise.all([
    getChampionIndex(),
    wantsOpgg ? loadOpggTierList() : Promise.resolve(null),
  ]);

  /* Falling back rather than erroring: if op.gg has never been ingested the
     site still has a tier list to show, which is a degraded view rather than
     a broken page. */
  const usingOpgg = wantsOpgg && opgg !== null;

  if (usingOpgg) {
    const rows = buildOpggTierRows(opgg, index, query.role);

    return (
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Ranked meta"
          title={query.role ? `${ROLE_LABELS[query.role]} tier list` : "Champion tier list"}
          description="op.gg's lane meta, every champion graded in every lane they track."
        />

        <SourceToggle value={query.source} />

        <SnapshotFilters
          platform={query.platform}
          queue={query.queue}
          bracket={query.bracket}
          role={query.role}
          availablePlatforms={[]}
          availableBrackets={[]}
          showScope={false}
        />

        <OpggNotice meta={opgg.meta} />

        {rows.length > 0 ? (
          <>
            <MetricsLegend variant="opgg" />
            {/* op.gg reports pick and ban rate to the whole percent. */}
            <TierListView
              rows={rows}
              showRole={query.role === null}
              rateDigits={{ pick: 0, ban: 0 }}
            />
          </>
        ) : (
          <EmptyState
            icon={<ListOrdered className="size-8" />}
            title="Nothing to rank"
            description="op.gg's lane meta has no champions for this role yet. Try another role, or switch the source above."
          />
        )}
      </div>
    );
  }

  const [snapshot, platforms] = await Promise.all([
    resolveSnapshot(query.platform, query.queue, query.bracket, query.bracketExplicit),
    availablePlatforms(),
  ]);

  /* Drive the controls from the snapshot actually rendered, not from the
     request, so they can never describe data that is not on screen. */
  const shown = snapshot
    ? {
        // A merged snapshot reports the global scope, not its seed shard.
        platform: snapshot.meta.regions ? GLOBAL_REGION : snapshot.meta.platform,
        queue: snapshot.meta.queue,
        bracket: snapshot.meta.bracket,
      }
    : { platform: query.platform, queue: query.queue, bracket: query.bracket };

  const brackets = await availableBrackets(shown.platform);
  const rows = snapshot ? buildTierRows(snapshot, index, query.role) : [];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Ranked meta"
        title={query.role ? `${ROLE_LABELS[query.role]} tier list` : "Champion tier list"}
        description="Ranked by a blend of win rate and how contested a champion is, computed within each role so lanes stay comparable."
      />

      {/* Reflects what is on screen, not what was asked for: a request for
          op.gg that fell back to the Riot ranking must not leave op.gg
          looking selected. */}
      <SourceToggle value="riot" />

      <SnapshotFilters
        platform={shown.platform}
        queue={shown.queue}
        bracket={shown.bracket}
        role={query.role}
        availablePlatforms={platforms}
        availableBrackets={brackets}
      />

      <FallbackNotice requested={query} actual={shown} />

      {snapshot && <DataNotice meta={snapshot.meta} />}

      {rows.length > 0 ? (
        <>
          <MetricsLegend />
          <TierListView rows={rows} showRole={query.role === null} />
        </>
      ) : (
        <EmptyState
          icon={<ListOrdered className="size-8" />}
          title="No snapshot for this selection"
          description="Nothing has been ingested for this region, rank and queue combination yet. Try another region, or check back after the next ingestion run."
        />
      )}
    </div>
  );
}
