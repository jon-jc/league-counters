import { NextResponse } from "next/server";
import { listSnapshots } from "@/lib/data/repository";
import { PLATFORMS } from "@/lib/lol/regions";
import { BRACKETS, QUEUES } from "@/lib/lol/constants";

export const revalidate = 900;

/** GET /api/snapshots — which region/rank/queue combinations currently have data. */
export async function GET() {
  const snapshots = await listSnapshots();

  return NextResponse.json(
    {
      count: snapshots.length,
      snapshots: snapshots.map((snapshot) => ({
        ...snapshot,
        regionLabel: PLATFORMS[snapshot.platform].label,
        bracketLabel: BRACKETS[snapshot.bracket].label,
        queueLabel: QUEUES[snapshot.queue].label,
      })),
    },
    {
      headers: {
        "cache-control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    },
  );
}
