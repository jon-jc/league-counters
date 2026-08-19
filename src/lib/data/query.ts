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
import { DEFAULT_REGION, resolveRegion, type RegionId } from "@/lib/lol/regions";

/** Search params as Next hands them to a server component. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface SnapshotQuery {
  /** A shard, or GLOBAL for the cross-region aggregate. */
  platform: RegionId;
  queue: QueueId;
  bracket: Bracket;
  role: Role | null;
  /**
   * Whether the visitor actually asked for this bracket.
   *
   * A default is not a choice. When nobody picked a bracket we are free to
   * serve the best snapshot a region has; when someone did pick one, we owe
   * them exactly that, even if it is thin.
   */
  bracketExplicit: boolean;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parse ?region=&queue=&rank=&role= into a validated query, falling back to defaults. */
export function parseSnapshotQuery(params: RawSearchParams): SnapshotQuery {
  const platform = resolveRegion(first(params.region) ?? DEFAULT_REGION);

  const rawQueue = Number(first(params.queue));
  const queue: QueueId = isQueueId(rawQueue) ? rawQueue : DEFAULT_QUEUE;

  const rawBracket = first(params.rank);
  const bracketExplicit = Boolean(rawBracket && isBracket(rawBracket));
  const bracket: Bracket = bracketExplicit ? (rawBracket as Bracket) : DEFAULT_BRACKET;

  return {
    platform,
    queue,
    bracket,
    bracketExplicit,
    role: resolveRole(first(params.role)),
  };
}
