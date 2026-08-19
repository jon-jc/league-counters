import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { championSquareUrl, getChampionIndex } from "@/lib/lol/ddragon";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "League Counters — who counters any LoL champion",
    template: "%s · League Counters",
  },
  description:
    "Find who counters any League of Legends champion. Every lane matchup scored from real ranked games by win-rate delta against the champion's own baseline.",
  openGraph: {
    type: "website",
    siteName: "League Counters",
    title: "League Counters — who counters any LoL champion",
    description:
      "Every lane matchup scored from real ranked games, region by region.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const index = await getChampionIndex();
  const champions = index.all.map((champion) => ({
    slug: champion.slug,
    name: champion.name,
    title: champion.title,
    icon: championSquareUrl(champion, index.version),
  }));

  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-surface-2 focus:px-4 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <SiteHeader champions={champions} />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
