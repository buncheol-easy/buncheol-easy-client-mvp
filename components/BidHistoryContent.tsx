"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { MouseEvent } from "react";
import { CheckIcon, CloseIcon } from "@/components/icons";
import {
  addressReturnStateKey,
  lastAddedDeliveryAddressIdKey,
  type AddressReturnState,
} from "@/lib/address-return-state";
import {
  getInitialDeliveryAddressState,
  readDeliveryAddressState,
  subscribeDeliveryAddressState,
} from "@/lib/delivery-address-store";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import {
  cancelBuncheolParticipation,
  deleteBuncheol,
  requestMyHostedBuncheols,
  requestMyParticipations,
  type MyHostedBuncheol,
  type MyParticipation,
} from "@/lib/auth-api";
import {
  getInitialHostedProducts,
  readHostedProducts,
  subscribeHostedProducts,
} from "@/lib/hosted-products-store";
import {
  getAvailableConvenienceStoreTypes,
  getConvenienceStoreLabel,
  getDefaultDeliveryAddressesByType,
  getPrioritizedDeliveryAddresses,
} from "@/lib/mock-delivery-addresses";
import { productDetails, type ProductDetailItem } from "@/lib/mock-products";

function priceToNumber(price: string) {
  return Number(price.replace(/[^0-9]/g, ""));
}

function formatPrice(price: number) {
  return `${price.toLocaleString("ko-KR")}원`;
}

const kstOffsetHours = 9;
const paymentDeadlineDays = 3;
const PRODUCT_BID_HISTORY_ENTRY_INDEX_KEY = "product-bid-history-entry-index";
const BID_HISTORY_SCROLL_TOP_KEY = "bid-history-scroll-top";

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

function parseDeadline(deadline: string) {
  const match = deadline
    .trim()
    .match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})(?:\D+(\d{1,2}))?/);

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

function parseHistoryDeadline(deadline: string) {
  const match = deadline
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

type BidHistoryMode = "joined" | "hosted";
type BidHistoryFilter = "all" | "payment" | "active";
type HostedHistoryFilter = "all" | "active" | "closed";

const shippingFee = 3200;
const mockBidAmounts = [5400, 6000, 4800, 5800];
const mockClosedDeadlines = [
  "2026.04.26 23",
  "2026.05.05 21",
  "2026.04.25 21",
  "2026.04.26 20",
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
    paidAt: rank === 1 && index === 3 ? "2026.04.27 09:20" : null,
    productId: product.id,
    rank,
    submittedAt: ["오늘 20:12", "오늘 18:40", "어제 23:08", "어제 19:22"][
      index
    ],
    title: product.title,
    tone: product.tone,
  };
});

type BidRecord = (typeof bidRecords)[number] & {
  buncheolStatus?: string;
  participationStatus?: string;
};

function isRecruitingStatus(status: string | undefined) {
  return !status || status === "RECRUITING";
}

function isBidRecordClosed(bid: BidRecord, now: Date) {
  if (bid.buncheolStatus && !isRecruitingStatus(bid.buncheolStatus)) {
    return !isRecruitingStatus(bid.buncheolStatus);
  }

  const deadlineDate = parseDeadline(bid.deadline);

  return (
    !Number.isNaN(deadlineDate.getTime()) &&
    deadlineDate.getTime() <= now.getTime()
  );
}

function isHostedProductClosed(product: ProductDetailItem, now: Date) {
  if (product.status && !isRecruitingStatus(product.status)) {
    return !isRecruitingStatus(product.status);
  }

  const deadlineDate = parseHistoryDeadline(product.deadline);

  return (
    !Number.isNaN(deadlineDate.getTime()) &&
    deadlineDate.getTime() <= now.getTime()
  );
}

function formatApiDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(date);
  const partMap = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${partMap.year}년 ${partMap.month}월 ${partMap.day}일 ${partMap.hour}시`;
}

function getToneFromId(id: string) {
  const tones = [
    "from-black via-zinc-800 to-zinc-500",
    "from-zinc-700 via-zinc-500 to-zinc-100",
    "from-zinc-900 via-zinc-700 to-zinc-300",
    "from-zinc-300 via-zinc-100 to-neutral-400",
  ];
  const hash = [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0);

  return tones[hash % tones.length];
}

function getBidRecordFromParticipation(
  participation: MyParticipation,
): BidRecord {
  const rank =
    participation.closedRank ??
    (participation.participationStatus === "AWAITING_PAYMENT" ? 1 : 0);

  return {
    id: participation.participationId,
    amount: participation.bidAmount,
    deadline: formatApiDateTime(participation.buncheolDeadline),
    member: `${participation.buncheolMemberCount}개 옵션`,
    optionLabel: participation.memberName,
    participantCount: 0,
    paidAt:
      participation.participationStatus === "CONFIRMED" ? "결제 완료" : null,
    buncheolStatus: participation.buncheolStatus,
    productId: participation.buncheolId,
    participationStatus: participation.participationStatus,
    rank: rank > 0 ? rank : 0,
    submittedAt: "",
    title: participation.buncheolTitle,
    tone: getToneFromId(participation.buncheolId),
  };
}

function getHostedProductFromBuncheol(
  buncheol: MyHostedBuncheol,
): ProductDetailItem {
  return {
    id: buncheol.id,
    buncheolId: buncheol.id,
    title: buncheol.title,
    member: `${buncheol.memberSlotCount}개 옵션`,
    optionCount: buncheol.memberSlotCount,
    targetMembers: buncheol.memberNames,
    uploadedAt: formatApiDateTime(buncheol.createdAt),
    era: buncheol.groupName,
    rating: "0.0",
    reviews: String(buncheol.activeParticipationCount),
    badge: buncheol.status === "RECRUITING" ? "모집중" : "마감",
    liked: buncheol.bookmarked,
    tone: getToneFromId(buncheol.id),
    courier: "배송 방법 확인 필요",
    deadline: formatApiDateTime(buncheol.deadline),
    description: "",
    imageUrl: buncheol.thumbnailUrl,
    imageUrls: buncheol.thumbnailUrl ? [buncheol.thumbnailUrl] : [],
    isApiProduct: true,
    options: [
      {
        id: `${buncheol.id}-participants`,
        label: "참여",
        price: "-",
        currentBid: "-",
        participantCount: buncheol.activeParticipationCount,
      },
    ],
    purchaseSource: "",
    status: buncheol.status,
  };
}

type BidHistoryContentProps = {
  skipEnterAnimation?: boolean;
};

export const BID_HISTORY_SKIP_ENTER_KEY = "skip-bid-history-enter-animation";

function takeShouldSkipBidHistoryEnter() {
  if (typeof window === "undefined") {
    return false;
  }

  const shouldSkip =
    window.sessionStorage.getItem(BID_HISTORY_SKIP_ENTER_KEY) === "true";
  window.sessionStorage.removeItem(BID_HISTORY_SKIP_ENTER_KEY);

  return shouldSkip;
}

export function BidHistoryContent({
  skipEnterAnimation = false,
}: BidHistoryContentProps) {
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const [shouldSkipEnterAnimation] = useState(
    () => skipEnterAnimation || takeShouldSkipBidHistoryEnter(),
  );
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
  const storedAddressState = useSyncExternalStore(
    subscribeDeliveryAddressState,
    readDeliveryAddressState,
    getInitialDeliveryAddressState,
  );
  const hostedProducts = useSyncExternalStore(
    subscribeHostedProducts,
    readHostedProducts,
    getInitialHostedProducts,
  );
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const { addresses: deliveryAddresses, defaultAddressIds } = storedAddressState;
  const [mode, setMode] = useState<BidHistoryMode>("joined");
  const [filter, setFilter] = useState<BidHistoryFilter>("all");
  const [hostedFilter, setHostedFilter] = useState<HostedHistoryFilter>("all");
  const [apiBidRecords, setApiBidRecords] = useState<BidRecord[] | null>(null);
  const [apiHostedProducts, setApiHostedProducts] = useState<
    ProductDetailItem[] | null
  >(null);
  const [deletingHostedProductId, setDeletingHostedProductId] = useState<
    string | null
  >(null);
  const [withdrawingBidId, setWithdrawingBidId] = useState<string | null>(null);
  const [historyMessage, setHistoryMessage] = useState("");
  const [hostedMessage, setHostedMessage] = useState("");

  const paymentBidRecords = apiBidRecords ?? bidRecords;
  const selectedPaymentBid =
    paymentBidRecords.find((bid) => bid.id === selectedPaymentBidId) ?? null;
  const selectedPaymentProduct = selectedPaymentBid
    ? productDetails.find((product) => product.id === selectedPaymentBid.productId) ??
      null
    : null;
  const defaultDeliveryAddresses = getDefaultDeliveryAddressesByType(
    deliveryAddresses,
    defaultAddressIds,
  );
  const prioritizedDeliveryAddresses = getPrioritizedDeliveryAddresses(
    deliveryAddresses,
    defaultAddressIds,
  );
  const availablePaymentStoreTypes = getAvailableConvenienceStoreTypes(
    selectedPaymentProduct?.shippingMethods,
    selectedPaymentProduct?.courier,
  );
  const eligiblePaymentAddresses =
    availablePaymentStoreTypes.length > 0
      ? prioritizedDeliveryAddresses.filter((address) =>
          availablePaymentStoreTypes.includes(address.storeType),
        )
      : prioritizedDeliveryAddresses;
  const selectedEligiblePaymentAddress =
    eligiblePaymentAddresses.find(
      (address) => address.id === selectedPaymentAddressId,
    ) ?? null;
  const paymentDeliveryAddress =
    selectedEligiblePaymentAddress ??
    eligiblePaymentAddresses[0] ??
    null;
  const paymentVisibleAddresses = availablePaymentStoreTypes.map((storeType) => ({
    storeType,
    address:
      paymentDeliveryAddress?.storeType === storeType
        ? paymentDeliveryAddress
        : defaultDeliveryAddresses[storeType],
  }));

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

  useEffect(() => {
    const accessToken = authState.accessToken;

    if (!authState.isLoggedIn || !accessToken) {
      const frame = window.requestAnimationFrame(() => {
        setApiBidRecords([]);
        setApiHostedProducts([]);
        setHistoryMessage("");
        setHostedMessage("");
      });

      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    let isActive = true;

    requestMyParticipations(accessToken)
      .then((participations) => {
        if (!isActive) {
          return;
        }

        setApiBidRecords(participations.map(getBidRecordFromParticipation));
        setHistoryMessage("");
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setApiBidRecords([]);
        setHistoryMessage(
          error instanceof Error
            ? error.message
            : "참여한 분철을 불러오지 못했어요.",
        );
      });

    requestMyHostedBuncheols(accessToken)
      .then((buncheols) => {
        if (!isActive) {
          return;
        }

        setApiHostedProducts(buncheols.map(getHostedProductFromBuncheol));
        setHostedMessage("");
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setApiHostedProducts([]);
        setHostedMessage(
          error instanceof Error
            ? error.message
            : "개최한 분철을 불러오지 못했어요.",
        );
      });

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, authState.isLoggedIn]);

  useEffect(() => {
    const rawReturnState = window.sessionStorage.getItem(addressReturnStateKey);

    if (!rawReturnState) {
      return;
    }

    let returnState: AddressReturnState;

    try {
      returnState = JSON.parse(rawReturnState) as AddressReturnState;
    } catch {
      window.sessionStorage.removeItem(addressReturnStateKey);
      return;
    }

    if (returnState.source !== "bids") {
      return;
    }

    window.sessionStorage.removeItem(addressReturnStateKey);
    const lastAddedAddressId = window.sessionStorage.getItem(
      lastAddedDeliveryAddressIdKey,
    );
    window.sessionStorage.removeItem(lastAddedDeliveryAddressIdKey);

    const returnBid = returnState.bidId
      ? paymentBidRecords.find((bid) => bid.id === returnState.bidId)
      : null;

    if (!returnBid) {
      return;
    }

    const returnProduct =
      productDetails.find((product) => product.id === returnBid.productId) ??
      null;
    const returnAvailableStoreTypes = getAvailableConvenienceStoreTypes(
      returnProduct?.shippingMethods,
      returnProduct?.courier,
    );
    const returnPrioritizedAddresses = getPrioritizedDeliveryAddresses(
      deliveryAddresses,
      defaultAddressIds,
    );
    const returnEligibleAddresses =
      returnAvailableStoreTypes.length > 0
        ? returnPrioritizedAddresses.filter((address) =>
            returnAvailableStoreTypes.includes(address.storeType),
          )
        : returnPrioritizedAddresses;
    const restoredAddressId = lastAddedAddressId ?? returnState.addressId;
    const restoredPaymentAddressId =
      restoredAddressId &&
      returnEligibleAddresses.some((address) => address.id === restoredAddressId)
        ? restoredAddressId
        : null;

    let isRestoreActive = true;
    const restoreTimer = window.setTimeout(() => {
      if (!isRestoreActive) {
        return;
      }

      setSelectedPaymentBidId(returnBid.id);
      setSelectedPaymentAddressId(restoredPaymentAddressId);
      setIsPaymentSheetOpen(true);
      setIsPaymentSheetClosing(false);
      setIsPaymentSheetEntered(true);
      setIsAddressSheetOpen(true);
      setIsAddressSheetClosing(false);

      window.requestAnimationFrame(() => {
        if (!isRestoreActive) {
          return;
        }

        setIsAddressSheetEntered(true);
      });
    }, 0);

    return () => {
      isRestoreActive = false;
      window.clearTimeout(restoreTimer);
    };
  }, [defaultAddressIds, deliveryAddresses, paymentBidRecords]);

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
    if (!authState.isLoggedIn) {
      return [];
    }

    const sourceRecords: BidRecord[] = apiBidRecords ?? bidRecords;

    return [...sourceRecords]
      .filter((bid) => {
        const isClosed = isBidRecordClosed(bid, now);

        if (filter === "payment") {
          return (
            bid.participationStatus === "AWAITING_PAYMENT" ||
            (isClosed && bid.rank === 1 && !bid.paidAt)
          );
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
  }, [apiBidRecords, authState.isLoggedIn, filter, now]);
  const hostedRecords = useMemo(() => {
    if (!authState.isLoggedIn) {
      return [];
    }

    const sourceProducts = apiHostedProducts ?? hostedProducts;

    return [...sourceProducts]
      .filter((product) => {
        const isClosed = isHostedProductClosed(product, now);

        if (hostedFilter === "active") {
          return !isClosed;
        }

        if (hostedFilter === "closed") {
          return isClosed;
        }

        return true;
      })
      .sort(
        (left, right) =>
          parseHistoryDeadline(right.deadline).getTime() -
          parseHistoryDeadline(left.deadline).getTime(),
      );
  }, [
    apiHostedProducts,
    authState.isLoggedIn,
    hostedFilter,
    hostedProducts,
    now,
  ]);

  function openPaymentSheet(bidId: string) {
    if (paymentSheetCloseTimerRef.current !== null) {
      window.clearTimeout(paymentSheetCloseTimerRef.current);
      paymentSheetCloseTimerRef.current = null;
    }

    const selectedBid = paymentBidRecords.find((bid) => bid.id === bidId) ?? null;
    const selectedProduct = selectedBid
      ? productDetails.find((product) => product.id === selectedBid.productId) ??
        null
      : null;
    const allowedStoreTypes = getAvailableConvenienceStoreTypes(
      selectedProduct?.shippingMethods,
      selectedProduct?.courier,
    );
    const nextDefaultAddresses = getDefaultDeliveryAddressesByType(
      deliveryAddresses,
      defaultAddressIds,
    );
    const fallbackAddress =
      allowedStoreTypes.length > 0
        ? allowedStoreTypes
            .map((storeType) => nextDefaultAddresses[storeType])
            .find((address) => address !== null) ??
          prioritizedDeliveryAddresses.find((address) =>
            allowedStoreTypes.includes(address.storeType),
          ) ??
          null
        : prioritizedDeliveryAddresses[0] ?? null;

    setSelectedPaymentBidId(bidId);
    setSelectedPaymentAddressId((current) =>
      current &&
      prioritizedDeliveryAddresses.some(
        (address) =>
          address.id === current && allowedStoreTypes.includes(address.storeType),
      )
        ? current
        : fallbackAddress?.id ?? null,
    );
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

  function rememberScrollPosition() {
    if (!scrollContainerRef.current) {
      return;
    }

    window.sessionStorage.setItem(
      BID_HISTORY_SCROLL_TOP_KEY,
      String(scrollContainerRef.current.scrollTop),
    );
  }

  function rememberAddressAddReturn() {
    const returnState: AddressReturnState = {
      source: "bids",
      bidId: selectedPaymentBidId,
      addressId: selectedPaymentAddressId,
    };

    window.sessionStorage.removeItem(lastAddedDeliveryAddressIdKey);
    window.sessionStorage.setItem(
      addressReturnStateKey,
      JSON.stringify(returnState),
    );
  }

  function openAddressSheet() {
    if (addressSheetCloseTimerRef.current !== null) {
      window.clearTimeout(addressSheetCloseTimerRef.current);
      addressSheetCloseTimerRef.current = null;
    }

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
    addressSheetCloseTimerRef.current = window.setTimeout(
      finishAddressSheetClose,
      280,
    );
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

    rememberScrollPosition();

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

  async function handleWithdrawBid(bidId: string) {
    const accessToken = authState.accessToken;

    if (!authState.isLoggedIn || !accessToken || withdrawingBidId) {
      return;
    }

    setWithdrawingBidId(bidId);

    try {
      await cancelBuncheolParticipation(accessToken, bidId);
      setApiBidRecords((current) =>
        current ? current.filter((bid) => bid.id !== bidId) : current,
      );
      setHistoryMessage("");
    } catch (error: unknown) {
      setHistoryMessage(
        error instanceof Error ? error.message : "입찰을 철회하지 못했어요.",
      );
    } finally {
      setWithdrawingBidId(null);
    }
  }

  async function handleDeleteHostedProduct(product: ProductDetailItem) {
    const accessToken = authState.accessToken;
    const buncheolId = product.buncheolId ?? product.id;

    if (!authState.isLoggedIn || !accessToken || deletingHostedProductId) {
      return;
    }

    if (!window.confirm("이 분철을 삭제할까요?")) {
      return;
    }

    setDeletingHostedProductId(buncheolId);

    try {
      await deleteBuncheol(accessToken, buncheolId);
      setApiHostedProducts((current) =>
        current
          ? current.filter(
              (item) => (item.buncheolId ?? item.id) !== buncheolId,
            )
          : current,
      );
      setHostedMessage("");
    } catch (error: unknown) {
      setHostedMessage(
        error instanceof Error
          ? error.message
          : "분철을 삭제하지 못했어요.",
      );
    } finally {
      setDeletingHostedProductId(null);
    }
  }

  useLayoutEffect(() => {
    const storedScrollTop = window.sessionStorage.getItem(
      BID_HISTORY_SCROLL_TOP_KEY,
    );

    if (!storedScrollTop || !scrollContainerRef.current) {
      return;
    }

    scrollContainerRef.current.scrollTop = Number(storedScrollTop);

    if (!skipEnterAnimation) {
      window.sessionStorage.removeItem(BID_HISTORY_SCROLL_TOP_KEY);
    }
  }, [skipEnterAnimation]);

  return (
    <div
      className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${
        shouldSkipEnterAnimation ? "" : "tab-content-enter"
      }`}
    >
      <header className="bid-history-header shrink-0 px-4 py-3">
        <div className="bid-history-header__copy flex h-10 flex-col justify-center">
          <p className="bid-history-header__eyebrow text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-black/35">
            History
          </p>
          <h1 className="bid-history-header__title mt-1 text-[22px] font-semibold leading-none tracking-[-0.06em]">
            {mode === "joined" ? "입찰 기록" : "개최 기록"}
          </h1>
        </div>
      </header>

      <div className="shrink-0 px-4 pb-4">
        <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-[0.95rem] bg-[#f7f7f7] p-1.5">
          {(
            [
              ["joined", "참여한 분철"],
              ["hosted", "개최한 분철"],
            ] as const
          ).map(([value, label]) => {
            const isActive = mode === value;

            return (
              <button
                className={`h-10 rounded-[0.8rem] text-[13px] font-semibold tracking-[-0.04em] ${
                  isActive ? "bg-black text-white" : "text-black/45"
                }`}
                key={value}
                onClick={() => setMode(value)}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>

        <div
          className={`${
            mode === "joined" ? "flex" : "hidden"
          } justify-end gap-2 overflow-x-auto pb-1`}
        >
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
                className={`h-8 w-[76px] shrink-0 rounded-full border text-[13px] font-semibold tracking-[-0.04em] ${
                  isActive
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-[#f7f7f7] text-black/45"
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
        <div
          className={`${
            mode === "hosted" ? "flex" : "hidden"
          } justify-end gap-2 overflow-x-auto pb-1`}
        >
          {(
            [
              ["all", "전체"],
              ["active", "진행 중"],
              ["closed", "마감"],
            ] as const
          ).map(([value, label]) => {
            const isActive = hostedFilter === value;

            return (
              <button
                className={`h-8 w-[76px] shrink-0 rounded-full border text-[13px] font-semibold tracking-[-0.04em] ${
                  isActive
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-[#f7f7f7] text-black/45"
                }`}
                key={value}
                onClick={() => setHostedFilter(value)}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <main
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-6"
        ref={scrollContainerRef}
      >
        <div
          className={shouldSkipEnterAnimation ? "" : "tab-content-enter"}
          key={`${mode}-${filter}-${hostedFilter}`}
        >
          {mode === "joined" ? (
            <div className="space-y-3">
            {historyMessage ? (
              <div className="rounded-[0.95rem] bg-[#f7f7f7] px-4 py-4">
                <p className="text-[14px] font-semibold text-black/45">
                  {historyMessage}
                </p>
              </div>
            ) : null}
            {records.length === 0 ? (
              <div className="rounded-[0.95rem] bg-[#f7f7f7] px-4 py-6">
                <p className="text-[14px] font-semibold text-black/70">
                  {authState.isLoggedIn
                    ? "표시할 참여 분철이 없습니다."
                    : "로그인 후 이용할 수 있어요."}
                </p>
                {authState.isLoggedIn ? (
                  <p className="mt-1 text-[13px] font-medium text-black/40">
                    참여한 분철이 여기에 쌓여요.
                  </p>
                ) : null}
              </div>
            ) : null}
            {records.map((bid) => {
              const isClosed = isBidRecordClosed(bid, now);
              const isWithdrawPending = withdrawingBidId === bid.id;
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
                        ) : !isClosed ? (
                          <button
                            className="shrink-0 rounded-full bg-[#f7f7f7] px-3 py-2 text-[13px] font-semibold text-black/55 disabled:text-black/25"
                            disabled={isWithdrawPending}
                            onClick={() => void handleWithdrawBid(bid.id)}
                            type="button"
                          >
                            {isWithdrawPending ? "철회 중" : "철회"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            </div>
          ) : (
            <div className="space-y-3">
              {hostedMessage ? (
                <div className="rounded-[0.95rem] bg-[#f7f7f7] px-4 py-4">
                  <p className="text-[14px] font-semibold text-black/45">
                    {hostedMessage}
                  </p>
                </div>
              ) : null}
              {hostedRecords.length === 0 ? (
                <div className="rounded-[0.95rem] bg-[#f7f7f7] px-4 py-6">
                  <p className="text-[14px] font-semibold text-black/70">
                    {authState.isLoggedIn
                      ? "표시할 개최 분철이 없습니다."
                      : "로그인 후 이용할 수 있어요."}
                  </p>
                  {authState.isLoggedIn ? (
                    <p className="mt-1 text-[13px] font-medium text-black/40">
                      상품 등록으로 만든 분철이 여기에 쌓여요.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {hostedRecords.map((product) => {
                const isClosed = isHostedProductClosed(product, now);
                const optionCount =
                  product.optionCount ??
                  product.targetMembers?.length ??
                  product.options.length;
                const participantCount = product.options.reduce(
                  (total, option) => total + option.participantCount,
                  0,
                );

                return (
                  <article
                    className="rounded-[1rem] border border-black/10 px-4 py-4 transition-colors hover:bg-black/[0.02]"
                    key={product.id}
                  >
                    <Link
                      className="block"
                      href={`/products/${product.id}?from=bids&hosted=true`}
                      onClick={rememberBidHistoryProductEntry}
                    >
                    <div className="flex items-start gap-3">
                      <div
                        className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-[0.9rem] bg-gradient-to-br ${product.tone}`}
                      >
                        {product.imageUrl ? (
                          <Image
                            alt=""
                            className="h-full w-full object-cover"
                            fill
                            sizes="64px"
                            src={product.imageUrl}
                            unoptimized
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                              {product.title}
                            </p>
                            <p className="mt-1 truncate text-[13px] font-medium text-black/45">
                              {product.member} · {product.era}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                              isClosed
                                ? "bg-[#f1f1f1] text-black/55"
                                : "bg-black text-white"
                            }`}
                          >
                            {isClosed ? "마감" : "모집중"}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-[0.75rem] bg-[#f7f7f7] px-3 py-2">
                              <p className="text-[11px] font-medium text-black/35">
                                옵션
                              </p>
                              <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em]">
                                {optionCount}개
                              </p>
                            </div>
                            <div className="rounded-[0.75rem] bg-[#f7f7f7] px-3 py-2">
                              <p className="text-[11px] font-medium text-black/35">
                                참여
                              </p>
                              <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em]">
                                {participantCount}명
                              </p>
                            </div>
                          </div>
                          <div className="rounded-[0.75rem] bg-[#f7f7f7] px-3 py-2">
                            <p className="text-[11px] font-medium text-black/35">
                              마감
                            </p>
                            <p className="mt-1 break-keep text-[14px] font-semibold leading-5 tracking-[-0.04em]">
                              {product.deadline}
                            </p>
                          </div>
                        </div>

                        <p
                          className={`mt-4 text-[12px] font-medium ${
                            isClosed ? "text-black/35" : "text-black"
                          }`}
                        >
                          {isClosed
                            ? "마감된 개최 분철이에요."
                            : "진행 중인 개최 분철이에요."}
                        </p>
                      </div>
                    </div>
                    </Link>
                    <div className="mt-4 flex justify-end gap-2 border-t border-black/10 pt-3">
                      {product.isApiProduct ? (
                      <Link
                        className="inline-flex h-9 items-center justify-center rounded-full bg-black px-4 text-[13px] font-semibold tracking-[-0.04em] text-white"
                        href={`/products/${product.buncheolId ?? product.id}/manage`}
                      >
                        관리하기
                      </Link>
                      ) : null}
                      {product.isApiProduct ? (
                        <button
                          className="h-9 rounded-full border border-black/10 px-4 text-[13px] font-semibold tracking-[-0.04em] text-black/55 disabled:text-black/25"
                          disabled={
                            deletingHostedProductId ===
                            (product.buncheolId ?? product.id)
                          }
                          onClick={() => handleDeleteHostedProduct(product)}
                          type="button"
                        >
                          삭제
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
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

            <div className="mt-4 space-y-2">
              {paymentVisibleAddresses.map(({ storeType, address }) => {
                const isSelected = address?.id === paymentDeliveryAddress?.id;

                return address ? (
                  <button
                    className={`w-full rounded-[0.95rem] border-[1.5px] px-4 py-3 text-left transition-[background-color,border-color,transform] duration-300 ease-out ${
                      isSelected
                        ? "border-[#d8d8d8] bg-[#ececec]"
                        : "border-[#ededed] bg-white"
                    }`}
                    key={storeType}
                    onClick={() => setSelectedPaymentAddressId(address.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-300 ease-out ${
                              isSelected
                                ? "bg-black text-white"
                                : "bg-white text-black/45"
                            }`}
                          >
                            {getConvenienceStoreLabel(storeType)}
                          </span>
                          {address.alias ? (
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-300 ease-out ${
                                "bg-black/10 text-black/60"
                              }`}
                            >
                              {address.alias}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 truncate text-[14px] font-semibold tracking-[-0.04em]">
                          {address.branchName}
                        </p>
                      </div>
                      <span
                        className={`inline-flex h-8 w-[4.25rem] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold transition-colors duration-300 ease-out ${
                          isSelected
                            ? "bg-black text-white"
                            : "bg-white text-black/45"
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          <span
                            className={`inline-flex h-3.5 w-3.5 items-center justify-center transition-opacity duration-300 ease-out ${
                              isSelected ? "opacity-100" : "opacity-0"
                            }`}
                          >
                            <CheckIcon />
                          </span>
                          <span>선택</span>
                        </span>
                      </span>
                    </div>
                  </button>
                ) : (
                  <div
                    className="rounded-[0.95rem] bg-[#f3f4f6] px-4 py-3"
                    key={storeType}
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black/45">
                        {getConvenienceStoreLabel(storeType)}
                      </span>
                      <p className="text-[14px] font-semibold tracking-[-0.04em] text-black/45">
                        기본 배송지가 없어요
                      </p>
                    </div>
                  </div>
                );
              })}
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
              className="mt-4 h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-white disabled:bg-black/20 disabled:text-white/70"
              disabled={!paymentDeliveryAddress}
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
            >
              {eligiblePaymentAddresses.map((address) => {
                const isDefault =
                  address.id === defaultAddressIds[address.storeType];
                const isSelected =
                  address.id ===
                  (selectedPaymentAddressId ?? paymentDeliveryAddress?.id);

                return (
                  <div
                    className={`w-full rounded-[0.95rem] border-[1.5px] px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-[#d8d8d8] bg-[#ececec]"
                        : "border-[#ededed] bg-white"
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
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              isSelected
                                ? "bg-black text-white"
                                : isDefault
                                ? "bg-black text-white"
                                : "bg-white text-black/45"
                            }`}
                          >
                            {getConvenienceStoreLabel(address.storeType)}
                          </span>
                          {address.alias ? (
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                "bg-black/10 text-black/60"
                              }`}
                            >
                              {address.alias}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 truncate text-[14px] font-semibold tracking-[-0.04em]">
                          {address.branchName}
                        </p>
                      </div>
                      <span
                        className={`inline-flex h-8 w-[4.25rem] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                          isSelected
                            ? "bg-black text-white"
                            : "bg-white text-black/45"
                        }`}
                      >
                        {isSelected ? "선택됨" : "선택"}
                      </span>
                    </div>
                  </div>
                );
              })}

              {eligiblePaymentAddresses.length === 0 ? (
                <div className="rounded-[0.95rem] border border-dashed border-black/12 bg-[#f7f7f7] px-4 py-5 text-center text-[14px] font-medium text-black/45">
                  선택 가능한 배송지가 없어요.
                </div>
              ) : null}

              <div className="idol-selection-enter" key="address-add-link">
                <Link
                  className="flex h-[4.25rem] w-full items-center justify-center rounded-[0.95rem] border border-dashed border-black/15 bg-[#f7f7f7] text-[14px] font-semibold text-black/45"
                  href="/profile/addresses?openAdd=1&returnTo=bids"
                  onNavigate={rememberAddressAddReturn}
                >
                  + 새 배송지 추가
                </Link>
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
