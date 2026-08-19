"use client";

import { ROLE_LABELS, ROLES, type Role } from "@/lib/lol/constants";
import { RoleIcon } from "@/components/ui/role-icon";
import { cn } from "@/lib/utils";

export function RoleTabs({
  value,
  onChange,
  includeAll = true,
  className,
}: {
  value: Role | null;
  onChange: (role: Role | null) => void;
  includeAll?: boolean;
  className?: string;
}) {
  const options: (Role | null)[] = includeAll ? [null, ...ROLES] : [...ROLES];

  return (
    <div
      className={cn(
        "flex items-center gap-1 overflow-x-auto rounded-xl border border-line bg-surface-2/60 p-1",
        className,
      )}
      role="tablist"
      aria-label="Filter by role"
    >
      {options.map((role) => {
        const active = value === role;
        return (
          <button
            key={role ?? "all"}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(role)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              active ? "bg-accent text-canvas" : "text-fg-muted hover:bg-surface-3 hover:text-fg",
            )}
          >
            {role && <RoleIcon role={role} className="size-3.5" />}
            {role ? ROLE_LABELS[role] : "All roles"}
          </button>
        );
      })}
    </div>
  );
}
