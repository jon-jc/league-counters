"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Route } from "next";
import { Loader2, Swords } from "lucide-react";
import { ChampionPicker, type PickerChampion } from "@/components/compare/champion-picker";
import { RoleTabs } from "@/components/filters/role-tabs";
import type { Role } from "@/lib/lol/constants";
import { cn } from "@/lib/utils";

/**
 * The site's primary question, asked directly: who beats this champion?
 *
 * Navigates rather than filtering in place so every answer is a shareable URL —
 * the thing people actually paste to a duo partner mid champion select.
 */
export function CounterFinder({
  champions,
  champion,
  role,
  region,
  source,
  size = "default",
  className,
}: {
  champions: PickerChampion[];
  champion: string | null;
  role: Role | null;
  region?: string;
  /**
   * Carried through so a search keeps the dataset you were reading. Region is
   * dropped alongside it when the source has no regions to speak of.
   */
  source?: string;
  size?: "default" | "hero";
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(nextChampion: string | null, nextRole: Role | null) {
    if (!nextChampion) return;
    const params = new URLSearchParams();
    params.set("champion", nextChampion);
    if (nextRole) params.set("role", nextRole);
    if (source) params.set("source", source);
    else if (region) params.set("region", region);
    startTransition(() => {
      router.push(`/counters?${params.toString()}` as Route);
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "rounded-card border border-line bg-surface-2/50 p-4",
          size === "hero" && "border-line-strong bg-surface-2/70 p-5",
        )}
      >
        <div className="flex items-center gap-2 pb-3">
          <Swords className="size-4 text-accent" />
          <span
            className={cn(
              "font-display font-semibold",
              size === "hero" ? "text-base" : "text-sm",
            )}
          >
            Who counters…
          </span>
          {pending && <Loader2 className="size-3.5 animate-spin text-fg-subtle" />}
        </div>

        <ChampionPicker
          label="Champion you are up against"
          champions={champions}
          value={champion}
          onChange={(slug) => go(slug, role)}
        />

        <div className="mt-3">
          <RoleTabs
            value={role}
            onChange={(next) => go(champion, next)}
            includeAll={false}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
