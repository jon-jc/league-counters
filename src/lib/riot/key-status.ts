import { platformHost, type PlatformId } from "@/lib/lol/regions";

/**
 * A cheap endpoint that every key can reach — it needs no summoner, no match,
 * and no extra permissions, so a failure means the key itself, not the route.
 */
const PROBE_PATH = "/lol/status/v4/platform-data";

export type KeyStatus =
  /** Key works. */
  | "valid"
  /** Riot does not recognise the key: revoked, mistyped, or a development
      key past its 24-hour lifetime. */
  | "expired"
  /** Recognised but not allowed to call this — a revoked or scoped-down key. */
  | "forbidden"
  /** Key is fine; we are simply calling too fast. */
  | "rate-limited"
  /** Riot is unwell, or the network is. Says nothing about the key. */
  | "unavailable";

/** Map an HTTP status from the probe onto what it says about the key. */
export function classifyKeyStatus(httpStatus: number): KeyStatus {
  if (httpStatus === 200) return "valid";
  if (httpStatus === 401) return "expired";
  if (httpStatus === 403) return "forbidden";
  if (httpStatus === 429) return "rate-limited";
  return "unavailable";
}

/** Whether this status means ingestion can go ahead. */
export function isUsable(status: KeyStatus): boolean {
  return status === "valid" || status === "rate-limited";
}

/** Whether this status means a human has to issue a new key. */
export function needsRotation(status: KeyStatus): boolean {
  return status === "expired" || status === "forbidden";
}

export const STATUS_MESSAGES: Record<KeyStatus, string> = {
  valid: "Key is valid.",
  expired:
    "Riot does not recognise this key. It may have been revoked, or it may be a development key past its 24-hour lifetime.",
  forbidden: "Key is recognised but not permitted to call the API. It may have been revoked.",
  "rate-limited": "Key is valid but currently rate limited.",
  unavailable: "Could not reach the Riot API. This says nothing about the key.",
};

export interface KeyCheck {
  status: KeyStatus;
  httpStatus: number;
  message: string;
}

/**
 * Probe a key against Riot. Never logs or returns the key itself, so this is
 * safe to call from CI where output is retained.
 */
export async function checkKey(
  apiKey: string,
  platform: PlatformId = "NA1",
): Promise<KeyCheck> {
  if (!apiKey.trim()) {
    return { status: "expired", httpStatus: 0, message: "No key was provided." };
  }

  let httpStatus: number;
  try {
    const response = await fetch(`${platformHost(platform)}${PROBE_PATH}`, {
      headers: { "X-Riot-Token": apiKey },
      cache: "no-store",
    });
    httpStatus = response.status;
  } catch {
    return { status: "unavailable", httpStatus: 0, message: STATUS_MESSAGES.unavailable };
  }

  const status = classifyKeyStatus(httpStatus);
  return { status, httpStatus, message: STATUS_MESSAGES[status] };
}

/** Riot development keys look like RGAPI-<uuid>. */
export function looksLikeRiotKey(value: string): boolean {
  return /^RGAPI-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}
