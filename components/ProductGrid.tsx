import {
  ProductCard,
  type ProductCardItem,
} from "@/components/ProductCard";

type ProductGridProps = {
  items: ProductCardItem[];
  keyPrefix?: string;
  variant?: "grid" | "wide";
  initialNowMs?: number;
};

export function ProductGrid({
  items,
  keyPrefix = "product",
  variant = "grid",
  initialNowMs,
}: ProductGridProps) {
  if (variant === "wide") {
    return (
      <div className="space-y-3 pb-6">
        {items.map((item, index) => (
          <ProductCard
            initialNowMs={initialNowMs}
            item={item}
            key={`${keyPrefix}-${item.id}-${index}`}
            variant="wide"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-7 pb-6">
      {items.map((item, index) => (
        <ProductCard
          initialNowMs={initialNowMs}
          item={item}
          key={`${keyPrefix}-${item.id}-${index}`}
        />
      ))}
    </div>
  );
}
