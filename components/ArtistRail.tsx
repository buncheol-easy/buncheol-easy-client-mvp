"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, HeartIcon, PlusIcon } from "@/components/icons";

export type ArtistRailItem = {
  apiId?: string;
  favorited?: boolean;
  id: string;
  imageUrl?: string;
  name: string;
  group?: string;
  initials: string;
  tone: string;
  type?: "group" | "member";
};

type ArtistRailLeadingItem = {
  label: string;
  subLabel?: string;
  icon?: "plus" | "all";
  active?: boolean;
};

type ArtistRailProps = {
  items: ArtistRailItem[];
  leadingItem?: ArtistRailLeadingItem;
  onFavoriteToggle?: (item: ArtistRailItem) => void;
  onItemClick?: (item: ArtistRailItem) => void;
  onLeadingClick?: () => void;
  pinFirstItem?: boolean;
  selectedId?: string;
};

const proxiedImageHosts = new Set([
  "buncheol-easy-bucket.s3.ap-northeast-2.amazonaws.com",
  "buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
  "staging-buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
]);

// 대비색은 이미지 픽셀만으로 정해지니 URL 당 한 번이면 된다. /artists 는 검색어 한 글자마다
// 카드가 통째로 리마운트돼, 캐시가 없으면 getImageData(GPU→CPU 동기 읽기)가 매번 카드 수만큼 돈다.
const CONTRAST_COLOR_FALLBACK = "#f1f1f1";
// 실패(색을 못 구했거나 canvas 가 tainted)도 같이 캐시한다. 실패를 비워 두면 그 이미지만
// 리마운트마다 getImageData 를 다시 돌아, 이 캐시가 없애려던 비용이 그대로 남는다.
const contrastColorCache = new Map<string, string>();

function getContrastingColor(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  const size = 24;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, size, size);

  const { data } = context.getImageData(0, 0, size, size);
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];

    if (alpha < 24) {
      continue;
    }

    red += data[index];
    green += data[index + 1];
    blue += data[index + 2];
    count += 1;
  }

  if (count === 0) {
    return null;
  }

  const averageRed = Math.round(red / count);
  const averageGreen = Math.round(green / count);
  const averageBlue = Math.round(blue / count);

  return `rgb(${255 - averageRed}, ${255 - averageGreen}, ${255 - averageBlue})`;
}

function getProxiedImageUrl(imageUrl: string) {
  try {
    const url = new URL(imageUrl);

    if (
      proxiedImageHosts.has(url.hostname) &&
      url.pathname.startsWith("/idol-groups/")
    ) {
      return `/api/group-image?url=${encodeURIComponent(imageUrl)}`;
    }
  } catch {
    return imageUrl;
  }

  return imageUrl;
}

function getFallbackInitials(value: string) {
  const initials = value
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "G";
}

