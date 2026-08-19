import { cn } from "@/lib/utils";

export function SiteLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        className="size-7 shrink-0"
        aria-hidden
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="lc-mark" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5B8CFF" />
            <stop offset="1" stopColor="#C084FC" />
          </linearGradient>
        </defs>
        <path
          d="M16 1.6 29 8.4v15.2L16 30.4 3 23.6V8.4L16 1.6Z"
          stroke="url(#lc-mark)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M11.2 10.4v11.2h9.6"
          stroke="url(#lc-mark)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display text-[15px] font-semibold tracking-tight">
        League<span className="text-accent">Counters</span>
      </span>
    </span>
  );
}
