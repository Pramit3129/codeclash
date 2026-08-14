export function ProblemListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 rounded-xl bg-surface border border-line animate-pulse"
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="w-8 h-4 bg-elevated rounded" />
            <div className="flex-1">
              <div className="h-4 bg-elevated rounded w-48" />
            </div>
          </div>
          <div className="w-16 h-5 bg-elevated rounded" />
        </div>
      ))}
    </div>
  );
}

export function ProblemDetailSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
      {/* Left panel skeleton */}
      <div className="lg:w-1/2 border-r border-line overflow-y-auto">
        <div className="h-[45px] border-b border-line" />
        <div className="px-8 py-9 max-w-[44rem]">
          <div className="flex items-start justify-between gap-5">
            <div className="h-7 w-64 bg-elevated rounded-md animate-pulse" />
            <div className="h-3 w-14 bg-elevated rounded-md animate-pulse" />
          </div>
          <div className="flex items-start gap-10 mt-6">
            <div className="space-y-2">
              <div className="h-2.5 w-16 bg-elevated rounded animate-pulse" />
              <div className="h-3.5 w-14 bg-elevated rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-2.5 w-14 bg-elevated rounded animate-pulse" />
              <div className="h-3.5 w-12 bg-elevated rounded animate-pulse" />
            </div>
          </div>
          <div className="h-px my-7 bg-line" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 bg-elevated rounded animate-pulse" style={{ width: `${85 - i * 5}%` }} />
            ))}
          </div>
        </div>
      </div>
      {/* Right panel skeleton */}
      <div className="lg:w-1/2 flex flex-col">
        <div className="h-12 bg-surface border-b border-line animate-pulse" />
        <div className="flex-1 bg-[#0b0c0f] animate-pulse" />
      </div>
    </div>
  );
}
