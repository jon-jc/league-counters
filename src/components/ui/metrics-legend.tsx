import { HelpCircle } from "lucide-react";
import { ConfidenceDot } from "./confidence-dot";
import { TierPill } from "./tier-pill";

interface Entry {
  term: React.ReactNode;
  body: string;
}

const SHARED: Entry[] = [
  {
    term: <TierPill tier="S+" size="sm" />,
    body: "Tier blends win rate with how contested a champion is, scored within its own role — so a strong support is not buried under a swingy jungler.",
  },
  {
    term: <span className="font-medium text-fg">Win rate</span>,
    body: "Share of games won. Coloured against 50%, since that is the only meaningful midpoint.",
  },
  {
    term: (
      <span className="inline-flex items-center gap-1.5 font-medium text-fg">
        <ConfidenceDot level="high" />
        Games
      </span>
    ),
    body: "Sample size. Green is a settled number, amber is provisional, red is noisy. Rows below 20 games are hidden rather than ranked.",
  },
];

const TIER_LIST: Entry[] = [
  ...SHARED,
  {
    term: <span className="font-medium text-fg">Pick / ban rate</span>,
    body: "How often the champion is chosen in its role, and how often it is banned across all games.",
  },
];

const MATCHUP: Entry[] = [
  {
    term: <span className="font-medium text-fg">Delta</span>,
    body: "The number that actually defines a counter: win rate in this lane minus the champion's own win rate in the role. A champion that wins 46% overall but 49% into someone is over-performing there — a raw win-rate sort would never show that.",
  },
  ...SHARED,
];

/**
 * A disclosure rather than always-on prose.
 *
 * The metrics here are not self-explanatory — "delta" in particular is
 * meaningless until you know it is measured against the champion's own
 * baseline — but a returning visitor should not have to scroll past the
 * explanation every time.
 */
export function MetricsLegend({ variant = "tier-list" }: { variant?: "tier-list" | "matchup" }) {
  const entries = variant === "matchup" ? MATCHUP : TIER_LIST;

  return (
    <details className="group rounded-card border border-line bg-surface/40">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-fg-muted transition-colors hover:text-fg">
        <HelpCircle className="size-4 shrink-0" />
        How to read these numbers
        <span className="ml-auto text-xs text-fg-subtle group-open:hidden">Show</span>
        <span className="ml-auto hidden text-xs text-fg-subtle group-open:inline">Hide</span>
      </summary>
      <dl className="space-y-3 border-t border-line px-4 py-4 text-sm">
        {entries.map((entry, index) => (
          <div key={index} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
            <dt className="shrink-0 sm:w-28">{entry.term}</dt>
            <dd className="leading-relaxed text-fg-muted">{entry.body}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
