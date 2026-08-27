# League Counters

A League of Legends counter-pick and tier-list tracker. Tier lists and lane
matchups are aggregated from real ranked matches, per region, and recomputed as
each patch settles.

Built with Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS v4.

## What it does

- **Tier list** — champions ranked per role by a blend of win rate and how
  contested they are, filterable by region, rank bracket and queue.
- **Counters** — every lane matchup scored as a win-rate delta against the
  champion's own baseline, not as a raw win rate.
- **Global view** — every region summed, which is the difference between roughly
  700 scored lanes and over 3,000.
- **Compare** — two champions head to head in a chosen lane.
- **Per region** — every Riot platform is aggregated independently.

## Getting started

```bash
npm install
cp .env.example .env.local   # add your Riot API key
npm run dev
```

The site runs without a Riot key: `data/snapshots/` ships with **real** ranked
snapshots for every supported region, committed by the scheduled ingest.

If you want throwaway data to develop against — after changing the ranking
formula, say — `npm run seed` generates a deterministic placeholder set. Those
snapshots are tagged `source: "seed"` and the UI labels them as sample data
wherever they appear, so they can never be mistaken for the live meta. Nothing
synthetic is committed.

## How the numbers are produced

Snapshots store **raw counts only** — games, wins, bans. Every rate is derived
at read time, which keeps the stored data small and means a change to the
ranking formula does not require re-ingesting anything.

Three choices do most of the work:

- **Shrinkage toward a 50% prior.** Ranked samples are wildly uneven. Champion
  win rates are shrunk against 150 pseudo-games and matchups against 40, so a
  9–3 record cannot outrank a champion with genuine volume.
- **Tier score is a blend.** `0.72·z(win rate) + 0.28·z(presence)`, computed
  *within* each role. Sorting by win rate alone buries contested picks, and
  comparing across roles buries support, whose win rates are naturally flat.
- **Counters are deltas.** A matchup is scored against the champion's own
  baseline in that role. A champion with a 46% overall win rate that goes 49%
  into a specific lane is over-performing there, and a raw win-rate sort would
  never surface it.

Rows below 20 games (8 for matchups) are hidden rather than ranked, and every
row carries a confidence indicator derived from its Wilson interval.

## Ingestion

```bash
npm run ingest -- --region KR --bracket master_plus --matches 600
```

| Flag           | Default         | Meaning                             |
| -------------- | --------------- | ----------------------------------- |
| `--region`     | `NA1`           | Riot platform id                    |
| `--bracket`    | `emerald_plus`  | Rank floor to sample                |
| `--queue`      | `420`           | 420 solo/duo, 440 flex              |
| `--matches`    | `200`           | Match budget for this run           |
| `--players`    | `40`            | Ladder players to pull history from |
| `--per-player` | `20`            | Match ids requested per player      |

Runs are **additive and resumable**. A checkpoint of already-seen match ids
lives in `data/checkpoints/` and is committed alongside the snapshot, so
repeated short runs accumulate into a real sample over the life of a patch
instead of re-counting the same games. The snapshot is flushed to disk every
100 matches, so an interrupted run keeps what it had.

Matches are rejected if they are the wrong queue, from a different patch, a
remake, or missing a classified position for any of the ten players.

### Rate limits, and how much data you can actually get

Matchup coverage is the expensive part. A champion gains a game every time it is
played, but a lane pairing only gains one when those two champions actually
meet. Rankings settle quickly at any key tier; counter tables need far more
volume.

The rate limiter reads Riot's `X-App-Rate-Limit` header and adopts whatever
limits the key in use actually has, so key tier needs no code change — a wider
allowance simply collects faster. Scheduled runs collect for a fixed stretch of
wall-clock time rather than a fixed match count, so a faster key fills the same
window with more matches.

**Run one ingest at a time.** The limiter tracks only its own requests, but the
budget belongs to the key. Two ingests running concurrently each believe they
own the whole budget, and both spend more time in 429 backoff than fetching —
a single process sees no 429s at all under the same workload. They also write
the same snapshot files, so overlapping runs can flush stale state over each
other. The scheduled workflow loops through regions sequentially for this
reason; do the same locally.

### Why the default view sums every region

