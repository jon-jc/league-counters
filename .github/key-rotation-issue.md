The scheduled key check could not authenticate against the Riot API, so
ingestion is paused. Development keys stop working 24 hours after they are
issued.

## Make this stop happening

Register a product at <https://developer.riotgames.com/app-type> and apply for a
**personal key**. Personal and production keys **do not expire**, which removes
this chore entirely and raises the rate limit enough to make matchup coverage
practical.

No code change is needed to use one — the rate limiter reads its budget from
Riot's response headers, so a wider key simply goes faster.

Details for the application, matching what this project actually does:

- **What it does:** aggregates ranked matches per region and patch to compute
  champion win/pick/ban rates and lane matchup win-rate deltas.
- **APIs used:** `league-v4` for ladder sampling, `match-v5` for aggregation,
  Data Dragon for static champion data.
- **Data handling:** no personal data is stored — only aggregate counts per
  champion, role and matchup.

## Until then

From a checkout of this repository:

```bash
npm run key:rotate
```

Generate the key first at <https://developer.riotgames.com/> — *Regenerate API
Key*. The command validates it against Riot before storing it anywhere, writes
`.env.local`, and updates the `RIOT_API_KEY` repository secret. The key is never
echoed, never passed as a command-line argument, and never written to shell
history.

---

**This issue closes itself once the key works again.** Scheduled ingests skip
quietly in the meantime rather than failing, so nothing else will mail you about
it — this issue is the only notification, and it will not be repeated.
