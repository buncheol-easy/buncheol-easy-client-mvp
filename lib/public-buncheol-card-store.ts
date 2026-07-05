import type { ProductCardItem } from "@/components/ProductCard";

const publicBuncheolCardStoreKey = "buncheol-public-card-cache";
const maxStoredPublicCards = 80;

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

function readStoredCards() {
  for (const storage of getReadableStorages()) {
    try {
      const rawValue = storage.getItem(publicBuncheolCardStoreKey);

      if (!rawValue) {
        continue;
      }

      const parsed = JSON.parse(rawValue) as unknown;

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, ProductCardItem>;
      }
    } catch {
      // Try the next storage.
    }
  }

  return {};
}

function writeStoredCards(cards: Record<string, ProductCardItem>) {
  const storage = getWritableStorage();

  if (!storage) {
    return;
  }

  const entries = Object.entries(cards).slice(-maxStoredPublicCards);

  try {
    storage.setItem(
      publicBuncheolCardStoreKey,
      JSON.stringify(Object.fromEntries(entries)),
    );
  } catch {
    // Public exploration can continue without the preview cache.
  }
}

export function readPublicBuncheolCard(id: string) {
  return readStoredCards()[id] ?? null;
}

export function writePublicBuncheolCard(item: ProductCardItem) {
  const productId = item.productId ?? item.id;
  const cards = readStoredCards();

  writeStoredCards({
    ...cards,
    [item.id]: item,
    [productId]: item,
  });
}
