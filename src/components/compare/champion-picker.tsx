"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { ChampionAvatar } from "@/components/champion/champion-avatar";
import { cn } from "@/lib/utils";

export interface PickerChampion {
  slug: string;
  name: string;
  icon: string;
}

/**
 * Searchable champion combobox. Built rather than using a native select
 * because 170+ options need filtering, and because the option rows carry
 * portraits — but keyboard behaviour (arrows, enter, escape) is preserved.
 */
export function ChampionPicker({
  label,
  champions,
  value,
  onChange,
}: {
  label: string;
  champions: PickerChampion[];
  value: string | null;
  onChange: (slug: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selected = champions.find((c) => c.slug === value) ?? null;

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!needle) return champions;
    return champions.filter((c) =>
      c.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(needle),
    );
  }, [champions, query]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function commit(slug: string) {
    onChange(slug);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter") {
      const choice = results[highlight];
      if (open && choice) {
        event.preventDefault();
        commit(choice.slug);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <span className="mb-1.5 block text-[11px] font-medium tracking-wider text-fg-subtle uppercase">
        {label}
      </span>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-left transition-colors",
          "hover:border-line-strong focus:border-accent focus:outline-none",
        )}
      >
        {selected ? (
          <>
            <ChampionAvatar src={selected.icon} alt="" size="sm" />
            <span className="flex-1 truncate text-sm font-medium">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-sm text-fg-subtle">Select a champion…</span>
        )}
        {selected && (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Clear ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              onChange(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
                onChange(null);
              }
            }}
            className="rounded p-0.5 text-fg-subtle hover:text-fg"
          >
            <X className="size-4" />
          </span>
        )}
        <ChevronDown className="size-4 shrink-0 text-fg-subtle" />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-line-strong bg-surface shadow-2xl">
          <div className="relative border-b border-line">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                // Re-anchor the highlight to the top of the new result set.
                setHighlight(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search…"
              aria-label={`Search ${label}`}
              className="w-full bg-transparent py-2.5 pr-3 pl-9 text-sm placeholder:text-fg-subtle focus:outline-none"
            />
          </div>
          <ul id={listboxId} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {results.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-fg-muted">No matches.</li>
            )}
            {results.map((champion, position) => (
              <li key={champion.slug}>
                <button
                  type="button"
                  role="option"
                  aria-selected={champion.slug === value}
                  onMouseEnter={() => setHighlight(position)}
                  onClick={() => commit(champion.slug)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm",
                    position === highlight ? "bg-surface-3 text-fg" : "text-fg-muted",
                  )}
                >
                  <ChampionAvatar src={champion.icon} alt="" size="xs" />
                  <span className="truncate">{champion.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
