import Link from "next/link";
import type { Route } from "next";
import { TIER_GRADES, type TierGrade } from "@/lib/data/metrics";
import { ROLE_LABELS } from "@/lib/lol/constants";
import { ChampionAvatar } from "@/components/champion/champion-avatar";
import { TierPill } from "@/components/ui/tier-pill";
import type { TierTableRow } from "./tier-table";
import { formatPercent } from "@/lib/utils";

/** The at-a-glance view: every champion bucketed into its grade. */
export function TierGroups({ rows, showRole }: { rows: TierTableRow[]; showRole: boolean }) {
  const grouped = TIER_GRADES.map((grade) => ({
    grade,
    entries: rows.filter((row) => row.tier === grade),
  })).filter((group) => group.entries.length > 0);

  return (
    <div className="space-y-3">
      {grouped.map(({ grade, entries }) => (
        <TierRow key={grade} grade={grade} entries={entries} showRole={showRole} />
      ))}
    </div>
  );
}

function TierRow({
  grade,
  entries,
  showRole,
}: {
  grade: TierGrade;
  entries: TierTableRow[];
  showRole: boolean;
}) {
  return (
    <div className="flex gap-4 rounded-card border border-line bg-surface/50 p-4">
      <div className="flex w-14 shrink-0 flex-col items-center gap-1.5 border-r border-line pr-4">
        <TierPill tier={grade} />
        <span className="text-[11px] tabular text-fg-subtle">{entries.length}</span>
      </div>
      <ul className="flex flex-1 flex-wrap gap-2">
        {entries.map((entry) => (
          <li key={`${entry.championId}-${entry.role}`}>
            <Link
              href={`/champions/${entry.slug}?role=${entry.role}` as Route}
              className="group flex w-[104px] flex-col items-center gap-1.5 rounded-lg p-2 transition-colors hover:bg-surface-2"
              title={`${entry.name}${showRole ? ` · ${ROLE_LABELS[entry.role]}` : ""} — ${formatPercent(entry.winRate)} win rate`}
            >
              <ChampionAvatar src={entry.icon} alt="" size="md" />
              <span className="w-full truncate text-center text-[11px] font-medium group-hover:text-accent">
                {entry.name}
              </span>
              <span className="text-[11px] tabular text-fg-subtle">
                {formatPercent(entry.winRate)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
