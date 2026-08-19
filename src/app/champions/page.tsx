import { Users } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Champions" };

export default function ChampionsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Roster"
        title="Champions"
        description="Every champion, with their current standing and lane matchups."
      />
      <EmptyState
        icon={<Users className="size-8" />}
        title="Roster not loaded"
        description="Champion metadata is pulled from Riot's Data Dragon CDN. It will populate once the data layer lands."
      />
    </div>
  );
}