export function ArtistImage({
  imageUrl,
  loading = "eager",
  name,
  roundedClassName = "rounded-[1.1rem]",
}: {
  imageUrl: string;
  // 기본 eager. 한 번에 수백 장이 깔리는 아티스트 그리드에서만 lazy 로 넘긴다.
  loading?: "eager" | "lazy";
  name: string;
  roundedClassName?: string;
}) {
  // 캐시가 있으면 첫 렌더부터 제 색으로 — 리마운트 때 회색 깜빡임이 없다.
  const [backgroundColor, setBackgroundColor] = useState(
    () => contrastColorCache.get(imageUrl) ?? CONTRAST_COLOR_FALLBACK,
  );
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const displayImageUrl = getProxiedImageUrl(imageUrl);
  const didImageFail = failedImageUrl === imageUrl;

  const applyContrastingColor = useCallback(
    (image: HTMLImageElement) => {
      const cachedColor = contrastColorCache.get(imageUrl);

      if (cachedColor) {
        setBackgroundColor(cachedColor);
        return;
      }

      try {
        const color = getContrastingColor(image);

        contrastColorCache.set(imageUrl, color || CONTRAST_COLOR_FALLBACK);

        if (color) {
          setBackgroundColor(color);
        }
      } catch {
        contrastColorCache.set(imageUrl, CONTRAST_COLOR_FALLBACK);
        setBackgroundColor(CONTRAST_COLOR_FALLBACK);
      }
    },
    [imageUrl],
  );

  // 서버 렌더 페이지(/artists/[groupId])에서는 하이드레이션 전에 이미지 로딩이 끝나 onLoad 가
  // 영영 발화하지 않는다. 그러면 배경이 초기값(#f1f1f1)에 멈춰 밝은 로고가 묻힌다.
  // ref 콜백으로 마운트 시점에 이미 완료된 이미지를 직접 처리한다.
  //
  // useCallback 으로 identity 를 고정해야 한다 — 콜백 ref 는 identity 가 바뀌면 React 가 렌더마다
  // ref(null) → ref(node) 를 다시 호출하고, 그때마다 drawImage + getImageData 가 커밋 단계에서
  // 동기로 돈다. 홈 레일은 헤더 토글·배너 도트 전환마다 리렌더돼 그 비용이 계속 붙는다.
  const handleImageRef = useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete && image.naturalWidth > 0) {
        applyContrastingColor(image);
      }
    },
    [applyContrastingColor],
  );

  if (didImageFail) {
    return (
      <>
        <span
          className={`absolute inset-0 bg-[#f1f1f1] ${roundedClassName}`}
        />
        <span
          className={`relative flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200 via-white to-zinc-500 text-[13px] font-semibold tracking-[-0.05em] text-black ${roundedClassName}`}
        >
          {getFallbackInitials(name)}
        </span>
      </>
    );
  }

  return (
    <>
      <span
        className={`absolute inset-0 ${roundedClassName}`}
        style={{ backgroundColor }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={name}
        className="relative h-full w-full object-contain p-2 [filter:drop-shadow(0_0_1px_rgba(255,255,255,0.9))_drop-shadow(0_1px_2px_rgba(0,0,0,0.45))]"
        crossOrigin="anonymous"
        decoding="async"
        loading={loading}
        onError={() => setFailedImageUrl(imageUrl)}
        onLoad={(event) => applyContrastingColor(event.currentTarget)}
        ref={handleImageRef}
        src={displayImageUrl}
      />
    </>
  );
}

