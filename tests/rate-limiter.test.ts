import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/lib/riot/rate-limiter";

describe("RateLimiter", () => {
  it("lets requests through while inside the window", async () => {
    const limiter = new RateLimiter([{ limit: 5, seconds: 1 }]);
    const started = Date.now();
    for (let i = 0; i < 5; i += 1) await limiter.acquire();
    expect(Date.now() - started).toBeLessThan(150);
  });

  it("blocks once the window is full", async () => {
    const limiter = new RateLimiter([{ limit: 2, seconds: 1 }]);
    const started = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    // The third has to wait for the first to age out of the window.
    expect(Date.now() - started).toBeGreaterThan(900);
  });

  it("respects the tightest of several windows", async () => {
    const limiter = new RateLimiter([
      { limit: 100, seconds: 120 },
      { limit: 2, seconds: 1 },
    ]);
    const started = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    expect(Date.now() - started).toBeGreaterThan(900);
  });

  it("adopts the limits Riot reports for the key", async () => {
    const limiter = new RateLimiter([{ limit: 1, seconds: 60 }]);
    // A production key reports far wider windows; the limiter should widen too.
    limiter.observeLimitHeader("30000:600,500:10");

    const started = Date.now();
    for (let i = 0; i < 10; i += 1) await limiter.acquire();
    expect(Date.now() - started).toBeLessThan(150);
  });

  it("ignores a malformed limit header rather than opening the gates", async () => {
    const limiter = new RateLimiter([{ limit: 2, seconds: 1 }]);
    limiter.observeLimitHeader("nonsense");

    const started = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    expect(Date.now() - started).toBeGreaterThan(900);
  });

  it("holds everything back for the duration of a 429", async () => {
    const limiter = new RateLimiter([{ limit: 100, seconds: 1 }]);
    limiter.blockFor(1);
    const started = Date.now();
    await limiter.acquire();
    expect(Date.now() - started).toBeGreaterThan(900);
  });
});
