"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HeartIcon } from "@/components/icons";
import {
  addBuncheolBookmark,
  removeBuncheolBookmark,
} from "@/lib/auth-api";
import { readAuthState, subscribeAuthState } from "@/lib/auth-store";
import { writePublicBuncheolCard } from "@/lib/public-buncheol-card-store";

const PRODUCT_FAVORITES_ENTRY_INDEX_KEY = "product-favorites-entry-index";
const HOME_SCROLL_TOP_KEY = "home-scroll-top";
const FAVORITES_SCROLL_TOP_KEY = "favorites-scroll-top";

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
  return names
    .filter((tag, index, tags) => tag && tags.indexOf(tag) === index)
    .map((tag) => tag.trim())
    .filter(Boolean);
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

function isPurchasableCardStatus(status: string | undefined) {
  const normalizedStatus = status?.trim().toUpperCase();

  if (!normalizedStatus) {
    return true;
  }

  return normalizedStatus === "RECRUITING" || normalizedStatus === "PUBLIC_PREVIEW";
}

function isCardDeadlineOpen(deadline: string) {
  const deadlineDate = parseKoreaDateTime(deadline);

  return Number.isNaN(deadlineDate.getTime())
    ? true
    : deadlineDate.getTime() > Date.now();
}

function isProductCardPurchasable(item: ProductCardItem) {
  return isPurchasableCardStatus(item.status) && isCardDeadlineOpen(item.deadline);
}

function getProductCardBadge(item: ProductCardItem) {
  if (!isProductCardPurchasable(item)) {
    return { label: "모집 종료", value: null };
  }

  return { label: "구매 가능", value: getReadableDeadlineBadge(item.deadline).value };
}

function getAvailableMemberNames(item: ProductCardItem) {
  if (Array.isArray(item.availableMemberNames)) {
    return getUniqueMemberNames(item.availableMemberNames);
  }

  return getUniqueMemberNames(
    item.targetMembers ?? [item.member],
  );
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
  const hasAvailableMemberNames = Array.isArray(item.availableMemberNames);
  const availableMemberNames = getAvailableMemberNames(item);
  const shouldShowAvailableMembers =
    hasAvailableMemberNames || availableMemberNames.length > 0;
  const shouldPeekOptionRail = availableMemberNames.length > 3;
  const availableMemberSummary =
    availableMemberNames.length > 0
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

  function getHistoryIndex() {
    const historyState = window.history.state as { idx?: unknown } | null;

    return typeof historyState?.idx === "number" ? historyState.idx : null;
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
      router.push("/login?returnTo=/favorites");
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
    } catch {
      setIsLiked(!nextLiked);
    } finally {
      setIsBookmarkPending(false);
    }
  }

  function handleCardClick(event: React.MouseEvent<HTMLAnchorElement>) {
    writePublicBuncheolCard(item);

    const pathname = window.location.pathname;

    if (pathname === "/search") {
      event.preventDefault();

      const searchParams = new URLSearchParams(window.location.search);
      const query = searchParams.get("q") ?? "";

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
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm ${
                isPurchasable
                  ? "bg-[#DDE7B8] text-black shadow-[0_8px_22px_rgba(120,132,82,0.22)]"
                  : "bg-black/55 text-white/80"
              }`}
            >
              {deadlineBadge.label}
            </span>
            {shouldShowBookmarkButton ? (
              <button
                type="button"
                aria-label={isLiked ? "찜 해제" : "찜하기"}
                className={`motion-icon-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 shadow-[0_10px_22px_rgba(0,0,0,0.16)] ${
                  isLiked
                    ? "bg-[#DDE7B8] text-black shadow-[0_10px_24px_rgba(120,132,82,0.24)]"
                    : "bg-white/95 text-black/45"
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

        <div className="px-3.5 py-3.5">
          {shouldShowAvailableMembers ? (
            <div>
              {availableMemberNames.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold leading-4 tracking-[-0.04em] text-[#D7FF5F]">
                    가능 멤버
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
            <p className="line-clamp-2 text-[12px] font-semibold leading-5 text-black/40">
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
        {isNewProduct ? (
          <div className="absolute left-3 top-3 rounded-full bg-black px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-white">
            신규
          </div>
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
            className={`motion-icon-button absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 shadow-[0_10px_22px_rgba(0,0,0,0.16)] ${
              isLiked
                ? "bg-[#DDE7B8] text-black shadow-[0_10px_24px_rgba(120,132,82,0.24)]"
                : "bg-white/95 text-black/45"
            } disabled:opacity-60`}
            disabled={isBookmarkPending}
            onClick={handleBookmarkClick}
          >
            <HeartIcon filled={isLiked} />
          </button>
        ) : null}
      </div>

      <div>
        {shouldShowAvailableMembers ? (
          <div className="mb-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-semibold leading-4">
            {availableMemberNames.length > 0 ? (
              <>
                <span className="shrink-0 rounded-full bg-[#E4F6A5] px-2 py-0.5 text-black/70 ring-1 ring-black/5">
                  가능 옵션
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
                남은 옵션 없음
              </span>
            )}
          </div>
        ) : (
          <p className="line-clamp-2 text-[12px] font-semibold leading-5 text-black/40">
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
