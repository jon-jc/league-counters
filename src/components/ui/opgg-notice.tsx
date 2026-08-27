import { ExternalLink, Info } from "lucide-react";
import type { OpggMeta } from "@/lib/opgg/types";
import { formatCompact, formatRelativeTime } from "@/lib/utils";

/**
 * Attribution for the op.gg-sourced tier list.
 *
 * This is not decoration. These grades are op.gg's work, on op.gg's sample,
 * and the rest of the site tells visitors that every number is derived from
 * matches this pipeline aggregates. Saying plainly whose numbers are on screen
 * is what keeps both statements true.
 */
export function OpggNotice({
  meta,
  kind = "tiers",
}: {
  meta: OpggMeta;
  kind?: "tiers" | "counters";
}) {
  const heading = kind === "counters" ? "Matchups from op.gg." : "Tier grades from op.gg.";
  const detail =
    kind === "counters"
      ? "Every lane pairing and the win rate each delta is measured against are"
      : "Ranking, grading and rates on this view are";

  return (
    <div className="space-y-2 rounded-card border border-accent/25 bg-accent/6 px-4 py-3">
      <p className="flex flex-wrap items-center gap-x-1.5 text-sm leading-relaxed text-fg-muted">
        <Info className="size-4 shrink-0 text-accent" />
        <span>
          <span className="font-semibold text-fg">{heading}</span> {detail}{" "}
          <a
            href="https://op.gg"
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-0.5 text-accent hover:underline"
          >
            op.gg&apos;s
            <ExternalLink className="size-3" />
          </a>{" "}
          — not derived from this site&apos;s own match aggregation.
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-[22px] text-xs text-fg-subtle">
        <span>{formatCompact(meta.championGames)} champion games</span>
        <span>{meta.champions} champions</span>
        <span>Fetched {formatRelativeTime(meta.fetchedAt)}</span>
        <span>
          Region and rank filters do not apply — op.gg&apos;s data here is a single global
          dataset.
        </span>
      </div>
    </div>
  );
}
