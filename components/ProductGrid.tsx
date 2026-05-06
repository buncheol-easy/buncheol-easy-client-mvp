import {
  ProductCard,
  type ProductCardItem,
} from "@/components/ProductCard";

type ProductGridProps = {
  items: ProductCardItem[];
  keyPrefix?: string;
};

export function ProductGrid({ items, keyPrefix = "product" }: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-7 pb-6">
      {items.map((item, index) => (
        <ProductCard key={`${keyPrefix}-${item.id}-${index}`} item={item} />
      ))}
    </div>
  );
}
