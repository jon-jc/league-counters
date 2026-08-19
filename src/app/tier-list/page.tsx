import type { Metadata } from "next";
import { ListOrdered } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DataNotice } from "@/components/ui/data-notice";
import { SnapshotFilters } from "@/components/filters/snapshot-filters";
import { TierListView } from "@/components/tier-list/tier-list-view";
import { getChampionIndex } from "@/lib/lol/ddragon";
import {
  availableBrackets,
  availablePlatforms,
  resolveSnapshot,
} from "@/lib/data/repository";
import { buildTierRows } from "@/lib/data/rows";
import { parseSnapshotQuery, type RawSearchParams } from "@/lib/data/query";
import { ROLE_LABELS } from "@/lib/lol/constants";
import { PLATFORMS } from "@/lib/lol/regions";

export const revalidate = 900;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}): Promise<Metadata> {
  const { platform, role } = parseSnapshotQuery(await searchParams);
  const scope = role ? `${ROLE_LABELS[role]} tier list` : "Champion tier list";
  return {
    title: `${scope} — ${PLATFORMS[platform].short}`,
    description: `Live ${scope.toLowerCase()} for ${PLATFORMS[platform].label}, ranked by win rate and presence from aggregated ranked matches.`,
  };
}

export default async function TierListPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseSnapshotQuery(await searchParams);

  const [index, snapshot, platforms] = await Promise.all([
    getChampionIndex(),
    resolveSnapshot(query.platform, query.queue, query.bracket),
    availablePlatforms(),
  ]);
  const brackets = await availableBrackets(query.platform);

  const rows = snapshot ? buildTierRows(snapshot, index, query.role) : [];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Ranked meta"
        title={query.role ? `${ROLE_LABELS[query.role]} tier list` : "Champion tier list"}
        description="Ranked by a blend of win rate and how contested a champion is, computed within each role so lanes stay comparable."
      />

      <SnapshotFilters
        platform={query.platform}
        queue={query.queue}
        bracket={query.bracket}
        role={query.role}
        availablePlatforms={platforms}
        availableBrackets={brackets}
      />

      {snapshot && <DataNotice meta={snapshot.meta} />}

      {rows.length > 0 ? (
        <TierListView rows={rows} showRole={query.role === null} />
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
