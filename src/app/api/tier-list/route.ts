import { NextResponse } from "next/server";
import { getChampionIndex } from "@/lib/lol/ddragon";
import { resolveSnapshot } from "@/lib/data/repository";
import { buildTierRows } from "@/lib/data/rows";
import { parseSnapshotQuery, type RawSearchParams } from "@/lib/data/query";
import { ROLE_LABELS } from "@/lib/lol/constants";

export const revalidate = 900;

/**
 * GET /api/tier-list?region=KR&rank=emerald_plus&queue=420&role=MIDDLE
 *
 * Returns this site's own ranking, aggregated from Riot's API — the same thing
 * the tier list page shows under its "Our data" source. Unknown or unsupported
 * parameters fall back to defaults rather than erroring.
 *
 * Deliberately does not serve the op.gg-sourced view. Displaying someone
 * else's tier list with attribution is one thing; re-serving their dataset as
 * JSON for other people to consume is another, and not ours to offer.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params: RawSearchParams = Object.fromEntries(url.searchParams.entries());
  const query = parseSnapshotQuery(params);

  const [index, snapshot] = await Promise.all([
    getChampionIndex(),
    resolveSnapshot(query.platform, query.queue, query.bracket, query.bracketExplicit),
  ]);

  if (!snapshot) {
    return NextResponse.json(
      { error: "No snapshot available for this region, rank and queue." },
      { status: 404 },
    );
  }

  const rows = buildTierRows(snapshot, index, query.role);

  return NextResponse.json(
    {
      meta: snapshot.meta,
      role: query.role,
      roleLabel: query.role ? ROLE_LABELS[query.role] : null,
      count: rows.length,
      champions: rows.map(({ icon: _icon, ...row }) => row),
    },
    {
      headers: {
        "cache-control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    },
  );
}
