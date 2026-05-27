import type { ProductCardItem } from "@/components/ProductCard";

const publicBuncheolCardStoreKey = "buncheol-public-card-cache";
const maxStoredPublicCards = 80;

function canUseSessionStorage() {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

function readStoredCards() {
  if (!canUseSessionStorage()) {
    return {};
  }

  try {
    const rawValue = window.sessionStorage.getItem(publicBuncheolCardStoreKey);

    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue) as unknown;

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, ProductCardItem>)
      : {};
  } catch {
    return {};
  }
}

function writeStoredCards(cards: Record<string, ProductCardItem>) {
  if (!canUseSessionStorage()) {
    return;
  }

  const entries = Object.entries(cards).slice(-maxStoredPublicCards);

  try {
    window.sessionStorage.setItem(
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
