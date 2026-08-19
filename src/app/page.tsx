import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Globe2, Swords, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataNotice } from "@/components/ui/data-notice";
import { RoleHighlights } from "@/components/tier-list/role-highlights";
import { getChampionIndex } from "@/lib/lol/ddragon";
import { resolveSnapshot } from "@/lib/data/repository";
import { buildTierRows } from "@/lib/data/rows";
import { DEFAULT_BRACKET, DEFAULT_QUEUE, ROLES } from "@/lib/lol/constants";
import { DEFAULT_PLATFORM } from "@/lib/lol/regions";

export const revalidate = 900;

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Tier list that moves",
    body: "Win rate, pick rate and ban rate per role, recomputed from ranked matches as each patch settles.",
  },
  {
    icon: Swords,
    title: "Matchup-level counters",
    body: "Every lane pairing scored by win-rate delta against the champion's own baseline, not raw win rate.",
  },
  {
    icon: Globe2,
    title: "Region by region",
    body: "KR, EUW, NA and the rest are aggregated separately — the meta is not the same everywhere.",
  },
];

export default async function HomePage() {
  const [index, snapshot] = await Promise.all([
    getChampionIndex(),
    // Nobody picked anything on the landing page, so serve the best we have.
    resolveSnapshot(DEFAULT_PLATFORM, DEFAULT_QUEUE, DEFAULT_BRACKET, false),
  ]);

  const highlights = snapshot
    ? ROLES.map((role) => ({
        role,
        rows: buildTierRows(snapshot, index, role).slice(0, 5),
      })).filter((entry) => entry.rows.length > 0)
    : [];

  const regionQuery = snapshot ? `region=${snapshot.meta.platform}&` : "";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="relative py-20 sm:py-28">
        <Badge variant="accent" className="mb-6">
          <span className="size-1.5 rounded-full bg-accent" />
          Aggregated from ranked match data
        </Badge>

        <h1 className="max-w-4xl font-display text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
          Know the <span className="text-gradient">counter</span> before you lock in.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-fg-muted text-pretty">
          League Counters turns raw ranked matches into a tier list and a matchup table you can
          actually act on in champion select — split by region, rank and role.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            href="/tier-list"
            className="group inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-canvas transition-transform hover:-translate-y-0.5"
          >
            Open the tier list
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/champions"
            className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2/60 px-5 py-3 text-sm font-semibold text-fg transition-colors hover:bg-surface-3"
          >
            Browse champions
          </Link>
        </div>
      </section>

      {highlights.length > 0 && snapshot && (
        <section className="space-y-4 pb-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Strongest right now
              </h2>
              <p className="mt-1 text-sm text-fg-muted">
                Top five per role on patch {snapshot.meta.patch}.
              </p>
            </div>
            <Link
              href={`/tier-list?${regionQuery}` as Route}
              className="text-sm text-accent hover:underline"
            >
              Full tier list →
            </Link>
          </div>

          <DataNotice meta={snapshot.meta} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {highlights.map(({ role, rows }) => (
              <RoleHighlights key={role} role={role} rows={rows} regionQuery={regionQuery} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 pb-8 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-card border border-line bg-surface/60 p-6 transition-colors hover:border-line-strong"
          >
            <Icon className="size-5 text-accent" />
            <h2 className="mt-4 font-display text-base font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
