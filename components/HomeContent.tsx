"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type UIEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ArtistRail, type ArtistRailItem } from "@/components/ArtistRail";
import { BusinessFooter } from "@/components/BusinessFooter";
import type { ProductCardItem } from "@/components/ProductCard";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductGridSkeleton } from "@/components/ProductGridSkeleton";
import {
  addFavoriteGroup,
  removeFavoriteGroup,
  requestAllBuncheols,
  readCachedBanners,
  requestCachedBanners,
  requestFavoriteGroups,
  toProductCardItem,
  type ApiBanner,
} from "@/lib/auth-api";
import {
  createLoginHref,
  getCurrentBrowserHref,
} from "@/lib/auth-navigation";
import {
  clearAuthState,
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import { getFreshAccessToken } from "@/lib/auth-session";
import { toArtistRailItem } from "@/lib/group-presenters";
import { mergeCachedProductImage } from "@/lib/product-card-image";

export const HOME_SKIP_ENTER_KEY = "skip-home-enter-animation";
const HOME_SCROLL_TOP_KEY = "home-scroll-top";
const HOME_LISTINGS_CACHE_KEY = "home-listings-cache";
const SCROLL_REVEAL_THRESHOLD = 8;
const SCROLL_HIDE_START = 24;
const SCROLL_EDGE_GUARD = 16;
const HOME_BANNER_AUTO_INTERVAL_MS = 4200;
const HOME_LISTINGS_REQUEST_TIMEOUT_MS = 12000;
type HomeBanner = {
  href: string;
  imageAlt: string;
  imageSrc: string;
  label: string;
};

const HOME_BANNERS: HomeBanner[] = [
  {
    href: "/board?from=home",
    imageAlt: "분철이지 사용법 한눈에 보기",
    imageSrc: "/banners/buncheol-guide.png",
    label: "분철이지 사용법",
  },
  {
    href: "/board/transfer-payment?from=home",
    imageAlt: "분철이지 오픈 안내",
    imageSrc: "/banners/buncheol-open.png",
    label: "분철이지 오픈",
  },
  {
    href: "/board/closed-bid-status?from=home",
    imageAlt: "안전한 분철을 위한 안내",
    imageSrc: "/banners/buncheol-safe.png",
    label: "안전한 분철 안내",
  },
];

type HomeContentProps = {
  skipEnterAnimation?: boolean;
};

function toHomeBanner(item: ApiBanner): HomeBanner {
  return {
    href: `/board/${encodeURIComponent(item.noticeId)}?from=home`,
    imageAlt: item.bannerTitle || "분철이지 배너",
    imageSrc: item.bannerImageUrl,
    label: item.bannerTitle || "분철이지 배너",
  };
}

function takeShouldSkipHomeEnter() {
  if (typeof window === "undefined") {
    return false;
  }

  const shouldSkip =
    window.sessionStorage.getItem(HOME_SKIP_ENTER_KEY) === "true";
  window.sessionStorage.removeItem(HOME_SKIP_ENTER_KEY);

  return shouldSkip;
}

function getStoredHomeScrollTop() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedScrollTop = window.sessionStorage.getItem(HOME_SCROLL_TOP_KEY);

  return storedScrollTop === null ? null : Number(storedScrollTop);
}

function readCachedHomeListings() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawListings = window.sessionStorage.getItem(HOME_LISTINGS_CACHE_KEY);

    if (rawListings === null) {
      return null;
    }

    const parsed = JSON.parse(rawListings);

    return Array.isArray(parsed) ? (parsed as ProductCardItem[]) : null;
  } catch {
    return null;
  }
}

function writeCachedHomeListings(listings: ProductCardItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      HOME_LISTINGS_CACHE_KEY,
      JSON.stringify(listings.slice(0, 80)),
    );
  } catch {
    // The cache is only for swipe-back recovery.
  }
}

function withHomeListingsTimeout<T>(request: Promise<T>) {
  if (typeof window === "undefined") {
    return request;
  }

  let timeoutId: number | null = null;

  const timeout = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error("홈 분철 목록 요청이 지연되고 있어요."));
    }, HOME_LISTINGS_REQUEST_TIMEOUT_MS);
  });

  return Promise.race([request, timeout]).finally(() => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  });
}

