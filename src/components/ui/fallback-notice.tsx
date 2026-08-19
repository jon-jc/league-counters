import { ArrowRight } from "lucide-react";
import { BRACKETS, type Bracket } from "@/lib/lol/constants";
import { regionShort, type RegionId } from "@/lib/lol/regions";

/**
 * Shown when the snapshot on screen is not the one that was asked for.
 *
 * The filter controls always reflect the data actually rendered, so without
 * this the substitution would be silent and the controls would look like they
 * ignored the click.
 */
export function FallbackNotice({
  requested,
  actual,
}: {
  requested: { platform: RegionId; bracket: Bracket };
  actual: { platform: RegionId; bracket: Bracket };
}) {
  const samePlatform = requested.platform === actual.platform;
  const sameBracket = requested.bracket === actual.bracket;
  if (samePlatform && sameBracket) return null;

  const from = samePlatform
    ? BRACKETS[requested.bracket].label
    : `${regionShort(requested.platform)}${sameBracket ? "" : ` · ${BRACKETS[requested.bracket].label}`}`;
  const to = samePlatform
    ? BRACKETS[actual.bracket].label
    : `${regionShort(actual.platform)}${sameBracket ? "" : ` · ${BRACKETS[actual.bracket].label}`}`;

  return (
    <p className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface-2/50 px-4 py-2.5 text-xs text-fg-muted">
      <span className="font-medium text-fg">No data for {from} yet.</span>
      <span className="inline-flex items-center gap-1.5">
        Showing <ArrowRight className="size-3" /> {to}
      </span>
    </p>
  );
}
