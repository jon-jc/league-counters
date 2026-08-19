import { TierPill } from "@/components/ui/tier-pill";
import { ConfidenceDot } from "@/components/ui/confidence-dot";
import type { ChampionRow } from "@/lib/data/metrics";
import { cn, formatCompact, formatPercent } from "@/lib/utils";

function Tile({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-card border border-line bg-surface/60 px-4 py-3.5", className)}>
      <p className="text-[11px] font-medium tracking-wider text-fg-subtle uppercase">{label}</p>
      <div className="mt-1.5 font-display text-2xl font-semibold tabular">{children}</div>
      {hint && <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}

export function StatTiles({ row, roleLabel }: { row: ChampionRow; roleLabel: string }) {
  const winTone =
    row.winRate >= 0.52 ? "text-good" : row.winRate < 0.485 ? "text-bad" : "text-fg";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Tile label="Tier" hint={`${roleLabel} rank #${row.rank}`}>
        <TierPill tier={row.tier} />
      </Tile>
      <Tile label="Win rate" hint={`±${(row.margin * 100).toFixed(1)}% at 95%`}>
        <span className={winTone}>{formatPercent(row.winRate)}</span>
      </Tile>
      <Tile label="Pick rate" hint={`share of ${roleLabel.toLowerCase()} games`}>
        {formatPercent(row.pickRate, 2)}
      </Tile>
      <Tile label="Ban rate" hint="share of all games">
        {formatPercent(row.banRate, 1)}
      </Tile>
      <Tile label="Games" hint={`${row.wins.toLocaleString()} wins`}>
        <span className="inline-flex items-center gap-2">
          <ConfidenceDot level={row.confidence} />
          {formatCompact(row.games)}
        </span>
      </Tile>
      <Tile label="Presence" hint="picked or banned">
        {formatPercent(row.presence, 1)}
      </Tile>
    </div>
  );
}
