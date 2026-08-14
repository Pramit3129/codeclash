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
      <div className="lg:w-1/2 p-6 space-y-4 border-r border-line overflow-y-auto">
        <div className="h-7 bg-elevated rounded w-64 animate-pulse" />
        <div className="h-5 bg-elevated rounded w-20 animate-pulse" />
        <div className="space-y-3 mt-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 bg-elevated rounded animate-pulse" style={{ width: `${85 - i * 5}%` }} />
          ))}
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
