import type { Confidence } from "@/lib/data/metrics";
import { cn } from "@/lib/utils";

const STYLES: Record<Confidence, { color: string; title: string }> = {
  high: { color: "bg-good", title: "High confidence — large sample" },
  medium: { color: "bg-warn", title: "Medium confidence — moderate sample" },
  low: { color: "bg-bad", title: "Low confidence — small sample, treat as noisy" },
};

/** Sample-size signal, so a thin row is never mistaken for a settled one. */
export function ConfidenceDot({ level, className }: { level: Confidence; className?: string }) {
  const style = STYLES[level];
  return (
    <span
      className={cn("inline-block size-1.5 shrink-0 rounded-full", style.color, className)}
      title={style.title}
      aria-label={style.title}
      role="img"
    />
  );
}
