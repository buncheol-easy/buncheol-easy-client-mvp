import type { ProductCardItem } from "@/components/ProductCard";

const homeListingsCacheKey = "home-listings-cache";
const maxCachedListings = 80;

// "상세 봤다가 바로 뒤로" 동선만 요청 없이 재사용하는 신선 창. 이보다 낡으면
// 캐시를 먼저 보여주고 백그라운드에서 조용히 재검증한다. 내 참여 등 내가 일으킨
// 변경은 이 창과 무관하게 즉시 무효화(clearCachedHomeListings)로 처리한다.
const HOME_LISTINGS_CACHE_TTL_MS = 60_000;

type HomeListingsCacheEntry = {
  listings: ProductCardItem[];
  loggedIn: boolean;
  savedAt: number;
};

export function readCachedHomeListings(): HomeListingsCacheEntry | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(homeListingsCacheKey);

    if (rawValue === null) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as unknown;

    // 구 포맷(배열)은 저장 시각·로그인 상태를 모른다 — 표시용으로는 쓰되 항상 재검증 대상.
    if (Array.isArray(parsed)) {
      return {
        listings: parsed as ProductCardItem[],
        loggedIn: false,
        savedAt: 0,
      };
    }

    if (
      parsed !== null &&
      typeof parsed === "object" &&
      Array.isArray((parsed as HomeListingsCacheEntry).listings)
    ) {
      const entry = parsed as HomeListingsCacheEntry;

      return {
        listings: entry.listings,
        loggedIn: entry.loggedIn === true,
        savedAt: typeof entry.savedAt === "number" ? entry.savedAt : 0,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function writeCachedHomeListings(
  listings: ProductCardItem[],
  loggedIn: boolean,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const entry: HomeListingsCacheEntry = {
      listings: listings.slice(0, maxCachedListings),
      loggedIn,
      savedAt: Date.now(),
    };

    window.sessionStorage.setItem(homeListingsCacheKey, JSON.stringify(entry));
  } catch {
    // The cache is only for back-navigation recovery.
  }
}

// 내가 일으킨 변경(분철 참여 등) 직후 호출한다 — 홈 복귀 시 반드시 fresh 요청을 태운다.
export function clearCachedHomeListings() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(homeListingsCacheKey);
}

export function isCachedHomeListingsFresh(
  entry: HomeListingsCacheEntry,
  loggedIn: boolean,
) {
  // 로그인 상태가 다르면 찜 여부 등 사용자별 필드가 어긋나므로 신선하지 않은 것으로 본다.
  return (
    entry.loggedIn === loggedIn &&
    Date.now() - entry.savedAt < HOME_LISTINGS_CACHE_TTL_MS
  );
}

// 상세 화면이 받은 최신 데이터로 목록 캐시의 해당 카드만 덮어쓴다(write-back).
// 뒤로가기 시 방금 상세에서 본 사실과 홈 카드가 어긋나 보이는 것을 막는다.
// savedAt 은 갱신하지 않는다 — 신선해진 것은 이 카드 하나뿐이므로.
export function updateCachedHomeListing(
  cardId: string,
  patch: Partial<ProductCardItem>,
) {
  if (typeof window === "undefined" || !cardId) {
    return;
  }

  const entry = readCachedHomeListings();

  if (entry === null) {
    return;
  }

  // undefined 값은 기존 필드를 지우지 않도록 제외한다 (예: 찜 여부가 아직 조회 전인 경우).
  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );

  let didUpdate = false;
  const nextListings = entry.listings.map((item) => {
    if ((item.productId ?? item.id) !== cardId) {
      return item;
    }

    didUpdate = true;

    return { ...item, ...definedPatch, id: item.id };
  });

  if (!didUpdate) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      homeListingsCacheKey,
      JSON.stringify({ ...entry, listings: nextListings }),
    );
  } catch {
    // The cache is only for back-navigation recovery.
  }
}

// 상세 아이템(ProductDetailItem 등 카드 상위 타입)에서 홈 카드가 표시하는 필드만 추린다.
// options 등 상세 전용 대형 필드가 캐시에 들어가는 것을 막는다.
export function toProductCardPatch(
  item: ProductCardItem,
): Partial<ProductCardItem> {
  return {
    availableMemberNames: item.availableMemberNames,
    badge: item.badge,
    deadline: item.deadline,
    era: item.era,
    imageUrl: item.imageUrl,
    isHostedByMe: item.isHostedByMe,
    liked: item.liked,
    member: item.member,
    minHeadcount: item.minHeadcount,
    optionCount: item.optionCount,
    price: item.price,
    rating: item.rating,
    reviews: item.reviews,
    status: item.status,
    targetMembers: item.targetMembers,
    title: item.title,
    tone: item.tone,
    uploadedAt: item.uploadedAt,
  };
}
