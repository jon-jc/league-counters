import Link from "next/link";
import type { Route } from "next";
import { Target } from "lucide-react";
import { ChampionAvatar } from "@/components/champion/champion-avatar";
import { ConfidenceDot } from "@/components/ui/confidence-dot";
import { TierPill } from "@/components/ui/tier-pill";
import type { MatchupDisplayRow } from "@/lib/data/rows";
import type { TierGrade } from "@/lib/data/metrics";
import { cn, formatCompact, formatPercent } from "@/lib/utils";

/**
 * Answers the question the rest of the page only supplies evidence for: given
 * this opponent, what should I actually pick?
 *
 * "Who beats this champion" is not the same as "what should I lock in". A
 * champion can punish the matchup badly and still be a poor pick — weak
 * overall, or barely played. So a recommendation has to clear three bars at
 * once: it beats them by a margin that is not noise, it is strong enough in
 * its own right to be worth picking, and there are enough games behind the
 * pairing to believe it.
 *
 * Anything that clears all three is worth surfacing. Anything that does not
 * still appears in the lists below, without being called a recommendation.
 */

/** How far the opponent must under-perform before the edge counts as real. */
const MIN_EDGE = 0.01;
/** Tiers considered worth picking on their own merit. */
const STRONG: TierGrade[] = ["S+", "S", "A"];
/** Below this the pairing is too thin to recommend, whatever the delta says. */
const MIN_GAMES = 15;

export function BestCounterPicks({
  rows,
  championName,
  roleLabel,
  limit = 3,
}: {
  /** Matchups from the *opponent's* perspective; a negative delta means they lose. */
  rows: MatchupDisplayRow[];
  championName: string;
  roleLabel: string;
  limit?: number;
}) {
  const picks = rows
    .filter(
      (row) =>
        row.delta <= -MIN_EDGE &&
        row.games >= MIN_GAMES &&
        row.tier !== null &&
        STRONG.includes(row.tier),
    )
    .sort((a, b) => a.delta - b.delta)
    .slice(0, limit);

  if (picks.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2.5">
        <Target className="mt-0.5 size-4 shrink-0 text-accent" />
        <div>
          <h2 className="font-display text-sm font-semibold">
            Best picks into {championName}
          </h2>
          <p className="mt-0.5 text-xs text-fg-subtle">
            Beat {championName} by a real margin in {roleLabel}, and are strong
            enough to be worth picking anyway.
          </p>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {picks.map((pick, index) => (
          <li key={pick.opponentId}>
            <Link
              href={`/champions/${pick.slug}?role=${pick.role}` as Route}
              className={cn(
                "group flex h-full flex-col gap-3 rounded-card border bg-surface/60 p-4 transition-colors",
                index === 0
                  ? "border-accent/40 hover:border-accent/70"
                  : "border-line hover:border-line-strong",
              )}
            >
              <div className="flex items-center gap-3">
                <ChampionAvatar src={pick.icon} alt="" size="lg" />
                <div className="min-w-0">
                  <p
                    className="truncate font-display text-base font-semibold group-hover:text-accent"
                    title={pick.name}
                  >
                    {pick.name}
                  </p>
                  <p className="mt-1">
                    {pick.tier && <TierPill tier={pick.tier} size="sm" />}
                  </p>
                </div>
              </div>

              <div className="mt-auto flex items-baseline justify-between">
                <span className="text-xs text-fg-subtle">
                  {championName} wins{" "}
                  <span className="font-semibold tabular text-bad">
                    {formatPercent(Math.abs(pick.delta), 1)}
                  </span>{" "}
                  less
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] tabular text-fg-subtle">
                  <ConfidenceDot level={pick.confidence} />
                  {formatCompact(pick.games)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
