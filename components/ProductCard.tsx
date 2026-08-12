"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { HeartIcon } from "@/components/icons";
import {
  getArtistRestoreIndexKey,
  getArtistScrollTopKey,
  getArtistSelectedMemberKey,
  isGroupIdShape,
  PRODUCT_ARTIST_ENTRY_INDEX_KEY,
} from "@/lib/artist-browse";
import {
  addBuncheolBookmark,
  removeBuncheolBookmark,
} from "@/lib/auth-api";
import {
  createLoginHref,
  getCurrentBrowserHref,
} from "@/lib/auth-navigation";
import { readAuthState, subscribeAuthState } from "@/lib/auth-store";
import {
  isBuncheolCancelledStatus,
  isBuncheolConfirmedStatus,
  isBuncheolPaymentCollectingStatus,
  isBuncheolPurchasableStatus,
} from "@/lib/buncheol-states";
import { getHistoryIndex } from "@/lib/history-index";
import { writePublicBuncheolCard } from "@/lib/public-buncheol-card-store";
import { homeListingsQueryKey } from "@/lib/query-keys";

const PRODUCT_FAVORITES_ENTRY_INDEX_KEY = "product-favorites-entry-index";
const HOME_SCROLL_TOP_KEY = "home-scroll-top";
const FAVORITES_SCROLL_TOP_KEY = "favorites-scroll-top";
const SEARCH_RESULT_SCROLL_TOP_KEY_PREFIX = "search-result-scroll-top";

export type ProductCardItem = {
  id: string;
  productId?: string;
  title: string;
  member: string;
  availableMemberNames?: string[];
  minHeadcount?: number | null;
  optionCount?: number;
  targetMembers?: string[];
  uploadedAt?: string;
  // 정렬용 원본 개최 시각. uploadedAt 은 표시용 포맷 문자열이라 비교에 쓸 수 없다.
  createdAt?: string;
  era: string;
  price?: string;
  deadline: string;
  rating: string;
  reviews: string;
  badge: string;
  tone: string;
  imageUrl?: string;
  isHostedByMe?: boolean;
  liked?: boolean;
  status?: string;
  // 오픈 이벤트 배송비 돌려받기 대상 분철(전 슬롯 0원) 배지. 서버 판정 + 플래그가 모두 켜졌을 때만 true 로 내려온다.
  isShippingFeePaybackEvent?: boolean;
};

type ProductCardProps = {
  item: ProductCardItem;
  variant?: "grid" | "wide";
};

const kstOffsetHours = 9;
const newProductDays = 3;
const soonDeadlineDays = 7;
const millisecondsPerHour = 60 * 60 * 1000;

function getTargetTags(item: ProductCardItem) {
  return getUniqueMemberNames(item.targetMembers ?? [item.member])
    .map((tag) => `#${tag}`);
}

function getUniqueMemberNames(names: string[]) {
  // trim 전에 중복 제거하면 "리즈"/"리즈 " 가 둘 다 살아남아 중복 key 로 이어진다.
  return names
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, tags) => tags.indexOf(tag) === index);
}

