import {
  ProductCard,
  type ProductCardItem,
} from "@/components/ProductCard";

type ProductGridProps = {
  items: ProductCardItem[];
};

export function ProductGrid({ items }: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-7 pb-6">
      {items.map((item) => (
        <ProductCard key={item.id} item={item} />
      ))}
    </div>
  );
}
