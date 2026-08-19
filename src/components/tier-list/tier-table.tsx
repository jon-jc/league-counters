"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { Route } from "next";
import type { TierRow } from "@/lib/data/rows";
import { ROLE_LABELS } from "@/lib/lol/constants";
import { ChampionAvatar } from "@/components/champion/champion-avatar";
import { RoleIcon } from "@/components/ui/role-icon";
import { TierPill } from "@/components/ui/tier-pill";
import { ConfidenceDot } from "@/components/ui/confidence-dot";
import { WinRateMeter } from "@/components/ui/win-rate-meter";
import { cn, formatCompact, formatPercent } from "@/lib/utils";

export type TierTableRow = TierRow;

type SortKey = "rank" | "winRate" | "pickRate" | "banRate" | "games";

/**
 * Columns drop away as the viewport narrows rather than forcing a sideways
 * scroll. Rank, champion, tier and win rate answer the question on their own;
 * the rest is supporting detail.
 */
const COLUMNS: { key: SortKey; label: string; short: string; className: string }[] = [
  { key: "winRate", label: "Win rate", short: "Win", className: "w-[104px] sm:w-[150px]" },
  { key: "pickRate", label: "Pick rate", short: "Pick", className: "hidden w-[96px] md:table-cell" },
  { key: "banRate", label: "Ban rate", short: "Ban", className: "hidden w-[96px] lg:table-cell" },
  { key: "games", label: "Games", short: "Games", className: "hidden w-[100px] sm:table-cell" },
];

/** Hoisted so it is not recreated (and remounted) on every render. */
function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown className="size-3 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
}

const HEAD =
  "inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider text-fg-subtle uppercase hover:text-fg";

export function TierTable({ rows, showRole }: { rows: TierTableRow[]; showRole: boolean }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "rank",
    dir: "asc",
  });

  const sorted = useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => (a[sort.key] - b[sort.key]) * factor);
  }, [rows, sort]);

  function toggle(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "rank" ? "asc" : "desc" },
    );
  }

  /** Screen readers announce sort state from this, not from the icon. */
  const ariaSort = (key: SortKey): "ascending" | "descending" | "none" =>
    sort.key !== key ? "none" : sort.dir === "asc" ? "ascending" : "descending";

  /*
   * overflow-x is applied only below sm. `overflow-x: auto` forces
   * `overflow-y: auto`, which makes the wrapper a scroll container — and a
   * sticky thead inside one positions against that container rather than the
   * viewport, landing on top of the first rows. Above sm the table fits, so
   * there is no scroll container and the sticky header behaves.
   *
   * The 65px offset matches the site header: h-16 plus its 1px bottom border.
   */
  return (
    <div className="rounded-card border border-line bg-surface/50 max-sm:overflow-x-auto">
      <table className="w-full min-w-[340px] border-collapse text-sm">
        <caption className="sr-only">
          Champions ranked by tier, win rate, pick rate, ban rate and games played. Column
          headers are buttons that change the sort order.
        </caption>
        <thead className="z-10 bg-surface-2/95 backdrop-blur sm:sticky sm:top-[65px]">
          <tr className="border-b border-line text-left">
            <th scope="col" className="w-11 py-3 pl-3 sm:w-14 sm:pl-4" aria-sort={ariaSort("rank")}>
              <button type="button" onClick={() => toggle("rank")} className={HEAD}>
                <span className="sr-only sm:not-sr-only">Rank</span>
                <span aria-hidden className="sm:hidden">
                  #
                </span>
                <SortIcon active={sort.key === "rank"} dir={sort.dir} />
              </button>
            </th>
            <th
              scope="col"
              className="py-3 text-[11px] font-semibold tracking-wider text-fg-subtle uppercase"
            >
              Champion
            </th>
            <th
              scope="col"
              className="w-14 py-3 text-[11px] font-semibold tracking-wider text-fg-subtle uppercase sm:w-16"
            >
              Tier
            </th>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn("py-3", column.className)}
                aria-sort={ariaSort(column.key)}
              >
                <button type="button" onClick={() => toggle(column.key)} className={HEAD}>
                  <span className="sm:hidden">{column.short}</span>
                  <span className="hidden sm:inline">{column.label}</span>
                  <SortIcon active={sort.key === column.key} dir={sort.dir} />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={`${row.championId}-${row.role}`}
              className="group border-b border-line/60 last:border-0 hover:bg-surface-2/50"
            >
              <td className="py-2.5 pl-3 tabular text-sm font-medium text-fg-subtle sm:pl-4">
                {row.rank}
              </td>
              <td className="py-2.5">
                <Link
                  href={`/champions/${row.slug}?role=${row.role}` as Route}
                  className="flex items-center gap-2.5 sm:gap-3"
                >
                  <ChampionAvatar src={row.icon} alt="" size="sm" />
                  <span className="min-w-0">
                    <span
                      className="block truncate font-medium group-hover:text-accent"
                      title={row.name}
                    >
                      {row.name}
                    </span>
                    {showRole && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-fg-subtle">
                        <RoleIcon role={row.role} className="size-3" />
                        {ROLE_LABELS[row.role]}
                      </span>
                    )}
                    {/* Below sm the games column is gone, so keep the sample size
                        visible here — a win rate without it is misleading. */}
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-subtle sm:hidden">
                      <ConfidenceDot level={row.confidence} />
                      {formatCompact(row.games)} games
                    </span>
                  </span>
                </Link>
              </td>
              <td className="py-2.5">
                <TierPill tier={row.tier} size="sm" />
              </td>
              <td className="py-2.5">
                <WinRateMeter value={row.winRate} />
              </td>
              <td className="hidden py-2.5 tabular text-fg-muted md:table-cell">
                {formatPercent(row.pickRate, 2)}
              </td>
              <td className="hidden py-2.5 tabular text-fg-muted lg:table-cell">
                {formatPercent(row.banRate, 1)}
              </td>
              <td className="hidden py-2.5 sm:table-cell">
                <span className="inline-flex items-center gap-1.5 tabular text-fg-subtle">
                  <ConfidenceDot level={row.confidence} />
                  {formatCompact(row.games)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
