import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const variants = {
  neutral: "border-line bg-surface-2 text-fg-muted",
  accent: "border-accent/30 bg-accent/10 text-accent",
  good: "border-good/30 bg-good/10 text-good",
  bad: "border-bad/30 bg-bad/10 text-bad",
  warn: "border-warn/30 bg-warn/10 text-warn",
} as const;

export type BadgeVariant = keyof typeof variants;

export function Badge({
  className,
  variant = "neutral",
  ...props
}: ComponentProps<"span"> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        "text-[11px] font-medium tracking-wide whitespace-nowrap",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
