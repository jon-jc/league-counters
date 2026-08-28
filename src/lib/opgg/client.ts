import { parseChampionCounters, parseLaneMeta, type ChampionCounters, type LaneMeta } from "./parse";
import { championSlug } from "@/lib/lol/ddragon";
import type { Role } from "@/lib/lol/constants";

/**
 * Minimal JSON-RPC client for op.gg's public MCP endpoint.
 *
 * This is deliberately not a general MCP implementation. The endpoint is
 * unauthenticated and stateless for the one tool we call, so the full
 * initialize/session handshake buys nothing — a single `tools/call` works. If
 * op.gg ever starts requiring a session, this is the file that grows one.
 */

const ENDPOINT = "https://mcp-api.op.gg/mcp";
const TOOL = "lol_list_lane_meta_champions";

/** Lanes op.gg reports, and the order it declares them in. */
export const OPGG_LANES = ["top", "mid", "jungle", "adc", "support"] as const;
export type OpggLane = (typeof OPGG_LANES)[number];

/**
 * The fields we ask for, and the only ones the parser expects.
 *
 * `desired_output_fields` is a closed set on op.gg's side — asking for a name
 * it does not know is an error, not a silently ignored field.
 */
const ROW_FIELDS = [
  "champion",
  "tier",
  "rank",
  "win_rate",
  "pick_rate",
  "ban_rate",
  "role_rate",
  "kda",
  "play",
  "win",
  "is_rip",
] as const;

interface JsonRpcResponse {
  error?: { code?: number; message?: string };
  result?: {
    isError?: boolean;
    content?: { type: string; text?: string }[];
  };
}

/**
 * The endpoint may answer as plain JSON or as a single SSE frame depending on
 * the `Accept` header it decides to honour, so unwrap both.
 */
function unwrapBody(raw: string): string {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("event:") && !trimmed.startsWith("data:")) return raw;
  const frames = raw.split(/^data: /m);
  const last = frames[frames.length - 1];
  if (!last) throw new Error("op.gg returned an empty SSE frame");
  return last;
}

async function callTool(
  args: Record<string, unknown>,
  signal?: AbortSignal,
  tool: string = TOOL,
): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`op.gg MCP responded ${res.status} ${res.statusText}`);
  }

  const payload = JSON.parse(unwrapBody(await res.text())) as JsonRpcResponse;

  if (payload.error) {
    throw new Error(`op.gg MCP error ${payload.error.code ?? ""}: ${payload.error.message ?? ""}`);
  }
  if (payload.result?.isError) {
    throw new Error("op.gg MCP reported a tool error");
  }

  const text = payload.result?.content?.find((part) => part.type === "text")?.text;
  if (!text) throw new Error("op.gg MCP returned no text content");
  return text;
}

/** Fetch every lane's tier list in one round trip. */
export async function fetchLaneMeta(signal?: AbortSignal): Promise<LaneMeta> {
  const desiredOutputFields = OPGG_LANES.flatMap((lane) =>
    ROW_FIELDS.map((field) => `data.positions.${lane}[].${field}`),
  );

  const text = await callTool(
    { position: "all", lang: "en_US", desired_output_fields: desiredOutputFields },
    signal,
  );

  return parseLaneMeta(text);
}

/* ---------- Champion counter matchups ---------- */

const COUNTERS_TOOL = "lol_get_champion_analysis";

/** Riot's `teamPosition` values -> op.gg's lane names. */
export const OPGG_LANE_BY_ROLE: Record<Role, OpggLane> = {
  TOP: "top",
  JUNGLE: "jungle",
  MIDDLE: "mid",
  BOTTOM: "adc",
  UTILITY: "support",
};

/**
 * "Kai'Sa" -> "KAISA", "Nunu & Willump" -> "NUNU_WILLUMP".
 *
 * op.gg takes champions in UPPER_SNAKE_CASE, which is the site's own slug with
 * different punctuation — so it is derived from `championSlug` rather than
 * kept as a second hand-maintained table that could drift out of step. Verified
 * against every awkward name in the roster, Wukong and Nunu included.
 */
export function toOpggChampionName(displayName: string): string {
  return championSlug(displayName).toUpperCase().replaceAll("-", "_");
}

const COUNTER_FIELDS = ["champion_id", "champion_name", "play", "win"] as const;

/* op.gg points at these explicitly when the graded counters are too thin, and
   they cover every position the champion plays rather than just the one asked
   for — so they are requested alongside, not only as a retry. */
const SUMMARY_FIELDS = [
  "data.summary.positions[].name",
  ...COUNTER_FIELDS.map((field) => `data.summary.positions[].counters[].${field}`),
];

/**
 * Best and worst matchups for one champion in one lane.
 *
 * op.gg returns only three each way, so this is not a full matchup table — it
 * is the extremes, on a sample far larger than this project can gather.
 */
export async function fetchChampionCounters(
  championName: string,
  lane: OpggLane,
  signal?: AbortSignal,
): Promise<ChampionCounters> {
  const desiredOutputFields = [
    ...COUNTER_FIELDS.map((field) => `data.strong_counters[].${field}`),
    ...COUNTER_FIELDS.map((field) => `data.weak_counters[].${field}`),
    ...SUMMARY_FIELDS,
  ];

  const text = await callTool(
    {
      game_mode: "ranked",
      champion: championName,
      position: lane,
      lang: "en_US",
      desired_output_fields: desiredOutputFields,
    },
    signal,
    COUNTERS_TOOL,
  );

  return parseChampionCounters(text);
}
