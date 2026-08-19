"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Search } from "lucide-react";
import { SearchDialog, type SearchChampion } from "./search-dialog";

/** Header search button plus its dialog, wired to the Cmd/Ctrl+K shortcut. */
export function SearchTrigger({ champions }: { champions: SearchChampion[] }) {
  const [open, setOpen] = useState(false);

  /* Read the platform through useSyncExternalStore rather than an effect: the
     server has no navigator, so it renders the non-Mac label and the client
     corrects it during hydration without a mismatch. */
  const isMac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search champions"
        className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-[10px] text-fg-subtle md:inline">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>

      <SearchDialog champions={champions} open={open} onOpenChange={setOpen} />
    </>
  );
}
