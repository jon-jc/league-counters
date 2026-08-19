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

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: "winRate", label: "Win rate", className: "w-[150px]" },
  { key: "pickRate", label: "Pick rate", className: "w-[96px]" },
  { key: "banRate", label: "Ban rate", className: "w-[96px]" },
  { key: "games", label: "Games", className: "w-[100px]" },
];

/** Hoisted so it is not recreated (and remounted) on every render. */
function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown className="size-3 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
}

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

  const headCell =
    "inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider text-fg-subtle uppercase hover:text-fg";

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface/50">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="sticky top-16 z-10 bg-surface-2/95 backdrop-blur">
          <tr className="border-b border-line text-left">
            <th scope="col" className="w-14 py-3 pl-4">
              <button type="button" onClick={() => toggle("rank")} className={headCell}>
                Rank <SortIcon active={sort.key === "rank"} dir={sort.dir} />
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
              className="w-16 py-3 text-[11px] font-semibold tracking-wider text-fg-subtle uppercase"
            >
              Tier
            </th>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className={cn("py-3", column.className)}>
                <button type="button" onClick={() => toggle(column.key)} className={headCell}>
                  {column.label} <SortIcon active={sort.key === column.key} dir={sort.dir} />
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
              <td className="py-2.5 pl-4 tabular text-sm font-medium text-fg-subtle">
                {row.rank}
              </td>
              <td className="py-2.5">
                <Link
                  href={`/champions/${row.slug}?role=${row.role}` as Route}
                  className="flex items-center gap-3"
                >
                  <ChampionAvatar src={row.icon} alt="" size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium group-hover:text-accent">
                      {row.name}
                    </span>
                    {showRole && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-fg-subtle">
                        <RoleIcon role={row.role} className="size-3" />
                        {ROLE_LABELS[row.role]}
                      </span>
                    )}
                  </span>
                </Link>
              </td>
              <td className="py-2.5">
                <TierPill tier={row.tier} size="sm" />
              </td>
              <td className="py-2.5">
                <WinRateMeter value={row.winRate} />
              </td>
              <td className="py-2.5 tabular text-fg-muted">{formatPercent(row.pickRate, 2)}</td>
              <td className="py-2.5 tabular text-fg-muted">{formatPercent(row.banRate, 1)}</td>
              <td className="py-2.5">
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
