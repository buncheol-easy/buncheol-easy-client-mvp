"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type PointerEvent,
  type UIEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import {
  BanknoteIcon,
  BidIcon,
  ClipboardListIcon,
  CloseIcon,
  PauseFilledIcon,
  PlayFilledIcon,
  SearchIcon,
} from "@/components/icons";
import { ArtistRail, type ArtistRailItem } from "@/components/ArtistRail";
import { BusinessFooter } from "@/components/BusinessFooter";
import { FloatingHelpButton } from "@/components/FloatingHelpButton";
import { HelpText } from "@/components/HelpText";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductGridSkeleton } from "@/components/ProductGridSkeleton";
import { SkeletonGroup } from "@/components/SkeletonGroup";
import { useIsUnderlay } from "@/components/SwipeUnderlay";
import { useScrollDirectionHidden } from "@/lib/use-scroll-direction-hidden";
import {
  addFavoriteGroup,
  readCachedBanners,
  removeFavoriteGroup,
  requestBanners,
  type ApiBanner,
  type ApiGroup,
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
  flattenHomeListings,
  getHomeListingsNextPageParam,
  homeListingsInitialPageParam,
  requestHomeListingsPage,
  type HomeListingsData,
} from "@/lib/home-listings";
import {
  bannersQueryKey,
  homeListingsQueryKey,
} from "@/lib/query-keys";
import {
  useFavoriteGroupsCache,
  useFavoriteGroupsQuery,
} from "@/lib/group-queries";
import {
  normalizeGroupSearchText,
  toArtistRailItem,
} from "@/lib/group-presenters";
import { mergeCachedProductImage } from "@/lib/product-card-image";
import { useProfileCompletionGuard } from "@/lib/use-profile-completion-guard";

export const HOME_SKIP_ENTER_KEY = "skip-home-enter-animation";
const HOME_SCROLL_TOP_KEY = "home-scroll-top";
const HOME_BANNER_SLIDE_KEY = "home-banner-slide";
const HOME_BANNER_STOPPED_KEY = "home-banner-stopped";
const SCROLL_REVEAL_THRESHOLD = 8;
const SCROLL_HIDE_START = 24;
const SCROLL_EDGE_GUARD = 16;
const HOME_LISTINGS_REQUEST_TIMEOUT_MS = 12000;
// 목록 끝이 화면 아래 이 거리 안에 들어오면 다음 페이지를 미리 받는다 (와이드 카드 2장 남짓).
const HOME_LISTINGS_LOAD_MORE_DISTANCE_PX = 800;
const HOME_LISTINGS_FAILED_MESSAGE =
  "분철 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
// 서버 UserFavoriteGroupService.MAX_FAVORITE_GROUP_COUNT 와 같은 값.
const FAVORITE_GROUP_LIMIT = 5;
const FAVORITE_LIMIT_MESSAGE = `최애 아티스트는 최대 ${FAVORITE_GROUP_LIMIT}개까지 등록가능해요.`;
// /artists 의 한도 토스트와 같은 수명. 같은 문구가 화면마다 다르게 사라지면 안 된다.
const FAVORITE_LIMIT_MESSAGE_DURATION_MS = 2400;
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
      "홈에서 진행 중인 분철을 둘러봐요. 멤버 이름이 연두색이면 지금 참여할 수 있어요.",
  },
  {
    icon: ClipboardListIcon,
    label: "멤버 골라 신청",
    description:
      "분철에 들어가 원하는 멤버를 고르고, 택배 받을 편의점을 정해 신청해요. 이 단계에서는 아직 입금하지 않아요.",
  },
  {
    icon: BanknoteIcon,
    label: "확정되면 입금",
    description:
      "개최자가 성사를 확정하면 알림톡으로 계좌와 24시간 입금 기한을 알려드려요. 송금 뒤 '보냈어요'를 누르면 개최자가 확인해요.",
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
  initialNowMs?: number;
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

// 스크롤 위치를 슬라이드 단위로 환산한다(1.5 = 2번째와 3번째 사이 한가운데).
function getBannerProgress(scrollElement: HTMLDivElement) {
  const slideOffsets = Array.from(scrollElement.children, (_, index) =>
    getBannerSlideLeft(scrollElement, index),
  );
  const { scrollLeft } = scrollElement;

  for (let index = 0; index < slideOffsets.length - 1; index += 1) {
    const start = slideOffsets[index];
    const end = slideOffsets[index + 1];

    if (scrollLeft <= end) {
      return index + Math.max(0, (scrollLeft - start) / (end - start));
    }
  }

  return Math.max(0, slideOffsets.length - 1);
}

// 도트 폭·색이 손가락 위치를 따라가게 한다. 스크롤 프레임마다 불리므로 React 상태를 거치지 않는다.
function paintBannerDots(dotsElement: HTMLElement | null, progress: number) {
  Array.from(dotsElement?.children ?? []).forEach((dot, index) => {
    if (dot instanceof HTMLElement) {
      dot.style.setProperty(
        "--dot-active",
        Math.max(0, 1 - Math.abs(progress - index)).toFixed(3),
      );
    }
  });
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);

  mediaQuery.addEventListener("change", onChange);

  return () => mediaQuery.removeEventListener("change", onChange);
}

function readReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

type BannerPauseReason = "hover" | "touch" | "focus" | "offscreen" | "hidden";

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

async function loadHomeListingsPage(loggedIn: boolean, cursor: string | null) {
  let accessToken: string | null = null;

  if (loggedIn) {
    try {
      accessToken = await getFreshAccessToken();
    } catch {
      accessToken = null;
    }
  }

  const page = await withHomeListingsTimeout(
    requestHomeListingsPage(accessToken ?? undefined, cursor),
  );

  return { ...page, items: page.items.map(mergeCachedProductImage) };
}

// 지연 안내는 이 오류의 종류로 판정한다. message 는 화면에 쓰지 않는다.
class HomeListingsTimeoutError extends Error {
  constructor() {
    super("홈 분철 목록 요청이 지연되고 있어요.");
    this.name = "HomeListingsTimeoutError";
  }
}

function withHomeListingsTimeout<T>(request: Promise<T>) {
  if (typeof window === "undefined") {
    return request;
  }

  let timeoutId: number | null = null;

  const timeout = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new HomeListingsTimeoutError());
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
    <SkeletonGroup
      aria-label="최애 그룹을 불러오는 중"
      className="flex items-start gap-3"
      role="status"
    >
      <div className="w-[65px] flex-shrink-0">
        <div className="h-[65px] w-[65px] skeleton-surface rounded-full bg-black/8" />
        <div className="mx-auto mt-2 h-3.5 w-[52px] skeleton-surface rounded-full bg-black/8" />
      </div>
      <div className="my-2 w-px self-stretch bg-black/8" />
      <div className="flex min-w-0 flex-1 gap-4 overflow-hidden pb-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="min-w-[65px]" key={`home-artist-skeleton-${index}`}>
            <div className="h-[65px] w-[65px] skeleton-surface rounded-[1.1rem] bg-black/8" />
            <div className="mt-2 h-4 w-[52px] skeleton-surface rounded-full bg-black/8" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}

function HomeListingsRetryNotice({
  isRetrying,
  message,
  onRetry,
}: {
  isRetrying: boolean;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-2 pb-6">
      <p className="rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3 text-[13px] font-semibold text-black/45">
        {message}
      </p>
      <button
        className="h-11 w-full rounded-[0.9rem] border border-black/10 bg-white text-[13px] font-semibold text-black/50 disabled:text-black/25"
        disabled={isRetrying}
        onClick={onRetry}
        type="button"
      >
        {isRetrying ? "불러오는 중…" : "다시 시도"}
      </button>
    </div>
  );
}

