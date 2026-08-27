import type { MatchupDisplayRow } from "@/lib/data/rows";
import { formatPercent } from "@/lib/utils";

/**
 * Every scored lane on one axis, so the *shape* of a champion's matchups is
 * visible at a glance.
 *
 * The lists above answer "who beats this champion" and the table below answers
 * "by how much", but neither shows the distribution: whether a champion is
 * polarised — dominant into half the roster and helpless into the rest — or
 * flat, with every lane close to even. That difference changes how you draft,
 * and a sorted list cannot show it.
 *
 * Rendered as inline SVG on the server: no charting dependency, no client
 * JavaScript, built from the same numbers the table uses.
 *
 * Only the geometry lives in the SVG. Text sits in HTML around it, because a
 * viewBox scales its contents — at phone width, 11px SVG labels render at about
 * six, which is unreadable. HTML labels keep their size at every viewport.
 */

/** Widest delta the axis shows before clamping. */
const DOMAIN = 0.1;
/** Dots are binned into columns so overlapping matchups stack rather than hide. */
const COLUMNS = 48;
const DOT_MIN = 3;
const DOT_MAX = 6.5;
const ROW_HEIGHT = 13;
const PADDING = 8;

const TICKS = [-0.1, -0.05, 0, 0.05, 0.1] as const;

interface Placed {
  row: MatchupDisplayRow;
  x: number;
  depth: number;
  r: number;
}

export function MatchupSpread({
  rows,
  championName,
  roleLabel,
}: {
  rows: MatchupDisplayRow[];
  championName: string;
  roleLabel: string;
}) {
  // A spread needs a spread. Below this it says less than the list already does.
  if (rows.length < 6) return null;

  const width = 720;
  const maxGames = Math.max(...rows.map((r) => r.games));

  // Bin by delta, then stack within each bin so nothing is hidden behind
  // anything else — a beeswarm, done cheaply.
  const bins = new Map<number, MatchupDisplayRow[]>();
  for (const row of [...rows].sort((a, b) => a.delta - b.delta)) {
    const clamped = Math.max(-DOMAIN, Math.min(DOMAIN, row.delta));
    const bin = Math.round(((clamped + DOMAIN) / (DOMAIN * 2)) * (COLUMNS - 1));
    const list = bins.get(bin);
    if (list) list.push(row);
    else bins.set(bin, [row]);
  }

  const placed: Placed[] = [];
  let tallest = 1;
  for (const [bin, list] of bins) {
    tallest = Math.max(tallest, list.length);
    list.forEach((row, depth) => {
      const scale = maxGames > 0 ? row.games / maxGames : 0;
      placed.push({
        row,
        x: (bin / (COLUMNS - 1)) * width,
        depth,
        r: DOT_MIN + Math.sqrt(scale) * (DOT_MAX - DOT_MIN),
      });
    });
  }

  const height = PADDING * 2 + tallest * ROW_HEIGHT;
  const baseline = height - PADDING;

  const hardest = rows.reduce((a, b) => (a.delta < b.delta ? a : b));
  const easiest = rows.reduce((a, b) => (a.delta > b.delta ? a : b));
  const losing = rows.filter((r) => r.delta < 0).length;

  const summary =
    `Distribution of ${championName}'s ${rows.length} scored ${roleLabel} matchups. ` +
    `${losing} are unfavourable. Hardest is ${hardest.name} at ${formatPercent(hardest.delta, 1)}, ` +
    `easiest is ${easiest.name} at ${formatPercent(easiest.delta, 1)}. ` +
    `The same figures are listed in the table below.`;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold tracking-wide uppercase">
          Matchup spread
        </h2>
        <p className="text-xs text-fg-subtle">
          {rows.length} scored lanes · {losing} unfavourable
        </p>
      </div>

      <div className="rounded-card border border-line bg-surface/60 p-4">
        <div className="mb-2 flex items-center justify-between text-[11px]">
          <span className="text-bad">beaten by</span>
          <span className="text-fg-subtle">even</span>
          <span className="text-good">beats</span>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          /* Uniform scaling: "none" would stretch the dots into ellipses.
             Only the geometry shrinks on a narrow screen, and the labels
             around it are HTML, so nothing becomes unreadable. */
          className="h-auto w-full"
          role="img"
          aria-label={summary}
        >
          {TICKS.map((tick) => {
            const x = ((tick + DOMAIN) / (DOMAIN * 2)) * width;
            const isCentre = tick === 0;
            return (
              <line
                key={tick}
                x1={x}
                x2={x}
                y1={0}
                y2={baseline}
                stroke="currentColor"
                strokeWidth={isCentre ? 2 : 1}
                className={isCentre ? "text-line-strong" : "text-line"}
                strokeDasharray={isCentre ? undefined : "3 4"}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {placed.map(({ row, x, depth, r }) => (
            <circle
              key={`${row.opponentId}-${row.role}`}
              cx={x}
              cy={baseline - depth * ROW_HEIGHT - ROW_HEIGHT / 2}
              r={r}
              className={
                row.delta < -0.005
                  ? "fill-bad/70"
                  : row.delta > 0.005
                    ? "fill-good/70"
                    : "fill-fg-subtle/60"
              }
            >
              <title>
                {`${row.name}: ${formatPercent(row.delta, 1)} vs baseline, ${row.games} games`}
              </title>
            </circle>
          ))}

          <line
            x1={0}
            x2={width}
            y1={baseline}
            y2={baseline}
            stroke="currentColor"
            className="text-line"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Axis labels in HTML, at the same fractions as the gridlines above. */}
        <div className="relative mt-1 h-4" aria-hidden>
          {TICKS.map((tick) => (
            <span
              key={tick}
              className="absolute -translate-x-1/2 text-[11px] tabular text-fg-subtle"
              style={{ left: `${((tick + DOMAIN) / (DOMAIN * 2)) * 100}%` }}
            >
              {tick > 0 ? "+" : ""}
              {(tick * 100).toFixed(0)}%
            </span>
          ))}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
          Each dot is one opponent, placed by how far that lane runs from{" "}
          {championName}&apos;s own {roleLabel.toLowerCase()} win rate. Larger dots have more
          games behind them.
        </p>
      </div>
    </section>
  );
}
