type ProductGridSkeletonProps = {
  ariaLabel: string;
  count?: number;
  className?: string;
};

export function ProductGridSkeleton({
  ariaLabel,
  count = 4,
  className = "",
}: ProductGridSkeletonProps) {
  return (
    <div
      aria-label={ariaLabel}
      className={`grid grid-cols-2 gap-x-4 gap-y-7 pb-6 ${className}`}
      role="status"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div className="block space-y-2" key={`product-grid-skeleton-${index}`}>
          <div className="relative aspect-square overflow-hidden rounded-[1.2rem] bg-black/8">
            <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.5)_38%,transparent_76%)]" />
            <div className="absolute bottom-3 left-3 h-5 w-16 animate-pulse rounded-full bg-white/45" />
            <div className="absolute bottom-3 right-3 h-9 w-9 animate-pulse rounded-full bg-white/60" />
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <div className="h-5 w-16 animate-pulse rounded-full bg-black/8" />
              <div className="h-3 w-16 animate-pulse rounded-full bg-black/8" />
            </div>
            <div className="h-4 w-full animate-pulse rounded-full bg-black/8" />
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded-full bg-black/8" />
          </div>
        </div>
      ))}
    </div>
  );
}
