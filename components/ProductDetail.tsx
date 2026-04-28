"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductDetailItem, ProductOption } from "@/lib/mock-products";
import { BackIcon, CloseIcon, HeartIcon, StarIcon } from "@/components/icons";
import { BottomNavigator } from "@/components/BottomNavigator";
import { HomeContent } from "@/components/HomeContent";
import {
  SEARCH_SKIP_ENTER_KEY,
  SearchExperience,
} from "@/components/SearchExperience";

type ProductDetailProps = {
  product: ProductDetailItem;
  backHref?: string;
  initialReturnSource?: "home";
  initialReturnQuery?: string;
};

function priceToNumber(price: string) {
  return Number(price.replace(/[^0-9]/g, ""));
}

function formatPrice(price: number) {
  return `${price.toLocaleString("ko-KR")}원`;
}

export function ProductDetail({
  backHref,
  product,
  initialReturnSource,
  initialReturnQuery,
}: ProductDetailProps) {
  const router = useRouter();
  const didNavigateBack = useRef(false);
  const sheetEnterAnimationFrameRef = useRef<number | null>(null);
  const sheetCloseFallbackTimerRef = useRef<number | null>(null);
  const [returnQuery] = useState<string | undefined>(initialReturnQuery);
  const [isEntered, setIsEntered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSheetEntered, setIsSheetEntered] = useState(false);
  const [isSheetClosing, setIsSheetClosing] = useState(false);
  const [auctionOptions, setAuctionOptions] = useState<ProductOption[]>(
    product.options,
  );
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [myBids, setMyBids] = useState<Record<string, number>>({});

  const activeBidCount = useMemo(() => {
    return auctionOptions.filter((option) => {
      const bidAmount = Number(bidAmounts[option.id] ?? 0);

      return bidAmount > priceToNumber(option.currentBid);
    }).length;
  }, [auctionOptions, bidAmounts]);

  const totalBidAmount = useMemo(() => {
    return auctionOptions.reduce((sum, option) => {
      const bidAmount = Number(bidAmounts[option.id] ?? 0);

      if (bidAmount <= priceToNumber(option.currentBid)) {
        return sum;
      }

      return sum + bidAmount;
    }, 0);
  }, [auctionOptions, bidAmounts]);

  const myBidItems = auctionOptions
    .map((option) => {
      const amount = myBids[option.id] ?? 0;

      if (amount <= 0) {
        return null;
      }

      const rank =
        getTopBids(option)
          .map((bid) => priceToNumber(bid))
          .filter((bid) => bid > amount).length + 1;

      return {
        amount,
        option,
        rank,
      };
    })
    .filter(
      (item): item is { amount: number; option: ProductOption; rank: number } =>
        item !== null,
    );

  const sortedAuctionOptions = [...auctionOptions].sort((left, right) => {
    const leftHasBid = Boolean(myBids[left.id]);
    const rightHasBid = Boolean(myBids[right.id]);

    if (leftHasBid === rightHasBid) {
      return 0;
    }

    return leftHasBid ? -1 : 1;
  });

  const shippingMethods = product.shippingMethods ?? [
    { name: product.courier, price: "판매자 안내" },
  ];

  function getTopBids(option: ProductOption) {
    return option.topBids ?? [option.currentBid, "-", "-"];
  }

  function buildTopBids(
    option: ProductOption,
    bidAmount: number,
    previousBidAmount = 0,
  ) {
    const topBidAmounts = [
      bidAmount,
      ...getTopBids(option).map((bid) => priceToNumber(bid)),
    ]
      .filter((bid) => bid > 0)
      .sort((a, b) => b - a);
    const previousBidIndex = topBidAmounts.indexOf(previousBidAmount);

    if (previousBidIndex >= 0) {
      topBidAmounts.splice(previousBidIndex, 1);
    }

    const topBids = topBidAmounts.slice(0, 3).map(formatPrice);

    return [
      topBids[0] ?? "-",
      topBids[1] ?? "-",
      topBids[2] ?? "-",
    ] as [string, string, string];
  }

  function removeBidFromTopBids(option: ProductOption, bidAmount: number) {
    const nextTopBidAmounts = getTopBids(option)
      .map((bid) => priceToNumber(bid))
      .filter((bid) => bid > 0);
    const withdrawnBidIndex = nextTopBidAmounts.indexOf(bidAmount);

    if (withdrawnBidIndex >= 0) {
      nextTopBidAmounts.splice(withdrawnBidIndex, 1);
    }

    const nextTopBids = nextTopBidAmounts
      .slice(0, 3)
      .map(formatPrice);

    return {
      currentBid: nextTopBids[0] ?? "-",
      topBids: [
        nextTopBids[0] ?? "-",
        nextTopBids[1] ?? "-",
        nextTopBids[2] ?? "-",
      ] as [string, string, string],
    };
  }

  function updateBidAmount(optionId: string, nextAmount: string) {
    setBidAmounts((current) => ({
      ...current,
      [optionId]: nextAmount.replace(/[^0-9]/g, ""),
    }));
  }

  function withdrawBid(optionId: string) {
    const withdrawnBid = myBids[optionId];

    if (!withdrawnBid) {
      return;
    }

    setAuctionOptions((currentOptions) =>
      currentOptions.map((option) => {
        if (option.id !== optionId) {
          return option;
        }

        const { currentBid, topBids } = removeBidFromTopBids(
          option,
          withdrawnBid,
        );

        return {
          ...option,
          currentBid,
          participantCount: Math.max(0, option.participantCount - 1),
          topBids,
        };
      }),
    );
    setMyBids((current) => {
      const nextBids = { ...current };
      delete nextBids[optionId];

      return nextBids;
    });
    setBidAmounts((current) => {
      const nextAmounts = { ...current };
      delete nextAmounts[optionId];

      return nextAmounts;
    });
  }

  function handleSubmitBids() {
    setAuctionOptions((currentOptions) =>
      currentOptions.map((option) => {
        const bidAmount = Number(bidAmounts[option.id] ?? 0);

        if (bidAmount <= priceToNumber(option.currentBid)) {
          return option;
        }

        const previousBidAmount = myBids[option.id] ?? 0;

        return {
          ...option,
          currentBid: formatPrice(bidAmount),
          participantCount:
            previousBidAmount > 0
              ? option.participantCount
              : option.participantCount + 1,
          topBids: buildTopBids(option, bidAmount, previousBidAmount),
        };
      }),
    );
    setMyBids((current) => {
      const nextBids = { ...current };

      auctionOptions.forEach((option) => {
        const bidAmount = Number(bidAmounts[option.id] ?? 0);

        if (bidAmount > priceToNumber(option.currentBid)) {
          nextBids[option.id] = bidAmount;
        }
      });

      return nextBids;
    });
    setBidAmounts({});
    closeSheet();
  }

  const navigateBack = useCallback(() => {
    if (didNavigateBack.current) {
      return;
    }

    didNavigateBack.current = true;
    if (backHref) {
      router.replace(backHref);
      return;
    }

    router.back();
  }, [backHref, router]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setIsEntered(true);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    if (!isExiting) {
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      navigateBack();
    }, 260);

    return () => {
      window.clearTimeout(fallbackTimer);
    };
  }, [isExiting, navigateBack]);

  useEffect(() => {
    return () => {
      if (sheetEnterAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(sheetEnterAnimationFrameRef.current);
      }

      if (sheetCloseFallbackTimerRef.current !== null) {
        window.clearTimeout(sheetCloseFallbackTimerRef.current);
      }
    };
  }, []);

  function handleBack() {
    if (isSheetOpen) {
      closeSheet();
      return;
    }

    if (returnQuery !== undefined) {
      window.sessionStorage.setItem(SEARCH_SKIP_ENTER_KEY, "true");
    } else {
      window.sessionStorage.removeItem(SEARCH_SKIP_ENTER_KEY);
    }

    setIsExiting(true);
  }

  function openSheet() {
    if (sheetCloseFallbackTimerRef.current !== null) {
      window.clearTimeout(sheetCloseFallbackTimerRef.current);
      sheetCloseFallbackTimerRef.current = null;
    }

    setIsSheetOpen(true);
    setIsSheetClosing(false);

    sheetEnterAnimationFrameRef.current = window.requestAnimationFrame(() => {
      sheetEnterAnimationFrameRef.current = null;
      setIsSheetEntered(true);
    });
  }

  function finishCloseSheet() {
    if (sheetCloseFallbackTimerRef.current !== null) {
      window.clearTimeout(sheetCloseFallbackTimerRef.current);
      sheetCloseFallbackTimerRef.current = null;
    }

    setIsSheetOpen(false);
    setIsSheetClosing(false);
  }

  function closeSheet() {
    if (sheetEnterAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(sheetEnterAnimationFrameRef.current);
      sheetEnterAnimationFrameRef.current = null;
    }

    setIsSheetClosing(true);
    setIsSheetEntered(false);

    if (sheetCloseFallbackTimerRef.current !== null) {
      window.clearTimeout(sheetCloseFallbackTimerRef.current);
    }

    sheetCloseFallbackTimerRef.current = window.setTimeout(() => {
      finishCloseSheet();
    }, 260);
  }

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]">
      {initialReturnSource === "home" ? (
        <div
          className={`product-underlay pointer-events-none absolute inset-0 mx-auto flex h-full w-full max-w-[430px] flex-col bg-white ${
            isEntered && !isExiting ? "product-underlay-active" : ""
          } ${isExiting ? "product-underlay-exit" : ""}`}
        >
          <HomeContent />
          <BottomNavigator />
        </div>
      ) : null}

      {returnQuery !== undefined ? (
        <div
          className={`product-underlay pointer-events-none absolute inset-0 ${
            isEntered && !isExiting ? "product-underlay-active" : ""
          } ${isExiting ? "product-underlay-exit" : ""}`}
        >
          <SearchExperience query={returnQuery} skipEnterAnimation />
        </div>
      ) : null}

      <div
        className={`product-page-panel relative mx-auto flex h-full w-full max-w-[430px] flex-col overflow-hidden bg-white ${
          isEntered && !isExiting ? "product-page-active" : ""
        } ${
          isExiting ? "product-page-exit" : ""
        }`}
        onTransitionEnd={(event) => {
          if (
            isExiting &&
            event.currentTarget === event.target &&
            event.propertyName === "transform"
          ) {
            navigateBack();
          }
        }}
      >
        <header className="shrink-0 px-4 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black text-white"
              onClick={handleBack}
              aria-label="이전 화면"
            >
              <BackIcon />
            </button>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-black"
              aria-label="찜하기"
            >
              <HeartIcon filled={product.liked} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto pb-28">
          <section className="px-4">
            <div
              className={`relative aspect-square overflow-hidden rounded-[1.35rem] bg-gradient-to-br ${product.tone}`}
            >
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  src={product.imageUrl}
                />
              ) : (
                <>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_66%_22%,rgba(255,255,255,0.56),transparent_22%)]" />
                  <div className="absolute bottom-8 left-8 h-[68%] w-[48%] rotate-[-8deg] rounded-[1.2rem] border border-white/35 bg-black/75 shadow-[0_22px_50px_rgba(0,0,0,0.28)]" />
                  <div className="absolute bottom-10 right-8 h-[72%] w-[52%] rotate-[7deg] rounded-[1.2rem] border border-black/10 bg-white/90 shadow-[0_22px_50px_rgba(0,0,0,0.2)]" />
                  <div className="absolute bottom-5 left-5 right-5 rounded-[1rem] bg-white/90 px-4 py-3 backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
                      {product.era}
                    </p>
                    <p className="mt-1 text-[19px] font-semibold tracking-[-0.05em]">
                      {product.member}
                    </p>
                  </div>
                </>
              )}
              <div className="absolute left-5 top-5 rounded-full bg-black px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-white">
                {product.badge}
              </div>
            </div>
          </section>

          <section className="px-5 pt-6">
            <div className="flex items-center gap-2 text-[13px] text-black/55">
              <span className="inline-flex items-center justify-center rounded-[0.35rem] bg-black p-1 text-white">
                <StarIcon />
              </span>
              <span>{product.rating}</span>
              <span>후기 {product.reviews}개</span>
            </div>

            <h1 className="mt-4 text-[27px] font-semibold leading-[1.18] tracking-[-0.06em]">
              {product.title}
            </h1>
            <p className="mt-3 text-[24px] font-semibold tracking-[-0.05em]">
              {product.price}
            </p>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="col-span-2 rounded-[0.9rem] border border-black/10 px-4 py-3">
                <p className="text-[12px] font-medium text-black/45">구매처</p>
                <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                  {product.purchaseSource ?? "공식 판매처"}
                </p>
              </div>
              <div className="rounded-[0.9rem] border border-black/10 px-4 py-3">
                <p className="text-[12px] font-medium text-black/45">입찰 기한</p>
                <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                  {product.deadline}
                </p>
              </div>
              <div className="rounded-[0.9rem] border border-black/10 px-4 py-3">
                <p className="text-[12px] font-medium text-black/45">발송 기한</p>
                <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                  {product.shippingDeadline ?? "마감 후 7일 이내"}
                </p>
              </div>
            </div>

            <div className="mt-7 border-t border-black/10 pt-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                배송 방법
              </h2>
              <div className="mt-3 space-y-2">
                {shippingMethods.map((method) => (
                  <div
                    key={method.name}
                    className="flex min-h-12 items-center justify-between rounded-[0.8rem] bg-[#f7f7f7] px-4"
                  >
                    <span className="text-[14px] font-semibold tracking-[-0.04em]">
                      {method.name}
                    </span>
                    <span className="text-[14px] font-semibold tracking-[-0.04em] text-black/55">
                      {method.price}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 border-t border-black/10 pt-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                상품 설명
              </h2>
              <p className="mt-3 text-[15px] leading-7 tracking-[-0.04em] text-black/65">
                {product.description}
              </p>
            </div>

            <div className="mt-8 border-t border-black/10 pt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                  내 입찰 현황
                </h2>
                <span className="text-[13px] font-medium text-black/45">
                  {myBidItems.length}개 참여
                </span>
              </div>

              {myBidItems.length > 0 ? (
                <div className="mt-4 grid gap-3">
                  {myBidItems.map(({ amount, option, rank }) => (
                    <div
                      key={option.id}
                      className="rounded-[0.9rem] border border-black/10 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${
                              option.avatarTone ??
                              "from-zinc-100 via-white to-zinc-400"
                            } text-[12px] font-semibold tracking-[-0.04em] text-black ring-1 ring-black/10`}
                          >
                            {option.avatarInitials ?? option.label.slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                              {option.label}
                            </p>
                            <p className="mt-1 text-[13px] font-medium text-black/45">
                              현재 {rank}등
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[15px] font-semibold tracking-[-0.04em]">
                            {formatPrice(amount)}
                          </p>
                          <button
                            type="button"
                            className="mt-2 text-[13px] font-semibold text-black/45"
                            onClick={() => withdrawBid(option.id)}
                          >
                            철회
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-5">
                  <p className="text-[14px] font-medium tracking-[-0.04em] text-black/45">
                    아직 등록한 입찰이 없습니다.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 border-t border-black/10 pt-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                옵션별 가격 TOP 3
              </h2>
              <div className="mt-4 grid gap-3">
                {auctionOptions.map((option) => (
                  <div
                    key={option.id}
                    className="rounded-[0.9rem] border border-black/10 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${
                            option.avatarTone ??
                            "from-zinc-100 via-white to-zinc-400"
                          } text-[12px] font-semibold tracking-[-0.04em] text-black ring-1 ring-black/10`}
                        >
                          {option.avatarInitials ?? option.label.slice(0, 2)}
                        </div>
                        <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                          {option.label}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12px] font-medium text-black/45">
                        참여 {option.participantCount}명
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {getTopBids(option).map((bid, index) => (
                        <div
                          key={`${option.id}-${index}`}
                          className="rounded-[0.7rem] bg-[#f7f7f7] px-3 py-2"
                        >
                          <p className="text-[11px] font-semibold text-black/35">
                            TOP {index + 1}
                          </p>
                          <p className="mt-1 text-[13px] font-semibold tracking-[-0.04em]">
                            {bid}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-white px-5 pb-5 pt-3 shadow-[0_-12px_34px_rgba(0,0,0,0.08)]">
          <button
            type="button"
            className="h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-white"
            onClick={openSheet}
          >
            입찰하기
          </button>
        </div>

        {isSheetOpen ? (
          <div
            className={`bid-sheet-backdrop absolute inset-0 z-10 flex items-end ${
              isSheetEntered && !isSheetClosing ? "bid-sheet-backdrop-active" : ""
            }`}
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              onClick={closeSheet}
              aria-label="구매 옵션 닫기"
            />
            <section
              className={`bid-sheet-panel relative w-full rounded-t-[1.4rem] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
                isSheetEntered && !isSheetClosing ? "bid-sheet-panel-active" : ""
              }`}
              onTransitionEnd={(event) => {
                if (
                  isSheetClosing &&
                  event.currentTarget === event.target &&
                  event.propertyName === "transform"
                ) {
                  finishCloseSheet();
                }
              }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[21px] font-semibold tracking-[-0.06em]">
                    입찰 옵션
                  </h2>
                  <p className="mt-1 text-[13px] font-medium text-black/45">
                    옵션별 현재 최고가를 확인하고 입찰가를 등록해 주세요.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
                  onClick={closeSheet}
                  aria-label="닫기"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="mt-5 max-h-[34dvh] space-y-3 overflow-y-auto pr-1 [touch-action:pan-y]">
                {sortedAuctionOptions.map((option) => {
                  const myBid = myBids[option.id];

                  return (
                    <div
                      key={option.id}
                      className={`rounded-[0.9rem] border px-4 py-3 ${
                        myBid
                          ? "border-black bg-[#f2f2f0]"
                          : "border-black/10 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${
                              option.avatarTone ??
                              "from-zinc-100 via-white to-zinc-400"
                            } text-[13px] font-semibold tracking-[-0.04em] text-black ring-1 ring-black/10`}
                          >
                            {option.avatarInitials ?? option.label.slice(0, 2)}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                                {option.label}
                              </p>
                              {myBid ? (
                                <span className="shrink-0 rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold text-white">
                                  입찰중
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[13px] font-medium tracking-[-0.04em] text-black/45">
                              {myBid
                                ? `내 입찰가 ${formatPrice(myBid)}`
                                : `참여 ${option.participantCount}명`}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[12px] font-medium text-black/45">
                            현재 최고가
                          </p>
                          <p className="mt-1 text-[15px] font-semibold tracking-[-0.04em]">
                            {option.currentBid}
                          </p>
                        </div>
                      </div>

                      <label
                        className={`mt-3 flex h-12 items-center rounded-[0.8rem] border px-3 focus-within:border-black ${
                          myBid
                            ? "border-black/15 bg-white"
                            : "border-black/10 bg-[#f7f7f7]"
                        }`}
                      >
                        <input
                          className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-black/30"
                          inputMode="numeric"
                          min={priceToNumber(option.currentBid) + 100}
                          onChange={(event) =>
                            updateBidAmount(option.id, event.currentTarget.value)
                          }
                          placeholder={`${formatPrice(
                            priceToNumber(option.currentBid) + 100,
                          )} 이상`}
                          type="number"
                          value={bidAmounts[option.id] ?? ""}
                        />
                        <span className="text-[14px] font-semibold text-black/45">
                          원
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-black/10 pt-4">
                <span className="text-[14px] font-medium text-black/45">
                  입찰 옵션 {activeBidCount}개
                </span>
                <span className="text-[22px] font-semibold tracking-[-0.05em]">
                  {formatPrice(totalBidAmount)}
                </span>
              </div>

              <button
                type="button"
                className="mt-4 h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-white disabled:bg-black/20"
                disabled={activeBidCount === 0}
                onClick={handleSubmitBids}
              >
                입찰가 등록하기
              </button>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
