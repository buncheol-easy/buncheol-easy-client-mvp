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
import { getFreshAccessToken } from "@/lib/auth-session";
import {
  deleteBuncheol,
  requestBuncheolDetail,
  requestMyHostedBuncheols,
  requestMyParticipations,
  requestParticipationPaymentDetail,
  requestPaymentReport,
  toProductDetailItem,
  type BankAccountInfo,
  type MyHostedBuncheol,
  type MyParticipation,
} from "@/lib/auth-api";
import {
  getAvailableConvenienceStoreTypes,
  getConvenienceStoreLabel,
  getDefaultDeliveryAddressesByType,
  getPrioritizedDeliveryAddresses,
  type ConvenienceStoreType,
} from "@/lib/mock-delivery-addresses";
import type { ProductDetailItem } from "@/lib/mock-products";
import { isTransferPaymentRequestedStatus } from "@/lib/transfer-payment";

function formatPrice(price: number) {
  return `${price.toLocaleString("ko-KR")}원`;
}

const kstOffsetHours = 9;
const paymentDeadlineMinutes = 30;
const PRODUCT_BID_HISTORY_ENTRY_INDEX_KEY = "product-bid-history-entry-index";
const BID_HISTORY_SCROLL_TOP_KEY = "bid-history-scroll-top";
const BID_HISTORY_VIEW_STATE_KEY = "bid-history-view-state";
export const BID_HISTORY_OPEN_PAYMENT_ID_KEY = "bid-history-open-payment-id";

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

function getPaymentDeadlineDate(
  deadline: string,
  paymentDueAt?: string | null,
  createdAt?: string | null,
) {
  const paymentDeadline = paymentDueAt
    ? new Date(paymentDueAt)
    : createdAt
      ? new Date(createdAt)
      : parseDeadline(deadline);

  if (!paymentDueAt && !Number.isNaN(paymentDeadline.getTime())) {
    paymentDeadline.setUTCMinutes(
      paymentDeadline.getUTCMinutes() + paymentDeadlineMinutes,
    );
  }

  return paymentDeadline;
}

function formatPaymentRemainingTime(
  deadline: string,
  now: Date,
  paymentDueAt?: string | null,
  createdAt?: string | null,
) {
  const paymentDeadline = getPaymentDeadlineDate(
    deadline,
    paymentDueAt,
    createdAt,
  );

  if (Number.isNaN(paymentDeadline.getTime())) {
    return "결제 기한 확인 필요";
  }

  return formatRemainingTimeFromDate(paymentDeadline, now);
}
type BidHistoryMode = "joined" | "hosted";
type BidHistoryFilter = "all" | "payment" | "active";
type HostedHistoryFilter = "all" | "active" | "closed";
type BidHistoryViewState = {
  filter?: BidHistoryFilter;
  hostedFilter?: HostedHistoryFilter;
  mode?: BidHistoryMode;
};

const bidHistoryModes: BidHistoryMode[] = ["joined", "hosted"];
const bidHistoryFilters: BidHistoryFilter[] = ["all", "payment", "active"];
const hostedHistoryFilters: HostedHistoryFilter[] = [
  "all",
  "active",
  "closed",
];

function isBidHistoryMode(value: unknown): value is BidHistoryMode {
  return bidHistoryModes.includes(value as BidHistoryMode);
}

function isBidHistoryFilter(value: unknown): value is BidHistoryFilter {
  return bidHistoryFilters.includes(value as BidHistoryFilter);
}

function isHostedHistoryFilter(value: unknown): value is HostedHistoryFilter {
  return hostedHistoryFilters.includes(value as HostedHistoryFilter);
}

function readStoredBidHistoryViewState(keepStoredState: boolean) {
  if (typeof window === "undefined") {
    return {};
  }

  const rawViewState = window.sessionStorage.getItem(
    BID_HISTORY_VIEW_STATE_KEY,
  );

  if (!rawViewState) {
    return {};
  }

  if (!keepStoredState) {
    window.sessionStorage.removeItem(BID_HISTORY_VIEW_STATE_KEY);
  }

  try {
    const viewState = JSON.parse(rawViewState) as BidHistoryViewState;

    return {
      filter: isBidHistoryFilter(viewState.filter)
        ? viewState.filter
        : undefined,
      hostedFilter: isHostedHistoryFilter(viewState.hostedFilter)
        ? viewState.hostedFilter
        : undefined,
      mode: isBidHistoryMode(viewState.mode) ? viewState.mode : undefined,
    };
  } catch {
    return {};
  }
}

