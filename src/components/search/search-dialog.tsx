"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { CornerDownLeft, ListOrdered, Search, Swords, Users } from "lucide-react";
import { ChampionAvatar } from "@/components/champion/champion-avatar";
import { cn } from "@/lib/utils";

export interface SearchChampion {
  slug: string;
  name: string;
  title: string;
  icon: string;
}

interface Result {
  key: string;
  label: string;
  hint: string;
  href: Route;
  icon?: string;
  glyph?: "tier" | "champions" | "compare";
}

const PAGES: Result[] = [
  { key: "page:tier", label: "Tier list", hint: "Ranked meta", href: "/tier-list" as Route, glyph: "tier" },
  { key: "page:champions", label: "Champions", hint: "Full roster", href: "/champions" as Route, glyph: "champions" },
  { key: "page:compare", label: "Compare", hint: "Head to head", href: "/compare" as Route, glyph: "compare" },
];

const GLYPHS = {
  tier: ListOrdered,
  champions: Users,
  compare: Swords,
} as const;

/** "Kai'Sa" -> "kaisa" so a typed apostrophe is never required. */
function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function score(champion: SearchChampion, needle: string): number {
  const name = normalise(champion.name);
  if (name === needle) return 0;
  if (name.startsWith(needle)) return 1;

  const initials = champion.name
    .split(/[\s'&.]+/)
    .map((word) => word[0]?.toLowerCase() ?? "")
    .join("");
  if (initials.startsWith(needle)) return 2;
  if (name.includes(needle)) return 3;
  if (normalise(champion.title).includes(needle)) return 4;
  return Number.POSITIVE_INFINITY;
}

export function SearchDialog({
  champions,
  open,
  onOpenChange,
}: {
  champions: SearchChampion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo<Result[]>(() => {
    const needle = normalise(query);
    if (!needle) return PAGES;

    const matches = champions
      .map((champion) => ({ champion, rank: score(champion, needle) }))
      .filter((entry) => Number.isFinite(entry.rank))
      .sort((a, b) => a.rank - b.rank || a.champion.name.localeCompare(b.champion.name))
      .slice(0, 8)
      .map<Result>(({ champion }) => ({
        key: `champion:${champion.slug}`,
        label: champion.name,
        hint: champion.title,
        href: `/champions/${champion.slug}` as Route,
        icon: champion.icon,
      }));

    const pages = PAGES.filter((page) => normalise(page.label).includes(needle));
    return [...matches, ...pages];
  }, [champions, query]);

  const close = useCallback(() => {
    onOpenChange(false);
    setQuery("");
    setActive(0);
  }, [onOpenChange]);

  const commit = useCallback(
    (result: Result) => {
      close();
      router.push(result.href);
    },
    [close, router],
  );

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // Keep the highlighted row inside the scroll container.
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  function onInputKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => (value + 1) % Math.max(results.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => (value - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === "Enter") {
      const result = results[active];
      if (result) {
        event.preventDefault();
        commit(result);
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-canvas/80 px-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={close}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-line">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search champions…"
            aria-label="Search champions"
            className="w-full bg-transparent py-4 pr-4 pl-11 text-sm placeholder:text-fg-subtle focus:outline-none"
          />
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-fg-muted">
            Nothing matches “{query}”.
          </p>
        ) : (
          <ul ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
            {results.map((result, index) => {
              const Glyph = result.glyph ? GLYPHS[result.glyph] : null;
              return (
                <li key={result.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => commit(result)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                      index === active ? "bg-surface-3" : "hover:bg-surface-2",
                    )}
                  >
                    {result.icon ? (
                      <ChampionAvatar src={result.icon} alt="" size="sm" />
                    ) : (
                      Glyph && (
                        <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-muted">
                          <Glyph className="size-4" />
                        </span>
                      )
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{result.label}</span>
                      <span className="block truncate text-xs text-fg-subtle capitalize">
                        {result.hint}
                      </span>
                    </span>
                    {index === active && (
                      <CornerDownLeft className="size-3.5 shrink-0 text-fg-subtle" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
