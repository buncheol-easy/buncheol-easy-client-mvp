"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { MouseEvent } from "react";
import type { ProductCardItem } from "@/components/ProductCard";
import { ProductGrid } from "@/components/ProductGrid";
import { requestBookmarkedBuncheols, toProductCardItem } from "@/lib/auth-api";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import { mergeCachedProductImage } from "@/lib/product-card-image";

type FavoriteFilter = "all" | "favoriteArtist";
type FavoriteSort = "deadline" | "recent";
type FavoriteProductCardItem = ProductCardItem & {
  favoritedOrder: number;
};
type FavoritesViewState = {
  filter?: FavoriteFilter;
  hideClosed?: boolean;
  sort?: FavoriteSort;
};

type FavoritesContentProps = {
  skipEnterAnimation?: boolean;
};

export const FAVORITES_SKIP_ENTER_KEY = "skip-favorites-enter-animation";
const FAVORITES_SCROLL_TOP_KEY = "favorites-scroll-top";
const FAVORITES_VIEW_STATE_KEY = "favorites-view-state";

// Deadline strings are entered as Korea-local cutoff times.
const kstOffsetHours = 9;

function parseDeadline(deadline: string) {
  const match = deadline
    .trim()
    .match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})(?:\D+(\d{1,2})(?::\d{2})?)?/);

  if (!match) {
    return new Date(Number.NaN);
  }

  const [, year, month, day, hour = "0"] = match;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - kstOffsetHours,
    ),
  );
}

function isClosed(deadline: string, now: Date) {
  const deadlineDate = parseDeadline(deadline);

  if (Number.isNaN(deadlineDate.getTime())) {
    return false;
  }

  return deadlineDate.getTime() <= now.getTime();
}

function isClosedByStatus(status: string | undefined) {
  return Boolean(status && status.toUpperCase() !== "RECRUITING");
}

function isDeletedProductStatus(status: string | undefined) {
  const normalizedStatus = status?.toUpperCase();

  return normalizedStatus === "CANCELLED" || normalizedStatus === "DELETED";
}

function shouldHideClosedProduct(product: ProductCardItem, now: Date) {
  return isClosedByStatus(product.status) || isClosed(product.deadline, now);
}

function takeShouldSkipFavoritesEnter() {
  if (typeof window === "undefined") {
    return false;
  }

  const shouldSkip =
    window.sessionStorage.getItem(FAVORITES_SKIP_ENTER_KEY) === "true";
  window.sessionStorage.removeItem(FAVORITES_SKIP_ENTER_KEY);

  return shouldSkip;
}

function isFavoriteFilter(value: unknown): value is FavoriteFilter {
  return value === "all" || value === "favoriteArtist";
}

function isFavoriteSort(value: unknown): value is FavoriteSort {
  return value === "deadline" || value === "recent";
}

function readStoredFavoritesViewState(keepStoredState: boolean) {
  if (typeof window === "undefined") {
    return {};
  }

  const rawViewState = window.sessionStorage.getItem(
    FAVORITES_VIEW_STATE_KEY,
  );

  if (!rawViewState) {
    return {};
  }

  if (!keepStoredState) {
    window.sessionStorage.removeItem(FAVORITES_VIEW_STATE_KEY);
  }

  try {
    const viewState = JSON.parse(rawViewState) as FavoritesViewState;

    return {
      filter: isFavoriteFilter(viewState.filter)
        ? viewState.filter
        : undefined,
      hideClosed:
        typeof viewState.hideClosed === "boolean"
          ? viewState.hideClosed
          : undefined,
      sort: isFavoriteSort(viewState.sort) ? viewState.sort : undefined,
    };
  } catch {
    return {};
  }
}

function FavoriteProductGridSkeleton() {
  return (
    <div aria-label="찜한 상품을 불러오는 중" className="grid grid-cols-2 gap-3" role="status">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="overflow-hidden rounded-[1rem] border border-black/10 bg-white p-3"
          key={`favorite-product-skeleton-${index}`}
        >
          <div className="aspect-square animate-pulse rounded-[0.85rem] bg-black/8" />
          <div className="mt-3 h-4 w-4/5 animate-pulse rounded-full bg-black/8" />
          <div className="mt-2 h-3 w-3/5 animate-pulse rounded-full bg-black/8" />
          <div className="mt-4 h-8 animate-pulse rounded-full bg-black/8" />
        </div>
      ))}
    </div>
  );
}

