import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  rows?: number;
  columns?: number;
  variant?: "table" | "cards";
  className?: string;
}

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded bg-muted", className)} />
  );
}

export function LoadingSkeleton({
  rows = 3,
  columns = 4,
  variant = "table",
  className,
}: LoadingSkeletonProps) {
  if (variant === "cards") {
    return (
      <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-5 space-y-3">
            <div className="flex items-center gap-3">
              <SkeletonPulse className="h-10 w-10 rounded-lg" />
              <div className="space-y-2 flex-1">
                <SkeletonPulse className="h-4 w-2/3" />
                <SkeletonPulse className="h-3 w-1/3" />
              </div>
            </div>
            <SkeletonPulse className="h-6 w-20" />
            <SkeletonPulse className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header row */}
      <div className="flex gap-4 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonPulse key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 px-4 py-3 border-t border-border">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <SkeletonPulse
              key={colIdx}
              className={cn("h-4 flex-1", colIdx === 0 && "max-w-[200px]")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
