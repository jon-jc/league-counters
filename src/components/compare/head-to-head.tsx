import Link from "next/link";
import type { Route } from "next";
import { ChampionAvatar } from "@/components/champion/champion-avatar";
import { ConfidenceDot } from "@/components/ui/confidence-dot";
import { TierPill } from "@/components/ui/tier-pill";
import type { Confidence, TierGrade } from "@/lib/data/metrics";
import { cn, formatCompact, formatPercent } from "@/lib/utils";

export interface CompareSide {
  slug: string;
  name: string;
  icon: string;
  tier: TierGrade | null;
  rank: number | null;
  winRate: number | null;
  games: number | null;
}

export function HeadToHead({
  left,
  right,
  roleLabel,
  matchup,
}: {
  left: CompareSide;
  right: CompareSide;
  roleLabel: string;
  matchup: {
    games: number;
    winRate: number;
    delta: number;
    confidence: Confidence;
  } | null;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface/60">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 p-6">
        <SidePanel side={left} align="right" />
        <div className="flex flex-col items-center gap-1">
          <span className="font-display text-xs font-semibold tracking-widest text-fg-subtle uppercase">
            vs
          </span>
          <span className="text-[11px] text-fg-subtle">{roleLabel}</span>
        </div>
        <SidePanel side={right} align="left" />
      </div>

      <div className="border-t border-line px-6 py-5">
        {matchup ? (
          <Verdict left={left} right={right} matchup={matchup} roleLabel={roleLabel} />
        ) : (
          <p className="text-center text-sm text-fg-muted">
            Not enough games recorded between {left.name} and {right.name} in {roleLabel} to
            score this matchup. Try a region with a larger sample.
          </p>
        )}
      </div>
    </div>
  );
}

function SidePanel({ side, align }: { side: CompareSide; align: "left" | "right" }) {
  const right = align === "right";
  return (
    <Link
      href={`/champions/${side.slug}` as Route}
      className={cn(
        "group flex items-center gap-4",
        right ? "flex-row-reverse text-right" : "text-left",
      )}
    >
      <ChampionAvatar src={side.icon} alt="" size="lg" />
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-semibold group-hover:text-accent">
          {side.name}
        </p>
        <div
          className={cn(
            "mt-1 flex items-center gap-2 text-xs text-fg-subtle",
            right && "justify-end",
          )}
        >
          {side.tier && <TierPill tier={side.tier} size="sm" />}
          {side.winRate !== null ? (
            <span className="tabular">{formatPercent(side.winRate)} overall</span>
          ) : (
            <span>No ranked data</span>
          )}
        </div>
        {side.rank !== null && (
          <p className={cn("mt-0.5 text-[11px] text-fg-subtle", right && "text-right")}>
            Rank #{side.rank} in role
          </p>
        )}
      </div>
    </Link>
  );
}

function Verdict({
  left,
  right,
  matchup,
  roleLabel,
}: {
  left: CompareSide;
  right: CompareSide;
  roleLabel: string;
  matchup: { games: number; winRate: number; delta: number; confidence: Confidence };
}) {
  const magnitude = Math.abs(matchup.delta) * 100;
  const negligible = magnitude < 0.75;
  const leftFavoured = matchup.delta >= 0;

  /* The delta is always measured against the LEFT champion's own baseline in
     this role — it is not a symmetric number, so the sentence has to name whose
     baseline moved rather than crediting the winner's. */
  return (
    <div className="space-y-3 text-center">
      <p className="text-sm leading-relaxed text-fg">
        {negligible ? (
          <>
            <span className="font-semibold">Even lane.</span> {left.name} performs about as well
            into {right.name} as it does in {roleLabel} generally.
          </>
        ) : leftFavoured ? (
          <>
            <span className="font-semibold text-good">{left.name} is favoured.</span> It wins{" "}
            <span className="font-semibold tabular text-good">{magnitude.toFixed(1)}%</span> more
            of this lane than its own {roleLabel} baseline.
          </>
        ) : (
          <>
            <span className="font-semibold text-bad">{right.name} is favoured.</span>{" "}
            {left.name} wins{" "}
            <span className="font-semibold tabular text-bad">{magnitude.toFixed(1)}%</span> less
            of this lane than its own {roleLabel} baseline.
          </>
        )}
      </p>
      <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
        <span className="tabular">
          {left.name} wins {formatPercent(matchup.winRate)} of this lane
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ConfidenceDot level={matchup.confidence} />
          {formatCompact(matchup.games)} games sampled
        </span>
      </p>
    </div>
  );
}
