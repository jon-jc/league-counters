"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { Route } from "next";
import { ArrowLeftRight } from "lucide-react";
import { ChampionPicker, type PickerChampion } from "./champion-picker";
import { RoleTabs } from "@/components/filters/role-tabs";
import type { Role } from "@/lib/lol/constants";
import { cn } from "@/lib/utils";

export function CompareControls({
  champions,
  a,
  b,
  role,
}: {
  champions: PickerChampion[];
  a: string | null;
  b: string | null;
  role: Role | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const queryString = params.toString();
    startTransition(() => {
      router.replace(`${pathname}${queryString ? `?${queryString}` : ""}` as Route, {
        scroll: false,
      });
    });
  }

  return (
    <div className={cn("space-y-4 transition-opacity", pending && "opacity-70")}>
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <ChampionPicker
          label="Champion"
          champions={champions}
          value={a}
          onChange={(slug) => update({ a: slug })}
        />
        <button
          type="button"
          onClick={() => update({ a: b, b: a })}
          disabled={!a && !b}
          aria-label="Swap champions"
          className="mb-1 hidden size-10 items-center justify-center rounded-xl border border-line bg-surface-2/60 text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-40 sm:inline-flex"
        >
          <ArrowLeftRight className="size-4" />
        </button>
        <ChampionPicker
          label="Opponent"
          champions={champions}
          value={b}
          onChange={(slug) => update({ b: slug })}
        />
      </div>

      <RoleTabs
        value={role}
        onChange={(next) => update({ role: next })}
        includeAll={false}
        className="w-fit max-w-full"
      />
    </div>
  );
}
