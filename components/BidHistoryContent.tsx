"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { CloseIcon } from "@/components/icons";
import { productDetails } from "@/lib/mock-products";

function priceToNumber(price: string) {
  return Number(price.replace(/[^0-9]/g, ""));
}

function formatPrice(price: number) {
  return `${price.toLocaleString("ko-KR")}원`;
}

const kstOffsetHours = 9;
const paymentDeadlineDays = 3;
const PRODUCT_BID_HISTORY_ENTRY_INDEX_KEY = "product-bid-history-entry-index";

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

function parseDeadline(deadline: string) {
  const match = deadline
    .trim()
    .match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})\s+(\d{1,2})(?::00)?$/);

  if (!match) {
    return new Date(Number.NaN);
  }

  const [, year, month, day, hour] = match;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - kstOffsetHours,
    ),
  );
}

function formatRemainingTimeFromDate(deadlineDate: Date, now: Date) {
  const difference = deadlineDate.getTime() - now.getTime();

  if (Number.isNaN(deadlineDate.getTime()) || difference <= 0) {
    return "마감됨";
  }

  const totalMinutes = Math.ceil(difference / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}일 ${hours}시간 남았어요`;
  }

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 남았어요`;
  }

  return `${minutes}분 남았어요`;
}

function formatPaymentRemainingTime(deadline: string, now: Date) {
  const paymentDeadline = parseDeadline(deadline);

  if (Number.isNaN(paymentDeadline.getTime())) {
    return "결제 기한 확인 필요";
  }

  paymentDeadline.setUTCDate(
    paymentDeadline.getUTCDate() + paymentDeadlineDays,
  );

  return formatRemainingTimeFromDate(paymentDeadline, now);
}

type DeliveryAddress = {
  id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
};

type BidHistoryFilter = "all" | "payment" | "active";

const shippingFee = 3200;
const mockBidAmounts = [3200, 5600, 4700, 5800];
const mockClosedDeadlines = [
  "2026.04.26 23",
  null,
  "2026.04.25 21",
  "2026.04.26 20",
];
const initialDeliveryAddresses: DeliveryAddress[] = [
  {
    id: "home",
    label: "집",
    name: "김번철",
    phone: "010-1234-5678",
    address: "서울특별시 마포구 월드컵북로 00, 101동 1203호",
  },
  {
    id: "office",
    label: "회사",
    name: "김번철",
    phone: "010-9876-5432",
    address: "서울특별시 성동구 왕십리로 00, 8층",
  },
];

const bidRecords = productDetails.slice(0, 4).map((product, index) => {
  const option = product.options[0];
  const amount = mockBidAmounts[index] ?? priceToNumber(option.currentBid) + 200;
  const topBids = option.topBids ?? [option.currentBid];
  const rank =
    topBids
      .map((bid) => priceToNumber(bid))
      .filter((bid) => bid > amount).length + 1;

  return {
    id: `${product.id}-${option.id}`,
    amount,
    deadline: mockClosedDeadlines[index] ?? product.deadline,
    member: product.member,
    optionLabel: option.label,
    participantCount: option.participantCount,
    paidAt: rank === 1 && index === 0 ? "2026.04.27 09:20" : null,
    productId: product.id,
    rank,
    submittedAt: ["오늘 20:12", "오늘 18:40", "어제 23:08", "어제 19:22"][
      index
    ],
    title: product.title,
    tone: product.tone,
  };
});

type BidHistoryContentProps = {
  skipEnterAnimation?: boolean;
};

