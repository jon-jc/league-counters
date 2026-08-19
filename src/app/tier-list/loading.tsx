import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-[58px] w-56" />
        <Skeleton className="h-[58px] w-44" />
        <Skeleton className="h-[58px] w-44" />
      </div>
      <Skeleton className="h-10 w-[420px] max-w-full" />

      <div className="space-y-px rounded-card border border-line bg-surface/50 p-4">
        {Array.from({ length: 12 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 py-2.5">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-4 flex-1 max-w-[180px]" />
            <Skeleton className="h-5 w-8" />
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
