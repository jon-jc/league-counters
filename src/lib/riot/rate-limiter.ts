/** A request budget: at most `limit` requests in any rolling `seconds` window. */
export interface RateWindow {
  limit: number;
  seconds: number;
}

/**
 * Development keys allow 20 req/s and 100 req/2min. The two-minute window is
 * the binding constraint by a wide margin, so the limiter has to respect both
 * rather than just spacing requests evenly.
 */
export const DEV_KEY_WINDOWS: RateWindow[] = [
  { limit: 20, seconds: 1 },
  { limit: 100, seconds: 120 },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sliding-window limiter that also learns from Riot's response headers.
 *
 * Riot returns `X-App-Rate-Limit: 100:120,20:1` on every response, so rather
 * than trusting a hardcoded guess the limiter adopts whatever the key actually
 * has — a production key widens the windows on its own with no code change.
 */
export class RateLimiter {
  private windows: RateWindow[];
  private hits: number[] = [];
  /** Set when a 429 tells us to stop entirely for a while. */
  private blockedUntil = 0;

  constructor(windows: RateWindow[] = DEV_KEY_WINDOWS) {
    this.windows = [...windows];
  }

  /** Blocks until issuing one more request stays inside every window. */
  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();

      if (now < this.blockedUntil) {
        await sleep(this.blockedUntil - now);
        continue;
      }

      const longest = Math.max(...this.windows.map((w) => w.seconds));
      this.hits = this.hits.filter((t) => now - t < longest * 1000);

      let waitMs = 0;
      for (const window of this.windows) {
        const cutoff = now - window.seconds * 1000;
        const inWindow = this.hits.filter((t) => t > cutoff);
        if (inWindow.length >= window.limit) {
          const oldest = inWindow[0]!;
          waitMs = Math.max(waitMs, oldest + window.seconds * 1000 - now + 25);
        }
      }

      if (waitMs <= 0) {
        this.hits.push(Date.now());
        return;
      }
      await sleep(waitMs);
    }
  }

  /** Adopt the real limits for this key, e.g. "100:120,20:1". */
  observeLimitHeader(value: string | null): void {
    if (!value) return;
    const parsed = value
      .split(",")
      .map((part) => part.split(":").map(Number))
      .filter((pair): pair is [number, number] => pair.length === 2 && pair.every(Number.isFinite))
      .map(([limit, seconds]) => ({ limit, seconds }));
    if (parsed.length > 0) this.windows = parsed;
  }

  /** Honour Retry-After from a 429. */
  blockFor(seconds: number): void {
    this.blockedUntil = Math.max(this.blockedUntil, Date.now() + seconds * 1000);
  }
}
