"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import type { Route } from "next";
import { SiteLogo } from "./site-logo";
import { SearchTrigger } from "@/components/search/search-trigger";
import type { SearchChampion } from "@/components/search/search-dialog";
import { cn } from "@/lib/utils";

const NAV: { href: Route; label: string }[] = [
  { href: "/tier-list", label: "Tier List" },
  { href: "/champions", label: "Champions" },
  { href: "/compare", label: "Compare" },
];

export function SiteHeader({ champions }: { champions: SearchChampion[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0" aria-label="League Counters home">
          <SiteLogo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "text-fg"
                  : "text-fg-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {item.label}
              {isActive(item.href) && (
                <span className="absolute inset-x-3 -bottom-[13px] h-px bg-accent" />
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <SearchTrigger champions={champions} />
          <a
            href="https://github.com/jon-jc/league-counters"
            target="_blank"
            rel="noreferrer noopener"
            className="hidden text-sm text-fg-muted transition-colors hover:text-fg sm:block"
          >
            GitHub
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-2 text-fg-muted hover:bg-surface-2 hover:text-fg md:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-line bg-surface px-4 py-3 md:hidden" aria-label="Mobile">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block rounded-lg px-3 py-2.5 text-sm font-medium",
                isActive(item.href) ? "bg-surface-2 text-fg" : "text-fg-muted",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