export function FavoritesContent({
  skipEnterAnimation = false,
}: FavoritesContentProps) {
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const [shouldSkipEnterAnimation] = useState(
    () => skipEnterAnimation || takeShouldSkipFavoritesEnter(),
  );
  const [initialViewState] = useState(() =>
    readStoredFavoritesViewState(shouldSkipEnterAnimation),
  );
  const [filter, setFilter] = useState<FavoriteFilter>(
    initialViewState.filter ?? "all",
  );
  const [sort, setSort] = useState<FavoriteSort>(
    initialViewState.sort ?? "recent",
  );
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [hideClosed, setHideClosed] = useState(
    initialViewState.hideClosed ?? false,
  );
  const [now, setNow] = useState(() => new Date());
  const [apiFavoriteProducts, setApiFavoriteProducts] = useState<
    FavoriteProductCardItem[] | null
  >(null);
  const [favoriteMessage, setFavoriteMessage] = useState("");
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const accessToken = authState.accessToken;

    if (!authState.isLoggedIn || !accessToken) {
      const frame = window.requestAnimationFrame(() => {
        setApiFavoriteProducts([]);
        setFavoriteMessage("");
      });

      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    let isActive = true;

    requestBookmarkedBuncheols(accessToken, {
      hideClosed,
      onlyFavoriteGroups: filter === "favoriteArtist",
      sort: sort === "deadline" ? "DEADLINE" : "LATEST",
    })
      .then((items) => {
        if (!isActive) {
          return;
        }

        setApiFavoriteProducts(
          items.map((item, index) => ({
            ...mergeCachedProductImage(toProductCardItem(item)),
            favoritedOrder: items.length - index,
          })),
        );
        setFavoriteMessage("");
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setApiFavoriteProducts([]);
        setFavoriteMessage(
          error instanceof Error
            ? error.message
            : "찜한 분철을 불러오지 못했어요.",
        );
      });

    return () => {
      isActive = false;
    };
  }, [
    authState.accessToken,
    authState.isLoggedIn,
    filter,
    hideClosed,
    sort,
  ]);

  const filteredProducts = useMemo(() => {
    const sourceProducts = apiFavoriteProducts ?? [];

    return sourceProducts
      .filter((product) => {
        if (isDeletedProductStatus(product.status)) {
          return false;
        }

        if (hideClosed && shouldHideClosedProduct(product, now)) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        if (sort === "recent") {
          return right.favoritedOrder - left.favoritedOrder;
        }

        return (
          parseDeadline(left.deadline).getTime() -
          parseDeadline(right.deadline).getTime()
        );
      });
  }, [apiFavoriteProducts, hideClosed, now, sort]);
  const isFavoriteProductsLoading =
    authState.isLoggedIn && apiFavoriteProducts === null;

  function rememberFavoritesViewState() {
    window.sessionStorage.setItem(
      FAVORITES_VIEW_STATE_KEY,
      JSON.stringify({ filter, hideClosed, sort }),
    );
  }

  function rememberFavoritesReturnState(
    event: MouseEvent<HTMLElement>,
  ) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const productLink = target.closest<HTMLAnchorElement>(
      'a[href^="/products/"]',
    );

    if (!productLink || !scrollContainerRef.current) {
      return;
    }

    window.sessionStorage.setItem(
      FAVORITES_SCROLL_TOP_KEY,
      String(scrollContainerRef.current.scrollTop),
    );
    rememberFavoritesViewState();
  }

  useLayoutEffect(() => {
    const storedScrollTop = window.sessionStorage.getItem(
      FAVORITES_SCROLL_TOP_KEY,
    );

    if (!storedScrollTop || !scrollContainerRef.current) {
      return;
    }

    if (isFavoriteProductsLoading) {
      return;
    }

    const restoreFrame = window.requestAnimationFrame(() => {
      if (!scrollContainerRef.current) {
        return;
      }

      scrollContainerRef.current.scrollTop = Number(storedScrollTop);

      if (!skipEnterAnimation) {
        window.sessionStorage.removeItem(FAVORITES_SCROLL_TOP_KEY);
      }
    });

    return () => {
      window.cancelAnimationFrame(restoreFrame);
    };
  }, [filteredProducts.length, isFavoriteProductsLoading, skipEnterAnimation]);

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${
        shouldSkipEnterAnimation ? "" : "tab-content-enter"
      }`}
    >
      <header className="favorites-header shrink-0 px-4 py-3">
        <div className="favorites-header__copy flex h-10 flex-col justify-center">
          <p className="favorites-header__eyebrow text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-black/35">
            Favorites
          </p>
          <h1 className="favorites-header__title mt-1 text-[22px] font-semibold leading-none tracking-[-0.06em]">
            찜한 상품
          </h1>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-[0.95rem] bg-[#f7f7f7] p-1.5">
          {(
            [
              ["all", "전체"],
              ["favoriteArtist", "최애 아티스트"],
            ] as const
          ).map(([value, label]) => {
            const isActive = filter === value;

            return (
              <button
                className={`h-10 rounded-[0.8rem] text-[13px] font-semibold tracking-[-0.04em] ${
                  isActive
                    ? "bg-black text-white"
                    : "text-black/45"
                }`}
                key={value}
                onClick={() => setFilter(value)}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="relative mt-3 flex items-center justify-between gap-3">
          <div className="relative">
            <button
              className="flex h-9 items-center gap-1.5 rounded-full bg-[#f7f7f7] px-3 text-[12px] font-semibold text-black/55 ring-1 ring-black/10"
              onClick={() => setIsSortOpen((current) => !current)}
              type="button"
            >
              <span>{sort === "recent" ? "최근 찜한 순" : "마감 임박순"}</span>
              <span
                className={`h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-current transition-transform ${
                  isSortOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isSortOpen ? (
              <div className="absolute right-[-1.5rem] top-11 z-20 w-32 overflow-hidden rounded-[0.8rem] border border-black/10 bg-white shadow-[0_14px_28px_rgba(0,0,0,0.12)]">
                {(
                  [
                    ["recent", "최근 찜한 순"],
                    ["deadline", "마감 임박순"],
                  ] as const
                ).map(([value, label]) => {
                  const isActive = sort === value;

                  return (
                    <button
                      className={`h-10 w-full px-3 text-left text-[13px] font-semibold tracking-[-0.04em] ${
                        isActive ? "bg-black text-white" : "text-black/55"
                      }`}
                      key={value}
                      onClick={() => {
                        setSort(value);
                        setIsSortOpen(false);
                      }}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="mr-1 flex items-center gap-2">
            <span className="text-[12px] font-semibold text-black/45">
              마감 숨김
            </span>
            <button
              aria-pressed={hideClosed}
              className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors ${
                hideClosed ? "bg-black" : "bg-black/10"
              }`}
              onClick={() => setHideClosed((current) => !current)}
              type="button"
            >
              <span
                className={`h-5 w-5 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition-transform ${
                  hideClosed ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      <main
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-6"
        data-product-scroll-container="favorites"
        onClickCapture={rememberFavoritesReturnState}
        ref={scrollContainerRef}
      >
        <div
          className={shouldSkipEnterAnimation ? "" : "tab-content-enter"}
          key={`${filter}-${hideClosed}-${sort}`}
        >
          {favoriteMessage ? (
            <div className="mb-4 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3">
              <p className="text-[13px] font-semibold text-black/45">
                {favoriteMessage}
              </p>
            </div>
          ) : null}
          {isFavoriteProductsLoading ? (
            <FavoriteProductGridSkeleton />
          ) : filteredProducts.length > 0 ? (
            <ProductGrid items={filteredProducts} />
          ) : (
            <div className="rounded-[0.9rem] bg-[#f7f7f7] px-4 py-6">
              <p className="text-[14px] font-medium text-black/45">
                {authState.isLoggedIn
                  ? "조건에 맞는 찜 상품이 없습니다."
                  : "로그인 후 이용할 수 있어요."}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
