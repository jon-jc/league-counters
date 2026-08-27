import Link from "next/link";
import type { Route } from "next";
import { Flame } from "lucide-react";
import { ChampionAvatar } from "@/components/champion/champion-avatar";
import { TierPill } from "@/components/ui/tier-pill";
import type { TierRow } from "@/lib/data/rows";
import { ROLE_LABELS } from "@/lib/lol/constants";
import { formatPercent } from "@/lib/utils";

/**
 * One-click starting points for the counters page.
 *
 * Landing on /counters with nothing chosen used to be a dead end: a dropdown,
 * and nothing to act on until you had already decided who to look up. These are
 * the champions ranked by presence — how often they are picked *or banned* —
 * which is as close as the data gets to "who is a problem right now", and
 * therefore who people are most likely to want countered.
 */
export function ContestedPicks({
  rows,
  regionQuery,
  limit = 12,
}: {
  rows: TierRow[];
  regionQuery: string;
  limit?: number;
}) {
  // A champion can rank in several roles; keep its most contested one.
  const best = new Map<number, TierRow>();
  for (const row of rows) {
    const presence = row.pickRate + row.banRate;
    const existing = best.get(row.championId);
    if (!existing || presence > existing.pickRate + existing.banRate) {
      best.set(row.championId, row);
    }
  }

  const contested = [...best.values()]
    .sort((a, b) => b.pickRate + b.banRate - (a.pickRate + a.banRate))
    .slice(0, limit);

  if (contested.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2.5">
        <Flame className="mt-0.5 size-4 shrink-0 text-accent" />
        <div>
          <h2 className="font-display text-sm font-semibold">Most contested right now</h2>
          <p className="mt-0.5 text-xs text-fg-subtle">
            Picked or banned most often — start here if you are not sure who to look up.
          </p>
        </div>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {contested.map((row) => (
          <li key={`${row.championId}-${row.role}`}>
            <Link
              href={`/counters?${regionQuery}champion=${row.slug}&role=${row.role}` as Route}
              className="group flex items-center gap-3 rounded-card border border-line bg-surface/60 p-2.5 transition-colors hover:border-accent/50 hover:bg-surface-2/60"
            >
              <ChampionAvatar src={row.icon} alt="" size="sm" />
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-sm font-medium group-hover:text-accent"
                  title={row.name}
                >
                  {row.name}
                </span>
                <span className="mt-0.5 block text-[11px] text-fg-subtle">
                  {ROLE_LABELS[row.role]} · {formatPercent(row.pickRate + row.banRate, 1)} presence
                </span>
              </span>
              <TierPill tier={row.tier} size="sm" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
