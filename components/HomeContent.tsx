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
  requestFavoriteGroups,
  toProductCardItem,
} from "@/lib/auth-api";
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
const SCROLL_REVEAL_THRESHOLD = 8;
const SCROLL_HIDE_START = 24;
const SCROLL_EDGE_GUARD = 16;
const HOME_BANNER_AUTO_INTERVAL_MS = 4200;
const HOME_BANNERS = [
  {
    href: "/board/transfer-payment?from=home",
    eyebrow: "Notice",
    title: "입금 확인 방식이\n계좌이체 기반으로 바뀌어요.",
    badge: "PAY",
    caption: "Transfer Guide",
    gradient:
      "bg-[linear-gradient(135deg,#111111_0%,#2f371f_50%,#AAB67C_100%)]",
  },
  {
    href: "/board/shipping-method-filter?from=home",
    eyebrow: "Delivery",
    title: "상품별 배송 방식에 맞는\n주소만 선택해요.",
    badge: "CU·GS",
    caption: "Address Match",
    gradient:
      "bg-[linear-gradient(135deg,#111827_0%,#3d4728_50%,#AAB67C_100%)]",
  },
  {
    href: "/board/closed-bid-status?from=home",
    eyebrow: "Bid Alert",
    title: "참여와 입금 상태를\n빠르게 확인하세요.",
    badge: "BID",
    caption: "Winning Status",
    gradient:
      "bg-[linear-gradient(135deg,#18181b_0%,#464a2b_50%,#AAB67C_100%)]",
  },
] as const;

