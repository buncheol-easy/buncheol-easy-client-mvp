"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, HeartIcon, PlusIcon, ProfileIcon } from "@/components/icons";

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
  name,
  roundedClassName = "rounded-[1.1rem]",
}: {
  imageUrl: string;
  name: string;
  roundedClassName?: string;
}) {
  const [backgroundColor, setBackgroundColor] = useState("#f1f1f1");
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const displayImageUrl = getProxiedImageUrl(imageUrl);
  const didImageFail = failedImageUrl === imageUrl;

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
        onError={() => setFailedImageUrl(imageUrl)}
        onLoad={(event) => {
          try {
            const color = getContrastingColor(event.currentTarget);

            if (color) {
              setBackgroundColor(color);
            }
          } catch {
            setBackgroundColor("#f1f1f1");
          }
        }}
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
              className={`motion-icon-button absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.12)] ${
                item.favorited === true
                  ? "bg-[#DDE7B8] text-black"
                  : "bg-white/90 text-black"
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
          <div className="flex-shrink-0">
          <button className="min-w-[65px]" onClick={onLeadingClick} type="button">
            <div
                className={`motion-icon-button flex aspect-square items-center justify-center rounded-[1.25rem] border text-black/35 ${
                  leadingItem.active
                    ? "border-[#C8D4A5] bg-[#DDE7B8] text-black shadow-[0_8px_22px_rgba(120,132,82,0.2)]"
                    : "border-black/10 bg-[#ededeb]"
                }`}
              >
                {leadingItem.icon === "all" ? (
                  <span className="text-[18px] font-semibold tracking-[-0.06em]">
                    All
                  </span>
                ) : (
                  <div className="relative h-10 w-10">
                    <ProfileIcon />
                    <div className="absolute -bottom-1 -right-2">
                      <PlusIcon />
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-2 text-[14px] font-medium tracking-[-0.03em]">
                {leadingItem.label}
              </p>
              {leadingItem.subLabel ? (
                <p className="text-[12px] text-black/45">
                  {leadingItem.subLabel}
                </p>
              ) : null}
            </button>
          </div>

          <div className="my-2 w-px self-stretch bg-black/10" />
        </>
      ) : null}

      {pinnedItem ? (
        <>
          <div className="flex-shrink-0">{renderItem(pinnedItem)}</div>
          <div className="my-2 w-px self-stretch bg-black/10" />
        </>
      ) : null}

      <div
        className="motion-carousel flex min-w-0 flex-1 gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        ref={scrollContainerRef}
      >
        {scrollItems.map(renderItem)}
      </div>
    </div>
  );
}
