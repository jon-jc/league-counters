"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { Route } from "next";
import { Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { RoleTabs } from "./role-tabs";
import { BRACKETS, QUEUES, type Bracket, type QueueId, type Role } from "@/lib/lol/constants";
import { GLOBAL_REGION, PLATFORMS, type PlatformId, type RegionId } from "@/lib/lol/regions";
import { cn } from "@/lib/utils";

export function SnapshotFilters({
  platform,
  queue,
  bracket,
  role,
  availablePlatforms,
  availableBrackets,
  showRoles = true,
  showScope = true,
  className,
}: {
  platform: RegionId;
  queue: QueueId;
  bracket: Bracket;
  role: Role | null;
  availablePlatforms: PlatformId[];
  availableBrackets: Bracket[];
  showRoles?: boolean;
  /**
   * Region, rank and queue. Hidden when the view is ranked from a source that
   * has no such dimensions — showing controls that silently do nothing is
   * worse than showing none.
   */
  showScope?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      startTransition(() => {
        router.replace(`${pathname}${query ? `?${query}` : ""}` as Route, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  /* A region with no snapshot is still listed, but flagged and unselectable —
     hiding it entirely makes the picker look broken to someone who plays there. */
  /* The global aggregate leads the list: it has by far the widest matchup
     coverage, because a lane pairing only gains one game per match and summing
     regions is the only way to reach a usable sample for most of them. */
  const platformOptions = [
    {
      value: GLOBAL_REGION,
      label:
        availablePlatforms.length > 0
          ? `Global · all ${availablePlatforms.length} regions`
          : "Global — no data yet",
      disabled: availablePlatforms.length === 0,
    },
    ...Object.keys(PLATFORMS).map((id) => {
      const has = availablePlatforms.includes(id as PlatformId);
      return {
        value: id,
        label: has
          ? `${PLATFORMS[id as PlatformId].short} · ${PLATFORMS[id as PlatformId].label}`
          : `${PLATFORMS[id as PlatformId].short} — no data yet`,
        disabled: !has,
      };
    }),
  ];

  const bracketOptions = Object.entries(BRACKETS).map(([value, meta]) => ({
    value,
    label: availableBrackets.includes(value as Bracket)
      ? meta.label
      : `${meta.label} — no data yet`,
    disabled: availableBrackets.length > 0 && !availableBrackets.includes(value as Bracket),
  }));

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-3 empty:hidden">
        {showScope && (
          <>
            <Select
              label="Region"
              value={platform}
              options={platformOptions}
              onChange={(value) => update({ region: value })}
              className="w-56"
            />
            <Select
              label="Rank"
              value={bracket}
              options={bracketOptions}
              onChange={(value) => update({ rank: value })}
              className="w-44"
            />
            <Select
              label="Queue"
              value={String(queue)}
              options={Object.entries(QUEUES).map(([value, meta]) => ({
                value,
                label: meta.label,
              }))}
              onChange={(value) => update({ queue: value })}
              className="w-44"
            />
          </>
        )}
        {pending && (
          <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
            <Loader2 className="size-3.5 animate-spin" />
            Updating
          </span>
        )}
      </div>

      {showRoles && (
        <RoleTabs
          value={role}
          onChange={(next) => update({ role: next })}
          className="w-fit max-w-full"
        />
      )}
    </div>
  );
}
