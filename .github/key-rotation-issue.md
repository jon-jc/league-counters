The scheduled key check could not authenticate against the Riot API.
Development keys stop working 24 hours after they are issued, so ingestion is
paused until a new one is installed.

**To fix it,** from a checkout of this repository:

```bash
npm run key:rotate
```

Generate the key first at <https://developer.riotgames.com/> — *Regenerate API
Key*. The command validates the key against Riot before storing it anywhere,
writes `.env.local`, and updates the `RIOT_API_KEY` repository secret. The key
is never echoed, never passed as a command-line argument, and never written to
shell history.

This issue closes itself once the key works again.

---

**To stop this recurring:** register a product at
<https://developer.riotgames.com/app-type> and apply for a personal key. Personal
and production keys do not expire, and the ingestion pipeline needs no code
change to use one — the rate limiter reads its budget from Riot's response
headers.
