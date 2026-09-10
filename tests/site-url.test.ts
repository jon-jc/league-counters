import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "@/lib/site-url";

describe("resolveSiteUrl", () => {
  /* The production failure: Vercel supplied NEXT_PUBLIC_SITE_URL as "", which
     `??` accepts as a real value, and `new URL("")` threw while collecting
     page data for /_not-found. */
  it("treats an empty variable as unset instead of handing it to new URL", () => {
    const url = resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "" });
    expect(url).toBe("http://localhost:3000");
    expect(() => new URL(url)).not.toThrow();
  });

  it("treats a whitespace-only variable as unset", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "   " })).toBe("http://localhost:3000");
  });

  it("falls back to Vercel's production domain, adding the scheme Vercel omits", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "",
        VERCEL_PROJECT_PRODUCTION_URL: "league-counters.vercel.app",
      }),
    ).toBe("https://league-counters.vercel.app");
  });

  it("prefers the production domain over a per-deployment preview URL", () => {
    expect(
      resolveSiteUrl({
        VERCEL_PROJECT_PRODUCTION_URL: "league-counters.vercel.app",
        VERCEL_URL: "league-counters-abc123.vercel.app",
      }),
    ).toBe("https://league-counters.vercel.app");
  });

  it("uses an explicit site URL over anything Vercel provides", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "https://counters.example",
        VERCEL_PROJECT_PRODUCTION_URL: "league-counters.vercel.app",
      }),
    ).toBe("https://counters.example");
  });

  it("normalises to an origin so appended paths never double their slashes", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://counters.example/" })).toBe(
      "https://counters.example",
    );
  });

  it("skips a malformed value rather than failing the build", () => {
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "http://", VERCEL_URL: "preview.vercel.app" }),
    ).toBe("https://preview.vercel.app");
  });

  it("defaults to localhost when nothing is configured", () => {
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });
});
