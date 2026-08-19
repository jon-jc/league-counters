"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { Route } from "next";
import type { TierGrade } from "@/lib/data/metrics";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/lol/constants";
import { ChampionAvatar } from "./champion-avatar";
import { TierPill } from "@/components/ui/tier-pill";
import { WinRate } from "@/components/ui/win-rate";
import { cn } from "@/lib/utils";

export interface ChampionGridItem {
  id: number;
  slug: string;
  name: string;
  title: string;
  tags: string[];
  icon: string;
  role: Role | null;
  winRate: number | null;
  tier: TierGrade | null;
}

/** Matches "kaisa", "kai sa" and "ks" against "Kai'Sa". */
function matches(item: ChampionGridItem, needle: string): boolean {
  if (!needle) return true;
  const haystack = `${item.name} ${item.title} ${item.tags.join(" ")}`.toLowerCase();
  const compact = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (haystack.includes(needle) || compact.includes(needle)) return true;

  // Initials: "mf" -> Miss Fortune, "jm" -> Jarvan IV won't match, which is fine.
  const initials = item.name
    .split(/[\s'&]+/)
    .map((word) => word[0]?.toLowerCase() ?? "")
    .join("");
  return initials.startsWith(needle);
}

export function ChampionGrid({ champions }: { champions: ChampionGridItem[] }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<Role | "ALL">("ALL");
  const deferredQuery = useDeferredValue(query);

  const visible = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase().replace(/\s+/g, "");
    return champions.filter(
      (c) => (role === "ALL" || c.role === role) && matches(c, needle),
    );
  }, [champions, deferredQuery, role]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search champions…"
            aria-label="Search champions"
            className="w-full rounded-xl border border-line bg-surface-2/60 py-2.5 pr-10 pl-10 text-sm placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 -translate-y-1/2 text-fg-subtle hover:text-fg"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div
          className="flex items-center gap-1 overflow-x-auto rounded-xl border border-line bg-surface-2/60 p-1"
          role="group"
          aria-label="Filter by role"
        >
          {(["ALL", ...ROLES] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              aria-pressed={role === value}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                role === value
                  ? "bg-accent text-canvas"
                  : "text-fg-muted hover:bg-surface-3 hover:text-fg",
              )}
            >
              {value === "ALL" ? "All" : ROLE_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-fg-subtle" aria-live="polite">
        {visible.length} champion{visible.length === 1 ? "" : "s"}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong py-16 text-center text-sm text-fg-muted">
          No champions match “{query}”.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((champion) => (
            <li key={champion.id}>
              <Link
                href={`/champions/${champion.slug}` as Route}
                className="group flex items-center gap-3 rounded-card border border-line bg-surface/60 p-3 transition-colors hover:border-accent/50 hover:bg-surface-2/60"
              >
                {/* Smaller portrait on phones so the name has room; the card is only
                    about 165px wide in the two-column layout. */}
                <ChampionAvatar
                  src={champion.icon}
                  alt=""
                  size="md"
                  className="size-9 sm:size-12"
                />
                {/* Tier sits on the meta line rather than beside the name. As a
                    sibling it stole 26px from the name, which on a two-column
                    phone layout left barely enough for "Sett". */}
                <div className="min-w-0 flex-1">
                  {/* Wraps rather than truncates. In a two-column phone layout
                      the name box is about 80px, and "Nunu & Willump" needs
                      108px — no amount of shrinking fits it, so it gets a
                      second line instead of an ellipsis. */}
                  <p
                    className="text-sm leading-tight font-semibold break-words text-balance group-hover:text-accent"
                    title={champion.name}
                  >
                    {champion.name}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
                    {champion.tier && <TierPill tier={champion.tier} size="sm" />}
                    <span>
                      {champion.role ? ROLE_LABELS[champion.role] : champion.tags[0]}
                    </span>
                    {champion.winRate !== null && <WinRate value={champion.winRate} />}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
