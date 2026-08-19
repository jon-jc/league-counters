import type { Role } from "@/lib/lol/constants";
import { ROLE_LABELS } from "@/lib/lol/constants";
import { cn } from "@/lib/utils";

/**
 * Position glyphs drawn inline rather than pulled from a CDN — they need to
 * inherit colour from the active/inactive tab state and stay crisp at 14px.
 */
const PATHS: Record<Role, React.ReactNode> = {
  TOP: (
    <>
      <path d="M3 13.5V3h10.5" />
      <path d="M3 3l7.5 7.5" />
      <path d="M8.5 17.5L17.5 8.5" />
      <path d="M21 10.5V21H10.5" />
    </>
  ),
  JUNGLE: (
    <>
      <path d="M12 21V9" />
      <path d="M12 13c0-3.5-2.2-6.4-5.5-7.5C6 9 8 12.4 12 13Z" />
      <path d="M12 11.5c0-3 1.9-5.6 4.8-6.6C17.3 8.2 15.5 11 12 11.5Z" />
      <path d="M8.5 21h7" />
    </>
  ),
  MIDDLE: (
    <>
      <path d="M3 15V3h12" />
      <path d="M9 21H21V9" />
      <path d="M4.5 19.5L19.5 4.5" />
    </>
  ),
  BOTTOM: (
    <>
      <path d="M21 10.5V21H10.5" />
      <path d="M21 21l-7.5-7.5" />
      <path d="M15.5 6.5L6.5 15.5" />
      <path d="M3 13.5V3h10.5" />
    </>
  ),
  UTILITY: (
    <>
      <path d="M12 3.5 4.5 6.8v5.1c0 4.3 3.1 7.7 7.5 8.6 4.4-.9 7.5-4.3 7.5-8.6V6.8L12 3.5Z" />
      <path d="M12 9v5" />
      <path d="M9.5 11.5h5" />
    </>
  ),
};

export function RoleIcon({ role, className }: { role: Role; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0", className)}
      role="img"
      aria-label={ROLE_LABELS[role]}
    >
      {PATHS[role]}
    </svg>
  );
}
