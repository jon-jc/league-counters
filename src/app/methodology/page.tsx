import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { listSnapshots } from "@/lib/data/repository";
import { MIN_CHAMPION_GAMES, MIN_MATCHUP_GAMES } from "@/lib/data/metrics";
import { MIN_BUILD_GAMES } from "@/lib/data/builds";
import { BRACKETS, QUEUES } from "@/lib/lol/constants";
import { PLATFORMS } from "@/lib/lol/regions";
import { formatCompact, formatRelativeTime } from "@/lib/utils";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How League Counters turns ranked matches into tier lists and counter picks — what is sampled, what is thrown away, and how every number is derived.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-fg-muted">{children}</div>
    </section>
  );
}

export default async function MethodologyPage() {
  const snapshots = await listSnapshots();
  const totalMatches = snapshots.reduce((sum, snapshot) => sum + snapshot.matches, 0);
  const newest = snapshots[0];

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="How this works"
        title="Methodology"
        description="The tier list can be ranked from op.gg's meta or from matches this site aggregates itself, and counters are always our own. Here is exactly how each is built, including what gets thrown away and where the limits are."
      />

      <div className="rounded-card border border-line bg-surface/60 p-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-fg-subtle">Matches aggregated</dt>
            <dd className="mt-1 font-display text-xl font-semibold tabular">
              {formatCompact(totalMatches)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Regions</dt>
            <dd className="mt-1 font-display text-xl font-semibold tabular">
              {new Set(snapshots.map((s) => s.platform)).size}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Patch</dt>
            <dd className="mt-1 font-display text-xl font-semibold tabular">
              {newest?.patch ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Last updated</dt>
            <dd className="mt-1 text-sm font-medium">
              {newest ? formatRelativeTime(newest.generatedAt) : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <Section title="Two sources, and which one you are looking at">
        <p>
          The tier list has a <strong className="text-fg">source switch</strong>, because the two
          datasets behind it are genuinely different things rather than two views of one.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-fg">op.gg</strong> — their lane meta, pulled through their
            public MCP endpoint. Their grading, their ranking, their sample: millions of champion
            games covering every champion in every lane they track. It is shown as theirs, with
            their six tier buckets mapped onto this site&apos;s pills and nothing re-scored. Win
            rates are the one exception, recomputed from the raw game and win counts they
            publish because their percentage field is rounded to two decimals.
          </li>
          <li>
            <strong className="text-fg">Our data</strong> — the ranking described in the rest of
            this page, aggregated here from Riot&apos;s API. Smaller, but it is the only one of
            the two that can be filtered by region and rank, and the only one whose formula is
            open to inspection.
          </li>
        </ul>
        <p>
          The switch also drives the counters page. Matchup coverage is where the two sources
          differ most, and not in our favour: a lane pairing gains one game per match, so our own
          pairings sit at a median of about a dozen games while op.gg&apos;s sit near a hundred.
          Roughly a third of the champion-roles we rank have no counter data of our own at all.
        </p>
        <p>
          op.gg reports the extremes rather than a full table — their best and worst lanes for a
          champion — which this site mirrors to fill both sides of a pairing: if a champion won
          184 of 412 lanes into an opponent, the opponent won the other 228 of that same 412.
          Deltas are always measured against a baseline from the same source as the pairing;
          scoring an op.gg matchup against our own win rate would measure the gap between two
          datasets and call it a counter.
        </p>
        <p>
          Builds and champion pages come from our own aggregation either way.
        </p>
      </Section>

      <Section title="Where our own data comes from">
        <p>
          Ranked ladders are sampled through Riot&apos;s league API, and each sampled player&apos;s
          recent games are pulled through match-v5. Every region is aggregated independently,
          because the meta genuinely differs between them — a champion can be a problem in one
          and unremarkable in another.
        </p>
        <p>
          Champion names, portraits, items and runes come from Riot&apos;s Data Dragon. Nothing on
          this site is hand-authored or estimated.
        </p>
      </Section>

      <Section title="What gets thrown away">
        <p>A match is discarded, not adjusted, when any of the following is true:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>It belongs to a different patch. Mixing patches is how a tier list goes stale.</li>
          <li>It is not the queue being aggregated.</li>
          <li>
            It is a remake — decided by Riot&apos;s own end-of-game result, and by a floor on game
            length.
          </li>
          <li>
            Riot could not classify all ten positions. Partial position data would invent lane
            matchups that never happened.
          </li>
        </ul>
        <p>
          Discards are large and expected: a player&apos;s recent history straddles patch
          boundaries, so a typical run rejects roughly half of what it fetches.
        </p>
      </Section>

      <Section title="How win rates are ranked">
        <p>
          Snapshots store raw counts only — games, wins, bans. Every rate is derived when the page
          renders, so changing the formula never requires re-collecting anything.
        </p>
        <p>
          Rates are <strong className="text-fg">shrunk toward a 50% prior</strong>. Ranked samples
          are wildly uneven, and without this a 9–3 record outranks a champion with ten thousand
          games. Champion rates are shrunk against 150 pseudo-games and matchups against 40.
        </p>
        <p>
          Tier is not a win-rate sort. It blends win rate with how contested a champion is —
          roughly three parts performance to one part presence — and both are scored{" "}
          <em>within the champion&apos;s own role</em>. Comparing across roles would bury support,
          whose win rates are naturally flat.
        </p>
        <p>
          Ranking uses the <strong className="text-fg">lower end</strong> of a champion&apos;s
          win-rate interval rather than its midpoint, so a claim is only as strong as the
          evidence behind it. A 66% record over 77 games no longer outranks 54% over 721.
        </p>
        <p>
          Presence is compared on a log scale. Win rates are symmetric and narrow while pick
          and ban rates have a long tail, so comparing both on a raw spread let sheer
          popularity outweigh a much better record. Bans are also charged to the roles a
          champion actually plays: a ban removes it from the whole game, but crediting the
          full ban rate to all five roles put a heavily-banned mid laner top of the support
          list on twenty games.
        </p>
      </Section>

      <Section title="What makes something a counter">
        <p>
          A counter is a <strong className="text-fg">win-rate delta</strong>, not a win rate. Each
          lane matchup is scored against the champion&apos;s own win rate in that role.
        </p>
        <p>
          This matters more than it sounds. A champion winning 46% overall but 49% into a specific
          opponent is <em>over-performing</em> there, and a raw win-rate sort would never surface
          it. The reverse traps people more often: a strong champion can win 58% into an opponent
          and still be losing that lane relative to its own baseline.
        </p>
      </Section>

      <Section title="Sample sizes, and what is hidden">
        <p>Rows below these thresholds are withheld rather than ranked:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-fg">{MIN_CHAMPION_GAMES} games</strong> for a champion in a
            role.
          </li>
          <li>
            <strong className="text-fg">{MIN_MATCHUP_GAMES} games</strong> for a lane matchup.
          </li>
          <li>
            <strong className="text-fg">{MIN_BUILD_GAMES} games</strong> before a build is shown at
            all.
          </li>
        </ul>
        <p>
          Everything that is shown carries the games behind it and a confidence dot derived from a
          Wilson interval. An empty counter list usually means the pairing is rare, not that
          something is broken.
        </p>
      </Section>

      <Section title="How often it updates">
        <p>
          A scheduled job ingests every region on a three-hour cadence and commits the refreshed
          snapshots, so the site follows a patch as it settles rather than being rebuilt once. Runs
          are additive: each one folds new matches into the existing sample instead of starting
          over.
        </p>
      </Section>

      <Section title="Limits worth knowing">
        <p>
          Matchup coverage needs far more volume than rankings, because a lane pairing only gains
          one game per match while a champion gains one per appearance. Rankings settle quickly;
          counter tables fill in slowly, and thin regions will show gaps.
        </p>
        <p>
          Currently only the{" "}
          <strong className="text-fg">{BRACKETS.master_plus.label}</strong> bracket is sampled, on{" "}
          {QUEUES[420].label}, across{" "}
          {snapshots
            .map((s) => PLATFORMS[s.platform].short)
            .filter((value, index, all) => all.indexOf(value) === index)
            .join(", ")}
          . Sampling more brackets would divide the same budget further, and depth matters more
          than breadth while matchup coverage is the scarce thing.
        </p>
      </Section>

      <p className="border-t border-line pt-6 text-sm text-fg-muted">
        Still curious?{" "}
        <Link href="/counters" className="text-accent hover:underline">
          Try it on a champion
        </Link>{" "}
        — every number links back to the games behind it.
      </p>
    </div>
  );
}