function HomeArtistRailSkeleton() {
  return (
    <div
      aria-label="최애 그룹을 불러오는 중"
      className="flex items-start gap-3"
      role="status"
    >
      <div className="w-[65px] flex-shrink-0">
        <div className="h-[65px] w-[65px] animate-pulse rounded-full bg-black/8" />
        <div className="mx-auto mt-2 h-3.5 w-[52px] animate-pulse rounded-full bg-black/8" />
      </div>
      <div className="my-2 w-px self-stretch bg-black/8" />
      <div className="flex min-w-0 flex-1 gap-4 overflow-hidden pb-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="min-w-[65px]" key={`home-artist-skeleton-${index}`}>
            <div className="h-[65px] w-[65px] animate-pulse rounded-[1.1rem] bg-black/8" />
            <div className="mt-2 h-4 w-[52px] animate-pulse rounded-full bg-black/8" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomeContent({ skipEnterAnimation = false }: HomeContentProps) {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isRestoringReturnScrollRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const bannerScrollerRef = useRef<HTMLDivElement | null>(null);
  const apiListingsRef = useRef<ProductCardItem[] | null>(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [shouldSkipEnterAnimation, setShouldSkipEnterAnimation] =
    useState(skipEnterAnimation);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [shouldSuppressHeaderTransition, setShouldSuppressHeaderTransition] =
    useState(false);
  const [apiBanners, setApiBanners] = useState<HomeBanner[] | null>(null);
  const [apiListings, setApiListings] = useState<ProductCardItem[] | null>(null);
  const [apiGroups, setApiGroups] = useState<ArtistRailItem[] | null>(null);
  const [listingMessage, setListingMessage] = useState("");
  const [groupMessage, setGroupMessage] = useState("");
  const [listingRefreshKey, setListingRefreshKey] = useState(0);
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const isListingLoading = apiListings === null;
  const isGroupLoading = apiGroups === null;
  const banners = apiBanners && apiBanners.length > 0 ? apiBanners : HOME_BANNERS;
  const listings = apiListings ?? [];
  const favoriteGroups = apiGroups ?? [];

  useEffect(() => {
    const cacheRestoreFrame = window.requestAnimationFrame(() => {
      const cachedListings = readCachedHomeListings();

      if (cachedListings !== null) {
        setApiListings((current) => current ?? cachedListings);
      }
    });

    return () => {
      window.cancelAnimationFrame(cacheRestoreFrame);
    };
  }, []);

  useEffect(() => {
    apiListingsRef.current = apiListings;
  }, [apiListings]);

  function handleContentScroll(event: UIEvent<HTMLDivElement>) {
    const scrollElement = event.currentTarget;
    const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
    const nextScrollTop = Math.max(
      0,
      Math.min(scrollElement.scrollTop, maxScrollTop),
    );

    if (isRestoringReturnScrollRef.current) {
      setIsHeaderHidden(false);
      lastScrollTopRef.current = nextScrollTop;
      return;
    }

    const previousScrollTop = lastScrollTopRef.current;
    const isNearBottom = maxScrollTop - nextScrollTop <= SCROLL_EDGE_GUARD;

    if (nextScrollTop <= SCROLL_REVEAL_THRESHOLD) {
      setIsHeaderHidden(false);
      lastScrollTopRef.current = nextScrollTop;
      return;
    }

    if (
      isNearBottom ||
      Math.abs(nextScrollTop - previousScrollTop) <= SCROLL_REVEAL_THRESHOLD
    ) {
      lastScrollTopRef.current = nextScrollTop;
      return;
    }

    const shouldHide =
      nextScrollTop > previousScrollTop && nextScrollTop > SCROLL_HIDE_START;

    setIsHeaderHidden((current) => (current === shouldHide ? current : shouldHide));
    lastScrollTopRef.current = nextScrollTop;
  }

  function handleBannerScroll(event: UIEvent<HTMLDivElement>) {
    const scrollElement = event.currentTarget;

    if (scrollElement.clientWidth <= 0) {
      return;
    }

    const slideOffsets = Array.from(scrollElement.children).map((child, index) =>
      child instanceof HTMLElement
        ? getBannerSlideLeft(scrollElement, index)
        : 0,
    );
    const nextIndex = slideOffsets.reduce((nearestIndex, offset, index) => {
      const nearestDistance = Math.abs(
        slideOffsets[nearestIndex] - scrollElement.scrollLeft,
      );
      const distance = Math.abs(offset - scrollElement.scrollLeft);

      return distance < nearestDistance ? index : nearestIndex;
    }, 0);

    setActiveBannerIndex((current) =>
      current === nextIndex ? current : nextIndex,
    );
  }

  function getBannerSlideLeft(scrollElement: HTMLDivElement, index: number) {
    const slide = scrollElement.children.item(index);

    if (!(slide instanceof HTMLElement)) {
      return scrollElement.clientWidth * index;
    }

    const scrollRect = scrollElement.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();

    return slideRect.left - scrollRect.left + scrollElement.scrollLeft;
  }

  function handleBannerDotClick(index: number) {
    const scrollElement = bannerScrollerRef.current;

    if (!scrollElement) {
      return;
    }

    setActiveBannerIndex(index);
    scrollElement.scrollTo({
      behavior: "smooth",
      left: getBannerSlideLeft(scrollElement, index),
    });
  }

  useEffect(() => {
    if (banners.length <= 1 || typeof window === "undefined") {
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (motionQuery.matches) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (document.visibilityState === "hidden") {
        return;
      }

      const scrollElement = bannerScrollerRef.current;

      if (!scrollElement) {
        return;
      }

      setActiveBannerIndex((currentIndex) => {
        const nextIndex = (currentIndex + 1) % banners.length;

        scrollElement.scrollTo({
          behavior: "auto",
          left: getBannerSlideLeft(scrollElement, nextIndex),
        });

        return nextIndex;
      });
    }, HOME_BANNER_AUTO_INTERVAL_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeBannerIndex, banners.length]);

  useLayoutEffect(() => {
    const storedScrollTop = getStoredHomeScrollTop();
    const shouldSkip =
      skipEnterAnimation ||
      takeShouldSkipHomeEnter() ||
      storedScrollTop !== null;
    const shouldStartWithHiddenHeader =
      storedScrollTop !== null &&
      storedScrollTop > SCROLL_HIDE_START;

    if (storedScrollTop === null || !scrollContainerRef.current) {
      const initialStateFrame = window.requestAnimationFrame(() => {
        setShouldSkipEnterAnimation(shouldSkip);
        setIsHeaderHidden(false);
        setShouldSuppressHeaderTransition(false);
      });

      return () => {
        window.cancelAnimationFrame(initialStateFrame);
      };
    }

    scrollContainerRef.current.scrollTop = storedScrollTop;
    lastScrollTopRef.current = storedScrollTop;

    const initialStateFrame = window.requestAnimationFrame(() => {
      setShouldSkipEnterAnimation(shouldSkip);
      setIsHeaderHidden(shouldStartWithHiddenHeader);
      setShouldSuppressHeaderTransition(
        shouldSkip && shouldStartWithHiddenHeader,
      );
    });

    isRestoringReturnScrollRef.current = !skipEnterAnimation;

    let restoreTimer: number | null = null;
    const restoreFrame = window.requestAnimationFrame(() => {
      if (!skipEnterAnimation) {
        setIsHeaderHidden(false);
        restoreTimer = window.setTimeout(() => {
          isRestoringReturnScrollRef.current = false;
        }, 320);
      }

      setShouldSuppressHeaderTransition(false);
    });

    if (!skipEnterAnimation && !isListingLoading) {
      window.sessionStorage.removeItem(HOME_SCROLL_TOP_KEY);
    }

    return () => {
      window.cancelAnimationFrame(initialStateFrame);
      window.cancelAnimationFrame(restoreFrame);

      if (restoreTimer !== null) {
        window.clearTimeout(restoreTimer);
      }
    };
  }, [isListingLoading, listings.length, skipEnterAnimation]);

  useEffect(() => {
    let isActive = true;
    const cachedBanners = readCachedBanners();
    const cachedBannerFrame = window.requestAnimationFrame(() => {
      if (isActive && cachedBanners !== null) {
        setApiBanners(cachedBanners.map(toHomeBanner));
      }
    });

    requestCachedBanners()
      .then((items) => {
        if (!isActive) {
          return;
        }

        setApiBanners(items.map(toHomeBanner));
        setActiveBannerIndex(0);

        const scrollElement = bannerScrollerRef.current;

        if (scrollElement) {
          scrollElement.scrollTo({ behavior: "auto", left: 0 });
        }
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setApiBanners([]);
      });

    return () => {
      isActive = false;
      window.cancelAnimationFrame(cachedBannerFrame);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadListings() {
      let accessToken: string | null = null;

      try {
        accessToken = authState.isLoggedIn ? await getFreshAccessToken() : null;
      } catch {
        accessToken = null;
      }

      return requestAllBuncheols(accessToken ?? undefined);
    }

    withHomeListingsTimeout(loadListings())
      .then((items) => {
        if (!isActive) {
          return;
        }

        const nextListings = items
          .map(toProductCardItem)
          .map(mergeCachedProductImage);

        setApiListings(nextListings);
        writeCachedHomeListings(nextListings);
        setListingMessage("");
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        const fallbackListings =
          apiListingsRef.current ?? readCachedHomeListings();

        setApiListings(fallbackListings ?? []);

        if (fallbackListings && fallbackListings.length > 0) {
          setListingMessage("");
          return;
        }

        setListingMessage(
          error instanceof Error
            ? error.message
            : "분철 목록을 불러오지 못했어요.",
        );
      });

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, authState.isLoggedIn, listingRefreshKey]);

  useEffect(() => {
    function recoverStalledListings() {
      if (apiListingsRef.current !== null) {
        return;
      }

      const cachedListings = readCachedHomeListings();

      if (cachedListings !== null) {
        setApiListings(cachedListings);
      }

      setListingRefreshKey((current) => current + 1);
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        recoverStalledListings();
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        recoverStalledListings();
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const resetFrame = window.requestAnimationFrame(() => {
      if (!isActive) {
        return;
      }

      setApiGroups(null);
      setGroupMessage("");
    });

    if (!authState.isLoggedIn || !authState.accessToken) {
      const emptyFrame = window.requestAnimationFrame(() => {
        if (!isActive) {
          return;
        }

        setApiGroups([]);
        setGroupMessage("");
      });

      return () => {
        isActive = false;
        window.cancelAnimationFrame(resetFrame);
        window.cancelAnimationFrame(emptyFrame);
      };
    }

    const groupRequest = async () => {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        return [];
      }

      return requestFavoriteGroups(accessToken);
    };

    groupRequest()
      .then((groups) => {
        if (!isActive) {
          return;
        }

        setApiGroups(groups.map(toArtistRailItem));
        setGroupMessage("");
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        const message = error instanceof Error ? error.message : "";

        if (message.includes("401") || message.includes("Unauthorized")) {
          clearAuthState();
          setApiGroups([]);
          setGroupMessage("");
          return;
        }

        setApiGroups([]);
        setGroupMessage(
          error instanceof Error
            ? error.message
            : "그룹 정보를 불러오지 못했어요.",
        );
      });

    return () => {
      isActive = false;
      window.cancelAnimationFrame(resetFrame);
    };
  }, [authState.accessToken, authState.isLoggedIn]);

  function openGroupSearch(groupName?: string) {
    if (!groupName && scrollContainerRef.current) {
      window.sessionStorage.setItem(
        HOME_SCROLL_TOP_KEY,
        String(scrollContainerRef.current.scrollTop),
      );
    }

    router.push(
      groupName ? `/search?q=${encodeURIComponent(groupName)}` : "/artists",
    );
  }

  async function handleFavoriteGroupToggle(item: ArtistRailItem) {
    if (!authState.isLoggedIn) {
      router.push(
        createLoginHref({
          cancelTo: getCurrentBrowserHref(),
          returnTo: "/",
        }),
      );
      return;
    }

    const accessToken = await getFreshAccessToken();

    if (!accessToken) {
      router.push(
        createLoginHref({
          cancelTo: getCurrentBrowserHref(),
          returnTo: "/",
        }),
      );
      return;
    }

    const favoriteGroupId = item.apiId ?? item.id;
    const nextFavorited = item.favorited !== true;
    setApiGroups((current) =>
      current?.map((group) =>
        group.id === item.id ? { ...group, favorited: nextFavorited } : group,
      ) ?? current,
    );

    try {
      if (nextFavorited) {
        await addFavoriteGroup(accessToken, favoriteGroupId);
      } else {
        await removeFavoriteGroup(accessToken, favoriteGroupId);
      }
      setGroupMessage("");
    } catch (error) {
      setApiGroups((current) =>
        current?.map((group) =>
          group.id === item.id ? { ...group, favorited: !nextFavorited } : group,
        ) ?? current,
      );
      setGroupMessage(
        error instanceof Error
          ? error.message
          : "최애 그룹을 변경하지 못했어요.",
      );
    }
  }

  function resumeHeaderScrollReaction() {
    isRestoringReturnScrollRef.current = false;
  }

  return (
    <div className="scroll-reactive-shell">
      <div
        className={`scroll-reactive-header ${
          isHeaderHidden ? "scroll-reactive-header--hidden" : ""
        } ${
          shouldSuppressHeaderTransition
            ? "scroll-reactive-header--instant"
            : ""
        }`}
      >
        <div className="scroll-reactive-header__inner">
          <AppHeader />
        </div>
      </div>

      <div
        className={`scroll-reactive-content scroll-reactive-content--home min-h-0 flex-1 overflow-y-auto ${
          shouldSkipEnterAnimation ? "" : "tab-content-enter"
        }`}
        data-product-scroll-container="home"
        onScroll={handleContentScroll}
        onTouchStart={resumeHeaderScrollReaction}
        onWheel={resumeHeaderScrollReaction}
        ref={scrollContainerRef}
      >
        <div className="flex min-h-full flex-col">
        <section className="px-4 pt-4">
          <div
            className="home-banner-carousel motion-carousel flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={handleBannerScroll}
            ref={bannerScrollerRef}
          >
            {banners.map((banner, index) => (
              <Link
                aria-label={`${banner.label} 보기`}
                className="motion-card motion-carousel__slide relative aspect-[1770/533] w-full flex-none snap-start overflow-hidden rounded-[1.15rem] bg-white shadow-[0_14px_34px_rgba(0,0,0,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                draggable={false}
                href={banner.href}
                key={banner.href}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={banner.imageAlt}
                  className="h-full w-full object-cover"
                  draggable={false}
                  loading={index === 0 ? "eager" : "lazy"}
                  src={banner.imageSrc}
                />
              </Link>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 pt-2 pb-4">
            {banners.map((banner, index) => (
              <button
                aria-label={`${index + 1}번째 배너 보기`}
                className={`motion-pill h-2 rounded-full ${
                  activeBannerIndex === index
                    ? "w-6 bg-[#CFE86B] shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_6px_16px_rgba(120,132,82,0.3)]"
                    : "w-2 bg-zinc-300"
                }`}
                key={banner.href}
                onClick={() => handleBannerDotClick(index)}
                type="button"
              />
            ))}
          </div>

        </section>

        <section className="px-4">
          <div className="mb-6">
          {isGroupLoading ? (
            <HomeArtistRailSkeleton />
          ) : (
          <ArtistRail
            items={favoriteGroups}
            leadingItem={{ label: "최애 추가", icon: "plus" }}
            onFavoriteToggle={handleFavoriteGroupToggle}
            onItemClick={(item) => openGroupSearch(item.name)}
            onLeadingClick={() => openGroupSearch()}
          />
          )}
          </div>

          {groupMessage ? (
            <div className="mb-4 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3">
              <p className="text-[13px] font-semibold text-black/45">
                {groupMessage}
              </p>
            </div>
          ) : null}

          <div className="border-t border-black/10 pt-5">
            {listingMessage ? (
              <div className="mb-4 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3">
                <p className="text-[13px] font-semibold text-black/45">
                  {listingMessage}
                </p>
              </div>
            ) : null}
            {isListingLoading ? (
              <ProductGridSkeleton
                ariaLabel="추천 상품을 불러오는 중"
                count={3}
                variant="wide"
              />
            ) : (
              <div className="content-reveal">
                <ProductGrid items={listings} variant="wide" />
              </div>
            )}
          </div>
        </section>

        <div className="mt-auto pt-8">
          <BusinessFooter />
        </div>
        </div>
      </div>
    </div>
  );
}
