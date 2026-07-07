type ProductGridSkeletonProps = {
  ariaLabel: string;
  count?: number;
  className?: string;
  variant?: "grid" | "wide";
};

export function ProductGridSkeleton({
  ariaLabel,
  count = 4,
  className = "",
  variant = "grid",
}: ProductGridSkeletonProps) {
  if (variant === "wide") {
    return (
      <div
        aria-label={ariaLabel}
        className={`space-y-3 pb-6 ${className}`}
        role="status"
      >
        {Array.from({ length: count }).map((_, index) => (
          <div
            className="overflow-hidden rounded-[1rem] border border-black/8 bg-white shadow-[0_12px_28px_rgba(0,0,0,0.06)]"
            key={`product-grid-skeleton-${index}`}
          >
            <div className="skeleton-surface relative aspect-[1.72/1] bg-black/8">
              <div className="absolute left-3 top-3 h-7 w-16 rounded-full bg-white/45" />
              <div className="absolute right-3 top-3 h-9 w-9 rounded-full bg-white/60" />
              <div className="absolute bottom-3 left-3 h-7 w-12 rounded-full bg-white/45" />
            </div>
            <div className="px-3.5 py-3.5">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <div className="skeleton-surface h-6 w-16 rounded-full bg-black/8" />
                <div className="skeleton-surface h-6 w-14 rounded-full bg-black/8" />
                <div className="skeleton-surface h-6 w-14 rounded-full bg-black/8" />
                <div className="skeleton-surface h-6 w-14 rounded-full bg-black/8" />
              </div>
              <div className="skeleton-surface h-5 w-3/4 rounded-full bg-black/8" />
              <div className="skeleton-surface mt-2 h-4 w-1/2 rounded-full bg-black/8" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      aria-label={ariaLabel}
      className={`grid grid-cols-2 gap-x-4 gap-y-7 pb-6 ${className}`}
      role="status"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div className="block space-y-2" key={`product-grid-skeleton-${index}`}>
          <div className="skeleton-surface relative aspect-square rounded-[1.2rem] bg-black/8">
            <div className="absolute bottom-3 left-3 h-5 w-16 rounded-full bg-white/45" />
            <div className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-white/60" />
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <div className="skeleton-surface h-5 w-16 rounded-full bg-black/8" />
              <div className="skeleton-surface h-3 w-16 rounded-full bg-black/8" />
            </div>
            <div className="skeleton-surface h-4 w-full rounded-full bg-black/8" />
            <div className="skeleton-surface mt-2 h-4 w-3/4 rounded-full bg-black/8" />
          </div>
        </div>
      ))}
    </div>
  );
}
