import Link from "next/link";
import { SiteLogo } from "./site-logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm space-y-3">
            <SiteLogo />
            <p className="text-sm leading-relaxed text-fg-subtle">
              Counter picks scored from real ranked matches across every Riot platform, and
              recomputed each patch.
            </p>
          </div>
          {/* -my-2 py-2 keeps the touch target comfortably tall without
              opening up the visual spacing between rows. */}
          <nav className="grid grid-cols-2 gap-x-12 text-sm" aria-label="Footer">
            <Link href="/counters" className="-my-1 py-2.5 text-fg-muted hover:text-fg">
              Counters
            </Link>
            <Link href="/tier-list" className="-my-1 py-2.5 text-fg-muted hover:text-fg">
              Tier List
            </Link>
            <Link href="/champions" className="-my-1 py-2.5 text-fg-muted hover:text-fg">
              Champions
            </Link>
            <Link href="/compare" className="-my-1 py-2.5 text-fg-muted hover:text-fg">
              Compare
            </Link>
            <a
              href="https://github.com/jon-jc/league-counters"
              target="_blank"
              rel="noreferrer noopener"
              className="-my-1 py-2.5 text-fg-muted hover:text-fg"
            >
              Source
            </a>
          </nav>
        </div>

        <p className="mt-10 border-t border-line pt-6 text-xs leading-relaxed text-fg-subtle">
          League Counters is not endorsed by Riot Games and does not reflect the views or opinions
          of Riot Games or anyone officially involved in producing or managing Riot Games
          properties. Riot Games and all associated properties are trademarks or registered
          trademarks of Riot Games, Inc.
        </p>
      </div>
    </footer>
  );
}
