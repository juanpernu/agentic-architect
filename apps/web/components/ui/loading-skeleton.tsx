import { Skeleton } from '@/components/ui/skeleton';

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border p-6 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function LoadingTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function LoadingBudgetTable() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      {/* Banner skeleton */}
      <Skeleton className="h-10 w-full rounded-md" />

      {/* Table skeleton */}
      <div className="border rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="bg-muted/50 flex items-center gap-2 px-3 py-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-16 ml-auto" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        {/* Section headers + rows */}
        {Array.from({ length: 2 }).map((_, sectionIdx) => (
          <div key={sectionIdx}>
            {/* Section header */}
            <div className="bg-slate-800 flex items-center gap-2 px-3 py-2">
              <Skeleton className="h-5 w-8 bg-slate-600" />
              <Skeleton className="h-5 w-40 bg-slate-600" />
              <Skeleton className="h-5 w-24 ml-auto bg-slate-600" />
            </div>
            {/* Item rows */}
            {Array.from({ length: 3 }).map((_, rowIdx) => (
              <div key={rowIdx} className="flex items-center gap-2 px-3 py-2 border-b">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24 ml-auto" />
              </div>
            ))}
            {/* Section subtotal */}
            <div className="bg-muted/20 flex items-center gap-2 px-3 py-2">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24 ml-auto" />
            </div>
          </div>
        ))}
        {/* Grand total */}
        <div className="bg-muted/30 border-t-2 flex items-center gap-2 px-3 py-2">
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-28 ml-auto" />
        </div>
      </div>
    </div>
  );
}
