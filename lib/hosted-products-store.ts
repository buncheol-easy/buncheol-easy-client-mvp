import type { ProductDetailItem } from "@/lib/mock-products";

const hostedProductIdsKey = "buncheol-hosted-product-ids";
const uploadedProductKeyPrefix = "uploaded-product:";
const hostedProductsChangeEventName = "buncheol-hosted-products-change";
const maxHostedProductCount = 8;
const initialHostedProducts: ProductDetailItem[] = [];
let cachedHostedProductsFingerprint = "";
let cachedHostedProducts = initialHostedProducts;

function getUploadedProductKey(productId: string) {
  return `${uploadedProductKeyPrefix}${productId}`;
}

function readHostedProductIds() {
  try {
    const rawValue = window.sessionStorage.getItem(hostedProductIdsKey);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);

    return Array.isArray(parsedValue)
      ? parsedValue.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function readUploadedProductIdsFromStorage() {
  const productIds: string[] = [];

  try {
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);

      if (key?.startsWith(uploadedProductKeyPrefix)) {
        productIds.push(key.slice(uploadedProductKeyPrefix.length));
      }
    }
  } catch {
    return [];
  }

  return productIds;
}

function writeHostedProductIds(productIds: string[]) {
  try {
    window.sessionStorage.setItem(
      hostedProductIdsKey,
      JSON.stringify(productIds),
    );
  } catch {
    // The product itself is already stored; the detail route can still load it.
  }
}

function removeUploadedProducts(productIds: string[]) {
  productIds.forEach((productId) => {
    try {
      window.sessionStorage.removeItem(getUploadedProductKey(productId));
    } catch {
      // Ignore storage cleanup failures; the next write may still succeed.
    }
  });
}

function notifyHostedProductsChanged() {
  window.dispatchEvent(new Event(hostedProductsChangeEventName));
}

export function getInitialHostedProducts() {
  return initialHostedProducts;
}

export function readUploadedProduct(productId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = readUploadedProductRawValue(productId);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as ProductDetailItem;
  } catch {
    return null;
  }
}

function readUploadedProductRawValue(productId: string) {
  try {
    return window.sessionStorage.getItem(getUploadedProductKey(productId));
  } catch {
    return null;
  }
}

export function readHostedProducts() {
  if (typeof window === "undefined") {
    return initialHostedProducts;
  }

  const productIds = [
    ...readHostedProductIds(),
    ...readUploadedProductIdsFromStorage(),
  ].filter((productId, index, productIds) => {
    return productIds.indexOf(productId) === index;
  });
  const rawProductEntries = productIds
    .map((productId) => ({
      productId,
      rawValue: readUploadedProductRawValue(productId),
    }))
    .filter((entry): entry is { productId: string; rawValue: string } => {
      return entry.rawValue !== null;
    });
  const fingerprint = rawProductEntries
    .map(({ productId, rawValue }) => `${productId}:${rawValue}`)
    .join("\n");

  if (fingerprint === cachedHostedProductsFingerprint) {
    return cachedHostedProducts;
  }

  const products = rawProductEntries
    .map(({ rawValue }) => {
      try {
        return JSON.parse(rawValue) as ProductDetailItem;
      } catch {
        return null;
      }
    })
    .filter((product): product is ProductDetailItem => product !== null);

  cachedHostedProductsFingerprint = fingerprint;
  cachedHostedProducts =
    products.length > 0 ? products : initialHostedProducts;

  return cachedHostedProducts;
}

export function writeUploadedProduct(product: ProductDetailItem) {
  const currentProductIds = readHostedProductIds();
  const nextProductIds = [
    product.id,
    ...currentProductIds.filter((productId) => productId !== product.id),
  ].slice(0, maxHostedProductCount);
  const prunedProductIds = currentProductIds.filter(
    (productId) => !nextProductIds.includes(productId),
  );

  window.sessionStorage.setItem(
    getUploadedProductKey(product.id),
    JSON.stringify(product),
  );
  writeHostedProductIds(nextProductIds);
  removeUploadedProducts(prunedProductIds);
  notifyHostedProductsChanged();
}

export function subscribeHostedProducts(onStoreChange: () => void) {
  window.addEventListener(hostedProductsChangeEventName, onStoreChange);
  window.addEventListener("focus", onStoreChange);
  window.addEventListener("pageshow", onStoreChange);

  return () => {
    window.removeEventListener(hostedProductsChangeEventName, onStoreChange);
    window.removeEventListener("focus", onStoreChange);
    window.removeEventListener("pageshow", onStoreChange);
  };
}
