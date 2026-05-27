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
};

const kstOffsetHours = 9;
const newProductDays = 3;
const soonDeadlineDays = 7;
const millisecondsPerHour = 60 * 60 * 1000;

function getTargetTags(item: ProductCardItem) {
  const tags = item.targetMembers ?? [item.member];

  return tags
    .filter((tag, index, tags) => tag && tags.indexOf(tag) === index)
    .map((tag) => `#${tag}`);
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

function getDeadlineBadge(deadline: string) {
  const deadlineDate = parseKoreaDateTime(deadline);

  if (Number.isNaN(deadlineDate.getTime())) {
    return {
      label: "마감",
      value: deadline,
    };
  }

  const now = new Date();

  if (deadlineDate.getTime() <= now.getTime()) {
    return {
      label: "Closed",
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
      label: "오늘 마감",
      value: "D-DAY",
    };
  }

  if (remainingDays <= soonDeadlineDays) {
    return {
      label: "마감 임박",
      value: `D-${remainingDays}`,
    };
  }

  return {
    label: `D-${remainingDays}`,
    value: `${deadlineCalendar.getUTCMonth() + 1}월 ${deadlineCalendar.getUTCDate()}일`,
  };
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

export function ProductCard({ item }: ProductCardProps) {
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
  const deadlineBadge = getDeadlineBadge(item.deadline);
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

  return (
    <Link
      href={`/products/${productId}`}
      className="block space-y-3"
      prefetch={false}
      onClick={(event) => {
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
      }}
    >
      <div
        className={`relative aspect-square overflow-hidden rounded-[1.2rem] bg-gradient-to-br ${item.tone}`}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            className="absolute inset-0 h-full w-full object-cover"
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
          <p className="inline-flex rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75 backdrop-blur-sm">
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
            className={`absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 ${
              isLiked ? "bg-black text-white" : "bg-white/95 text-black/45"
            } disabled:opacity-60`}
            disabled={isBookmarkPending}
            onClick={handleBookmarkClick}
          >
            <HeartIcon filled={isLiked} />
          </button>
        ) : null}
      </div>

      <div>
        <p className="line-clamp-2 text-[12px] font-semibold leading-5 text-black/40">
          {targetTags.join(" ")}
        </p>
        <p className="line-clamp-2 text-[15px] leading-6 tracking-[-0.04em] text-black">
          {item.title}
        </p>
      </div>
    </Link>
  );
}
