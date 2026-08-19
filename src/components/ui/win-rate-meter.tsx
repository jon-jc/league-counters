import { cn, formatPercent } from "@/lib/utils";

/**
 * Win rate as a bar diverging from 50%, not from zero — the only part of the
 * range that carries meaning sits roughly between 42% and 58%.
 */
const FLOOR = 0.42;
const CEIL = 0.58;

export function WinRateMeter({ value, className }: { value: number; className?: string }) {
  const clamped = Math.min(CEIL, Math.max(FLOOR, value));
  const half = (CEIL - FLOOR) / 2;
  const offset = (clamped - 0.5) / half;
  const width = Math.abs(offset) * 50;
  const positive = value >= 0.5;

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {/* The bar is the first thing to go on narrow screens: the number carries
          the meaning, the bar only speeds up comparison. */}
      <span className="relative hidden h-1.5 w-[70px] shrink-0 overflow-hidden rounded-full bg-surface-3 sm:block">
        <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
        <span
          className={cn("absolute inset-y-0 rounded-full", positive ? "bg-good" : "bg-bad")}
          style={
            positive
              ? { left: "50%", width: `${width}%` }
              : { right: "50%", width: `${width}%` }
          }
        />
      </span>
      <span
        className={cn(
          "tabular font-medium",
          value >= 0.52 ? "text-good" : value < 0.485 ? "text-bad" : "text-fg",
        )}
      >
        {formatPercent(value)}
      </span>
    </span>
  );
}
