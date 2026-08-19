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
- **Compare** — two champions head to head in a chosen lane.
- **Per region** — every Riot platform is aggregated independently.

## Getting started

```bash
npm install
cp .env.example .env.local   # add your Riot API key
npm run dev
```

The site runs without a Riot key: `data/snapshots/` ships with placeholder
snapshots so every page renders. They are tagged `source: "seed"` and the UI
labels them as sample data.

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

A **development key** allows 100 requests per 2 minutes — roughly 50 matches a
minute. That is enough to rank champions within a day, but genuine matchup
coverage needs far more volume, since a lane pairing only accrues one game per
match. A **production key** (30,000 requests per 10 minutes) reaches useful
matchup depth in under an hour.

The rate limiter reads Riot's `X-App-Rate-Limit` header and adopts whatever
limits the key actually has, so moving to a production key needs no code change.

### Scheduled runs

`.github/workflows/ingest.yml` runs every three hours, ingests each configured
region, and commits the updated snapshots back to `main`. It needs a
`RIOT_API_KEY` repository secret. Development keys expire every 24 hours, so a
production key is required for this to keep working unattended.

## Scripts

| Command            | Description                                  |
| ------------------ | -------------------------------------------- |
| `npm run dev`      | Development server                           |
| `npm run build`    | Production build                             |
| `npm test`         | Unit tests (Vitest)                          |
| `npm run lint`     | ESLint                                       |
| `npm run typecheck`| `tsc --noEmit`                               |
| `npm run ingest`   | Aggregate ranked matches into a snapshot     |
| `npm run seed`     | Regenerate the placeholder dataset           |

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
