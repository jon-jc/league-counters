"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import type { Route } from "next";
import { ChampionAvatar } from "@/components/champion/champion-avatar";
import { ConfidenceDot } from "@/components/ui/confidence-dot";
import { TierPill } from "@/components/ui/tier-pill";
import { DeltaValue } from "@/components/ui/win-rate";
import { WinRateMeter } from "@/components/ui/win-rate-meter";
import type { MatchupDisplayRow } from "@/lib/data/rows";
import { formatCompact, formatPercent } from "@/lib/utils";

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

  /** Screen readers announce sort state from this, not from the icon. */
  const ariaSort = (key: SortKey): "ascending" | "descending" | "none" =>
    sort.key !== key ? "none" : sort.dir === "asc" ? "ascending" : "descending";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold tracking-wide uppercase">
          All matchups
        </h2>
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter opponents…"
            aria-label="Filter opponents"
            className="w-full rounded-lg border border-line bg-surface-2/60 py-2 pr-3 pl-9 text-sm placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-surface/50">
        <table className="w-full min-w-[320px] border-collapse text-sm">
          <caption className="sr-only">
            Every tracked lane opponent. Delta is this champion&apos;s win rate in the matchup
            minus its own win rate in the role, so a positive value means it over-performs.
          </caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="py-3 pl-3 sm:pl-4" aria-sort={ariaSort("name")}>
                <button type="button" onClick={() => toggle("name")} className={HEAD}>
                  Opponent <SortIcon active={sort.key === "name"} dir={sort.dir} />
                </button>
              </th>
              <th
                scope="col"
                className="hidden w-[150px] py-3 sm:table-cell"
                aria-sort={ariaSort("winRate")}
              >
                <button type="button" onClick={() => toggle("winRate")} className={HEAD}>
                  Win rate <SortIcon active={sort.key === "winRate"} dir={sort.dir} />
                </button>
              </th>
              <th scope="col" className="w-[92px] py-3" aria-sort={ariaSort("delta")}>
                <button type="button" onClick={() => toggle("delta")} className={HEAD}>
                  Delta <SortIcon active={sort.key === "delta"} dir={sort.dir} />
                </button>
              </th>
              <th
                scope="col"
                className="hidden w-[100px] py-3 pr-4 sm:table-cell"
                aria-sort={ariaSort("games")}
              >
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
                className="group border-b border-line/60 last:border-0 hover:bg-surface-2/50"
              >
                <td className="py-2.5 pl-3 sm:pl-4">
                  <Link
                    href={`/champions/${row.slug}?role=${row.role}` as Route}
                    className="flex items-center gap-2.5 sm:gap-3"
                  >
                    <ChampionAvatar src={row.icon} alt="" size="sm" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium group-hover:text-accent">
                          {row.name}
                        </span>
                        {row.tier && <TierPill tier={row.tier} size="sm" />}
                      </span>
                      {/* Win rate and sample size live here below sm, where their
                          own columns are hidden. */}
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-subtle sm:hidden">
                        <ConfidenceDot level={row.confidence} />
                        {formatCompact(row.games)} games · {formatPercent(row.winRate)} win rate
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="hidden py-2.5 sm:table-cell">
                  <WinRateMeter value={row.winRate} />
                </td>
                <td className="py-2.5">
                  <DeltaValue value={row.delta} />
                </td>
                <td className="hidden py-2.5 pr-4 sm:table-cell">
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
