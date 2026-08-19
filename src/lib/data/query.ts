import {
  DEFAULT_BRACKET,
  DEFAULT_QUEUE,
  isBracket,
  isQueueId,
  resolveRole,
  type Bracket,
  type QueueId,
  type Role,
} from "@/lib/lol/constants";
import { resolvePlatform, type PlatformId } from "@/lib/lol/regions";

/** Search params as Next hands them to a server component. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface SnapshotQuery {
  platform: PlatformId;
  queue: QueueId;
  bracket: Bracket;
  role: Role | null;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parse ?region=&queue=&rank=&role= into a validated query, falling back to defaults. */
export function parseSnapshotQuery(params: RawSearchParams): SnapshotQuery {
  const platform = resolvePlatform(first(params.region));

  const rawQueue = Number(first(params.queue));
  const queue: QueueId = isQueueId(rawQueue) ? rawQueue : DEFAULT_QUEUE;

  const rawBracket = first(params.rank);
  const bracket: Bracket = rawBracket && isBracket(rawBracket) ? rawBracket : DEFAULT_BRACKET;

  return { platform, queue, bracket, role: resolveRole(first(params.role)) };
}

/** Serialise a query back to a query string, omitting defaults for clean URLs. */
export function toSearchString(query: Partial<SnapshotQuery>): string {
  const params = new URLSearchParams();
  if (query.platform) params.set("region", query.platform);
  if (query.queue && query.queue !== DEFAULT_QUEUE) params.set("queue", String(query.queue));
  if (query.bracket && query.bracket !== DEFAULT_BRACKET) params.set("rank", query.bracket);
  if (query.role) params.set("role", query.role);
  const s = params.toString();
  return s ? `?${s}` : "";
}
