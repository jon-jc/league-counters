"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { Route } from "next";
import { Loader2 } from "lucide-react";
import { TIER_SOURCES, TIER_SOURCE_LABELS, type TierSource } from "@/lib/data/source";
import { cn } from "@/lib/utils";

const DESCRIPTIONS: Record<TierSource, string> = {
  opgg: "Every champion, every lane",
  riot: "Filterable by region and rank",
};

/**
 * Switches the tier list between op.gg's lane meta and this site's own
 * ranking.
 *
 * Deliberately a visible, labelled control rather than a quiet preference:
 * the two datasets disagree, and someone reading a tier grade is entitled to
 * know at a glance whose grade it is.
 */
export function SourceToggle({
  value,
  className,
}: {
  value: TierSource;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const select = useCallback(
    (next: TierSource) => {
      if (next === value) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("source", next);
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false });
      });
    },
    [pathname, router, searchParams, value],
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <span className="text-xs font-medium text-fg-subtle">Ranked from</span>
      <div
        className="flex items-center gap-1 rounded-xl border border-line bg-surface-2/60 p-1"
        role="group"
        aria-label="Data source"
      >
        {TIER_SOURCES.map((source) => (
          <button
            key={source}
            type="button"
            onClick={() => select(source)}
            aria-pressed={value === source}
            className={cn(
              "rounded-lg px-3 py-1.5 text-left transition-colors",
              value === source
                ? "bg-surface-3 text-fg"
                : "text-fg-muted hover:bg-surface-3/60 hover:text-fg",
            )}
          >
            <span className="block text-xs font-semibold">{TIER_SOURCE_LABELS[source]}</span>
            <span className="mt-0.5 block text-[11px] text-fg-subtle">
              {DESCRIPTIONS[source]}
            </span>
          </button>
        ))}
      </div>
      {pending && (
        <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
          <Loader2 className="size-3.5 animate-spin" />
          Updating
        </span>
      )}
    </div>
  );
}
