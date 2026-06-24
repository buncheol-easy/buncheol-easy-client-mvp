import { readUploadedProduct } from "@/lib/hosted-products-store";

type ProductImageTarget = {
  id: string;
  imageUrl?: string;
  productId?: string;
};

export function getCachedProductImageUrl(productId: string) {
  const cachedProduct = readUploadedProduct(productId);

  return cachedProduct?.imageUrl ?? cachedProduct?.imageUrls?.[0];
}

export function mergeCachedProductImage<T extends ProductImageTarget>(
  item: T,
): T {
  if (item.imageUrl) {
    return item;
  }

  const cachedImageUrl = getCachedProductImageUrl(item.productId ?? item.id);

  return cachedImageUrl ? { ...item, imageUrl: cachedImageUrl } : item;
}
