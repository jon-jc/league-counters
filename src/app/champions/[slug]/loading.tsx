import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <div className="border-b border-line bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-end gap-5">
            <Skeleton className="size-24 rounded-2xl" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-48" />
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Skeleton className="h-[58px] w-56" />
            <Skeleton className="h-[58px] w-44" />
            <Skeleton className="h-[58px] w-44" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-[86px] rounded-card" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[420px] rounded-card" />
          <Skeleton className="h-[420px] rounded-card" />
        </div>
      </div>
    </>
  );
}
