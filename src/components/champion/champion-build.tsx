import Image from "next/image";
import { Gem, Sparkles, Wand2 } from "lucide-react";
import { ConfidenceDot } from "@/components/ui/confidence-dot";
import type { BuildOption, ChampionBuild, SpellPairOption } from "@/lib/data/builds";
import { cn, formatCompact, formatPercent } from "@/lib/utils";

function OptionIcon({ src, alt, size = 36 }: { src: string; alt: string; size?: number }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      className="shrink-0 rounded-md border border-line bg-surface-2"
    />
  );
}

/** One option with its share and how it performed. */
function OptionRow({ option, rank }: { option: BuildOption; rank?: number }) {
  return (
    <li className="flex items-center gap-3 py-2">
      {rank !== undefined && (
        <span className="w-3 shrink-0 text-xs tabular text-fg-subtle">{rank}</span>
      )}
      <OptionIcon src={option.icon} alt="" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{option.name}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-subtle">
          <ConfidenceDot level={option.confidence} />
          {formatCompact(option.games)} games · {formatPercent(option.pickRate, 0)} of builds
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 text-sm tabular font-medium",
          option.winRate >= 0.52
            ? "text-good"
            : option.winRate < 0.485
              ? "text-bad"
              : "text-fg",
        )}
      >
        {formatPercent(option.winRate)}
      </span>
    </li>
  );
}

function SpellRow({ option }: { option: SpellPairOption }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex shrink-0 gap-1">
        {option.spells.map((spell) => (
          <OptionIcon key={spell.name} src={spell.icon} alt={spell.name} size={28} />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{option.name}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-subtle">
          <ConfidenceDot level={option.confidence} />
          {formatCompact(option.games)} games · {formatPercent(option.pickRate, 0)} of builds
        </span>
      </span>
      <span className="shrink-0 text-sm tabular font-medium">
        {formatPercent(option.winRate)}
      </span>
    </li>
  );
}

function Panel({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-surface/60">
      <div className="flex items-start gap-2.5 border-b border-line px-4 py-3">
        <span className="mt-0.5 text-accent">{icon}</span>
        <div>
          <h3 className="font-display text-sm font-semibold">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p>}
        </div>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  );
}

/**
 * What players actually built, ordered by how often rather than by win rate.
 *
 * Sorting by win rate would promote whatever a handful of players got lucky
 * with; frequency is the honest answer to "what is the build", with the win
 * rate shown alongside so an unpopular-but-strong option is still visible.
 */
export function ChampionBuildPanels({
  build,
  roleLabel,
}: {
  build: ChampionBuild;
  roleLabel: string;
}) {
  const hasRunes = build.keystones.length > 0 || build.secondaryStyles.length > 0;
  if (build.items.length === 0 && !hasRunes && build.spells.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold tracking-wide uppercase">
          Most built
        </h2>
        <p className="text-xs text-fg-subtle">
          From {formatCompact(build.games)} {roleLabel.toLowerCase()} games on this snapshot
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {build.items.length > 0 && (
          <Panel
            icon={<Gem className="size-4" />}
            title="Core items"
            hint="Finished items, by how often they were held at the end"
          >
            <ol className="divide-y divide-line/60">
              {build.items.map((item, index) => (
                <OptionRow key={item.id} option={item} rank={index + 1} />
              ))}
            </ol>
          </Panel>
        )}

        {hasRunes && (
          <Panel icon={<Sparkles className="size-4" />} title="Runes">
            <ol className="divide-y divide-line/60">
              {build.keystones.map((rune) => (
                <OptionRow key={rune.id} option={rune} />
              ))}
              {build.secondaryStyles.map((style) => (
                <OptionRow key={`style-${style.id}`} option={style} />
              ))}
            </ol>
          </Panel>
        )}

        <div className="space-y-4">
          {build.spells.length > 0 && (
            <Panel icon={<Wand2 className="size-4" />} title="Summoner spells">
              <ol className="divide-y divide-line/60">
                {build.spells.map((pair) => (
                  <SpellRow key={pair.id} option={pair} />
                ))}
              </ol>
            </Panel>
          )}

          {build.boots.length > 0 && (
            <Panel icon={<Gem className="size-4" />} title="Boots">
              <ol className="divide-y divide-line/60">
                {build.boots.map((boot) => (
                  <OptionRow key={boot.id} option={boot} />
                ))}
              </ol>
            </Panel>
          )}
        </div>
      </div>
    </section>
  );
}