function parseKoreaDateTime(value: string) {
  const match = value
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

function getKoreaCalendar(date: Date) {
  const koreaTime = new Date(
    date.getTime() + kstOffsetHours * millisecondsPerHour,
  );

  return new Date(
    Date.UTC(
      koreaTime.getUTCFullYear(),
      koreaTime.getUTCMonth(),
      koreaTime.getUTCDate(),
    ),
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getDeadlineBadge(deadline: string) {
  const deadlineDate = parseKoreaDateTime(deadline);

  if (Number.isNaN(deadlineDate.getTime())) {
    return {
      label: "모집 기한",
      value: deadline,
    };
  }

  const now = new Date();

  if (deadlineDate.getTime() <= now.getTime()) {
    return {
      label: "?? ??",
      value: null,
    };
  }

  const deadlineCalendar = getKoreaCalendar(deadlineDate);
  const nowCalendar = getKoreaCalendar(now);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const remainingDays = Math.round(
    (deadlineCalendar.getTime() - nowCalendar.getTime()) / millisecondsPerDay,
  );

  if (remainingDays === 0) {
    return {
      label: "오늘 종료",
      value: "D-DAY",
    };
  }

  if (remainingDays <= soonDeadlineDays) {
    return {
      label: "모집 임박",
      value: `D-${remainingDays}`,
    };
  }

  return {
    label: `D-${remainingDays}`,
    value: `${deadlineCalendar.getUTCMonth() + 1}월 ${deadlineCalendar.getUTCDate()}일`,
  };
}

function getReadableDeadlineBadge(deadline: string) {
  const deadlineDate = parseKoreaDateTime(deadline);

  if (Number.isNaN(deadlineDate.getTime())) {
    return {
      label: "DATE",
      value: deadline,
    };
  }

  const now = new Date();

  if (deadlineDate.getTime() <= now.getTime()) {
    return {
      label: "CLOSED",
      value: null,
    };
  }

  const deadlineCalendar = getKoreaCalendar(deadlineDate);
  const nowCalendar = getKoreaCalendar(now);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const remainingDays = Math.round(
    (deadlineCalendar.getTime() - nowCalendar.getTime()) / millisecondsPerDay,
  );

  if (remainingDays === 0) {
    return {
      label: "ENDS TODAY",
      value: "D-DAY",
    };
  }

  if (remainingDays <= soonDeadlineDays) {
    return {
      label: "DUE SOON",
      value: `D-${remainingDays}`,
    };
  }

  return {
    label: `D-${remainingDays}`,
    value: `${deadlineCalendar.getUTCMonth() + 1}.${deadlineCalendar.getUTCDate()}`,
  };
}

function isCardDeadlineOpen(deadline: string) {
  const deadlineDate = parseKoreaDateTime(deadline);

  return Number.isNaN(deadlineDate.getTime())
    ? true
    : deadlineDate.getTime() > Date.now();
}

function isProductCardPurchasable(item: ProductCardItem) {
  return (
    isBuncheolPurchasableStatus(item.status) && isCardDeadlineOpen(item.deadline)
  );
}

// 취소(개최자 취소 HOST_CANCELLED 포함)·진행 확정 계열 판정은 중앙 모듈 기준.
// 그 외 비구매 상태(마감 지남 등)는 "모집 종료"로 접는다.
function getProductCardBadge(item: ProductCardItem) {
  if (!isProductCardPurchasable(item)) {
    return {
      label: isBuncheolCancelledStatus(item.status)
        ? "분철 취소"
        : isBuncheolConfirmedStatus(item.status)
          ? "진행 확정"
          : // C2C 입금 수집 구간 — 끝난 분철이 아니라 진행 중(추가 신청은 상세에서 가능).
            isBuncheolPaymentCollectingStatus(item.status)
            ? "입금 진행 중"
            : "모집 종료",
      value: null,
    };
  }

  return { label: "구매 가능", value: getReadableDeadlineBadge(item.deadline).value };
}

function getAvailableMemberSummary(memberNames: string[]) {
  return memberNames.join(" · ");
}

function isRecentlyUploaded(uploadedAt?: string) {
  if (!uploadedAt) {
    return false;
  }

  const uploadedDate = parseKoreaDateTime(uploadedAt);

  if (Number.isNaN(uploadedDate.getTime())) {
    return false;
  }

  const now = new Date();
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const elapsedDays = Math.floor(
    (now.getTime() - uploadedDate.getTime()) / millisecondsPerDay,
  );

  return elapsedDays >= 0 && elapsedDays < newProductDays;
}

export function ProductCard({ item, variant = "grid" }: ProductCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    readAuthState,
  );
  const [isLiked, setIsLiked] = useState(item.liked === true);
  const [isBookmarkPending, setIsBookmarkPending] = useState(false);
  const productId = item.productId ?? item.id;
  const targetTags = getTargetTags(item);
  const deadlineBadge = getProductCardBadge(item);
  const isPurchasable = isProductCardPurchasable(item);
  // C2C 입금 수집 중(PAYMENT_COLLECTING)은 종료가 아니라 진행 중 — 상세에서 추가 신청이
  // 열려 있으므로 마감 카드처럼 흐리지 않는다(배지는 "입금 진행 중" 유지).
  const shouldDimCard =
    !isPurchasable && !isBuncheolPaymentCollectingStatus(item.status);
  // 서버가 availableMemberNames 를 내려준 경우에만 남은 멤버로 취급한다(null = 데이터 없음).
  // 데이터가 없는 카드(찜 목록 등)는 전체 멤버를 남은 멤버처럼 보여주는 대신 대상 멤버 태그로 대체한다.
  const availableMemberNames = Array.isArray(item.availableMemberNames)
    ? getUniqueMemberNames(item.availableMemberNames)
    : null;
  const shouldPeekOptionRail = (availableMemberNames?.length ?? 0) > 3;
  const availableMemberSummary = availableMemberNames?.length
    ? getAvailableMemberSummary(availableMemberNames)
    : "";
  const isNewProduct = isRecentlyUploaded(item.uploadedAt);
  const shouldShowBookmarkButton = item.isHostedByMe !== true;

  useEffect(() => {
    setIsLiked(item.liked === true);
  }, [item.id, item.liked]);

  function isPlainPrimaryClick(event: React.MouseEvent<HTMLAnchorElement>) {
    return (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    );
  }

  function rememberFavoritesProductEntry() {
    const historyIndex = getHistoryIndex();

    if (historyIndex === null) {
      window.sessionStorage.removeItem(PRODUCT_FAVORITES_ENTRY_INDEX_KEY);
      return;
    }

    window.sessionStorage.setItem(
      PRODUCT_FAVORITES_ENTRY_INDEX_KEY,
      String(historyIndex + 1),
    );
  }

  function rememberArtistProductEntry() {
    const historyIndex = getHistoryIndex();

    if (historyIndex === null) {
      window.sessionStorage.removeItem(PRODUCT_ARTIST_ENTRY_INDEX_KEY);
      return;
    }

    window.sessionStorage.setItem(
      PRODUCT_ARTIST_ENTRY_INDEX_KEY,
      String(historyIndex + 1),
    );
  }

  // 스크롤과 멤버 필터는 한 쌍이다. 스크롤만 저장하면 복귀 시 "전체" 목록 위에 멤버 목록의
  // 오프셋이 얹혀, 있지도 않은 위치로 튄다. 히스토리 인덱스까지 같이 저장해야 복원 쪽이
  // "돌아온 마운트" 와 "새로 연 마운트" 를 가릴 수 있다.
  function rememberArtistListState(
    scrollContainer: HTMLElement,
    groupId: string,
  ) {
    const historyIndex = getHistoryIndex();

    window.sessionStorage.setItem(
      getArtistScrollTopKey(groupId),
      String(scrollContainer.scrollTop),
    );
    window.sessionStorage.setItem(
      getArtistSelectedMemberKey(groupId),
      scrollContainer.dataset.artistMemberId ?? "",
    );
    window.sessionStorage.setItem(
      getArtistRestoreIndexKey(groupId),
      historyIndex === null ? "" : String(historyIndex),
    );
  }

  function rememberProductListScrollPosition(
    event: React.MouseEvent<HTMLAnchorElement>,
    storageKey: string,
  ) {
    const scrollContainer = event.currentTarget.closest<HTMLElement>(
      "[data-product-scroll-container]",
    );

    if (!scrollContainer) {
      return;
    }

    window.sessionStorage.setItem(storageKey, String(scrollContainer.scrollTop));
  }

  async function handleBookmarkClick(
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (isBookmarkPending) {
      return;
    }

    const accessToken = authState.accessToken;

    if (!authState.isLoggedIn || !accessToken) {
      router.push(
        createLoginHref({
          cancelTo: getCurrentBrowserHref(),
          returnTo: "/favorites",
        }),
      );
      return;
    }

    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setIsBookmarkPending(true);

    try {
      if (nextLiked) {
        await addBuncheolBookmark(accessToken, productId);
      } else {
        await removeBuncheolBookmark(accessToken, productId);
      }

      // 홈 목록은 React Query 캐시를 그대로 다시 그리므로, 캐시의 liked 도
      // 같이 고쳐야 상세를 갔다 돌아와도 하트 상태가 유지된다.
      // 찜은 로그인 상태에서만 가능하므로 로그인 목록 캐시만 갱신하면 된다.
      queryClient.setQueryData<ProductCardItem[]>(
        homeListingsQueryKey(true),
        (current) =>
          current?.map((cachedItem) =>
            (cachedItem.productId ?? cachedItem.id) === productId
              ? { ...cachedItem, liked: nextLiked }
              : cachedItem,
          ),
      );
    } catch {
      setIsLiked(!nextLiked);
    } finally {
      setIsBookmarkPending(false);
    }
  }

  function handleCardClick(event: React.MouseEvent<HTMLAnchorElement>) {
    // 목록에서 방금 토글한 찜 상태가 상세 진입 시 그대로 보이도록 최신 값을 저장한다.
    writePublicBuncheolCard({ ...item, liked: isLiked });

    const pathname = window.location.pathname;

    if (pathname === "/search") {
      event.preventDefault();

      const searchParams = new URLSearchParams(window.location.search);
      const query = searchParams.get("q") ?? "";

      rememberProductListScrollPosition(
        event,
        `${SEARCH_RESULT_SCROLL_TOP_KEY_PREFIX}:${query}:`,
      );
      router.push(
        `/products/${productId}?from=search&q=${encodeURIComponent(query)}`,
      );
      return;
    }

    if (pathname === "/") {
      event.preventDefault();
      rememberProductListScrollPosition(event, HOME_SCROLL_TOP_KEY);
      router.push(`/products/${productId}?from=home`);
      return;
    }

    // 그룹마다 경로가 달라 from 만으로는 복귀처를 못 정한다. 이 표기가 빠지면 상세의
    // 뒤로가기 버튼이 어느 분기에도 안 걸려 홈으로 떨어진다(스와이프는 멀쩡해 눈치채기 어렵다).
    if (pathname.startsWith("/artists/") && isPlainPrimaryClick(event)) {
      const scrollContainer = event.currentTarget.closest<HTMLElement>(
        "[data-product-scroll-container]",
      );
      // 서버가 준 group.id 를 우선한다. 주소창 조각은 표기가 달라도(`/artists/007`, 트레일링
      // 슬래시) 그대로 실려, 복원 키가 어긋나고 isGroupIdShape 도 통과하지 못해 이번에 고친
      // "뒤로가기가 홈으로" 가 그대로 재발한다. 형태가 어긋나면 아예 표기를 싣지 않는다.
      const groupId =
        scrollContainer?.dataset.artistGroupId ||
        pathname.slice("/artists/".length);

      if (scrollContainer && isGroupIdShape(groupId)) {
        event.preventDefault();
        rememberArtistListState(scrollContainer, groupId);
        rememberArtistProductEntry();
        router.push(
          `/products/${productId}?from=artist&groupId=${encodeURIComponent(groupId)}`,
        );
        return;
      }
    }

    if (pathname === "/favorites" && isPlainPrimaryClick(event)) {
      event.preventDefault();
      rememberProductListScrollPosition(event, FAVORITES_SCROLL_TOP_KEY);
      rememberFavoritesProductEntry();
      router.push(`/products/${productId}?from=favorites`);
    }
  }

  if (variant === "wide") {
    return (
      <Link
        href={`/products/${productId}`}
        className="motion-card block overflow-hidden rounded-[1rem] border border-black/8 bg-white shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
        draggable={false}
        prefetch={false}
        onClick={handleCardClick}
      >
        <div
          className={`relative aspect-[1.72/1] overflow-hidden bg-gradient-to-br ${item.tone}`}
        >
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={item.title}
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_22%,rgba(255,255,255,0.5),transparent_22%)]" />
          )}
          {shouldDimCard ? (
            <div className="absolute inset-0 bg-black/45" />
          ) : null}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
            <div className="flex min-w-0 flex-col items-start gap-1.5">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm ${
                  isPurchasable
                    ? "bg-[#DDE7B8] text-black shadow-[0_8px_22px_rgba(120,132,82,0.22)]"
                    : "bg-black/55 text-white/80"
                }`}
              >
                {deadlineBadge.label}
              </span>
              {item.isShippingFeePaybackEvent ? (
                <span className="inline-flex rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-[#D7FF5F] shadow-[0_8px_18px_rgba(0,0,0,0.2)]">
                  배송비 돌려받는 무료 분철
                </span>
              ) : null}
            </div>
            {shouldShowBookmarkButton ? (
              <button
                type="button"
                aria-label={isLiked ? "찜 해제" : "찜하기"}
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  isLiked
                    ? "heart-on-image heart-on-image--active text-like"
                    : "heart-on-image text-white"
                } disabled:opacity-60`}
                disabled={isBookmarkPending}
                onClick={handleBookmarkClick}
              >
                <HeartIcon filled={isLiked} />
              </button>
            ) : null}
          </div>
          {deadlineBadge.value ? (
            <span className="absolute bottom-3 left-3 rounded-full bg-black/76 px-2.5 py-1 text-[13px] font-semibold tracking-[-0.04em] text-white backdrop-blur-sm">
              {deadlineBadge.value}
            </span>
          ) : null}
        </div>

        <div
          className={`px-3.5 py-3.5 ${shouldDimCard ? "opacity-60" : ""}`}
        >
          {availableMemberNames !== null ? (
            <div>
              {availableMemberNames.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold leading-4 tracking-[-0.04em] text-[#D7FF5F]">
                    남은 멤버
                  </span>
                  {availableMemberNames.map((memberName) => (
                    <span
                      className="rounded-full bg-[#EEF8C8] px-2.5 py-1 text-[11px] font-semibold leading-4 tracking-[-0.04em] text-black/70 ring-1 ring-[#CFE86B]/55"
                      key={memberName}
                    >
                      {memberName}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-black/38">
                  남은 멤버 없음
                </span>
              )}
            </div>
          ) : (
            // 칩 행(24px)과 높이를 맞춰 데이터 유무에 따른 카드 높이 차이를 없앤다.
            <p className="line-clamp-1 text-[12px] font-semibold leading-6 text-black/40">
              {targetTags.join(" ")}
            </p>
          )}
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="line-clamp-2 min-w-0 text-[16px] font-semibold leading-6 tracking-[-0.04em] text-black">
              {item.title}
            </p>
            {isNewProduct ? (
              <span className="shrink-0 rounded-full bg-[#E4F6A5] px-2 py-0.5 text-[10px] font-semibold text-black">
                신규
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/products/${productId}`}
      className="motion-card block space-y-2"
      draggable={false}
      prefetch={false}
      onClick={handleCardClick}
    >
      <div
        className={`relative aspect-square overflow-hidden rounded-[1.2rem] bg-gradient-to-br shadow-[0_12px_28px_rgba(0,0,0,0.08)] ${item.tone}`}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_22%,rgba(255,255,255,0.5),transparent_22%)]" />
        )}
        {item.isShippingFeePaybackEvent ? (
          <div className="absolute left-3 top-3 rounded-full bg-black px-2.5 py-1 text-[10px] font-semibold text-[#D7FF5F] shadow-[0_8px_18px_rgba(0,0,0,0.2)]">
            배송비 돌려받는 무료 분철
          </div>
        ) : isNewProduct ? (
          <div className="absolute left-3 top-3 rounded-full bg-black px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-white">
            신규
          </div>
        ) : null}
        {shouldDimCard ? (
          <div className="absolute inset-0 bg-black/45" />
        ) : null}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/45 to-transparent px-3 pb-3 pt-16 text-white">
          <p
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${
              isPurchasable
                ? "bg-[#DDE7B8] text-black shadow-[0_6px_18px_rgba(120,132,82,0.22)]"
                : "bg-black/40 text-white/75"
            }`}
          >
            {deadlineBadge.label}
          </p>
          {deadlineBadge.value ? (
            <p className="mt-1 text-[17px] font-semibold tracking-[-0.04em] drop-shadow-[0_1px_6px_rgba(0,0,0,0.65)]">
              {deadlineBadge.value}
            </p>
          ) : null}
        </div>
        {shouldShowBookmarkButton ? (
          <button
            type="button"
            aria-label={isLiked ? "찜 해제" : "찜하기"}
            className={`absolute bottom-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full ${
              isLiked
                ? "heart-on-image heart-on-image--active text-like"
                : "heart-on-image text-white"
            } disabled:opacity-60`}
            disabled={isBookmarkPending}
            onClick={handleBookmarkClick}
          >
            <HeartIcon filled={isLiked} />
          </button>
        ) : null}
      </div>

      <div className={shouldDimCard ? "opacity-60" : ""}>
        {availableMemberNames !== null ? (
          <div className="mb-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-semibold leading-4">
            {availableMemberNames.length > 0 ? (
              <>
                <span className="shrink-0 rounded-full bg-[#E4F6A5] px-2 py-0.5 text-black/70 ring-1 ring-black/5">
                  가능 멤버
                </span>
                <span className="shrink-0 text-black/15">·</span>
                <div className="relative min-w-0 flex-1">
                  <div
                    className={`overflow-x-auto whitespace-nowrap pb-0.5 pr-7 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                      shouldPeekOptionRail ? "product-card-option-rail" : ""
                    }`}
                  >
                    <div
                      className={`flex w-max ${
                        shouldPeekOptionRail
                          ? "product-card-option-rail__track motion-carousel__hint"
                          : ""
                      }`}
                    >
                      <span className="text-black/58">{availableMemberSummary}</span>
                    </div>
                  </div>
                  {shouldPeekOptionRail ? (
                    <span className="pointer-events-none absolute bottom-0 right-0 top-0 w-7 bg-gradient-to-l from-white via-white/95 to-transparent" />
                  ) : null}
                </div>
              </>
            ) : (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 ring-1 ring-black/5 ${
                  isPurchasable
                    ? "bg-[#f2f2f2] text-black/45"
                    : "bg-black/5 text-black/38"
                }`}
              >
                남은 멤버 없음
              </span>
            )}
          </div>
        ) : (
          // 칩 행과 동일한 하단 여백·1줄 고정으로 2열 그리드의 카드 높이를 맞춘다.
          <p className="mb-1.5 line-clamp-1 text-[12px] font-semibold leading-5 text-black/40">
            {targetTags.join(" ")}
          </p>
        )}
        <p className="line-clamp-2 text-[15px] leading-6 tracking-[-0.04em] text-black">
          {item.title}
        </p>
      </div>
    </Link>
  );
}