export function BidHistoryContent({
  skipEnterAnimation = false,
}: BidHistoryContentProps) {
  const addressListRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [selectedPaymentBidId, setSelectedPaymentBidId] = useState<
    string | null
  >(null);
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);
  const [isPaymentSheetEntered, setIsPaymentSheetEntered] = useState(false);
  const [isPaymentSheetClosing, setIsPaymentSheetClosing] = useState(false);
  const paymentSheetCloseTimerRef = useRef<number | null>(null);
  const [selectedPaymentAddressId, setSelectedPaymentAddressId] = useState<
    string | null
  >(null);
  const [isAddressSheetOpen, setIsAddressSheetOpen] = useState(false);
  const [isAddressSheetEntered, setIsAddressSheetEntered] = useState(false);
  const [isAddressSheetClosing, setIsAddressSheetClosing] = useState(false);
  const addressSheetCloseTimerRef = useRef<number | null>(null);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [deliveryAddresses, setDeliveryAddresses] = useState(
    initialDeliveryAddresses,
  );
  const [defaultAddressId] = useState("home");
  const [newAddressLabel, setNewAddressLabel] = useState("");
  const [newAddressName, setNewAddressName] = useState("");
  const [newAddressValue, setNewAddressValue] = useState("");
  const [newAddressPhone, setNewAddressPhone] = useState("");
  const [filter, setFilter] = useState<BidHistoryFilter>("all");

  const selectedPaymentBid =
    bidRecords.find((bid) => bid.id === selectedPaymentBidId) ?? null;
  const defaultDeliveryAddress =
    deliveryAddresses.find((address) => address.id === defaultAddressId) ??
    deliveryAddresses[0];
  const paymentDeliveryAddress =
    deliveryAddresses.find(
      (address) => address.id === selectedPaymentAddressId,
    ) ?? defaultDeliveryAddress;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(timer);

      if (paymentSheetCloseTimerRef.current !== null) {
        window.clearTimeout(paymentSheetCloseTimerRef.current);
      }

      if (addressSheetCloseTimerRef.current !== null) {
        window.clearTimeout(addressSheetCloseTimerRef.current);
      }
    };
  }, []);

  function finishPaymentSheetClose() {
    if (paymentSheetCloseTimerRef.current !== null) {
      window.clearTimeout(paymentSheetCloseTimerRef.current);
      paymentSheetCloseTimerRef.current = null;
    }

    setIsPaymentSheetOpen(false);
    setIsPaymentSheetClosing(false);
    setSelectedPaymentBidId(null);
  }

  function finishAddressSheetClose() {
    if (addressSheetCloseTimerRef.current !== null) {
      window.clearTimeout(addressSheetCloseTimerRef.current);
      addressSheetCloseTimerRef.current = null;
    }

    setIsAddressSheetOpen(false);
    setIsAddressSheetClosing(false);
  }

  const records = useMemo(() => {
    return [...bidRecords]
      .filter((bid) => {
        const isClosed = parseDeadline(bid.deadline).getTime() <= now.getTime();

        if (filter === "payment") {
          return isClosed && bid.rank === 1 && !bid.paidAt;
        }

        if (filter === "active") {
          return !isClosed;
        }

        return true;
      })
      .sort(
        (left, right) =>
          parseDeadline(right.deadline).getTime() -
          parseDeadline(left.deadline).getTime(),
      );
  }, [filter, now]);

  function resetNewAddressDraft() {
    setNewAddressLabel("");
    setNewAddressName("");
    setNewAddressValue("");
    setNewAddressPhone("");
  }

  function openPaymentSheet(bidId: string) {
    if (paymentSheetCloseTimerRef.current !== null) {
      window.clearTimeout(paymentSheetCloseTimerRef.current);
      paymentSheetCloseTimerRef.current = null;
    }

    setSelectedPaymentBidId(bidId);
    setSelectedPaymentAddressId((current) => current ?? defaultAddressId);
    setIsPaymentSheetOpen(true);
    setIsPaymentSheetClosing(false);

    window.requestAnimationFrame(() => {
      setIsPaymentSheetEntered(true);
    });
  }

  function closePaymentSheet() {
    if (paymentSheetCloseTimerRef.current !== null) {
      return;
    }

    setIsPaymentSheetClosing(true);
    setIsPaymentSheetEntered(false);
    paymentSheetCloseTimerRef.current = window.setTimeout(
      finishPaymentSheetClose,
      280,
    );
  }

  function openAddressSheet() {
    if (addressSheetCloseTimerRef.current !== null) {
      window.clearTimeout(addressSheetCloseTimerRef.current);
      addressSheetCloseTimerRef.current = null;
    }

    setIsAddressFormOpen(false);
    setIsAddressSheetOpen(true);
    setIsAddressSheetClosing(false);

    window.requestAnimationFrame(() => {
      setIsAddressSheetEntered(true);
    });
  }

  function closeAddressSheet() {
    if (addressSheetCloseTimerRef.current !== null) {
      return;
    }

    setIsAddressSheetClosing(true);
    setIsAddressSheetEntered(false);
    setIsAddressFormOpen(false);
    resetNewAddressDraft();
    addressSheetCloseTimerRef.current = window.setTimeout(
      finishAddressSheetClose,
      280,
    );
  }

  function addDeliveryAddress() {
    const trimmedLabel = newAddressLabel.trim();
    const trimmedName = newAddressName.trim();
    const trimmedAddress = newAddressValue.trim();
    const trimmedPhone = newAddressPhone.trim();

    if (!trimmedLabel || !trimmedName || !trimmedAddress || !trimmedPhone) {
      return;
    }

    const nextAddress = {
      id: `address-${Date.now()}`,
      label: trimmedLabel,
      name: trimmedName,
      phone: trimmedPhone,
      address: trimmedAddress,
    };

    setDeliveryAddresses((current) => [...current, nextAddress]);
    setSelectedPaymentAddressId(nextAddress.id);
    resetNewAddressDraft();
    setIsAddressFormOpen(false);
  }

  function rememberBidHistoryProductEntry(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const historyIndex = getHistoryIndex();

    if (historyIndex === null) {
      window.sessionStorage.removeItem(PRODUCT_BID_HISTORY_ENTRY_INDEX_KEY);
      return;
    }

    window.sessionStorage.setItem(
      PRODUCT_BID_HISTORY_ENTRY_INDEX_KEY,
      String(historyIndex + 1),
    );
  }

  return (
    <div
      className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${
        skipEnterAnimation ? "" : "tab-content-enter"
      }`}
    >
      <header className="bid-history-header shrink-0 px-4 py-3">
        <div className="bid-history-header__copy flex h-10 flex-col justify-center">
          <p className="bid-history-header__eyebrow text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-black/35">
            History
          </p>
          <h1 className="bid-history-header__title mt-1 text-[22px] font-semibold leading-none tracking-[-0.06em]">
            입찰 기록
          </h1>
        </div>
      </header>

      <div className="shrink-0 px-4 pb-4">
        <div className="grid grid-cols-3 gap-1.5 rounded-[0.95rem] bg-[#f7f7f7] p-1.5">
          {(
            [
              ["all", "전체"],
              ["active", "입찰 중"],
              ["payment", "결제 필요"],
            ] as const
          ).map(([value, label]) => {
            const isActive = filter === value;

            return (
              <button
                className={`h-10 rounded-[0.8rem] text-[13px] font-semibold tracking-[-0.04em] ${
                  isActive ? "bg-black text-white" : "text-black/45"
                }`}
                key={value}
                onClick={() => setFilter(value)}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <div className="tab-content-enter" key={filter}>
          <div className="space-y-3">
            {records.map((bid) => {
              const isClosed =
                parseDeadline(bid.deadline).getTime() <= now.getTime();
              const paymentRemainingTime = formatPaymentRemainingTime(
                bid.deadline,
                now,
              );

              return (
                <article
                  className="rounded-[1rem] border border-black/10 px-4 py-4"
                  key={bid.id}
                >
                  <div className="flex items-start gap-3">
                    <Link
                      aria-label={`${bid.title} 상세 보기`}
                      className={`h-14 w-14 shrink-0 rounded-[0.85rem] bg-gradient-to-br ${bid.tone}`}
                      href={`/products/${bid.productId}?from=bids`}
                      onClick={rememberBidHistoryProductEntry}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          className="min-w-0"
                          href={`/products/${bid.productId}?from=bids`}
                          onClick={rememberBidHistoryProductEntry}
                        >
                          <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                            {bid.title}
                          </p>
                          <p className="mt-1 text-[13px] font-medium text-black/45">
                            {bid.member} · {bid.optionLabel}
                          </p>
                        </Link>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                            bid.rank === 1
                              ? "bg-black text-white"
                              : "bg-[#f1f1f1] text-black/55"
                          }`}
                        >
                          {bid.rank}등
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-[0.75rem] bg-[#f7f7f7] px-3 py-2">
                            <p className="text-[11px] font-medium text-black/35">
                              내 입찰가
                            </p>
                            <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em]">
                              {formatPrice(bid.amount)}
                            </p>
                          </div>
                          <div className="rounded-[0.75rem] bg-[#f7f7f7] px-3 py-2">
                            <p className="text-[11px] font-medium text-black/35">
                              상태
                            </p>
                            <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em]">
                              {bid.paidAt
                                ? "결제 완료"
                                : isClosed
                                ? bid.rank === 1
                                  ? "낙찰"
                                  : "미낙찰"
                                : "입찰중"}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-[0.75rem] bg-[#f7f7f7] px-3 py-2">
                          <p className="text-[11px] font-medium text-black/35">
                            마감
                          </p>
                          <p className="mt-1 break-keep text-[14px] font-semibold leading-5 tracking-[-0.04em]">
                            {bid.deadline}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div
                          className={`min-w-0 text-[12px] font-medium ${
                            isClosed && bid.rank === 1
                              ? "text-black"
                              : "text-black/35"
                          }`}
                        >
                          {isClosed ? (
                            bid.paidAt ? (
                              <>
                                <p>결제가 완료됐어요</p>
                                <p className="mt-0.5 text-black/45">
                                  결제일 {bid.paidAt}
                                </p>
                              </>
                            ) : bid.rank === 1 ? (
                              <>
                                <p>결제가 필요해요</p>
                                <p className="mt-0.5 text-black/45">
                                  결제까지 {paymentRemainingTime}
                                </p>
                              </>
                            ) : (
                              <p>마감된 입찰이에요</p>
                            )
                          ) : (
                            <p>진행 중인 입찰이에요</p>
                          )}
                        </div>
                        {isClosed && bid.rank === 1 && !bid.paidAt ? (
                          <button
                            className="shrink-0 rounded-full bg-black px-3 py-2 text-[13px] font-semibold text-white"
                            onClick={() => openPaymentSheet(bid.id)}
                            type="button"
                          >
                            결제
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </main>

      {isPaymentSheetOpen && selectedPaymentBid ? (
        <div
          className={`bid-sheet-backdrop absolute inset-0 z-20 flex items-end ${
            isPaymentSheetEntered && !isPaymentSheetClosing
              ? "bid-sheet-backdrop-active"
              : ""
          }`}
        >
          <button
            aria-label="결제 배송지 선택 닫기"
            className="absolute inset-0 cursor-default"
            onClick={closePaymentSheet}
            type="button"
          />
          <section
            className={`bid-sheet-panel relative w-full rounded-t-[1.4rem] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
              isPaymentSheetEntered && !isPaymentSheetClosing
                ? "bid-sheet-panel-active"
                : ""
            }`}
            onTransitionEnd={(event) => {
              if (
                isPaymentSheetClosing &&
                event.currentTarget === event.target &&
                event.propertyName === "transform"
              ) {
                finishPaymentSheetClose();
              }
            }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[21px] font-semibold tracking-[-0.06em]">
                  배송지 선택
                </h2>
                <p className="mt-1 text-[13px] font-medium text-black/45">
                  낙찰 상품을 받을 주소를 확인해 주세요.
                </p>
              </div>
              <button
                aria-label="닫기"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
                onClick={closePaymentSheet}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="mt-5 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3">
              <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                {selectedPaymentBid.title}
              </p>
              <p className="mt-1 text-[13px] font-medium text-black/45">
                {selectedPaymentBid.member} · {selectedPaymentBid.optionLabel}
              </p>
            </div>

            <div className="mt-4 rounded-[0.95rem] border border-black bg-white px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="rounded-full bg-[#f7f7f7] px-2.5 py-1 text-[11px] font-semibold text-black/45">
                  {paymentDeliveryAddress.label}
                </span>
                <p className="truncate text-[14px] font-semibold tracking-[-0.04em]">
                  {paymentDeliveryAddress.name}
                </p>
              </div>
              <p className="mt-3 text-[13px] leading-5 tracking-[-0.04em] text-black/65">
                {paymentDeliveryAddress.address}
              </p>
              <p className="mt-1 text-[13px] font-medium text-black/45">
                {paymentDeliveryAddress.phone}
              </p>
            </div>
            <button
              className="mt-2 h-11 w-full rounded-full bg-[#f7f7f7] text-[14px] font-semibold text-black/55"
              onClick={openAddressSheet}
              type="button"
            >
              다른 배송지 선택
            </button>

            <div className="mt-5 border-t border-black/10 pt-4">
              <div className="flex items-center justify-between text-[14px] font-medium text-black/45">
                <span>낙찰가</span>
                <span>{formatPrice(selectedPaymentBid.amount)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[14px] font-medium text-black/45">
                <span>배송비</span>
                <span>{formatPrice(shippingFee)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[15px] font-semibold tracking-[-0.04em]">
                  결제 예정 금액
                </span>
                <span className="text-[22px] font-semibold tracking-[-0.05em]">
                  {formatPrice(selectedPaymentBid.amount + shippingFee)}
                </span>
              </div>
            </div>

            <button
              className="mt-4 h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-white"
              onClick={closePaymentSheet}
              type="button"
            >
              결제하기
            </button>
          </section>
        </div>
      ) : null}

      {isAddressSheetOpen ? (
        <div
          className={`bid-sheet-backdrop absolute inset-0 z-30 flex items-end ${
            isAddressSheetEntered && !isAddressSheetClosing
              ? "bid-sheet-backdrop-active"
              : ""
          }`}
        >
          <button
            aria-label="다른 배송지 선택 닫기"
            className="absolute inset-0 cursor-default"
            onClick={closeAddressSheet}
            type="button"
          />
          <section
            className={`bid-sheet-panel relative flex h-[76dvh] w-full flex-col rounded-t-[1.4rem] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
              isAddressSheetEntered && !isAddressSheetClosing
                ? "bid-sheet-panel-active"
                : ""
            }`}
            onTransitionEnd={(event) => {
              if (
                isAddressSheetClosing &&
                event.currentTarget === event.target &&
                event.propertyName === "transform"
              ) {
                finishAddressSheetClose();
              }
            }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[21px] font-semibold tracking-[-0.06em]">
                  다른 배송지 선택
                </h2>
                <p className="mt-1 text-[13px] font-medium text-black/45">
                  이번 결제에 사용할 배송지를 골라 주세요.
                </p>
              </div>
              <button
                aria-label="닫기"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
                onClick={closeAddressSheet}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>

            <div
              className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
              ref={addressListRef}
            >
              {deliveryAddresses.map((address) => {
                const isSelected =
                  address.id ===
                  (selectedPaymentAddressId ?? defaultAddressId);

                return (
                  <div
                    className={`w-full rounded-[0.95rem] border px-4 py-3 text-left ${
                      isSelected
                        ? "border-black bg-white"
                        : "border-black/10 bg-[#f7f7f7]"
                    }`}
                    key={address.id}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedPaymentAddressId(address.id);
                      }
                    }}
                    onClick={() => setSelectedPaymentAddressId(address.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1 pr-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black/45">
                            {address.label}
                          </span>
                          <p className="truncate text-[14px] font-semibold tracking-[-0.04em]">
                            {address.name}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex h-8 w-[4.25rem] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                          isSelected
                            ? "bg-black text-white"
                            : "bg-white text-black/45 ring-1 ring-black/10"
                        }`}
                      >
                        {isSelected ? "선택됨" : "선택"}
                      </span>
                    </div>
                    <p className="mt-3 text-[13px] leading-5 tracking-[-0.04em] text-black/65">
                      {address.address}
                    </p>
                    <p className="mt-1 text-[13px] font-medium text-black/45">
                      {address.phone}
                    </p>
                  </div>
                );
              })}

              <div className="rounded-[0.95rem] border border-dashed border-black/15 bg-[#f7f7f7] px-4 py-3">
                {isAddressFormOpen ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold tracking-[-0.04em]">
                        새 배송지 추가
                      </p>
                      <button
                        className="text-[12px] font-semibold text-black/35"
                        onClick={() => {
                          setIsAddressFormOpen(false);
                          resetNewAddressDraft();
                        }}
                        type="button"
                      >
                        닫기
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <input
                        className="h-9 rounded-[0.65rem] bg-white px-3 text-[13px] font-medium outline-none placeholder:text-black/30"
                        onChange={(event) =>
                          setNewAddressLabel(event.target.value)
                        }
                        placeholder="별칭"
                        value={newAddressLabel}
                      />
                      <input
                        className="h-9 rounded-[0.65rem] bg-white px-3 text-[13px] font-medium outline-none placeholder:text-black/30"
                        onChange={(event) =>
                          setNewAddressName(event.target.value)
                        }
                        placeholder="받는 분"
                        value={newAddressName}
                      />
                    </div>
                    <input
                      className="mt-2 h-9 w-full rounded-[0.65rem] bg-white px-3 text-[13px] font-medium outline-none placeholder:text-black/30"
                      inputMode="tel"
                      onChange={(event) =>
                        setNewAddressPhone(event.target.value)
                      }
                      placeholder="연락처"
                      value={newAddressPhone}
                    />
                    <input
                      className="mt-2 h-9 w-full rounded-[0.65rem] bg-white px-3 text-[13px] font-medium outline-none placeholder:text-black/30"
                      onChange={(event) =>
                        setNewAddressValue(event.target.value)
                      }
                      placeholder="주소"
                      value={newAddressValue}
                    />
                    <button
                      className="mt-3 h-9 w-full rounded-full bg-black text-[13px] font-semibold text-white disabled:bg-black/20"
                      disabled={
                        !newAddressLabel.trim() ||
                        !newAddressName.trim() ||
                        !newAddressValue.trim() ||
                        !newAddressPhone.trim()
                      }
                      onClick={addDeliveryAddress}
                      type="button"
                    >
                      배송지 추가
                    </button>
                  </>
                ) : (
                  <button
                    className="flex min-h-[4.9rem] w-full items-center justify-center text-[14px] font-semibold text-black/45"
                    onClick={() => setIsAddressFormOpen(true)}
                    type="button"
                  >
                    + 새 배송지 추가
                  </button>
                )}
              </div>
            </div>

            <button
              className="mt-3 h-12 w-full rounded-full bg-black text-[15px] font-semibold text-white"
              onClick={closeAddressSheet}
              type="button"
            >
              이 배송지로 받기
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
