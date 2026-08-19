import Link from "next/link";
import type { Route } from "next";
import { ShieldAlert, Swords } from "lucide-react";
import { ChampionAvatar } from "@/components/champion/champion-avatar";
import { ConfidenceDot } from "@/components/ui/confidence-dot";
import { DeltaValue } from "@/components/ui/win-rate";
import type { MatchupDisplayRow } from "@/lib/data/rows";
import { cn, formatCompact, formatPercent } from "@/lib/utils";

/**
 * A ranked list of lane opponents. `tone` picks which end of the spread this
 * card is showing — the champions that beat it, or the ones it beats.
 */
export function CounterList({
  tone,
  rows,
  role,
  emptyHint,
}: {
  tone: "weak" | "strong";
  rows: MatchupDisplayRow[];
  role: string;
  emptyHint: string;
}) {
  const weak = tone === "weak";
  const Icon = weak ? ShieldAlert : Swords;

  return (
    <div className="rounded-card border border-line bg-surface/60">
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <Icon className={cn("mt-0.5 size-4 shrink-0", weak ? "text-bad" : "text-good")} />
        <div>
          <h2 className="font-display text-sm font-semibold">
            {weak ? "Struggles against" : "Strong against"}
          </h2>
          <p className="mt-0.5 text-xs text-fg-subtle">
            {weak
              ? `Opponents this champion under-performs into as ${role}.`
              : `Opponents this champion over-performs into as ${role}.`}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-fg-muted">{emptyHint}</p>
      ) : (
        <ol className="divide-y divide-line/60">
          {rows.map((row) => (
            <li key={row.opponentId}>
              <Link
                href={`/champions/${row.slug}?role=${row.role}` as Route}
                className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/60"
              >
                <ChampionAvatar src={row.icon} alt="" size="sm" />
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-sm font-medium group-hover:text-accent"
                    title={row.name}
                  >
                    {row.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-subtle">
                    <ConfidenceDot level={row.confidence} />
                    {formatCompact(row.games)} games · {formatPercent(row.winRate)} win rate
                  </span>
                </span>
                <DeltaValue value={row.delta} className="text-sm" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
