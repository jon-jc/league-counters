import { Swords } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Compare" };

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Head to head"
        title="Compare champions"
        description="Pick two champions to see how the lane actually plays out."
      />
      <EmptyState
        icon={<Swords className="size-8" />}
        title="Nothing to compare yet"
        description="Matchup data comes from aggregated ranked games. Select two champions once the dataset is available."
      />
    </div>
  );
}