Matchup coverage is the scarce resource. A champion gains a game every time it
is played, but a *lane pairing* only gains one when those two champions meet, so
most pairings sit under the display threshold even in a region with thousands of
matches. Measured on the current snapshots:

| View | Scored lanes | Champions with counters |
| ---- | ------------ | ----------------------- |
| KR (largest single region) | 722 | 106 |
| All regions merged | **3,090** | **167** |

So `region=GLOBAL` is the default. Per-region views remain a click away, because
regional metas genuinely differ — but a locally precise answer is worth little
when there is no local data. Only snapshots on the same patch are ever merged.

### Which brackets have data

The pipeline samples **Master+** for every region, and that is what the site
defaults to. Sampling a second bracket would halve the volume behind each one,
which matters far more than breadth while matchup coverage is still the scarce
thing. Requesting a bracket with no snapshot falls back to
the best one that region has, with a notice saying so.

To populate another bracket, point the ingest at it:

```bash
npm run ingest -- --region KR --bracket emerald_plus --matches 2000
```

### Scheduled runs

`.github/workflows/ingest.yml` runs every three hours, ingests each configured
region, and commits the updated snapshots back to `main`. It needs a
`RIOT_API_KEY` repository secret.

## Installing a key

Personal and production keys do not expire. Development keys stop working 24
hours after they are issued, and **Riot publishes no endpoint for issuing one** —
regeneration is a button on the developer portal behind an account login — so
running on a development key means replacing it by hand.

### Installing or replacing

```bash
npm run key:rotate
```

Generate the key first at <https://developer.riotgames.com/> (*Regenerate API
Key*), then paste it when prompted — input is hidden. The command validates it
against Riot **before** storing it anywhere, writes `.env.local`, and updates
the `RIOT_API_KEY` repository secret through the `gh` CLI. A malformed or dead
key is rejected without touching either, so a bad paste cannot take down a
working setup.

It also accepts a pipe, which keeps the key out of shell history:

```bash
echo "RGAPI-..." | npm run key:rotate
```

### Checking a key

```bash
npm run key:check
```

Exit codes are meaningful: `0` usable, `1` needs replacing, `2` Riot
unreachable. That distinction matters — a Riot outage must not be reported as a
dead key.

**Nothing notifies you about the key.** There is no schedule, no issue, no
failing run.

Scheduled ingests skip quietly while the key is expired — the run goes green
with a warning annotation and collects nothing, then resumes on its own once the
key works again. Nothing is lost by skipping: runs are additive, so the next one
picks up where the last left off. A **missing** `RIOT_API_KEY` secret does still
fail loudly, since that is a misconfiguration rather than an expiry and will
never fix itself.

`.github/workflows/key-health.yml` is manual-only. Run it from the Actions tab
when you want to know whether the key in the *repository secret* still works —
`npm run key:check` cannot tell you that, because it reads `.env.local`.

### Stopping the treadmill

Register a product at <https://developer.riotgames.com/app-type> and apply for a
personal key. Personal and production keys **do not expire**, which removes the
daily rotation entirely and raises the rate limit enough to make matchup
coverage practical. No code change is needed — the rate limiter reads its budget
from Riot's response headers.

## Scripts

| Command            | Description                                  |
| ------------------ | -------------------------------------------- |
| `npm run dev`      | Development server                           |
| `npm run build`    | Production build                             |
| `npm test`         | Unit tests (Vitest)                          |
| `npm run lint`     | ESLint                                       |
| `npm run typecheck`| `tsc --noEmit`                               |
| `npm run ingest`   | Aggregate ranked matches into a snapshot     |
| `npm run seed`     | Generate a local placeholder dataset          |
| `npm run ingest:all` | Ingest several regions, one after another   |
| `npm run key:check`  | Report whether the Riot key still works    |
| `npm run key:rotate` | Install a new Riot key everywhere it is needed |

## API

| Route                | Description                                    |
| -------------------- | ---------------------------------------------- |
| `GET /api/tier-list` | Ranking for `?region=&rank=&queue=&role=`      |
| `GET /api/snapshots` | Which region/rank/queue combinations have data |

## Legal

League Counters is not endorsed by Riot Games and does not reflect the views or
opinions of Riot Games or anyone officially involved in producing or managing
Riot Games properties. Riot Games and all associated properties are trademarks
or registered trademarks of Riot Games, Inc.
