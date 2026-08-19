import { FlaskConical, Info } from "lucide-react";
import type { SnapshotMeta } from "@/lib/data/types";
import { PLATFORMS } from "@/lib/lol/regions";
import { BRACKETS, QUEUES } from "@/lib/lol/constants";
import { formatCompact, formatRelativeTime } from "@/lib/utils";

/**
 * Says plainly where the numbers on screen came from. Seed snapshots get a
 * loud banner — nobody should mistake placeholder data for the live meta.
 */
export function DataNotice({ meta }: { meta: SnapshotMeta }) {
  if (meta.source === "seed") {
    return (
      <div className="flex items-start gap-3 rounded-card border border-warn/30 bg-warn/8 px-4 py-3">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-warn" />
        <p className="text-sm leading-relaxed text-fg-muted">
          <span className="font-semibold text-warn">Sample data.</span> Champions and roles are
          real, but these win, pick and ban rates are generated placeholders — the ingestion
          pipeline has not published a live snapshot for {PLATFORMS[meta.platform].short} yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
      <span className="inline-flex items-center gap-1.5">
        <Info className="size-3.5" />
        {formatCompact(meta.matches)} ranked games
      </span>
      <span>
        {meta.regions
          ? `All regions (${meta.regions.length})`
          : PLATFORMS[meta.platform].label}{" "}
        · {BRACKETS[meta.bracket].label} · {QUEUES[meta.queue].short}
      </span>
      <span>Patch {meta.patch}</span>
      <span>Updated {formatRelativeTime(meta.generatedAt)}</span>
    </div>
  );
}