export function ArtistRail({
  items,
  leadingItem,
  onFavoriteToggle,
  onItemClick,
  onLeadingClick,
  pinFirstItem = false,
  selectedId,
}: ArtistRailProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  const pinnedItem = pinFirstItem ? items[0] : null;
  const scrollItems = pinnedItem ? items.slice(1) : items;
  const itemSignature = items.map((item) => item.id).join("|");

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    const selectedItem = selectedItemRef.current;

    if (
      !scrollContainer ||
      !selectedItem ||
      !scrollContainer.contains(selectedItem)
    ) {
      return;
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const itemRect = selectedItem.getBoundingClientRect();
    const edgePadding = 12;
    const isFullyVisible =
      itemRect.left >= containerRect.left + edgePadding &&
      itemRect.right <= containerRect.right - edgePadding;

    if (isFullyVisible) {
      return;
    }

    const targetScrollLeft =
      itemRect.left < containerRect.left + edgePadding
        ? scrollContainer.scrollLeft -
          (containerRect.left + edgePadding - itemRect.left)
        : scrollContainer.scrollLeft +
          (itemRect.right - (containerRect.right - edgePadding));
    const maxScrollLeft =
      scrollContainer.scrollWidth - scrollContainer.clientWidth;
    const nextScrollLeft = Math.min(
      Math.max(targetScrollLeft, 0),
      Math.max(maxScrollLeft, 0),
    );
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    scrollContainer.scrollTo({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      left: nextScrollLeft,
    });
  }, [itemSignature, selectedId]);

  function renderItem(item: ArtistRailItem) {
    const isSelected = item.id === selectedId;

    return (
      <div
        key={item.id}
        className="w-[65px] shrink-0"
        ref={isSelected ? selectedItemRef : undefined}
      >
        <div className="relative">
          <button
            className="motion-card w-[65px] text-left"
            onClick={() => onItemClick?.(item)}
            type="button"
          >
            <div
              className={`relative flex h-[65px] w-[65px] items-center justify-center overflow-hidden rounded-[1.1rem] border bg-[#f1f1f1] text-[22px] font-semibold tracking-[-0.06em] text-black ${
                isSelected ? "border-black/10" : "border-black/8"
              }`}
            >
              {item.imageUrl ? (
                <ArtistImage imageUrl={item.imageUrl} name={item.name} />
              ) : (
                <span
                  className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${item.tone}`}
                >
                  {item.initials}
                </span>
              )}
            </div>
          </button>
          {onFavoriteToggle && item.type !== "member" ? (
            <button
              className={`absolute right-0.5 top-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full ${
                item.favorited === true
                  ? "heart-on-image heart-on-image--active text-like"
                  : "heart-on-image text-white"
              }`}
              onClick={() => onFavoriteToggle(item)}
              type="button"
              aria-label={item.favorited ? "최애 그룹 삭제" : "최애 그룹 등록"}
            >
              <HeartIcon filled={item.favorited === true} />
            </button>
          ) : null}
          {isSelected ? (
            <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#DDE7B8] text-black shadow-[0_5px_14px_rgba(120,132,82,0.24)] ring-2 ring-white">
              <CheckIcon />
            </span>
          ) : null}
        </div>
        <button
          className="w-[65px] text-left"
          onClick={() => onItemClick?.(item)}
          type="button"
        >
          <p className="mt-2 text-[13px] font-medium tracking-[-0.03em]">
            {item.name}
          </p>
          {item.group ? (
            <p className="text-[12px] text-black/45">{item.group}</p>
          ) : null}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      {leadingItem ? (
        <>
          <div className="w-[65px] flex-shrink-0">
            <button
              className="motion-card flex w-full flex-col items-center text-center"
              onClick={onLeadingClick}
              type="button"
            >
              <div
                className={`motion-icon-button flex h-[65px] w-[65px] items-center justify-center rounded-full border transition-[background-color,border-color,box-shadow,transform] duration-200 ${
                  leadingItem.active
                    ? "border-[#C8D4A5] bg-[#DDE7B8] text-black shadow-[0_8px_20px_rgba(120,132,82,0.2)]"
                    : "border-black/8 bg-white text-black/55 shadow-[0_6px_18px_rgba(0,0,0,0.06)]"
                }`}
              >
                {leadingItem.icon === "all" ? (
                  <span className="text-[13px] font-semibold tracking-[-0.03em]">
                    All
                  </span>
                ) : (
                  <PlusIcon />
                )}
              </div>
              <p className="mt-2 w-full text-[13px] font-semibold leading-[1.15] tracking-[-0.03em] text-black/80">
                {leadingItem.label}
              </p>
              {leadingItem.subLabel ? (
                <p className="text-[12px] text-black/45">
                  {leadingItem.subLabel}
                </p>
              ) : null}
            </button>
          </div>

          {/* 구분선은 "추가 버튼"과 "담은 목록"을 가르는 선이라 가를 것이 있을 때만 그린다.
              최애가 하나도 없으면 선 오른쪽이 통째로 비어, 선만 허공에 남아 있었다. */}
          {items.length > 0 ? (
            <div className="my-2 w-px self-stretch bg-black/10" />
          ) : null}
        </>
      ) : null}

      {pinnedItem ? (
        <>
          <div className="flex-shrink-0">{renderItem(pinnedItem)}</div>
          <div className="my-2 w-px self-stretch bg-black/10" />
        </>
      ) : null}

      <div
        className="motion-carousel flex min-w-0 flex-1 gap-4 overflow-x-auto pb-4 rail-scroll"
        ref={scrollContainerRef}
      >
        {scrollItems.map(renderItem)}
      </div>
    </div>
  );
}
