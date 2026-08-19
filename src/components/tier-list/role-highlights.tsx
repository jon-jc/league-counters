import Link from "next/link";
import type { Route } from "next";
import { ArrowUpRight } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/lib/lol/constants";
import { RoleIcon } from "@/components/ui/role-icon";
import { ChampionAvatar } from "@/components/champion/champion-avatar";
import { TierPill } from "@/components/ui/tier-pill";
import type { TierRow } from "@/lib/data/rows";
import { formatPercent } from "@/lib/utils";

/** Compact "who is strong right now" column, one per role. */
export function RoleHighlights({
  role,
  rows,
  regionQuery,
}: {
  role: Role;
  rows: TierRow[];
  regionQuery: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface/60">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <RoleIcon role={role} className="size-4 text-accent" />
          {ROLE_LABELS[role]}
        </span>
        <Link
          href={`/tier-list?${regionQuery}role=${role}` as Route}
          className="inline-flex items-center gap-0.5 text-xs text-fg-subtle transition-colors hover:text-accent"
        >
          All
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
      <ul className="divide-y divide-line/60">
        {rows.map((row) => (
          <li key={row.championId}>
            <Link
              href={`/champions/${row.slug}?role=${role}` as Route}
              className="group flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-surface-2/60"
            >
              <span className="w-3 shrink-0 text-xs tabular text-fg-subtle">{row.rank}</span>
              <ChampionAvatar src={row.icon} alt="" size="sm" />
              {/* The name gets a line to itself. Sharing one with the rank, win
                  rate and tier pill left it around 60px in a five-column row,
                  which truncated even short names like Gragas. */}
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-sm font-medium group-hover:text-accent"
                  title={row.name}
                >
                  {row.name}
                </span>
                <span className="mt-1 flex items-center gap-1.5">
                  <TierPill tier={row.tier} size="sm" />
                  <span className="text-[11px] tabular text-fg-subtle">
                    {formatPercent(row.winRate)}
                  </span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
