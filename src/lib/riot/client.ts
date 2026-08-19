import { type z } from "zod";
import { RateLimiter } from "./rate-limiter";
import {
  leagueEntriesSchema,
  leagueListSchema,
  matchIdsSchema,
  matchSchema,
  type RiotMatch,
} from "./types";
import { platformHost, routeHost, type PlatformId } from "@/lib/lol/regions";
import type { QueueId, RankTier } from "@/lib/lol/constants";

const QUEUE_NAMES: Record<QueueId, string> = {
  420: "RANKED_SOLO_5x5",
  440: "RANKED_FLEX_SR",
};

export class RiotApiError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    // The URL never carries the key — it travels in the X-Riot-Token header.
    super(`Riot API ${status} for ${url}`);
    this.name = "RiotApiError";
  }
}

export interface RiotClientOptions {
  apiKey: string;
  /** Called on each retry, for progress output. */
  onRetry?: (info: { url: string; status: number; waitSeconds: number }) => void;
  maxRetries?: number;
}

/**
 * Thin Riot API client: rate limiting, retry on 429/5xx, and schema validation
 * at the boundary so a shape change surfaces here rather than deep in the
 * aggregator.
 */
export class RiotClient {
  private readonly limiter = new RateLimiter();
  private readonly apiKey: string;
  private readonly onRetry: RiotClientOptions["onRetry"];
  private readonly maxRetries: number;

  constructor({ apiKey, onRetry, maxRetries = 5 }: RiotClientOptions) {
    if (!apiKey) throw new Error("RIOT_API_KEY is not set");
    this.apiKey = apiKey;
    this.onRetry = onRetry;
    this.maxRetries = maxRetries;
  }

  private async request<T>(url: string, schema: z.ZodType<T>): Promise<T> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      await this.limiter.acquire();

      const response = await fetch(url, {
        headers: { "X-Riot-Token": this.apiKey },
        cache: "no-store",
      });

      this.limiter.observeLimitHeader(response.headers.get("x-app-rate-limit"));

      if (response.ok) {
        return schema.parse(await response.json());
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === this.maxRetries) {
        throw new RiotApiError(response.status, stripQuery(url));
      }

      const retryAfter = Number(response.headers.get("retry-after"));
      const waitSeconds = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter
        : Math.min(60, 2 ** attempt);
      this.limiter.blockFor(waitSeconds);
      this.onRetry?.({ url: stripQuery(url), status: response.status, waitSeconds });
    }

    throw new RiotApiError(0, stripQuery(url));
  }

  /** Challenger / Grandmaster / Master ladders — one request each. */
  async apexLeague(
    platform: PlatformId,
    queue: QueueId,
    tier: "challenger" | "grandmaster" | "master",
  ): Promise<string[]> {
    const url = `${platformHost(platform)}/lol/league/v4/${tier}leagues/by-queue/${QUEUE_NAMES[queue]}`;
    const league = await this.request(url, leagueListSchema);
    return league.entries.map((entry) => entry.puuid);
  }

  /** A page of a specific tier/division, for brackets below Master. */
  async leagueEntries(
    platform: PlatformId,
    queue: QueueId,
    tier: RankTier,
    division: "I" | "II" | "III" | "IV",
    page = 1,
  ): Promise<string[]> {
    const url = `${platformHost(platform)}/lol/league/v4/entries/${QUEUE_NAMES[queue]}/${tier}/${division}?page=${page}`;
    const entries = await this.request(url, leagueEntriesSchema);
    return entries.map((entry) => entry.puuid);
  }

  async matchIds(
    platform: PlatformId,
    puuid: string,
    queue: QueueId,
    count = 20,
  ): Promise<string[]> {
    const url = `${routeHost(platform)}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${queue}&type=ranked&start=0&count=${count}`;
    return this.request(url, matchIdsSchema);
  }

  async match(platform: PlatformId, matchId: string): Promise<RiotMatch> {
    const url = `${routeHost(platform)}/lol/match/v5/matches/${matchId}`;
    return this.request(url, matchSchema);
  }
}

/** Keep query strings out of error messages and logs. */
function stripQuery(url: string): string {
  const index = url.indexOf("?");
  return index === -1 ? url : url.slice(0, index);
}
