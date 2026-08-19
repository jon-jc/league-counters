"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Native select under a styled shell — keeps platform keyboard behaviour and
 * mobile pickers instead of reimplementing a listbox.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={cn("group relative block", className)}>
      <span className="sr-only">{label}</span>
      <span className="pointer-events-none absolute top-1.5 left-3 text-[10px] font-medium tracking-wider text-fg-subtle uppercase">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full appearance-none rounded-xl border border-line bg-surface-2/60 pt-5 pr-9 pb-1.5 pl-3",
          "text-sm font-medium text-fg transition-colors",
          "hover:border-line-strong focus:border-accent focus:outline-none",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-subtle" />
    </label>
  );
}