type HomeContentProps = {
  skipEnterAnimation?: boolean;
};

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
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [shouldSkipEnterAnimation, setShouldSkipEnterAnimation] =
    useState(skipEnterAnimation);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [shouldSuppressHeaderTransition, setShouldSuppressHeaderTransition] =
    useState(false);
  const [apiListings, setApiListings] = useState<ProductCardItem[] | null>(null);
  const [apiGroups, setApiGroups] = useState<ArtistRailItem[] | null>(null);
  const [listingMessage, setListingMessage] = useState("");
  const [groupMessage, setGroupMessage] = useState("");
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const isListingLoading = apiListings === null;
  const isGroupLoading = apiGroups === null;
  const listings = apiListings ?? [];
  const favoriteGroups = apiGroups ?? [];

  function handleContentScroll(event: UIEvent<HTMLDivElement>) {
    const scrollElement = event.currentTarget;
    const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
    const nextScrollTop = Math.max(0, Math.min(scrollElement.scrollTop, maxScrollTop));

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
    const { clientWidth, scrollLeft } = event.currentTarget;

    if (clientWidth <= 0) {
      return;
    }

    const nextIndex = Math.min(
      HOME_BANNERS.length - 1,
      Math.max(0, Math.round(scrollLeft / clientWidth)),
    );

    setActiveBannerIndex((current) =>
      current === nextIndex ? current : nextIndex,
    );
  }

  function handleBannerDotClick(index: number) {
    const scrollElement = bannerScrollerRef.current;

    if (!scrollElement) {
      return;
    }

    setActiveBannerIndex(index);
    scrollElement.scrollTo({
      behavior: "smooth",
      left: scrollElement.clientWidth * index,
    });
  }

  useEffect(() => {
    if (HOME_BANNERS.length <= 1 || typeof window === "undefined") {
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
        const nextIndex = (currentIndex + 1) % HOME_BANNERS.length;

        scrollElement.scrollTo({
          behavior: "smooth",
          left: scrollElement.clientWidth * nextIndex,
        });

        return nextIndex;
      });
    }, HOME_BANNER_AUTO_INTERVAL_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeBannerIndex]);

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

    if (!skipEnterAnimation) {
      window.sessionStorage.removeItem(HOME_SCROLL_TOP_KEY);
    }

    return () => {
      window.cancelAnimationFrame(initialStateFrame);
      window.cancelAnimationFrame(restoreFrame);

      if (restoreTimer !== null) {
        window.clearTimeout(restoreTimer);
      }
    };
  }, [skipEnterAnimation]);

  useEffect(() => {
    let isActive = true;
    const resetFrame = window.requestAnimationFrame(() => {
      if (!isActive) {
        return;
      }

      setApiListings(null);
      setListingMessage("");
    });

    async function loadListings() {
      let accessToken: string | null = null;

      try {
        accessToken = authState.isLoggedIn ? await getFreshAccessToken() : null;
      } catch {
        accessToken = null;
      }

      return requestAllBuncheols(accessToken ?? undefined);
    }

    loadListings()
      .then((items) => {
        if (!isActive) {
          return;
        }

        setApiListings(
          items.map(toProductCardItem).map(mergeCachedProductImage),
        );
        setListingMessage("");
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setApiListings([]);
        setListingMessage(
          error instanceof Error
            ? error.message
            : "분철 목록을 불러오지 못했어요.",
        );
      });

    return () => {
      isActive = false;
      window.cancelAnimationFrame(resetFrame);
    };
  }, [authState.accessToken, authState.isLoggedIn]);

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
      router.push("/login?returnTo=/");
      return;
    }

    const accessToken = await getFreshAccessToken();

    if (!accessToken) {
      router.push("/login?returnTo=/");
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
        <section className="px-4 pt-4">
          <div
            className="motion-carousel flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={handleBannerScroll}
            ref={bannerScrollerRef}
          >
            {HOME_BANNERS.map((banner) => (
              <Link
                aria-label={`${banner.eyebrow} 공지 상세 보기`}
                className="motion-card motion-carousel__slide grid w-full flex-none snap-center grid-cols-[0.95fr_1.05fr] overflow-hidden rounded-[1.15rem] border border-black bg-black shadow-[0_18px_40px_rgba(0,0,0,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                href={banner.href}
                key={banner.href}
              >
                <div className="flex items-center px-4 py-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                      {banner.eyebrow}
                    </p>
                    <h2 className="mt-2 whitespace-pre-line text-[17px] font-semibold leading-[1.22] text-white">
                      {banner.title}
                    </h2>
                  </div>
                </div>
                <div
                  className={`relative min-h-[112px] overflow-hidden border-l border-white/10 ${banner.gradient}`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_28%,rgba(255,255,255,0.7),transparent_22%)]" />
                  <div className="absolute bottom-4 left-4 h-[82px] w-[62px] rotate-[-10deg] rounded-[0.85rem] border border-white/25 bg-black shadow-[0_12px_24px_rgba(0,0,0,0.24)]" />
                  <div className="absolute bottom-4 left-[4.8rem] h-[96px] w-[70px] rotate-[7deg] rounded-[0.85rem] border border-white/40 bg-white/85 shadow-[0_12px_24px_rgba(0,0,0,0.16)]" />
                  <div className="absolute right-4 top-4 rounded-full bg-[#DDE7B8] px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-black shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
                    {banner.badge}
                  </div>
                  <div className="absolute bottom-3 right-3 rounded-xl border border-black/10 bg-white/90 px-2.5 py-2 backdrop-blur">
                    <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-black/45">
                      {banner.caption}
                    </p>
                    <p className="mt-1 text-[12px] font-semibold tracking-[-0.03em]">
                      자세히 보기
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 pt-2 pb-4">
            {HOME_BANNERS.map((banner, index) => (
              <button
                aria-label={`${index + 1}번째 광고판 보기`}
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
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[19px] font-semibold tracking-[-0.05em]">
                  나를 위한 추천 상품
                </h3>
              </div>
            </div>

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
                count={6}
              />
            ) : (
              <ProductGrid items={listings} />
            )}
          </div>
        </section>

        <div className="mt-8">
          <BusinessFooter />
        </div>
      </div>
    </div>
  );
}
