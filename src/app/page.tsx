import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Globe2, Scale, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataNotice } from "@/components/ui/data-notice";
import { CounterFinder } from "@/components/matchup/counter-finder";
import { RoleHighlights } from "@/components/tier-list/role-highlights";
import { championSquareUrl, getChampionIndex } from "@/lib/lol/ddragon";
import { resolveSnapshot } from "@/lib/data/repository";
import { buildTierRows } from "@/lib/data/rows";
import { DEFAULT_BRACKET, DEFAULT_QUEUE, ROLES } from "@/lib/lol/constants";
import { DEFAULT_REGION, GLOBAL_REGION } from "@/lib/lol/regions";

export const revalidate = 900;

const FEATURES = [
  {
    icon: Swords,
    title: "Counters, not win rates",
    body: "Every lane pairing is scored against the champion's own baseline. A champion that merely holds even still reads as a losing matchup.",
  },
  {
    icon: Scale,
    title: "Sample size in the open",
    body: "Every number carries the games behind it. Thin rows are hidden rather than ranked, so a hot streak never poses as a counter.",
  },
  {
    icon: Globe2,
    title: "Region by region",
    body: "KR, EUW, NA, BR and EUNE are aggregated separately — the meta is not the same everywhere.",
  },
];

export default async function HomePage() {
  const [index, snapshot] = await Promise.all([
    getChampionIndex(),
    // Nobody picked anything on the landing page, so serve the best we have.
    resolveSnapshot(DEFAULT_REGION, DEFAULT_QUEUE, DEFAULT_BRACKET, false),
  ]);

  const pickerChampions = index.all.map((champion) => ({
    slug: champion.slug,
    name: champion.name,
    icon: championSquareUrl(champion, index.version),
  }));

  const highlights = snapshot
    ? ROLES.map((role) => ({
        role,
        rows: buildTierRows(snapshot, index, role).slice(0, 5),
      })).filter((entry) => entry.rows.length > 0)
    : [];

  /* A merged snapshot must link on as the global scope, not the shard that
     happened to seed it. */
  const shownRegion = snapshot
    ? (snapshot.meta.regions ? GLOBAL_REGION : snapshot.meta.platform)
    : null;
  const regionQuery = shownRegion ? `region=${shownRegion}&` : "";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="grid gap-10 py-16 sm:py-20 lg:grid-cols-[1fr_minmax(0,420px)] lg:items-center lg:gap-16">
        <div>
          <Badge variant="accent" className="mb-6">
            <span className="size-1.5 rounded-full bg-accent" />
            Scored from real ranked games
          </Badge>

          <h1 className="max-w-2xl font-display text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
            Know the <span className="text-gradient">counter</span> before you lock in.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted text-pretty">
            Name the champion you are up against. League Counters shows which picks actually
            beat them in lane, how big the edge is, and how many games stand behind it.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/counters"
              className="group inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-canvas transition-transform hover:-translate-y-0.5"
            >
              Find a counter
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/tier-list"
              className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2/60 px-5 py-3 text-sm font-semibold text-fg transition-colors hover:bg-surface-3"
            >
              Browse the tier list
            </Link>
          </div>
        </div>

        {/* The finder is the product. It sits in the hero rather than a page
            deeper, because "who beats this champion" is why anyone is here. */}
        <CounterFinder
          champions={pickerChampions}
          champion={null}
          role={null}
          region={shownRegion ?? undefined}
          size="hero"
        />
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
