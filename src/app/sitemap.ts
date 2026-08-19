import type { MetadataRoute } from "next";
import { getChampionIndex } from "@/lib/lol/ddragon";
import { listSnapshots } from "@/lib/data/repository";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [index, snapshots] = await Promise.all([getChampionIndex(), listSnapshots()]);

  /* Content changes when a snapshot is published, so lastModified tracks the
     newest ingest rather than the build time. */
  const lastModified = snapshots[0]?.generatedAt
    ? new Date(snapshots[0].generatedAt)
    : new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/counters`, lastModified, changeFrequency: "daily", priority: 0.95 },
    { url: `${siteUrl}/tier-list`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/champions`, lastModified, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/compare`, lastModified, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/methodology`, lastModified, changeFrequency: "monthly", priority: 0.4 },
  ];

  const champions: MetadataRoute.Sitemap = index.all.map((champion) => ({
    url: `${siteUrl}/champions/${champion.slug}`,
    lastModified,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...pages, ...champions];
}
