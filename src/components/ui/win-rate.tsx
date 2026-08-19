import { cn, formatPercent } from "@/lib/utils";

/** Win rate coloured against the 50% baseline, not against an arbitrary scale. */
export function WinRate({
  value,
  className,
  digits = 1,
}: {
  value: number;
  className?: string;
  digits?: number;
}) {
  const tone =
    value >= 0.52 ? "text-good" : value >= 0.5 ? "text-fg" : value >= 0.485 ? "text-fg-muted" : "text-bad";
  return (
    <span className={cn("tabular font-medium", tone, className)}>
      {formatPercent(value, digits)}
    </span>
  );
}

/** Signed delta against a baseline — the number that actually defines a counter. */
export function DeltaValue({
  value,
  className,
  digits = 1,
}: {
  value: number;
  className?: string;
  digits?: number;
}) {
  const tone = value > 0.002 ? "text-good" : value < -0.002 ? "text-bad" : "text-fg-muted";
  const pct = value * 100;
  return (
    <span className={cn("tabular font-semibold", tone, className)}>
      {pct > 0 ? "+" : ""}
      {pct.toFixed(digits)}%
    </span>
  );
}
