"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type UIEvent,
} from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ArtistRail, type ArtistRailItem } from "@/components/ArtistRail";
import type { ProductCardItem } from "@/components/ProductCard";
import { ProductGrid } from "@/components/ProductGrid";
import {
  addFavoriteGroup,
  removeFavoriteGroup,
  requestAllBuncheols,
  requestFavoriteGroups,
  requestTokenReissue,
  toProductCardItem,
} from "@/lib/auth-api";
import {
  clearAuthState,
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
  writeAuthTokens,
} from "@/lib/auth-store";
import { toArtistRailItem } from "@/lib/group-presenters";
import { favoriteIdols, homeListings } from "@/lib/mock-home-search";

export const HOME_SKIP_ENTER_KEY = "skip-home-enter-animation";
const HOME_SCROLL_TOP_KEY = "home-scroll-top";
const SCROLL_REVEAL_THRESHOLD = 8;
const SCROLL_HIDE_START = 24;
const SCROLL_EDGE_GUARD = 16;

type HomeContentProps = {
  skipEnterAnimation?: boolean;
};

function isJwtExpired(token: string) {
  const [, payload] = token.split(".");

  if (!payload) {
    return false;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      "=",
    );
    const parsed = JSON.parse(window.atob(paddedPayload)) as {
      exp?: unknown;
    };

    return (
      typeof parsed.exp === "number" &&
      parsed.exp * 1000 <= Date.now() + 30_000
    );
  } catch {
    return false;
  }
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

export function HomeContent({ skipEnterAnimation = false }: HomeContentProps) {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isRestoringReturnScrollRef = useRef(false);
  const lastScrollTopRef = useRef(0);
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
  const listings = apiListings ?? homeListings;
  const favoriteGroups = apiGroups ?? favoriteIdols;

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

  useLayoutEffect(() => {
    const storedScrollTop = getStoredHomeScrollTop();
    const shouldSkip = skipEnterAnimation || takeShouldSkipHomeEnter();
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
    const accessToken = authState.isLoggedIn
      ? authState.accessToken ?? undefined
      : undefined;

    let isActive = true;

    requestAllBuncheols(accessToken)
      .then((items) => {
        if (!isActive) {
          return;
        }

        setApiListings(items.map(toProductCardItem));
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
    };
  }, [authState.accessToken, authState.isLoggedIn]);

  useEffect(() => {
    let isActive = true;

    if (!authState.isLoggedIn || !authState.accessToken) {
      setApiGroups([]);
      setGroupMessage("");
      return;
    }

    const groupRequest = async () => {
      let accessToken = authState.accessToken;

      if (!accessToken) {
        return [];
      }

      if (isJwtExpired(accessToken)) {
        const reissuedToken = await requestTokenReissue();
        accessToken = reissuedToken.accessToken;
        writeAuthTokens({ accessToken });
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
    };
  }, [authState.accessToken, authState.isLoggedIn]);

  function openGroupSearch(groupName?: string) {
    router.push(groupName ? `/search?q=${encodeURIComponent(groupName)}` : "/artists");
  }

  async function handleFavoriteGroupToggle(item: ArtistRailItem) {
    const accessToken = authState.accessToken;

    if (!authState.isLoggedIn || !accessToken) {
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
          <div className="grid grid-cols-[1fr_1.15fr] overflow-hidden rounded-[1.35rem] border border-black bg-black">
            <div className="flex items-center p-5">
              <div>
                <p className="text-[14px] uppercase tracking-[0.24em] text-white/45">
                  For your bias
                </p>
                <h2 className="mt-3 text-[22px] font-semibold leading-[1.18] tracking-[-0.06em] text-white">
                  당신의
                  <br />
                  최애를 쉽게.
                </h2>
              </div>
            </div>
            <div className="relative min-h-[140px] overflow-hidden border-l border-white/10 bg-[linear-gradient(135deg,#1a1a1a_0%,#6c6c6c_48%,#efefef_100%)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_28%,rgba(255,255,255,0.7),transparent_22%)]" />
              <div className="absolute bottom-5 left-5 h-[110px] w-[82px] rotate-[-10deg] rounded-[1rem] border border-white/25 bg-black shadow-[0_15px_35px_rgba(0,0,0,0.28)]" />
              <div className="absolute bottom-6 left-[6.1rem] h-[126px] w-[92px] rotate-[7deg] rounded-[1rem] border border-white/40 bg-white/85 shadow-[0_15px_35px_rgba(0,0,0,0.18)]" />
              <div className="absolute right-5 top-5 rounded-full bg-black px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-white">
                PICK
              </div>
              <div className="absolute bottom-4 right-4 rounded-2xl border border-black/10 bg-white/90 px-3 py-2 backdrop-blur">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/45">
                  Bias Match
                </p>
                <p className="mt-1 text-[13px] font-semibold tracking-[-0.03em]">
                  원영 · 유진 · 카리나
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2 pb-5">
            <span className="h-2 w-2 rounded-full bg-black" />
            <span className="h-2 w-2 rounded-full bg-zinc-300" />
            <span className="h-2 w-2 rounded-full bg-zinc-300" />
            <span className="h-2 w-2 rounded-full bg-zinc-300" />
            <span className="h-2 w-2 rounded-full bg-zinc-300" />
          </div>
        </section>

        <section className="px-4">
          <ArtistRail
            items={favoriteGroups}
            leadingItem={{ label: "최애 추가", icon: "plus" }}
            onFavoriteToggle={handleFavoriteGroupToggle}
            onItemClick={(item) => openGroupSearch(item.name)}
            onLeadingClick={() => openGroupSearch()}
          />

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
              <button className="text-[13px] font-medium text-black/55">
                전체보기
              </button>
            </div>

            {listingMessage ? (
              <div className="mb-4 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3">
                <p className="text-[13px] font-semibold text-black/45">
                  {listingMessage}
                </p>
              </div>
            ) : null}
            <ProductGrid items={listings} />
          </div>
        </section>
      </div>
    </div>
  );
}
