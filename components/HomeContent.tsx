"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type UIEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import {
  BanknoteIcon,
  BidIcon,
  ClipboardListIcon,
  CloseIcon,
  SearchIcon,
} from "@/components/icons";
import { ArtistRail, type ArtistRailItem } from "@/components/ArtistRail";
import { BusinessFooter } from "@/components/BusinessFooter";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductGridSkeleton } from "@/components/ProductGridSkeleton";
import {
  addFavoriteGroup,
  readCachedBanners,
  removeFavoriteGroup,
  requestAllBuncheols,
  requestBanners,
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
import { FEATURES } from "@/lib/feature-flags";
import {
  bannersQueryKey,
  homeListingsQueryKey,
} from "@/lib/query-keys";
import { toArtistRailItem } from "@/lib/group-presenters";
import { mergeCachedProductImage } from "@/lib/product-card-image";
import { useProfileCompletionGuard } from "@/lib/use-profile-completion-guard";

export const HOME_SKIP_ENTER_KEY = "skip-home-enter-animation";
const HOME_SCROLL_TOP_KEY = "home-scroll-top";
const HOME_BANNER_SLIDE_KEY = "home-banner-slide";
const SCROLL_REVEAL_THRESHOLD = 8;
const SCROLL_HIDE_START = 24;
const SCROLL_EDGE_GUARD = 16;
const HOME_LISTINGS_REQUEST_TIMEOUT_MS = 12000;
// "상세 봤다가 바로 뒤로" 동선은 재요청 없이 캐시를 재사용하는 신선 창(멘토 권고).
// 내 행동(참여·업로드·삭제)은 invalidateQueries 로 즉시 무효화되므로 이 창과 무관하다.
const HOME_LISTINGS_STALE_MS = 60 * 1000;
const HOME_BANNERS_STALE_MS = 15 * 60 * 1000;
type HomeBanner = {
  href: string;
  imageAlt: string;
  imageSrc: string;
  label: string;
};

// 배너 폭은 어떤 뷰포트에서도 ≈398px 을 넘지 않는다. 프레임 조건과는 무관하다.
// - 폰 프레임 안: 프레임(≈430px) − px-4 패딩
// - 프레임 밖: 페이지 컨테이너 max-w-[430px](app/page.tsx) − px-4 패딩
// 즉 뷰포트가 462px(430 + 2rem) 이상이면 항상 398px 고정이라 프레임 조건을 복제할 필요가 없다.
// 이전 값은 1120px 미만에서 뷰포트 폭을 그대로 요청해, 폰 가로·태블릿에서 실제 폭의
// 2배가 넘는 후보를 받았다 (첫 배너는 priority 라 LCP 대역폭에 그대로 얹힌다).
const HOME_BANNER_IMAGE_SIZES = "(min-width: 462px) 398px, calc(100vw - 2rem)";

// next.config.ts images.remotePatterns 와 같은 목록. API 가 이 밖의 호스트를
// 내려주면 next/image 로더가 throw(개발)하거나 400(프로덕션)이 나므로,
// 미등록 호스트는 최적화를 끄고 원본을 그대로 그린다.
const OPTIMIZED_BANNER_HOSTS = new Set([
  "buncheol-easy-bucket.s3.ap-northeast-2.amazonaws.com",
  "buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
  "staging-buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
]);

function isOptimizableBannerSrc(src: string) {
  if (src.startsWith("/")) {
    return true;
  }

  try {
    return OPTIMIZED_BANNER_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

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

const homeUsageGuide = [
  {
    icon: SearchIcon,
    label: "분철 둘러보기",
    description:
      "홈에서 진행 중인 분철을 둘러봐요. 남은 멤버를 보면 어떤 멤버를 구매할 수 있는지 바로 알 수 있어요.",
  },
  {
    icon: ClipboardListIcon,
    label: "멤버 골라 주문",
    description:
      "분철에 들어가 원하는 멤버를 고르고, 택배 받을 편의점을 정해 주문해요.",
  },
  {
    icon: BanknoteIcon,
    label: "30분 안에 입금",
    description:
      "주문하면 개최자 계좌가 보여요. 30분 안에 입금과 개최자 확인까지 끝나야 참여가 확정돼요.",
  },
  {
    icon: BidIcon,
    label: "참여 내역에서 확인",
    description:
      "입금 확인부터 배송, 편의점 수령까지 진행 상황은 참여 내역에서 볼 수 있어요.",
  },
] as const;

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

function getBannerSlideLeft(scrollElement: HTMLDivElement, index: number) {
  const slide = scrollElement.children.item(index);

  if (!(slide instanceof HTMLElement)) {
    return scrollElement.clientWidth * index;
  }

  const scrollRect = scrollElement.getBoundingClientRect();
  const slideRect = slide.getBoundingClientRect();

  return slideRect.left - scrollRect.left + scrollElement.scrollLeft;
}

function getNearestBannerIndex(scrollElement: HTMLDivElement) {
  const slideOffsets = Array.from(scrollElement.children).map((child, index) =>
    child instanceof HTMLElement
      ? getBannerSlideLeft(scrollElement, index)
      : 0,
  );

  return slideOffsets.reduce((nearestIndex, offset, index) => {
    const nearestDistance = Math.abs(
      slideOffsets[nearestIndex] - scrollElement.scrollLeft,
    );
    const distance = Math.abs(offset - scrollElement.scrollLeft);

    return distance < nearestDistance ? index : nearestIndex;
  }, 0);
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

type StoredBannerSlide = {
  fingerprint: string;
  index: number;
};

// 저장해 둔 슬라이드가 지금 배너 구성의 것인지 판별하기 위한 지문.
function getBannersFingerprint(banners: HomeBanner[]) {
  return banners.map((banner) => banner.href).join("|");
}

function readStoredBannerSlide(): StoredBannerSlide | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(HOME_BANNER_SLIDE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as StoredBannerSlide;

    return typeof parsed?.fingerprint === "string" &&
      Number.isInteger(parsed?.index)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

async function loadHomeListings(loggedIn: boolean) {
  let accessToken: string | null = null;

  if (loggedIn) {
    try {
      accessToken = await getFreshAccessToken();
    } catch {
      accessToken = null;
    }
  }

  const items = await withHomeListingsTimeout(
    requestAllBuncheols(accessToken ?? undefined),
  );

  return items.map(toProductCardItem).map(mergeCachedProductImage);
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
  useProfileCompletionGuard();

  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isRestoringReturnScrollRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const bannerScrollerRef = useRef<HTMLDivElement | null>(null);
  const bannerDotsRef = useRef<HTMLDivElement | null>(null);
  // 도트 클릭으로 이동 중인 목표 슬라이드. 이동하는 동안 스크롤 기반 도트 갱신을 억제해
  // 활성 도트가 이전 슬라이드로 되돌아갔다 오는 왕복(→←→)을 막는다.
  const bannerScrollTargetRef = useRef<number | null>(null);
  const [isUsageHelpSheetOpen, setIsUsageHelpSheetOpen] = useState(false);
  const [isUsageHelpSheetEntered, setIsUsageHelpSheetEntered] =
    useState(false);
  const [isUsageHelpSheetClosing, setIsUsageHelpSheetClosing] =
    useState(false);
  const usageHelpSheetCloseTimerRef = useRef<number | null>(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [shouldSkipEnterAnimation, setShouldSkipEnterAnimation] =
    useState(skipEnterAnimation);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [shouldSuppressHeaderTransition, setShouldSuppressHeaderTransition] =
    useState(false);
  const [apiGroups, setApiGroups] = useState<ArtistRailItem[] | null>(null);
  const [groupMessage, setGroupMessage] = useState("");
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );

  // 캐시는 루트 레이아웃의 QueryClient 에 살아있으므로, 뒤로가기 복귀 시 첫 렌더부터
  // 데이터가 있다(스켈레톤 없음). staleTime 내에는 재요청도 없고, 지나면 캐시를 보여준
  // 채 백그라운드 재검증한다. 참여·업로드·삭제는 invalidateQueries 로 즉시 무효화.
  const listingsQuery = useQuery({
    queryKey: homeListingsQueryKey(authState.isLoggedIn),
    queryFn: () => loadHomeListings(authState.isLoggedIn),
    staleTime: HOME_LISTINGS_STALE_MS,
    // 로그인 상태가 바뀌어 키가 갈릴 때 이전 목록을 유지해 스켈레톤 재노출을 막는다.
    placeholderData: keepPreviousData,
  });
  const queryClient = useQueryClient();
  const bannersQuery = useQuery({
    queryKey: bannersQueryKey,
    queryFn: async () => (await requestBanners()).map(toHomeBanner),
    staleTime: HOME_BANNERS_STALE_MS,
  });

  // 새로고침 직후에는 React Query 캐시가 비어 폴백 배너가 먼저 그려지고, API 응답이
  // 오면 슬라이드가 통째로 교체되며 깜빡인다. localStorage 캐시가 있으면 페인트 전에
  // 심어 첫 페인트부터 실제 배너를 그린다. SSR HTML 은 폴백 기준이라 initialData 로
  // 넣으면 hydration 불일치가 나므로 layout effect 를 쓴다. updatedAt: 0 으로 곧바로
  // stale 처리해 백그라운드 재검증(신선도)은 기존과 동일하게 유지한다.
  useLayoutEffect(() => {
    if (queryClient.getQueryData(bannersQueryKey)) {
      return;
    }

    const cachedBanners = readCachedBanners();

    if (cachedBanners && cachedBanners.length > 0) {
      queryClient.setQueryData(
        bannersQueryKey,
        cachedBanners.map(toHomeBanner),
        { updatedAt: 0 },
      );
    }
  }, [queryClient]);
  // 캐시 히트로 마운트하면(첫 렌더부터 데이터 존재) reveal 애니메이션을 생략한다 —
  // 이미 보이던 목록이 사라졌다 나타나는 것처럼 보이는 문제 방지. 마운트 시점 판정을
  // 고정하는 것이 목적이라 초기값 이후 갱신하지 않는다.
  const [shouldRevealListings] = useState(() => listingsQuery.isPending);

  const isListingLoading = listingsQuery.data === undefined;
  const isGroupLoading = apiGroups === null;
  const banners =
    bannersQuery.data && bannersQuery.data.length > 0
      ? bannersQuery.data
      : HOME_BANNERS;
  const listings = listingsQuery.data ?? [];
  const listingMessage =
    listingsQuery.isError && listings.length === 0
      ? listingsQuery.error instanceof Error
        ? listingsQuery.error.message
        : "분철 목록을 불러오지 못했어요."
      : "";
  const favoriteGroups = apiGroups ?? [];

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

    const nextIndex = getNearestBannerIndex(scrollElement);

    // 도트 클릭 이동 중에는 목표 도착 전까지 스크롤 기반 갱신을 건너뛴다.
    if (bannerScrollTargetRef.current !== null) {
      if (nextIndex === bannerScrollTargetRef.current) {
        bannerScrollTargetRef.current = null;
      }

      return;
    }

    setActiveBannerIndex((current) =>
      current === nextIndex ? current : nextIndex,
    );
  }

  // 도트 이동 중 사용자가 직접 조작하면 억제를 풀어 스크롤 추종으로 되돌린다.
  function releaseBannerScrollTarget() {
    bannerScrollTargetRef.current = null;
  }

  function handleBannerDotClick(index: number) {
    const scrollElement = bannerScrollerRef.current;

    if (!scrollElement) {
      return;
    }

    bannerScrollTargetRef.current = index;
    setActiveBannerIndex(index);
    scrollElement.scrollTo({
      behavior: "smooth",
      left: getBannerSlideLeft(scrollElement, index),
    });
  }

  useLayoutEffect(() => {
    const storedScrollTop = getStoredHomeScrollTop();
    const shouldSkip =
      skipEnterAnimation ||
      takeShouldSkipHomeEnter() ||
      storedScrollTop !== null;
    const shouldStartWithHiddenHeader =
      storedScrollTop !== null &&
      storedScrollTop > SCROLL_HIDE_START;

    // skip 판정을 rAF 로 미루면 첫 페인트에 enter 애니메이션 초기 상태(opacity 0.72 등)가
    // 적용됐다 제거되는 스냅이 생긴다. 페인트 전에 동기로 확정한다.
    /* eslint-disable react-hooks/set-state-in-effect -- 페인트 전 동기 상태 확정이 목적 */
    if (storedScrollTop === null || !scrollContainerRef.current) {
      setShouldSkipEnterAnimation(shouldSkip);
      setIsHeaderHidden(false);
      setShouldSuppressHeaderTransition(false);
      return;
    }

    scrollContainerRef.current.scrollTop = storedScrollTop;
    lastScrollTopRef.current = storedScrollTop;

    setShouldSkipEnterAnimation(shouldSkip);
    setIsHeaderHidden(shouldStartWithHiddenHeader);
    setShouldSuppressHeaderTransition(shouldSkip && shouldStartWithHiddenHeader);
    /* eslint-enable react-hooks/set-state-in-effect */

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
      window.cancelAnimationFrame(restoreFrame);

      if (restoreTimer !== null) {
        window.clearTimeout(restoreTimer);
      }
    };
  }, [isListingLoading, listings.length, skipEnterAnimation]);

  // 재마운트 시 보던 슬라이드를 복원한다(상세를 다녀와도 배너 위치 유지).
  // 배너 구성이 바뀌면(폴백→API 교체, 배너 갱신) 첫 슬라이드부터 다시 시작한다.
  // 페인트 전에 위치를 확정해야 첫 슬라이드가 보였다가 이동하는 스냅이 없다.
  useLayoutEffect(() => {
    const scrollElement = bannerScrollerRef.current;

    if (!scrollElement) {
      return;
    }

    const storedSlide = readStoredBannerSlide();
    const restoredIndex =
      storedSlide &&
      storedSlide.fingerprint === getBannersFingerprint(banners) &&
      storedSlide.index > 0 &&
      storedSlide.index < banners.length
        ? storedSlide.index
        : 0;

    // 복원으로 활성 도트가 바뀔 때 motion-pill 의 폭·색 transition 이 재생되면
    // 도트가 스와이프하듯 보인다. 첫 페인트 동안만 transition 을 끄고 되돌린다.
    const dotsElement = bannerDotsRef.current;
    let instantFrame: number | null = null;

    if (dotsElement) {
      dotsElement.classList.add("banner-dots--instant");
      instantFrame = window.requestAnimationFrame(() => {
        instantFrame = window.requestAnimationFrame(() => {
          dotsElement.classList.remove("banner-dots--instant");
          instantFrame = null;
        });
      });
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- 페인트 전 위치 복원(같은 값이면 bail-out)
    setActiveBannerIndex(restoredIndex);
    // "auto" 는 CSS scroll-behavior(smooth)를 따라가 복원이 스와이프처럼 보인다.
    // 점프 없이 복원하려면 "instant" 로 강제해야 한다.
    scrollElement.scrollTo({
      behavior: "instant",
      left:
        restoredIndex === 0
          ? 0
          : getBannerSlideLeft(scrollElement, restoredIndex),
    });

    return () => {
      if (instantFrame !== null) {
        window.cancelAnimationFrame(instantFrame);
      }

      dotsElement?.classList.remove("banner-dots--instant");
    };
  }, [banners]);

  // 현재 슬라이드를 세션에 남겨 상세를 다녀와도 이어 보게 한다.
  useEffect(() => {
    window.sessionStorage.setItem(
      HOME_BANNER_SLIDE_KEY,
      JSON.stringify({
        fingerprint: getBannersFingerprint(banners),
        index: activeBannerIndex,
      }),
    );
  }, [activeBannerIndex, banners]);

  useEffect(() => {
    // 최애 그룹 레일이 꺼져 있으면 그룹 조회 자체를 건너뛴다.
    if (!FEATURES.favoriteArtists) {
      return;
    }

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

  function openUsageHelpSheet() {
    if (usageHelpSheetCloseTimerRef.current !== null) {
      window.clearTimeout(usageHelpSheetCloseTimerRef.current);
      usageHelpSheetCloseTimerRef.current = null;
    }

    setIsUsageHelpSheetClosing(false);
    setIsUsageHelpSheetOpen(true);
    window.requestAnimationFrame(() => {
      setIsUsageHelpSheetEntered(true);
    });
  }

  function closeUsageHelpSheet() {
    if (usageHelpSheetCloseTimerRef.current !== null) {
      return;
    }

    setIsUsageHelpSheetClosing(true);
    setIsUsageHelpSheetEntered(false);
    usageHelpSheetCloseTimerRef.current = window.setTimeout(() => {
      usageHelpSheetCloseTimerRef.current = null;
      setIsUsageHelpSheetOpen(false);
      setIsUsageHelpSheetClosing(false);
    }, 280);
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
            className={`home-banner-carousel motion-carousel ${
              shouldSkipEnterAnimation ? "motion-carousel--skip-enter" : ""
            } flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
            onPointerDown={releaseBannerScrollTarget}
            onScroll={handleBannerScroll}
            onWheel={releaseBannerScrollTarget}
            ref={bannerScrollerRef}
          >
            {banners.map((banner, index) => (
              <Link
                aria-label={`${banner.label} 보기`}
                className="motion-card motion-carousel__slide relative aspect-[1.72/1] w-full flex-none snap-start overflow-hidden rounded-[1.15rem] bg-white shadow-[0_14px_34px_rgba(0,0,0,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                draggable={false}
                href={banner.href}
                key={banner.href}
              >
                <Image
                  alt=""
                  aria-hidden="true"
                  className="scale-110 object-cover blur-xl"
                  draggable={false}
                  fill
                  loading={index === 0 ? "eager" : "lazy"}
                  sizes={HOME_BANNER_IMAGE_SIZES}
                  src={banner.imageSrc}
                  unoptimized={!isOptimizableBannerSrc(banner.imageSrc)}
                />
                <Image
                  alt={banner.imageAlt}
                  className="object-contain"
                  draggable={false}
                  fill
                  priority={index === 0}
                  sizes={HOME_BANNER_IMAGE_SIZES}
                  src={banner.imageSrc}
                  unoptimized={!isOptimizableBannerSrc(banner.imageSrc)}
                />
              </Link>
            ))}
          </div>

          <div
            className="flex items-center justify-center gap-2 pt-2 pb-4"
            ref={bannerDotsRef}
          >
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
          {FEATURES.favoriteArtists ? (
            <>
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
            </>
          ) : null}

          <div
            className={
              FEATURES.favoriteArtists
                ? "border-t border-black/10 pt-5"
                : "pt-2"
            }
          >
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
              <div className={shouldRevealListings ? "content-reveal" : ""}>
                <ProductGrid items={listings} variant="wide" />
              </div>
            )}
          </div>
        </section>

        {/* 우하단 도움말 버튼(bottom-5 + h-12 = 68px)이 스크롤 맨 아래에서 푸터를 덮는다.
            스크롤 컨테이너에 여백을 주면 푸터가 바닥에서 떠 보이므로 푸터 아래에만 확보한다 (docs/53 Q-21). */}
        <div className="mt-auto pb-20 pt-8">
          <BusinessFooter />
        </div>
        </div>
      </div>

      <button
        aria-label="분철이지 이용 방법 보기"
        className="motion-icon-button absolute bottom-5 right-4 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-black text-[18px] font-semibold text-[#D7FF5F] shadow-[0_14px_30px_rgba(0,0,0,0.28)]"
        onClick={openUsageHelpSheet}
        type="button"
      >
        ?
      </button>

      {isUsageHelpSheetOpen ? (
        <div
          className={`bid-sheet-backdrop fixed inset-0 z-40 flex items-end ${
            isUsageHelpSheetEntered && !isUsageHelpSheetClosing
              ? "bid-sheet-backdrop-active"
              : ""
          }`}
        >
          <button
            aria-label="이용 방법 안내 닫기"
            className="absolute inset-0 cursor-default"
            onClick={closeUsageHelpSheet}
            type="button"
          />
          <section
            className={`bid-sheet-panel relative mx-auto flex max-h-[calc(100%-2.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[1.4rem] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
              isUsageHelpSheetEntered && !isUsageHelpSheetClosing
                ? "bid-sheet-panel-active"
                : ""
            }`}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[21px] font-semibold tracking-[-0.06em]">
                  분철이지 사용법 가이드
                </h2>
                <p className="mt-1 text-[13px] font-medium text-black/45">
                  분철 참여는 이 순서로 진행돼요.
                </p>
              </div>
              <button
                aria-label="닫기"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
                onClick={closeUsageHelpSheet}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {homeUsageGuide.map((item) => (
                <div
                  className="rounded-[0.85rem] bg-[#f7f7f7] px-4 py-3"
                  key={item.label}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#DDE7B8]">
                      <item.icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-[13px] font-semibold tracking-[-0.04em]">
                      {item.label}
                    </p>
                  </div>
                  <p className="mt-1.5 text-[12px] font-medium leading-5 text-black/50">
                    {item.description}
                  </p>
                </div>
              ))}
              <p className="px-1 pt-1 text-[12px] font-medium leading-5 text-black/40">
                마음에 드는 분철은 하트를 눌러 찜해 둘 수 있어요. 분철을 직접
                여는 기능은 준비 중이에요. 조금만 기다려 주세요!
              </p>
            </div>

            <button
              className="mt-4 h-12 w-full shrink-0 rounded-full bg-[#CFE86B] text-[15px] font-semibold text-black shadow-[0_10px_24px_rgba(120,132,82,0.2)]"
              onClick={closeUsageHelpSheet}
              type="button"
            >
              확인했어요
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
