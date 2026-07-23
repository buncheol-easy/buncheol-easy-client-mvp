import {
  ProductCard,
  type ProductCardItem,
} from "@/components/ProductCard";

type ProductGridProps = {
  items: ProductCardItem[];
  keyPrefix?: string;
  variant?: "grid" | "wide";
};

export function ProductGrid({
  items,
  keyPrefix = "product",
  variant = "grid",
}: ProductGridProps) {
  if (variant === "wide") {
    return (
      <div className="space-y-3 pb-6">
        {items.map((item, index) => (
          <ProductCard
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
        <ProductCard key={`${keyPrefix}-${item.id}-${index}`} item={item} />
      ))}
    </div>
  );
}
