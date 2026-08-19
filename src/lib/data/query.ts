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