const shippingFee = 3200;
type BidRecord = {
  amount: number;
  deadline: string;
  id: string;
  imageUrl?: string;
  member: string;
  optionLabel: string;
  paidAt: string | null;
  participantCount: number;
  productId: string;
  rank: number;
  courier?: string;
  deliveryId?: string | null;
  deliveryStatus?: string | null;
  shippingMethods?: ProductDetailItem["shippingMethods"];
  submittedAt: string;
  title: string;
  tone: string;
  buncheolStatus?: string;
  payerName?: string;
  paymentAmount?: number | null;
  paymentDueAt?: string | null;
  createdAt?: string | null;
  participationStatus?: string;
  shippingFee?: number | null;
  trackingNumber?: string | null;
  hostBankAccount?: BankAccountInfo | null;
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

function isBidRecordPaymentReady(bid: BidRecord, now: Date) {
  return (
    !bid.paidAt &&
    (isPaymentWaitingParticipationStatus(bid.participationStatus) ||
      (isBidRecordClosed(bid, now) && bid.rank === 1)) &&
    !isBidRecordPaymentExpired(bid, now)
  );
}

function canRequestBidPaymentReport(bid: BidRecord, now: Date) {
  const isRequestableStatus =
    !bid.participationStatus ||
    bid.participationStatus === "ACTIVE_BID" ||
    isPaymentWaitingParticipationStatus(bid.participationStatus);

  return isRequestableStatus && isBidRecordPaymentReady(bid, now);
}

function isPaymentWaitingParticipationStatus(status: string | undefined) {
  return status === "AWAITING_PAYMENT" || status === "PENDING_PAYMENT";
}

function isCancelledParticipationStatus(status: string | undefined) {
  return status === "CANCELLED" || status === "CANCELED";
}

function isBidRecordPaymentExpired(bid: BidRecord, now: Date) {
  const isPaymentCandidate =
    isPaymentWaitingParticipationStatus(bid.participationStatus) ||
    (isBidRecordClosed(bid, now) && bid.rank === 1);

  if (
    bid.paidAt ||
    isTransferPaymentRequestedStatus(bid.participationStatus) ||
    !isPaymentCandidate
  ) {
    return false;
  }

  const paymentDeadline = getPaymentDeadlineDate(
    bid.deadline,
    bid.paymentDueAt,
    bid.createdAt,
  );

  return (
    !Number.isNaN(paymentDeadline.getTime()) &&
    paymentDeadline.getTime() <= now.getTime()
  );
}

function isBidRecordTransferRequested(bid: BidRecord) {
  return (
    !bid.paidAt && isTransferPaymentRequestedStatus(bid.participationStatus)
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
    (isPaymentWaitingParticipationStatus(participation.participationStatus)
      ? 1
      : 0);

  return {
    id: participation.participationId,
    amount: participation.bidAmount,
    deadline: formatApiDateTime(participation.buncheolDeadline),
    imageUrl: participation.thumbnailUrl,
    member: `${participation.buncheolMemberCount}개 옵션`,
    optionLabel: participation.memberName,
    participantCount: 0,
    paidAt:
      participation.participationStatus === "CONFIRMED" ||
      participation.participationStatus === "PAYMENT_CONFIRMED"
        ? "결제 완료"
        : null,
    buncheolStatus: participation.buncheolStatus,
    deliveryId: participation.deliveryId,
    deliveryStatus: participation.deliveryStatus,
    paymentAmount: participation.paymentAmount,
    paymentDueAt: participation.paymentDueAt,
    createdAt: participation.createdAt,
    productId: participation.buncheolId,
    participationStatus: participation.participationStatus,
    rank: rank > 0 ? rank : 0,
    shippingFee: participation.shippingFee,
    trackingNumber: participation.trackingNumber,
    hostBankAccount: participation.hostBankAccount,
    submittedAt: "",
    title: participation.buncheolTitle,
    tone: getToneFromId(participation.buncheolId),
  };
}

async function getBidRecordWithShippingData(
  accessToken: string,
  participation: MyParticipation,
): Promise<BidRecord> {
  const bidRecord = getBidRecordFromParticipation(participation);

  try {
    const detail = await requestBuncheolDetail(accessToken, bidRecord.productId);
    const product = toProductDetailItem(detail);

    return {
      ...bidRecord,
      courier: product.courier,
      hostBankAccount: bidRecord.hostBankAccount ?? detail.hostBankAccount,
      imageUrl: bidRecord.imageUrl ?? product.imageUrl,
      shippingMethods: product.shippingMethods,
    };
  } catch {
    return bidRecord;
  }
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
  restoreStoredViewState?: boolean;
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

function BidHistoryListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div aria-label="참여 내역을 불러오는 중" className="space-y-3" role="status">
      {Array.from({ length: count }).map((_, index) => (
        <div
          className="rounded-[1rem] border border-black/10 px-4 py-4"
          key={`bid-history-skeleton-${index}`}
        >
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 shrink-0 animate-pulse rounded-[0.85rem] bg-black/8" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-3/4 animate-pulse rounded-full bg-black/8" />
                  <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-black/8" />
                </div>
                <div className="h-7 w-12 shrink-0 animate-pulse rounded-full bg-black/8" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="h-[52px] animate-pulse rounded-[0.75rem] bg-black/8" />
                <div className="h-[52px] animate-pulse rounded-[0.75rem] bg-black/8" />
              </div>
              <div className="mt-2 h-[52px] animate-pulse rounded-[0.75rem] bg-black/8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BidHistoryContent({
  restoreStoredViewState = true,
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
  const [isPaymentReportConfirmOpen, setIsPaymentReportConfirmOpen] =
    useState(false);
  const paymentSheetCloseTimerRef = useRef<number | null>(null);
  const paymentCopyToastTimerRef = useRef<number | null>(null);
  const [paymentCopyToast, setPaymentCopyToast] = useState("");
  const [selectedPaymentAddressId, setSelectedPaymentAddressId] = useState<
    string | null
  >(null);
  const [apiPaymentStoreTypes, setApiPaymentStoreTypes] = useState<
    ConvenienceStoreType[] | null
  >(null);
  const [isPaymentStoreTypeLoading, setIsPaymentStoreTypeLoading] =
    useState(false);
  const [isAddressSheetOpen, setIsAddressSheetOpen] = useState(false);
  const [isAddressSheetEntered, setIsAddressSheetEntered] = useState(false);
  const [isAddressSheetClosing, setIsAddressSheetClosing] = useState(false);
  const addressSheetCloseTimerRef = useRef<number | null>(null);
  const paymentStoreTypeRequestIdRef = useRef(0);
  const storedAddressState = useSyncExternalStore(
    subscribeDeliveryAddressState,
    readDeliveryAddressState,
    getInitialDeliveryAddressState,
  );
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const { addresses: deliveryAddresses, defaultAddressIds } = storedAddressState;
  const [mode, setMode] = useState<BidHistoryMode>("joined");
  const [filter, setFilter] = useState<BidHistoryFilter>("all");
  const [hostedFilter, setHostedFilter] =
    useState<HostedHistoryFilter>("all");
  const [apiBidRecords, setApiBidRecords] = useState<BidRecord[] | null>(null);
  const [apiHostedProducts, setApiHostedProducts] = useState<
    ProductDetailItem[] | null
  >(null);
  const [deletingHostedProductId, setDeletingHostedProductId] = useState<
    string | null
  >(null);
  const [payingBidId, setPayingBidId] = useState<string | null>(null);
  const [historyMessage, setHistoryMessage] = useState("");
  const [hostedMessage, setHostedMessage] = useState("");
  const isBidRecordsLoading = authState.isLoggedIn && apiBidRecords === null;
  const isHostedProductsLoading =
    authState.isLoggedIn && apiHostedProducts === null;

  const paymentBidRecords: BidRecord[] = useMemo(
    () => apiBidRecords ?? [],
    [apiBidRecords],
  );
  const selectedPaymentBid =
    paymentBidRecords.find((bid) => bid.id === selectedPaymentBidId) ?? null;
  const canSelectedPaymentBidReportPayment = selectedPaymentBid
    ? canRequestBidPaymentReport(selectedPaymentBid, now)
    : false;
  const shouldRefreshPaymentState = paymentBidRecords.some(
    (bid) =>
      bid.participationStatus === "ACTIVE_BID" && isBidRecordClosed(bid, now),
  );
  const defaultDeliveryAddresses = getDefaultDeliveryAddressesByType(
    deliveryAddresses,
    defaultAddressIds,
  );
  const prioritizedDeliveryAddresses = getPrioritizedDeliveryAddresses(
    deliveryAddresses,
    defaultAddressIds,
  );
  const availablePaymentStoreTypes =
    apiPaymentStoreTypes ??
    getAvailableConvenienceStoreTypes(
      selectedPaymentBid?.shippingMethods,
      selectedPaymentBid?.courier,
    );
  const isApiPaymentStoreTypePending =
    selectedPaymentBid !== null && isPaymentStoreTypeLoading;
  const eligiblePaymentAddresses =
    isApiPaymentStoreTypePending
      ? []
      : availablePaymentStoreTypes.length > 0
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
  const paymentShippingFee = selectedPaymentBid?.shippingFee ?? shippingFee;
  const paymentTotalAmount = selectedPaymentBid
    ? selectedPaymentBid.paymentAmount ??
      selectedPaymentBid.amount + paymentShippingFee
    : 0;
  const selectedPaymentBankAccount =
    selectedPaymentBid?.hostBankAccount ?? null;
  const visiblePaymentStoreTypes =
    isApiPaymentStoreTypePending
      ? []
      : availablePaymentStoreTypes.length > 0
      ? availablePaymentStoreTypes
      : [
          ...new Set(
            eligiblePaymentAddresses.map((address) => address.storeType),
          ),
        ];
  const paymentVisibleAddresses = visiblePaymentStoreTypes.map((storeType) => ({
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

      if (paymentCopyToastTimerRef.current !== null) {
        window.clearTimeout(paymentCopyToastTimerRef.current);
      }

      if (addressSheetCloseTimerRef.current !== null) {
        window.clearTimeout(addressSheetCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!restoreStoredViewState) {
      return;
    }

    const storedViewState = readStoredBidHistoryViewState(skipEnterAnimation);

    if (storedViewState.mode) {
      setMode(storedViewState.mode);
    }

    if (storedViewState.filter) {
      setFilter(storedViewState.filter);
    }

    if (storedViewState.hostedFilter) {
      setHostedFilter(storedViewState.hostedFilter);
    }
  }, [restoreStoredViewState, skipEnterAnimation]);

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

        Promise.all(
          participations.map((participation) =>
            getBidRecordWithShippingData(accessToken, participation),
          ),
        ).then((bidRecords) => {
          if (!isActive) {
            return;
          }

          setApiBidRecords(bidRecords);
          setHistoryMessage("");

          const pendingPaymentId = window.sessionStorage.getItem(
            BID_HISTORY_OPEN_PAYMENT_ID_KEY,
          );
          const pendingPaymentRecord = pendingPaymentId
            ? bidRecords.find((bid) => bid.id === pendingPaymentId)
            : null;

          if (pendingPaymentRecord) {
            window.sessionStorage.removeItem(BID_HISTORY_OPEN_PAYMENT_ID_KEY);
            setMode("joined");
            setFilter("payment");
            setSelectedPaymentBidId(pendingPaymentRecord.id);
            setIsPaymentSheetOpen(true);
            setIsPaymentSheetClosing(false);
            setIsAddressSheetOpen(false);
            setIsAddressSheetClosing(false);

            window.requestAnimationFrame(() => {
              if (!isActive) {
                return;
              }

              setIsPaymentSheetEntered(true);
            });
          }
        });
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
    if (!authState.isLoggedIn || !shouldRefreshPaymentState) {
      return;
    }

    let isActive = true;

    async function refreshParticipations() {
      const accessToken = await getFreshAccessToken();

      if (!isActive || !accessToken) {
        return;
      }

      try {
        const participations = await requestMyParticipations(accessToken);
        const bidRecords = await Promise.all(
          participations.map((participation) =>
            getBidRecordWithShippingData(accessToken, participation),
          ),
        );

        if (isActive) {
          setApiBidRecords(bidRecords);
        }
      } catch {
        // Keep the current list while the backend finishes deadline processing.
      }
    }

    void refreshParticipations();
    const timer = window.setInterval(() => {
      void refreshParticipations();
    }, 15_000);

    return () => {
      isActive = false;
      window.clearInterval(timer);
    };
  }, [authState.isLoggedIn, shouldRefreshPaymentState]);

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

    const returnAvailableStoreTypes = getAvailableConvenienceStoreTypes(
      returnBid.shippingMethods,
      returnBid.courier,
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
    setIsPaymentReportConfirmOpen(false);
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

    const sourceRecords: BidRecord[] = paymentBidRecords;

    return [...sourceRecords]
      .filter((bid) => {
        const isClosed = isBidRecordClosed(bid, now);

        if (isCancelledParticipationStatus(bid.participationStatus)) {
          return false;
        }

        if (filter === "payment") {
          return (
            isBidRecordPaymentReady(bid, now) ||
            isBidRecordTransferRequested(bid)
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
  }, [authState.isLoggedIn, filter, now, paymentBidRecords]);
  const hostedRecords = useMemo(() => {
    if (!authState.isLoggedIn) {
      return [];
    }

    const sourceProducts = apiHostedProducts ?? [];

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
    now,
  ]);

  function openPaymentSheet(bidId: string) {
    if (paymentSheetCloseTimerRef.current !== null) {
      window.clearTimeout(paymentSheetCloseTimerRef.current);
      paymentSheetCloseTimerRef.current = null;
    }

    const requestId = paymentStoreTypeRequestIdRef.current + 1;
    const selectedBid = paymentBidRecords.find((bid) => bid.id === bidId) ?? null;

    if (!selectedBid) {
      return;
    }

    if (isBidRecordPaymentExpired(selectedBid, new Date())) {
      setHistoryMessage(
        "입금 기한이 지나 결제할 수 없어요. 참여가 자동 취소됐을 수 있어요.",
      );
      return;
    }

    const allowedStoreTypes = getAvailableConvenienceStoreTypes(
      selectedBid.shippingMethods,
      selectedBid.courier,
    );
    const shouldLoadApiStoreTypes =
      allowedStoreTypes.length === 0;
    const nextDefaultAddresses = getDefaultDeliveryAddressesByType(
      deliveryAddresses,
      defaultAddressIds,
    );
    const fallbackAddress = shouldLoadApiStoreTypes
      ? null
      : allowedStoreTypes.length > 0
        ? allowedStoreTypes
            .map((storeType) => nextDefaultAddresses[storeType])
            .find((address) => address !== null) ??
          prioritizedDeliveryAddresses.find((address) =>
            allowedStoreTypes.includes(address.storeType),
          ) ??
          null
        : prioritizedDeliveryAddresses[0] ?? null;

    paymentStoreTypeRequestIdRef.current = requestId;
    setApiPaymentStoreTypes(null);
    setIsPaymentStoreTypeLoading(shouldLoadApiStoreTypes);
    setSelectedPaymentBidId(bidId);
    setSelectedPaymentAddressId((current) =>
      current &&
      prioritizedDeliveryAddresses.some(
        (address) =>
          address.id === current &&
          (allowedStoreTypes.length === 0 ||
            allowedStoreTypes.includes(address.storeType)),
      )
        ? current
        : fallbackAddress?.id ?? null,
    );
    setIsPaymentSheetOpen(true);
    setIsPaymentSheetClosing(false);

    if (authState.accessToken) {
      requestParticipationPaymentDetail(authState.accessToken, selectedBid.id)
        .then((paymentDetail) => {
          if (paymentStoreTypeRequestIdRef.current !== requestId) {
            return;
          }

          setApiBidRecords((current) =>
            current
              ? current.map((bid) =>
                  bid.id === selectedBid.id
                    ? {
                        ...bid,
                        amount: paymentDetail.bidAmount || bid.amount,
                        hostBankAccount:
                          paymentDetail.hostBankAccount ?? bid.hostBankAccount,
                        paymentAmount:
                          paymentDetail.paymentAmount ?? bid.paymentAmount,
                        paymentDueAt:
                          paymentDetail.paymentDueAt ?? bid.paymentDueAt,
                        participationStatus:
                          paymentDetail.paymentStatus ||
                          bid.participationStatus,
                        shippingFee:
                          paymentDetail.shippingFee ?? bid.shippingFee,
                      }
                    : bid,
                )
              : current,
          );
        })
        .catch(() => {});
    }

    if (shouldLoadApiStoreTypes) {
      requestBuncheolDetail(
        authState.isLoggedIn ? authState.accessToken ?? undefined : undefined,
        selectedBid.productId,
      )
        .then((detail) => {
          if (paymentStoreTypeRequestIdRef.current !== requestId) {
            return;
          }

          const storeTypes = getAvailableConvenienceStoreTypes(
            detail.shippingOptions.map((option) => ({ name: option.method })),
            undefined,
          );

          setApiPaymentStoreTypes(storeTypes.length > 0 ? storeTypes : null);

          if (storeTypes.length === 0) {
            return;
          }

          setSelectedPaymentAddressId((current) => {
            const currentAddress = prioritizedDeliveryAddresses.find(
              (address) => address.id === current,
            );

            if (currentAddress && storeTypes.includes(currentAddress.storeType)) {
              return current;
            }

            return (
              storeTypes
                .map((storeType) => nextDefaultAddresses[storeType])
                .find((address) => address !== null)?.id ??
              prioritizedDeliveryAddresses.find((address) =>
                storeTypes.includes(address.storeType),
              )?.id ??
              null
            );
          });
        })
        .catch(() => {})
        .finally(() => {
          if (paymentStoreTypeRequestIdRef.current === requestId) {
            setIsPaymentStoreTypeLoading(false);
          }
        });
    }

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
    setIsPaymentReportConfirmOpen(false);
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

  function rememberBidHistoryViewState() {
    window.sessionStorage.setItem(
      BID_HISTORY_VIEW_STATE_KEY,
      JSON.stringify({ filter, hostedFilter, mode }),
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
    rememberBidHistoryViewState();

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

  function rememberBidHistoryManageEntry(event: MouseEvent<HTMLAnchorElement>) {
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
    rememberBidHistoryViewState();
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

  async function copyTransferText(value: string, label: string) {
    if (!value.trim() || value.includes("준비 중")) {
      return;
    }

    if (paymentCopyToastTimerRef.current !== null) {
      window.clearTimeout(paymentCopyToastTimerRef.current);
    }

    try {
      await navigator.clipboard.writeText(value);
      setPaymentCopyToast(`${label}가 복사됐어요.`);
    } catch {
      setPaymentCopyToast(`${label}를 복사하지 못했어요.`);
    }

    paymentCopyToastTimerRef.current = window.setTimeout(() => {
      setPaymentCopyToast("");
      paymentCopyToastTimerRef.current = null;
    }, 1800);
  }

  function openPaymentReportConfirm() {
    if (
      !selectedPaymentBid ||
      !canSelectedPaymentBidReportPayment ||
      !paymentDeliveryAddress ||
      !selectedPaymentBankAccount ||
      payingBidId
    ) {
      return;
    }

    setIsPaymentReportConfirmOpen(true);
  }

  async function handleTransferPaymentRequest() {
    if (
      !selectedPaymentBid ||
      !paymentDeliveryAddress ||
      !selectedPaymentBankAccount ||
      payingBidId
    ) {
      return;
    }

    if (!canSelectedPaymentBidReportPayment) {
      setIsPaymentReportConfirmOpen(false);
      setHistoryMessage(
        "입금 완료를 접수할 수 없는 상태예요. 최신 상태를 확인해 주세요.",
      );
      closePaymentSheet();
      return;
    }

    setPayingBidId(selectedPaymentBid.id);
    setIsPaymentReportConfirmOpen(false);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        return;
      }

      await requestPaymentReport(
        accessToken,
        selectedPaymentBid.id,
        paymentDeliveryAddress.id,
      );
      setApiBidRecords((current) =>
        current
          ? current.map((bid) =>
              bid.id === selectedPaymentBid.id
                ? {
                    ...bid,
                    paidAt: null,
                    participationStatus: "PAYMENT_REPORTED",
                  }
                : bid,
            )
          : current,
      );
      setHistoryMessage(
        "입금 확인 요청을 보냈어요. 판매자의 확인을 기다려 주세요.",
      );
      closePaymentSheet();
    } catch (error: unknown) {
      setHistoryMessage(
        error instanceof Error
          ? error.message
          : "입금 완료를 접수하지 못했어요.",
      );
    } finally {
      setPayingBidId(null);
    }
  }

  useLayoutEffect(() => {
    const storedScrollTop = window.sessionStorage.getItem(
      BID_HISTORY_SCROLL_TOP_KEY,
    );

    if (!storedScrollTop || !scrollContainerRef.current) {
      return;
    }

    if (mode === "joined" && isBidRecordsLoading) {
      return;
    }

    if (mode === "hosted" && isHostedProductsLoading) {
      return;
    }

    const restoreFrame = window.requestAnimationFrame(() => {
      if (!scrollContainerRef.current) {
        return;
      }

      scrollContainerRef.current.scrollTop = Number(storedScrollTop);

      if (!skipEnterAnimation) {
        window.sessionStorage.removeItem(BID_HISTORY_SCROLL_TOP_KEY);
      }
    });

    return () => {
      window.cancelAnimationFrame(restoreFrame);
    };
  }, [
    isBidRecordsLoading,
    isHostedProductsLoading,
    mode,
    records.length,
    hostedRecords.length,
    skipEnterAnimation,
  ]);

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
            {mode === "joined" ? "참여 내역" : "개최 기록"}
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
              ["active", "진행 중"],
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
            {isBidRecordsLoading ? (
              <BidHistoryListSkeleton />
            ) : records.length === 0 ? (
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
            {!isBidRecordsLoading && records.map((bid) => {
              const isClosed = isBidRecordClosed(bid, now);
              const isPaymentExpired = isBidRecordPaymentExpired(bid, now);
              const isPaymentReady = isBidRecordPaymentReady(bid, now);
              const isTransferRequested = isBidRecordTransferRequested(bid);
              return (
                <article
                  className="rounded-[1rem] border border-black/10 px-4 py-4"
                  key={bid.id}
                >
                  <div className="flex items-start gap-3">
                    <Link
                      aria-label={`${bid.title} 상세 보기`}
                      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-[0.85rem] bg-gradient-to-br ${bid.tone}`}
                      href={`/products/${bid.productId}?from=bids`}
                      onClick={rememberBidHistoryProductEntry}
                    >
                      {bid.imageUrl ? (
                        <Image
                          alt=""
                          className="h-full w-full object-cover"
                          fill
                          sizes="56px"
                          src={bid.imageUrl}
                          unoptimized
                        />
                      ) : null}
                    </Link>
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
                          참여
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-[0.75rem] bg-[#f7f7f7] px-3 py-2">
                            <p className="text-[11px] font-medium text-black/35">
                              상품 금액
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
                                : isTransferRequested
                                ? "입금 확인 중"
                                : isPaymentExpired
                                ? "입금 만료"
                                : isPaymentReady
                                ? "결제 필요"
                                : isClosed
                                ? bid.rank === 1
                                  ? "참여"
                                  : "마감"
                                : "참여중"}
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
                            isPaymentReady || isTransferRequested
                              ? "text-black"
                              : "text-black/35"
                          }`}
                        >
                          {isClosed ? (
                            bid.paidAt ? (
                              <>
                                <p>결제가 완료되었어요</p>
                                <p className="mt-0.5 text-black/45">
                                  결제일 {bid.paidAt}
                                </p>
                              </>
                            ) : isTransferRequested ? (
                              <>
                                <p>입금 확인 중이에요</p>
                                <p className="mt-0.5 text-black/45">
                                  판매자의 확인을 기다리고 있어요
                                </p>
                              </>
                            ) : isPaymentExpired ? (
                              <>
                                <p>입금 기한이 지났어요</p>
                                <p className="mt-0.5 text-black/45">
                                  입금 기한이 지나 참여가 취소됐을 수 있어요
                                </p>
                              </>
                            ) : isPaymentReady ? (
                              <>
                                <p>결제가 필요해요</p>
                                <p className="mt-0.5 text-black/45">
                                  결제까지{" "}
                                  {formatPaymentRemainingTime(
                                    bid.deadline,
                                    now,
                                    bid.paymentDueAt,
                                    bid.createdAt,
                                  )}
                                </p>
                              </>
                            ) : (
                              <p>마감된 분철이에요</p>
                            )
                          ) : isPaymentReady ? (
                            <>
                              <p>결제가 필요해요</p>
                              <p className="mt-0.5 text-black/45">
                                결제까지{" "}
                                {formatPaymentRemainingTime(
                                  bid.deadline,
                                  now,
                                  bid.paymentDueAt,
                                  bid.createdAt,
                                )}
                              </p>
                            </>
                          ) : (
                            <p>진행 중인 참여예요</p>
                          )}
                        </div>
                        {isPaymentReady ? (
                          <button
                            className="shrink-0 rounded-full bg-black px-3 py-2 text-[13px] font-semibold text-white"
                            onClick={() => openPaymentSheet(bid.id)}
                            type="button"
                          >
                            결제
                          </button>
                        ) : null}
                      </div>
                      {bid.deliveryId && bid.paidAt ? (
                        <div className="mt-3 rounded-[0.75rem] bg-[#f7f7f7] px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-black/35">
                                배송
                              </p>
                              <p className="mt-1 truncate text-[13px] font-semibold text-black/55">
                                {bid.trackingNumber
                                  ? `운송장 ${bid.trackingNumber}`
                                  : "운송장 등록 대기"}
                              </p>
                            </div>
                            {bid.trackingNumber ? (
                              <span className="shrink-0 rounded-full bg-black/10 px-3 py-2 text-[12px] font-semibold text-black/45">
                                운송장 등록
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
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
              {isHostedProductsLoading ? (
                <BidHistoryListSkeleton />
              ) : hostedRecords.length === 0 ? (
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
              {!isHostedProductsLoading && hostedRecords.map((product) => {
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
                        onClick={rememberBidHistoryManageEntry}
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
          className={`bid-sheet-backdrop fixed inset-0 z-40 flex items-end ${
            isPaymentSheetEntered && !isPaymentSheetClosing
              ? "bid-sheet-backdrop-active"
              : ""
          }`}
        >
          <button
            aria-label="입금 정보 닫기"
            className="absolute inset-0 cursor-default"
            onClick={closePaymentSheet}
            type="button"
          />
          <section
            className={`bid-sheet-panel relative mx-auto flex max-h-[calc(100dvh-2.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[1.4rem] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
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
                  입금 정보
                </h2>
                <p className="mt-1 text-[13px] font-medium text-black/45">
                  계좌와 배송지를 확인한 뒤 입금 완료를 눌러 주세요.
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

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="mt-5 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3">
              <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                {selectedPaymentBid.title}
              </p>
              <p className="mt-1 text-[13px] font-medium text-black/45">
                {selectedPaymentBid.member} · {selectedPaymentBid.optionLabel}
              </p>
            </div>

            <div className="relative mt-4 rounded-[0.95rem] border border-black/10 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-black/40">
                    개최자 계좌
                  </p>
                  <p className="mt-1 truncate text-[15px] font-semibold tracking-[-0.04em]">
                    {selectedPaymentBankAccount
                      ? `${selectedPaymentBankAccount.bank} ${selectedPaymentBankAccount.account}`.trim()
                      : "계좌 정보 확인 중"}
                  </p>
                  <p className="mt-1 text-[12px] font-medium text-black/40">
                    {selectedPaymentBankAccount?.holder
                      ? `예금주 ${selectedPaymentBankAccount.holder}`
                      : "개최자가 등록한 계좌로 입금해 주세요."}
                  </p>
                </div>
                <button
                  className="h-9 shrink-0 rounded-full bg-black px-3 text-[12px] font-semibold text-white disabled:bg-black/10 disabled:text-black/30"
                  disabled={!selectedPaymentBankAccount}
                  onClick={() =>
                    selectedPaymentBankAccount
                      ? void copyTransferText(
                          selectedPaymentBankAccount.account,
                          "계좌번호",
                        )
                      : undefined
                  }
                  type="button"
                >
                  계좌 복사
                </button>
              </div>
              <p className="mt-3 text-[12px] font-medium leading-5 text-black/45">
                송금 후 입금 완료를 눌러 주세요.
              </p>
              {paymentCopyToast ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
                  <p
                    aria-live="polite"
                    className="soft-panel-enter rounded-full bg-black/92 px-4 py-3 text-center text-[12px] font-semibold tracking-[-0.04em] text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
                    role="status"
                  >
                    {paymentCopyToast}
                  </p>
                </div>
              ) : null}
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

            </div>

            <div className="shrink-0 border-t border-black/10 bg-white pt-4">
              <div className="flex items-center justify-between text-[14px] font-medium text-black/45">
                <span>상품 금액</span>
                <span>{formatPrice(selectedPaymentBid.amount)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[14px] font-medium text-black/45">
                <span>배송비</span>
                <span>{formatPrice(paymentShippingFee)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[15px] font-semibold tracking-[-0.04em]">
                  결제 예정 금액
                </span>
                <span className="text-[22px] font-semibold tracking-[-0.05em]">
                  {formatPrice(paymentTotalAmount)}
                </span>
              </div>
            </div>

            <button
              className="mt-4 h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-white disabled:bg-black/20 disabled:text-white/70"
              disabled={
                !paymentDeliveryAddress ||
                !selectedPaymentBankAccount ||
                !canSelectedPaymentBidReportPayment ||
                payingBidId === selectedPaymentBid.id
              }
              onClick={openPaymentReportConfirm}
              type="button"
            >
              입금 완료
            </button>

            {isPaymentReportConfirmOpen ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-t-[1.4rem] bg-black/35 px-5">
                <section className="w-full rounded-[1.1rem] bg-white px-5 py-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
                  <h3 className="text-[22px] font-semibold tracking-[-0.06em]">
                    입금을 완료하셨나요?
                  </h3>
                  <p className="mt-2 text-[14px] font-medium leading-6 text-black/50">
                    송금 후에만 입금 완료 버튼을 눌러주세요. 허위 신고 시
                    서비스 이용이 제한될 수 있습니다.
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      className="h-12 rounded-full bg-[#f5f5f5] text-[15px] font-semibold text-black/45"
                      onClick={() => setIsPaymentReportConfirmOpen(false)}
                      type="button"
                    >
                      취소
                    </button>
                    <button
                      className="h-12 rounded-full bg-black text-[15px] font-semibold text-white disabled:bg-black/20"
                      disabled={
                        !selectedPaymentBankAccount ||
                        !canSelectedPaymentBidReportPayment ||
                        payingBidId === selectedPaymentBid.id
                      }
                      onClick={() => void handleTransferPaymentRequest()}
                      type="button"
                    >
                      입금 완료
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {isAddressSheetOpen ? (
        <div
          className={`bid-sheet-backdrop fixed inset-0 z-50 flex items-end ${
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
            className={`bid-sheet-panel relative mx-auto flex h-[76dvh] w-full max-w-[430px] flex-col rounded-t-[1.4rem] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
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