export function HomeContent({
  skipEnterAnimation = false,
  initialNowMs,
}: HomeContentProps) {
  useProfileCompletionGuard();

  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isRestoringReturnScrollRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const bannerScrollerRef = useRef<HTMLDivElement | null>(null);
  const bannerDotsRef = useRef<HTMLDivElement | null>(null);
  // 도트 클릭·자동 넘김으로 이동 중인 목표 슬라이드. 이동하는 동안 스크롤 기반 활성 배너 갱신을 억제해
  // 활성 도트가 이전 슬라이드로 되돌아갔다 오는 왕복(→←→)을 막는다.
  const bannerScrollTargetRef = useRef<number | null>(null);
  const bannerPauseReasonsRef = useRef(new Set<BannerPauseReason>());
  // 도움말 버튼도 하단 탭과 같은 신호로 비켜난다 — 상시 떠 있으면 카드 하트·진행바를 가린다.
  const isChromeScrolledAway = useScrollDirectionHidden();
  const [isUsageHelpSheetOpen, setIsUsageHelpSheetOpen] = useState(false);
  const [isUsageHelpSheetEntered, setIsUsageHelpSheetEntered] =
    useState(false);
  const [isUsageHelpSheetClosing, setIsUsageHelpSheetClosing] =
    useState(false);
  const usageHelpSheetCloseTimerRef = useRef<number | null>(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  // 멈췄다 다시 움직일 때마다 올려 타이머를 4초부터 새로 센다 — 남은 시간이 이어지면
  // 사용자가 넘긴 직후 반대쪽으로 넘어가 버린다.
  const [bannerTimerKey, setBannerTimerKey] = useState(0);
  const [isBannerStopped, setIsBannerStopped] = useState(false);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => true,
  );
  const isUnderlay = useIsUnderlay();
  const [shouldSkipEnterAnimation, setShouldSkipEnterAnimation] =
    useState(skipEnterAnimation);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [shouldSuppressHeaderTransition, setShouldSuppressHeaderTransition] =
    useState(false);
  const [groupMessage, setGroupMessage] = useState("");
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  // /artists 와 같은 캐시를 본다 — 아티스트 화면을 다녀와도 레일이 스켈레톤으로 돌아가지 않고,
  // 최애 기준 목록 필터도 첫 렌더부터 제대로 걸린다(전체 목록이 그려졌다 갈리지 않는다).
  const favoriteGroupsQuery = useFavoriteGroupsQuery(authState.isLoggedIn);
  const { setFavorited } = useFavoriteGroupsCache(authState.isLoggedIn);
  // 이 화면에서 하트를 누른 레일 항목의 자리. 해제해도 빠지지 않고, 되돌려도 끝으로 밀리지 않게
  // 처음 누른 자리를 붙잡아 둔다. 마운트마다 비므로 다른 화면에서 해제한 것은 남지 않는다.
  const [pinnedRailSlots, setPinnedRailSlots] = useState<
    { group: ApiGroup; index: number }[]
  >([]);

  // 캐시는 루트 레이아웃의 QueryClient 에 살아있으므로, 뒤로가기 복귀 시 첫 렌더부터
  // 데이터가 있다(스켈레톤 없음). staleTime 내에는 재요청도 없고, 지나면 캐시를 보여준
  // 채 백그라운드 재검증한다. 참여·업로드·삭제는 invalidateQueries 로 즉시 무효화.
  const listingsQuery = useInfiniteQuery({
    queryKey: homeListingsQueryKey(authState.isLoggedIn),
    queryFn: ({ pageParam }) =>
      loadHomeListingsPage(authState.isLoggedIn, pageParam),
    initialPageParam: homeListingsInitialPageParam,
    getNextPageParam: getHomeListingsNextPageParam,
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
  // keepPreviousData 는 '불러오는 중'에만 적용돼, 로그인 목록이 데이터 없이 실패하면 보이던
  // 비로그인 목록이 사라진다. 캐시는 그대로 두고 화면에서만 그 목록을 계속 그린다.
  const fallbackListingsData =
    authState.isLoggedIn && listingsQuery.isError && isListingLoading
      ? queryClient.getQueryData<HomeListingsData>(homeListingsQueryKey(false))
      : undefined;
  const isUsingFallbackListings = fallbackListingsData !== undefined;
  const listingsData = listingsQuery.data ?? fallbackListingsData;
  // isListingLoading 은 스크롤 되돌리기 효과가 쓰므로 뜻을 바꾸지 않고, 화면 그리기는 아래 조건을 쓴다.
  const hasNoListingsToShow = listingsData === undefined;
  const isListingsFailed = hasNoListingsToShow && listingsQuery.isError;
  // 끊김처럼 곧바로 실패한 재시도에는 지연 안내를 띄우지 않는다(1초 깜빡임 방지).
  const isListingsSlow =
    hasNoListingsToShow &&
    listingsQuery.isFetching &&
    listingsQuery.failureCount > 0 &&
    listingsQuery.failureReason instanceof HomeListingsTimeoutError;
  // 최애 조회는 favoriteArtists 가 꺼져 있거나 비로그인이면 아예 돌지 않아 data 가 계속
  // undefined 다. 그 상태를 기다리면 스켈레톤에서 벗어나지 못하므로 노출 조건과 함께 판정한다.
  const apiGroups = favoriteGroupsQuery.data;
  const isGroupLoading =
    FEATURES.favoriteArtists && authState.isLoggedIn && apiGroups === undefined;
  const banners =
    bannersQuery.data && bannersQuery.data.length > 0
      ? bannersQuery.data
      : HOME_BANNERS;
  // 멈춤 버튼·점 모양은 서버 렌더와 깔린 홈에서도 똑같이 그려 하이드레이션·상세 복귀 때 점이 밀리지 않게 한다.
  // 동작 줄이기 사용자에겐 CSS 로 버튼만 숨긴다.
  const canBannerAutoplay = banners.length > 1;
  // 타이머는 따로 거른다. 동작 줄이기면 전역 규칙이 1ms 로 줄여 연달아 넘어가고,
  // 패널 밑에 깔린 홈이면 보이지 않는 채로 넘어가 저장된 위치가 바뀐다.
  const isBannerAutoplayOn =
    canBannerAutoplay &&
    !isBannerStopped &&
    !prefersReducedMotion &&
    !isUnderlay;
  const listings = useMemo(
    () => flattenHomeListings(listingsData),
    [listingsData],
  );
  // 레일에서 해제한 항목은 이 화면에 머무는 동안만 빈 하트로 자리를 지킨다 — 그 자리에서 오탭을
  // 바로 되돌릴 수 있어야 하기 때문이다 (빼버리면 /artists 까지 가야 복구된다). 화면을 벗어나면
  // 사라진다: 다른 화면에서 해제한 것까지 남으면 최애가 아닌 그룹이 홈에 계속 떠 있게 된다.
  const railGroups = useMemo(() => {
    const favoriteGroupsData = apiGroups ?? [];

    if (pinnedRailSlots.length === 0) {
      return favoriteGroupsData.map(toArtistRailItem);
    }

    const favoriteIds = new Set(favoriteGroupsData.map((group) => group.id));
    const pinnedIds = new Set(pinnedRailSlots.map(({ group }) => group.id));
    const items = favoriteGroupsData
      .filter((group) => !pinnedIds.has(group.id))
      .map(toArtistRailItem);

    // 하트를 눌렀던 항목은 해제·복구 어느 쪽이든 처음 그 자리에 그대로 둔다.
    [...pinnedRailSlots]
      .sort((left, right) => left.index - right.index)
      .forEach(({ group, index }) => {
        items.splice(Math.min(index, items.length), 0, {
          ...toArtistRailItem(group),
          favorited: favoriteIds.has(group.id),
        });
      });

    return items;
  }, [apiGroups, pinnedRailSlots]);
  // 최애는 로그인 사용자에게만 존재하므로 비로그인에는 레일 자체를 노출하지 않는다.
  const isArtistRailVisible = FEATURES.favoriteArtists && authState.isLoggedIn;
  // 레일에 남겨 둔 해제분은 빼고 "실제로 최애인" 것만 센다. 레일 길이로 판정하면 전부 해제해도
  // 목록이 계속 좁혀지고, 한도 검사도 해제분까지 세어 헐거워진다.
  const favoritedGroups = useMemo(
    () => railGroups.filter((group) => group.favorited !== false),
    [railGroups],
  );
  const favoriteGroupsError = favoriteGroupsQuery.error;
  // 401 은 토큰이 죽은 것이라 안내 대신 로그인 상태를 정리한다 (기존 fetch 경로와 동일).
  const isFavoriteGroupsUnauthorized =
    favoriteGroupsError !== null &&
    (favoriteGroupsError.message.includes("401") ||
      favoriteGroupsError.message.includes("Unauthorized"));
  // 토글 실패·한도 안내(groupMessage)는 사용자가 방금 한 행동의 결과라 조회 실패보다 우선한다.
  // 조회 실패 원문은 브라우저·서버 영어('Failed to fetch'·'Bad Gateway')라 화면에 쓰지 않는다.
  const visibleGroupMessage =
    groupMessage ||
    (favoriteGroupsError && !isFavoriteGroupsUnauthorized
      ? "그룹 정보를 불러오지 못했어요."
      : "");

  useEffect(() => {
    if (isFavoriteGroupsUnauthorized) {
      clearAuthState();
    }
  }, [isFavoriteGroupsUnauthorized]);
  const favoritedGroupCount = favoritedGroups.length;
  // 한도 안내만 스스로 사라진다. 조회·변경 실패 문구는 사용자가 상황을 인지해야 하므로 남긴다.
  useEffect(() => {
    if (groupMessage !== FAVORITE_LIMIT_MESSAGE) {
      return;
    }
    const timer = window.setTimeout(
      () => setGroupMessage(""),
      FAVORITE_LIMIT_MESSAGE_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [groupMessage]);
  // 최애를 등록했으면 그 그룹 분철만, 아니면 전체를 보여준다.
  const favoriteGroupNames = useMemo(
    () =>
      new Set(
        favoritedGroups.map((group) => normalizeGroupSearchText(group.name)),
      ),
    [favoritedGroups],
  );
  // 서버 순서(모집 중·입금 진행 → 진행 확정 → 인원 미달 취소)가 정본이다 — 클라에서 다시
  // 정렬하면 마감된 두 묶음(진행 확정·미달 취소)이 섞인다.
  const visibleListings = useMemo(
    () =>
      favoriteGroupNames.size > 0
        ? listings.filter((item) =>
            favoriteGroupNames.has(normalizeGroupSearchText(item.era ?? "")),
          )
        : listings,
    [favoriteGroupNames, listings],
  );
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const {
    fetchNextPage: fetchNextListingsPage,
    hasNextPage: hasNextListingsPage,
    isFetching: isFetchingListings,
    isFetchingNextPage: isFetchingNextListingsPage,
    isFetchNextPageError: isNextListingsPageError,
    isPlaceholderData: isListingsPlaceholderData,
  } = listingsQuery;
  // placeholder(이전 키 목록)·대체 목록을 보이는 동안 hasNextPage 는 아직 빈 새 키 기준이라 false 다.
  // 그대로 믿으면 최애 사용자 새로고침마다 "최애 분철이 없어요"가 잠깐 뜨고, 실패 때는 그대로 남는다.
  const isListingsExhausted =
    !isListingLoading && !hasNextListingsPage && !isListingsPlaceholderData;
  const isAwaitingFavoriteListings =
    visibleListings.length === 0 &&
    favoriteGroupNames.size > 0 &&
    !isListingsExhausted;
  // 페이지가 들어온 직후에도 판정한다 — 최애만 걸러 보면 한 페이지로 화면이 안 차 스크롤할 거리가 없다.
  // isFetching 중엔 막는다: 백그라운드 재검증(전 페이지 재요청)과 겹치면 서로 덮어쓴다.
  const loadMoreListingsIfNearEnd = useCallback(() => {
    const scrollElement = scrollContainerRef.current;
    const sentinel = loadMoreSentinelRef.current;

    if (
      !scrollElement ||
      !sentinel ||
      !hasNextListingsPage ||
      isFetchingListings ||
      isNextListingsPageError
    ) {
      return;
    }

    const distanceToEnd =
      sentinel.getBoundingClientRect().top -
      scrollElement.getBoundingClientRect().bottom;

    if (distanceToEnd <= HOME_LISTINGS_LOAD_MORE_DISTANCE_PX) {
      // cancelRefetch 기본값(true)이면 같은 커서 요청을 취소·재전송하므로 끈다.
      void fetchNextListingsPage({ cancelRefetch: false });
    }
  }, [
    fetchNextListingsPage,
    hasNextListingsPage,
    isFetchingListings,
    isNextListingsPageError,
  ]);

  useEffect(() => {
    loadMoreListingsIfNearEnd();
  }, [loadMoreListingsIfNearEnd, visibleListings.length]);

  function handleContentScroll(event: UIEvent<HTMLDivElement>) {
    loadMoreListingsIfNearEnd();

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

    const progress = getBannerProgress(scrollElement);
    const nextIndex = Math.round(progress);

    paintBannerDots(bannerDotsRef.current, progress);

    // 도트 클릭·자동 넘김으로 이동 중에는 목표 도착 전까지 활성 배너 갱신을 건너뛴다.
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

  function scrollToBanner(index: number) {
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

  function handleBannerTimerEnd() {
    scrollToBanner((activeBannerIndex + 1) % banners.length);
  }

  function toggleBannerStopped() {
    const nextStopped = !isBannerStopped;

    setIsBannerStopped(nextStopped);
    window.sessionStorage.setItem(HOME_BANNER_STOPPED_KEY, String(nextStopped));
  }

  const setBannerPaused = useCallback(
    (reason: BannerPauseReason, paused: boolean) => {
      const reasons = bannerPauseReasonsRef.current;
      const wasPaused = reasons.size > 0;

      if (paused) {
        reasons.add(reason);
      } else {
        reasons.delete(reason);
      }

      const isPaused = reasons.size > 0;
      const dotsElement = bannerDotsRef.current;

      if (dotsElement) {
        dotsElement.dataset.paused = String(isPaused);
      }

      if (wasPaused && !isPaused) {
        setBannerTimerKey((current) => current + 1);
      }
    },
    [],
  );

  function handleBannerPointerHover(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") {
      setBannerPaused("hover", event.type === "pointerenter");
    }
  }

  function handleBannerFocus(event: FocusEvent<HTMLElement>) {
    setBannerPaused("focus", event.target.matches(":focus-visible"));
  }

  function handleBannerBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setBannerPaused("focus", false);
    }
  }

  // 화면 밖이거나 앱이 백그라운드면 자동 넘김을 멈춘다 — 돌아왔을 때 보던 배너가 바뀌어 있지 않게.
  useEffect(() => {
    const scrollElement = bannerScrollerRef.current;

    if (!isBannerAutoplayOn || !scrollElement) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) =>
        setBannerPaused(
          "offscreen",
          entries[entries.length - 1].intersectionRatio < 0.5,
        ),
      { threshold: 0.5 },
    );
    const handleVisibilityChange = () =>
      setBannerPaused("hidden", document.visibilityState === "hidden");

    observer.observe(scrollElement);
    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isBannerAutoplayOn, setBannerPaused]);

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
  }, [isListingLoading, skipEnterAnimation]);

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

    // eslint-disable-next-line react-hooks/set-state-in-effect -- 페인트 전 위치 복원(같은 값이면 bail-out)
    setActiveBannerIndex(restoredIndex);
    paintBannerDots(bannerDotsRef.current, restoredIndex);
    // "auto" 는 CSS scroll-behavior(smooth)를 따라가 복원이 스와이프처럼 보인다.
    // 점프 없이 복원하려면 "instant" 로 강제해야 한다.
    scrollElement.scrollTo({
      behavior: "instant",
      left:
        restoredIndex === 0
          ? 0
          : getBannerSlideLeft(scrollElement, restoredIndex),
    });
  }, [banners]);

  // 멈춤 버튼으로 멈춘 상태도 세션 동안 유지한다(상세를 다녀와도 멈춘 채로).
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 페인트 전 복원
    setIsBannerStopped(
      window.sessionStorage.getItem(HOME_BANNER_STOPPED_KEY) === "true",
    );
  }, []);

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

  function openArtistPage(item: ArtistRailItem) {
    if (scrollContainerRef.current) {
      window.sessionStorage.setItem(
        HOME_SCROLL_TOP_KEY,
        String(scrollContainerRef.current.scrollTop),
      );
    }

    const groupId = item.apiId;

    // 멤버 아이템이거나 apiId 가 없으면 그룹 페이지를 만들 수 없다 — 기존 검색 경로로 떨어뜨린다.
    if (item.type === "member" || !groupId) {
      openGroupSearch(item.name);
      return;
    }

    router.push(`/artists/${encodeURIComponent(groupId)}`);
  }

  function openHosting() {
    if (scrollContainerRef.current) {
      window.sessionStorage.setItem(
        HOME_SCROLL_TOP_KEY,
        String(scrollContainerRef.current.scrollTop),
      );
    }

    router.push("/upload");
  }

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
    // 되돌리기(빈 하트 다시 누르기) 대상은 캐시에서 이미 빠져 있으므로 붙잡아 둔 자리에서도 찾는다.
    const sourceGroup =
      (apiGroups ?? []).find((group) => group.id === favoriteGroupId) ??
      pinnedRailSlots.find(({ group }) => group.id === favoriteGroupId)?.group;

    if (!sourceGroup) {
      return;
    }

    // 레일에는 개수 표시가 없어 한도 초과를 눌러보고서야 알게 된다. 서버 왕복 전에 막고 이유를 알린다.
    if (nextFavorited && favoritedGroupCount >= FAVORITE_GROUP_LIMIT) {
      setGroupMessage(FAVORITE_LIMIT_MESSAGE);
      return;
    }

    // 해제하면 캐시에서 빠지지만 이 화면에서는 자리를 지킨다. 자리는 처음 누를 때만 잡는다.
    const slotIndex = railGroups.findIndex(
      (group) => (group.apiId ?? group.id) === favoriteGroupId,
    );

    setPinnedRailSlots((current) =>
      current.some(({ group }) => group.id === favoriteGroupId)
        ? current
        : [...current, { group: sourceGroup, index: slotIndex }],
    );

    // 캐시를 바로 고쳐 하트를 즉시 반영한다. 같은 캐시를 보는 /artists 도 함께 갱신된다.
    setFavorited(sourceGroup, nextFavorited);

    try {
      if (nextFavorited) {
        // 이미 등록돼 있었다면(다른 탭에서 등록 등) 원하는 상태가 이미 만족된 것이라 그대로 둔다.
        await addFavoriteGroup(accessToken, favoriteGroupId);
      } else {
        await removeFavoriteGroup(accessToken, favoriteGroupId);
      }
      setGroupMessage("");
    } catch (error) {
      setFavorited(sourceGroup, !nextFavorited);
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
        className={`scroll-reactive-content scroll-reactive-content--home app-page-scroll min-h-0 flex-1 overflow-y-auto ${
          shouldSkipEnterAnimation ? "" : "tab-content-enter"
        }`}
        data-product-scroll-container="home"
        onScroll={handleContentScroll}
        onTouchStart={resumeHeaderScrollReaction}
        onWheel={resumeHeaderScrollReaction}
        ref={scrollContainerRef}
      >
        <div className="flex min-h-full flex-col">
        <section
          className="px-4 pt-4"
          onBlur={handleBannerBlur}
          onFocus={handleBannerFocus}
          onPointerEnter={handleBannerPointerHover}
          onPointerLeave={handleBannerPointerHover}
          onTouchCancel={() => setBannerPaused("touch", false)}
          onTouchEnd={() => setBannerPaused("touch", false)}
          onTouchStart={() => setBannerPaused("touch", true)}
        >
          <div
            className={`home-banner-carousel motion-carousel ${
              shouldSkipEnterAnimation ? "motion-carousel--skip-enter" : ""
            } flex snap-x snap-mandatory overflow-x-auto rail-scroll`}
            onPointerDown={releaseBannerScrollTarget}
            onScroll={handleBannerScroll}
            onWheel={releaseBannerScrollTarget}
            ref={bannerScrollerRef}
          >
            {banners.map((banner, index) => (
              <Link
                aria-label={`${banner.label} 보기`}
                className="motion-card motion-carousel__slide relative aspect-[1.72/1] w-full flex-none snap-start rounded-[1.15rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                draggable={false}
                href={banner.href}
                key={banner.href}
              >
                <span className="home-banner-card absolute inset-0 overflow-hidden rounded-[inherit] bg-white">
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
                </span>
              </Link>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 pt-2 pb-4">
            <div
              className="home-banner-dots flex items-center gap-2"
              data-autoplay={canBannerAutoplay && !isBannerStopped}
              ref={bannerDotsRef}
            >
              {banners.map((banner, index) => (
                <button
                  aria-label={`${index + 1}번째 배너 보기`}
                  className="home-banner-dot h-2 rounded-full"
                  key={banner.href}
                  onClick={() => scrollToBanner(index)}
                  type="button"
                >
                  {isBannerAutoplayOn && activeBannerIndex === index ? (
                    <span
                      aria-hidden="true"
                      className="home-banner-dot__timer"
                      key={bannerTimerKey}
                      onAnimationEnd={handleBannerTimerEnd}
                    />
                  ) : null}
                </button>
              ))}
            </div>
            {canBannerAutoplay ? (
              <button
                aria-label={
                  isBannerStopped
                    ? "배너 자동 넘김 다시 시작"
                    : "배너 자동 넘김 멈추기"
                }
                className="home-banner-stop relative -my-1.5 grid size-5 place-items-center rounded-full bg-zinc-100 text-zinc-600 before:absolute before:-inset-1 before:content-['']"
                onClick={toggleBannerStopped}
                type="button"
              >
                {isBannerStopped ? <PlayFilledIcon /> : <PauseFilledIcon />}
              </button>
            ) : null}
          </div>

        </section>

        <section className="px-4">
          {isArtistRailVisible ? (
            <>
              <div className="mb-6">
              {/* 최애가 없어도 레일 구성은 그대로 두고 아이템만 비운다 — 등록 전후로 홈 레이아웃이 바뀌지 않게. */}
              {isGroupLoading ? (
                <HomeArtistRailSkeleton />
              ) : (
                <ArtistRail
                  items={railGroups}
                  leadingItem={{ label: "최애 추가", icon: "plus" }}
                  onFavoriteToggle={handleFavoriteGroupToggle}
                  onItemClick={openArtistPage}
                  onLeadingClick={() => openGroupSearch()}
                />
              )}
              </div>

              {visibleGroupMessage ? (
                <div className="mb-4 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3">
                  <p className="text-[13px] font-semibold text-black/45">
                    {visibleGroupMessage}
                  </p>
                </div>
              ) : null}
            </>
          ) : null}

          <div
            className={
              isArtistRailVisible ? "border-t border-black/10 pt-5" : "pt-2"
            }
          >
            {isListingsFailed ? (
              <HomeListingsRetryNotice
                isRetrying={isFetchingListings}
                message={HOME_LISTINGS_FAILED_MESSAGE}
                onRetry={() => void listingsQuery.refetch()}
              />
            ) : hasNoListingsToShow ? (
              <>
                {isListingsSlow ? (
                  <div className="mb-4 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3">
                    <HelpText>
                      {"분철 목록을 불러오는 데 시간이 걸리고 있어요. 다시 불러오는 중이에요."}
                    </HelpText>
                  </div>
                ) : null}
                <ProductGridSkeleton
                  ariaLabel="추천 상품을 불러오는 중"
                  count={3}
                  variant="wide"
                />
              </>
            ) : visibleListings.length === 0 &&
              favoriteGroupNames.size > 0 &&
              isListingsExhausted ? (
              /* 최애만 보여주는 상태라 목록이 비면 이유를 알 수 없다 — 전체가 없는 건지
                 내 최애 것만 없는 건지 구분해 알린다. */
                <div className="rounded-[1.1rem] bg-[#f7f7f7] px-5 py-9 text-center">
                  <p className="text-[15px] font-semibold tracking-[-0.05em]">
                    최애 아티스트 그룹의 분철이 아직 없어요
                  </p>
                  {/* 카오모지는 장식이라 스크린리더가 괄호·기호를 읽지 않도록 숨긴다. */}
                  <p
                      aria-hidden="true"
                      className="mt-2 text-[14px] leading-none text-black/50"
                  >
                    {"(´•̥ ᵔ •̥`)"}
                  </p>
                  <button
                      className="motion-card mt-4 inline-flex h-11 items-center rounded-full bg-[#DDE7B8] px-5 text-[14px] font-semibold tracking-[-0.04em] text-black shadow-[0_10px_24px_rgba(120,132,82,0.24)]"
                      onClick={openHosting}
                      type="button"
                  >
                    분철 직접 개최하기
                  </button>
                </div>
            ) : (
                <div className={shouldRevealListings ? "content-reveal" : ""}>
                  <ProductGrid
                    initialNowMs={initialNowMs}
                    items={visibleListings}
                    variant="wide"
                  />
                </div>
            )}
            {hasNoListingsToShow ? null : (
              <div ref={loadMoreSentinelRef}>
                {/* 최애를 찾는 동안의 스켈레톤도 센티널 안에 둔다 — 위에 두면 센티널이 밀려 연쇄 로드가 멈춘다. */}
                {isUsingFallbackListings ? (
                  /* 대체 목록은 로그인 키로 이어 받을 커서가 없다 — 로그인 목록부터 다시 받는다.
                     최애로 걸러 한 장도 안 남으면 "더"가 사실과 달라 목록 실패 문구를 쓴다. */
                  <HomeListingsRetryNotice
                    isRetrying={isFetchingListings}
                    message={
                      visibleListings.length === 0
                        ? HOME_LISTINGS_FAILED_MESSAGE
                        : "분철을 더 불러오지 못했어요."
                    }
                    onRetry={() => void listingsQuery.refetch()}
                  />
                ) : isNextListingsPageError ? (
                  <HomeListingsRetryNotice
                    isRetrying={isFetchingNextListingsPage}
                    message="분철을 더 불러오지 못했어요."
                    onRetry={() => void fetchNextListingsPage()}
                  />
                ) : isFetchingNextListingsPage || isAwaitingFavoriteListings ? (
                  <ProductGridSkeleton
                    ariaLabel="분철을 더 불러오는 중"
                    count={2}
                    variant="wide"
                  />
                ) : null}
              </div>
            )}
          </div>
        </section>

        <div className="mt-auto pt-8">
          <BusinessFooter clearsFloatingHelpButton />
        </div>
        </div>
      </div>

      <FloatingHelpButton
        isScrolledAway={isChromeScrolledAway}
        label="분철이지 이용 방법 보기"
        onClick={openUsageHelpSheet}
      />

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
                  회원이 개최한 분철은 이 순서로 진행돼요.
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

            <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pb-1 sheet-scroll">
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
                  <HelpText className="mt-1.5">{item.description}</HelpText>
                </div>
              ))}
              <HelpText className="px-1 pt-1">
                분철이지가 직접 개최한 분철은 신청 단계 없이 참여 즉시 10분 안에
                입금하면 돼요. 분철이지는 통신판매중개자이며, 회원 개최 분철의
                대금은 개최자 계좌로 직접 입금돼요.
              </HelpText>
              <HelpText className="px-1 pt-2">
                마음에 드는 분철은 하트를 눌러 찜해 둘 수 있어요. 원하는 분철이
                없다면 하단 &lsquo;개최&rsquo; 탭에서 직접 열 수 있어요.
                <Link
                  className="mt-0.5 inline-block font-semibold text-black/75 underline underline-offset-2"
                  href="/upload/notice"
                  onClick={closeUsageHelpSheet}
                >
                  개최 자격 조건 보기
                </Link>
              </HelpText>
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
