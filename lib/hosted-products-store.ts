import type { ProductDetailItem } from "@/lib/mock-products";

const hostedProductIdsKey = "buncheol-hosted-product-ids";
const uploadedProductKeyPrefix = "uploaded-product:";
const hostedProductsChangeEventName = "buncheol-hosted-products-change";
const maxHostedProductCount = 8;
const initialHostedProducts: ProductDetailItem[] = [];
let cachedHostedProductsFingerprint = "";
let cachedHostedProducts = initialHostedProducts;

function getWritableStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    if (window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Fall back to session storage below.
  }

  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function getReadableStorages() {
  if (typeof window === "undefined") {
    return [];
  }

  const storages: Storage[] = [];

  try {
    if (window.localStorage) {
      storages.push(window.localStorage);
    }
  } catch {
    // Ignore blocked storage.
  }

  try {
    if (window.sessionStorage && !storages.includes(window.sessionStorage)) {
      storages.push(window.sessionStorage);
    }
  } catch {
    // Ignore blocked storage.
  }

  return storages;
}

function getUploadedProductKey(productId: string) {
  return `${uploadedProductKeyPrefix}${productId}`;
}

function readHostedProductIds() {
  for (const storage of getReadableStorages()) {
    try {
      const rawValue = storage.getItem(hostedProductIdsKey);

      if (!rawValue) {
        continue;
      }

      const parsedValue = JSON.parse(rawValue);

      if (Array.isArray(parsedValue)) {
        return parsedValue.filter((id): id is string => typeof id === "string");
      }
    } catch {
      // Try the next storage.
    }
  }

  return [];
}

function readUploadedProductIdsFromStorage() {
  const productIds: string[] = [];

  getReadableStorages().forEach((storage) => {
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);

        if (key?.startsWith(uploadedProductKeyPrefix)) {
          productIds.push(key.slice(uploadedProductKeyPrefix.length));
        }
      }
    } catch {
      // Ignore blocked storage.
    }
  });

  return productIds.filter((productId, index, productIds) => {
    return productIds.indexOf(productId) === index;
  });
}

function writeHostedProductIds(productIds: string[]) {
  const storage = getWritableStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(hostedProductIdsKey, JSON.stringify(productIds));
  } catch {
    // The product itself is already stored; the detail route can still load it.
  }
}

function removeUploadedProducts(productIds: string[]) {
  const storages = getReadableStorages();

  productIds.forEach((productId) => {
    try {
      storages.forEach((storage) => {
        storage.removeItem(getUploadedProductKey(productId));
      });
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
  for (const storage of getReadableStorages()) {
    try {
      const rawValue = storage.getItem(getUploadedProductKey(productId));

      if (rawValue) {
        return rawValue;
      }
    } catch {
      // Try the next storage.
    }
  }

  return null;
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
  const storage = getWritableStorage();

  if (!storage) {
    return;
  }

  const currentProductIds = readHostedProductIds();
  const nextProductIds = [
    product.id,
    ...currentProductIds.filter((productId) => productId !== product.id),
  ].slice(0, maxHostedProductCount);
  const prunedProductIds = currentProductIds.filter(
    (productId) => !nextProductIds.includes(productId),
  );

  storage.setItem(getUploadedProductKey(product.id), JSON.stringify(product));
  writeHostedProductIds(nextProductIds);
  removeUploadedProducts(prunedProductIds);
  notifyHostedProductsChanged();
}

export function clearHostedProducts() {
  if (typeof window === "undefined") {
    return;
  }

  const productIds = [
    ...readHostedProductIds(),
    ...readUploadedProductIdsFromStorage(),
  ].filter((productId, index, productIds) => {
    return productIds.indexOf(productId) === index;
  });

  removeUploadedProducts(productIds);

  try {
    getReadableStorages().forEach((storage) => {
      storage.removeItem(hostedProductIdsKey);
    });
  } catch {
    // The in-memory cache is still reset below.
  }

  cachedHostedProductsFingerprint = "";
  cachedHostedProducts = initialHostedProducts;
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
