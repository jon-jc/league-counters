import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-surface/40 px-6 py-16 text-center">
      {icon && <div className="mb-4 text-fg-subtle">{icon}</div>}
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="mt-1.5 max-w-md text-sm text-fg-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
