"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import type { Route } from "next";
import { ChampionAvatar } from "@/components/champion/champion-avatar";
import { ConfidenceDot } from "@/components/ui/confidence-dot";
import { DeltaValue } from "@/components/ui/win-rate";
import { WinRateMeter } from "@/components/ui/win-rate-meter";
import type { MatchupDisplayRow } from "@/lib/data/rows";
import { cn, formatCompact } from "@/lib/utils";

type SortKey = "delta" | "winRate" | "games" | "name";

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown className="size-3 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
}

const HEAD =
  "inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider text-fg-subtle uppercase hover:text-fg";

export function MatchupTable({ rows }: { rows: MatchupDisplayRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "delta",
    dir: "asc",
  });
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);

  const visible = useMemo(() => {
    const needle = deferred.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((row) => row.name.toLowerCase().includes(needle))
      : rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) =>
      sort.key === "name"
        ? a.name.localeCompare(b.name) * factor
        : (a[sort.key] - b[sort.key]) * factor,
    );
  }, [rows, deferred, sort]);

  function toggle(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold tracking-wide uppercase">
          All matchups
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter opponents…"
            aria-label="Filter opponents"
            className="w-56 rounded-lg border border-line bg-surface-2/60 py-1.5 pr-3 pl-9 text-sm placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-surface/50">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="py-3 pl-4">
                <button type="button" onClick={() => toggle("name")} className={HEAD}>
                  Opponent <SortIcon active={sort.key === "name"} dir={sort.dir} />
                </button>
              </th>
              <th scope="col" className="w-[150px] py-3">
                <button type="button" onClick={() => toggle("winRate")} className={HEAD}>
                  Win rate <SortIcon active={sort.key === "winRate"} dir={sort.dir} />
                </button>
              </th>
              <th scope="col" className="w-[110px] py-3">
                <button type="button" onClick={() => toggle("delta")} className={HEAD}>
                  Delta <SortIcon active={sort.key === "delta"} dir={sort.dir} />
                </button>
              </th>
              <th scope="col" className="w-[100px] py-3 pr-4">
                <button type="button" onClick={() => toggle("games")} className={HEAD}>
                  Games <SortIcon active={sort.key === "games"} dir={sort.dir} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.opponentId}
                className={cn("group border-b border-line/60 last:border-0 hover:bg-surface-2/50")}
              >
                <td className="py-2.5 pl-4">
                  <Link
                    href={`/champions/${row.slug}?role=${row.role}` as Route}
                    className="flex items-center gap-3"
                  >
                    <ChampionAvatar src={row.icon} alt="" size="sm" />
                    <span className="truncate font-medium group-hover:text-accent">
                      {row.name}
                    </span>
                  </Link>
                </td>
                <td className="py-2.5">
                  <WinRateMeter value={row.winRate} />
                </td>
                <td className="py-2.5">
                  <DeltaValue value={row.delta} />
                </td>
                <td className="py-2.5 pr-4">
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

      {visible.length === 0 && (
        <p className="py-6 text-center text-sm text-fg-muted">No opponents match that filter.</p>
      )}
    </div>
  );
}
