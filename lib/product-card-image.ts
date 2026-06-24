import type { ProductCardItem } from "@/components/ProductCard";
import { readUploadedProduct } from "@/lib/hosted-products-store";

export function mergeCachedProductImage<T extends ProductCardItem>(item: T): T {
  if (item.imageUrl) {
    return item;
  }

  const cachedProduct = readUploadedProduct(item.productId ?? item.id);
  const cachedImageUrl =
    cachedProduct?.imageUrl ?? cachedProduct?.imageUrls?.[0];

  return cachedImageUrl ? { ...item, imageUrl: cachedImageUrl } : item;
}
