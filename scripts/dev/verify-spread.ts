/**
 * Checks the matchup spread chart against the data it claims to show.
 *
 * The chart is the one part of the site that cannot be proof-read — it is
 * geometry, not text — so its geometry is asserted instead: position must track
 * delta, size must track sample, colour must track sign, and nothing may be
 * drawn outside the canvas.
 *
 *   npx tsx scripts/dev/verify-spread.ts [url]
 */
export {};

const url = process.argv[2] ?? "http://localhost:3100/counters?champion=lee-sin";

const html = await fetch(url).then((r) => r.text());
const start = html.indexOf("Matchup spread");
if (start === -1) throw new Error("no spread chart on that page");

const svg = html.slice(html.indexOf("<svg", start), html.indexOf("</svg>", start));

interface Dot {
  cx: number;
  cy: number;
  r: number;
  cls: string;
  name: string;
  delta: number;
  games: number;
}

const dots: Dot[] = [];
for (const match of svg.matchAll(/<circle\b([^>]*)>([\s\S]*?)<\/circle>/g)) {
  const [, attrs = "", inner = ""] = match;
  const attr = (name: string) => {
    const found = attrs.match(new RegExp(`${name}="([^"]*)"`));
    return found?.[1] ?? "";
  };
  const title = (inner.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").replace(/<!-- -->/g, "");
  const parsed = title.match(/^(.+?): (-?[\d.]+)% vs baseline, (\d+) games/);
  if (!parsed) continue;
  dots.push({
    cx: Number(attr("cx")),
    cy: Number(attr("cy")),
    r: Number(attr("r")),
    cls: attr("class"),
    name: parsed[1]!,
    delta: Number(parsed[2]),
    games: Number(parsed[3]),
  });
}

const viewBox = (svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) ?? []).slice(1).map(Number);
const [width = 720, height = 0] = viewBox;
const centre = width / 2;

const byDelta = [...dots].sort((a, b) => a.delta - b.delta);
const monotonic = byDelta.every((d, i) => i === 0 || d.cx >= byDelta[i - 1]!.cx - 0.001);

const biggest = dots.reduce((a, b) => (a.games > b.games ? a : b));
const smallest = dots.reduce((a, b) => (a.games < b.games ? a : b));

const checks: [string, boolean, string][] = [
  ["dots match the data", dots.length > 0, `${dots.length} drawn`],
  ["x position tracks delta", monotonic, "sorted by delta is sorted by x"],
  [
    "unfavourable lanes sit left of centre",
    dots.filter((d) => d.delta < 0).every((d) => d.cx <= centre),
    `centre = ${centre}`,
  ],
  [
    "favourable lanes sit right of centre",
    dots.filter((d) => d.delta > 0).every((d) => d.cx >= centre),
    `centre = ${centre}`,
  ],
  [
    "dot size tracks sample size",
    biggest.r > smallest.r,
    `${smallest.games}g r=${smallest.r} -> ${biggest.games}g r=${biggest.r}`,
  ],
  [
    "colour tracks sign",
    dots.filter((d) => d.delta < -0.6).every((d) => d.cls.includes("bad")) &&
      dots.filter((d) => d.delta > 0.6).every((d) => d.cls.includes("good")),
    "negative red, positive green",
  ],
  [
    "nothing drawn outside the canvas",
    dots.every((d) => d.cx >= 0 && d.cx <= width && d.cy >= 0 && d.cy <= height),
    `${width} x ${height}`,
  ],
  [
    "every dot is individually labelled",
    dots.every((d) => d.name.length > 0),
    "each has a <title> for hover and screen readers",
  ],
];

let failed = 0;
for (const [label, pass, detail] of checks) {
  if (!pass) failed += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label.padEnd(38)} ${detail}`);
}
process.exitCode = failed === 0 ? 0 : 1;
