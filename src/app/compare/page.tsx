import type { Metadata } from "next";
import { Swords } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DataNotice } from "@/components/ui/data-notice";
import { FallbackNotice } from "@/components/ui/fallback-notice";
import { SnapshotFilters } from "@/components/filters/snapshot-filters";
import { CompareControls } from "@/components/compare/compare-controls";
import { HeadToHead, type CompareSide } from "@/components/compare/head-to-head";
import { championSquareUrl, getChampionIndex, type Champion } from "@/lib/lol/ddragon";
import {
  availableBrackets,
  availablePlatforms,
  resolveSnapshot,
} from "@/lib/data/repository";
import { buildRoleRows, rolesFor } from "@/lib/data/metrics";
import { buildMatchupDisplayRows } from "@/lib/data/rows";
import { parseSnapshotQuery, type RawSearchParams } from "@/lib/data/query";
import { ROLE_LABELS, type Role } from "@/lib/lol/constants";
import type { Snapshot } from "@/lib/data/types";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Compare champions",
  description:
    "Put two League of Legends champions head to head and see who is favoured in lane, scored against each champion's own baseline.",
};

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ?? null;
}

/** Build one side of the comparison from whatever the snapshot knows. */
function toSide(
  champion: Champion,
  snapshot: Snapshot | null,
  role: Role | null,
): CompareSide {
  const base: CompareSide = {
    slug: champion.slug,
    name: champion.name,
    icon: "",
    tier: null,
    rank: null,
    winRate: null,
    games: null,
  };
  if (!snapshot || !role) return base;

  const row = buildRoleRows(snapshot, role).find((r) => r.championId === champion.id);
  if (!row) return base;

  return {
    ...base,
    tier: row.tier,
    rank: row.rank,
    winRate: row.winRate,
    games: row.games,
  };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const query = parseSnapshotQuery(raw);
  const slugA = first(raw.a);
  const slugB = first(raw.b);

  const index = await getChampionIndex();
  const [snapshot, platforms] = await Promise.all([
    resolveSnapshot(query.platform, query.queue, query.bracket),
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

  const championA = slugA ? (index.bySlug.get(slugA) ?? null) : null;
  const championB = slugB ? (index.bySlug.get(slugB) ?? null) : null;

  const pickerChampions = index.all.map((champion) => ({
    slug: champion.slug,
    name: champion.name,
    icon: championSquareUrl(champion, index.version),
  }));

  /* Default to a lane both champions actually play, so the comparison is not
     silently scored in a role neither of them appears in. */
  const tallyA = snapshot && championA
    ? snapshot.champions.find((c) => c.championId === championA.id)
    : undefined;
  const tallyB = snapshot && championB
    ? snapshot.champions.find((c) => c.championId === championB.id)
    : undefined;

  const rolesA = tallyA ? rolesFor(tallyA) : [];
  const rolesB = tallyB ? rolesFor(tallyB) : [];
  const shared = rolesA.filter((role) => rolesB.includes(role));

  const role: Role | null =
    query.role && (shared.includes(query.role) || shared.length === 0)
      ? query.role
      : (shared[0] ?? rolesA[0] ?? rolesB[0] ?? null);

  const matchup =
    snapshot && championA && championB && role
      ? (buildMatchupDisplayRows(snapshot, index, championA.id, role).find(
          (row) => row.opponentId === championB.id,
        ) ?? null)
      : null;

  const ready = championA && championB && role;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Head to head"
        title="Compare champions"
        description="Pick two champions and a lane. The verdict is scored against each champion's own baseline, so a strong champion having a merely average game still reads as a losing matchup."
      />

      <SnapshotFilters
        platform={shown.platform}
        queue={shown.queue}
        bracket={shown.bracket}
        role={role}
        availablePlatforms={platforms}
        availableBrackets={brackets}
        showRoles={false}
      />

      <CompareControls champions={pickerChampions} a={slugA} b={slugB} role={role} />

      <FallbackNotice requested={query} actual={shown} />

      {snapshot && <DataNotice meta={snapshot.meta} />}

      {ready ? (
        <HeadToHead
          left={{
            ...toSide(championA, snapshot, role),
            icon: championSquareUrl(championA, index.version),
          }}
          right={{
            ...toSide(championB, snapshot, role),
            icon: championSquareUrl(championB, index.version),
          }}
          roleLabel={ROLE_LABELS[role]}
          matchup={
            matchup
              ? {
                  games: matchup.games,
                  winRate: matchup.winRate,
                  delta: matchup.delta,
                  confidence: matchup.confidence,
                }
              : null
          }
        />
      ) : (
        <EmptyState
          icon={<Swords className="size-8" />}
          title="Pick two champions"
          description="Choose a champion and an opponent above to see who is favoured in lane, how large the edge is, and how many games back it up."
        />
      )}
    </div>
  );
}
