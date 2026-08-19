import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { ChampionAvatar } from "./champion-avatar";
import type { Champion } from "@/lib/lol/ddragon";

/**
 * Key art as an ambient backdrop, faded hard into the page background so the
 * text on top keeps its contrast regardless of which splash is behind it.
 */
export function ChampionHero({
  champion,
  splash,
  icon,
  children,
}: {
  champion: Champion;
  splash: string;
  icon: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="absolute inset-0 -z-10">
        <Image
          src={splash}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_22%] opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/85 to-canvas/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-canvas via-transparent to-canvas/70" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end gap-5">
          <ChampionAvatar src={icon} alt="" size="xl" className="ring-1 ring-line-strong" />
          <div className="min-w-0">
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {champion.name}
            </h1>
            <p className="mt-1 text-sm text-fg-muted capitalize">{champion.title}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Class tags only — Data Dragon's summary endpoint reports the
                  wrong resource for several champions (Darius as "Mana"), so
                  partype is not shown. */}
              {champion.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
