"use client";

import { useState } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";
import { TierTable, type TierTableRow } from "./tier-table";
import { TierGroups } from "./tier-groups";
import { cn } from "@/lib/utils";

type View = "table" | "tiers";

/**
 * Two ways to read the same ranking: a sortable table for comparing numbers,
 * and grade buckets for scanning what is strong at a glance.
 */
export function TierListView({ rows, showRole }: { rows: TierTableRow[]; showRole: boolean }) {
  const [view, setView] = useState<View>("table");

  const options: { value: View; label: string; icon: typeof Rows3 }[] = [
    { value: "table", label: "Table", icon: Rows3 },
    { value: "tiers", label: "Tiers", icon: LayoutGrid },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-fg-subtle" aria-live="polite">
          {rows.length} ranked {rows.length === 1 ? "entry" : "entries"}
        </p>
        <div
          className="flex items-center gap-1 rounded-xl border border-line bg-surface-2/60 p-1"
          role="group"
          aria-label="View mode"
        >
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              aria-pressed={view === value}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                view === value
                  ? "bg-surface-3 text-fg"
                  : "text-fg-muted hover:bg-surface-3/60 hover:text-fg",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "table" ? (
        <TierTable rows={rows} showRole={showRole} />
      ) : (
        <TierGroups rows={rows} showRole={showRole} />
      )}
    </div>
  );
}
