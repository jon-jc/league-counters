const LOCAL_ORIGIN = "http://localhost:3000";

/**
 * The site's absolute origin, for `metadataBase`, robots.txt and the sitemap.
 *
 * `process.env.X ?? fallback` is not enough here. `??` only falls back on
 * undefined, and a variable that exists but is blank arrives as "" — which
 * `new URL("")` rejects during page-data collection. That is exactly how a
 * Vercel deploy failed while every local build passed: locally the variable is
 * simply absent. So a blank or malformed value is treated as unset.
 *
 * On Vercel, the platform's own production domain fills in before localhost
 * does, so canonical and Open Graph URLs are correct without any configuration.
 * The production domain is preferred over `VERCEL_URL` because previews should
 * still point canonical links at production, not at a throwaway deployment.
 */
export function resolveSiteUrl(env: Record<string, string | undefined> = process.env): string {
  const candidates = [
    env.NEXT_PUBLIC_SITE_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_URL,
  ];

  for (const candidate of candidates) {
    const origin = toOrigin(candidate);
    if (origin) return origin;
  }
  return LOCAL_ORIGIN;
}

/** A usable origin, or null. Vercel's system variables are bare hostnames. */
function toOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;

  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    /* `origin` rather than the raw string, so a trailing slash never turns
       `${siteUrl}/sitemap.xml` into a double slash. */
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

export const siteUrl = resolveSiteUrl();
