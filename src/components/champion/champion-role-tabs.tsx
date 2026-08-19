"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { Route } from "next";
import { ROLE_LABELS, type Role } from "@/lib/lol/constants";
import { RoleIcon } from "@/components/ui/role-icon";
import { cn, formatCompact } from "@/lib/utils";

/** Only the roles this champion is actually played in, with their sample size. */
export function ChampionRoleTabs({
  roles,
  active,
}: {
  roles: { role: Role; games: number }[];
  active: Role;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (roles.length <= 1) return null;

  function select(role: Role) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("role", role);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false });
    });
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 overflow-x-auto rounded-xl border border-line bg-surface-2/60 p-1 transition-opacity",
        pending && "opacity-60",
      )}
      role="tablist"
      aria-label="Role"
    >
      {roles.map(({ role, games }) => (
        <button
          key={role}
          type="button"
          role="tab"
          aria-selected={role === active}
          onClick={() => select(role)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
            role === active
              ? "bg-accent text-canvas"
              : "text-fg-muted hover:bg-surface-3 hover:text-fg",
          )}
        >
          <RoleIcon role={role} className="size-3.5" />
          {ROLE_LABELS[role]}
          <span className="opacity-60">{formatCompact(games)}</span>
        </button>
      ))}
    </div>
  );
}
