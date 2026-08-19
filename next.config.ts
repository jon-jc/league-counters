import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ddragon.leagueoflegends.com" },
      { protocol: "https", hostname: "raw.communitydragon.org" },
    ],
  },
  typedRoutes: true,
  // Snapshots are read from disk at request time, so they must be traced into
  // the serverless bundle alongside the compiled routes.
  outputFileTracingIncludes: {
    "/**": ["./data/snapshots/**"],
  },
};

export default nextConfig;
