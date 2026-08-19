import type { TierGrade } from "@/lib/data/metrics";
import { cn } from "@/lib/utils";

const STYLES: Record<TierGrade, string> = {
  "S+": "border-tier-splus/40 bg-tier-splus/12 text-tier-splus",
  S: "border-tier-s/40 bg-tier-s/12 text-tier-s",
  A: "border-tier-a/40 bg-tier-a/12 text-tier-a",
  B: "border-tier-b/40 bg-tier-b/12 text-tier-b",
  C: "border-tier-c/40 bg-tier-c/12 text-tier-c",
  D: "border-tier-d/40 bg-tier-d/12 text-tier-d",
};

const SIZES = {
  sm: "h-5 min-w-[26px] text-[11px]",
  md: "h-7 min-w-[34px] text-xs",
} as const;

export function TierPill({
  tier,
  size = "md",
  className,
}: {
  tier: TierGrade;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-1.5 font-display font-bold",
        STYLES[tier],
        SIZES[size],
        className,
      )}
      title={`Tier ${tier}`}
    >
      {tier}
    </span>
  );
}
