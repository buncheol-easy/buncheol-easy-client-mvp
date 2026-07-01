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
import { CloseIcon } from "@/components/icons";
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
  type DeliveryAddress,
} from "@/lib/mock-delivery-addresses";
import type { ProductDetailItem } from "@/lib/mock-products";
import {
  readCachedParticipationPayment,
  writeCachedParticipationPayment,
} from "@/lib/participation-payment-cache";
import { getCachedProductImageUrl } from "@/lib/product-card-image";
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
    return "기한 지남";
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
type BidHistoryFilter = "all" | "payment" | "confirmed";
type HostedHistoryFilter = "all" | "active" | "closed";
type BidHistoryViewState = {
  filter?: BidHistoryFilter;
  hostedFilter?: HostedHistoryFilter;
  mode?: BidHistoryMode;
};

const bidProgressStepLabels = [
  "결제 확인",
  "결제 완료",
  "배송중",
  "배송 완료",
] as const;

const bidHistoryModes: BidHistoryMode[] = ["joined", "hosted"];
const bidHistoryFilters: BidHistoryFilter[] = ["all", "payment", "confirmed"];
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
  shippingAddress?: DeliveryAddress | null;
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
    !isBidRecordPaymentConfirmed(bid) &&
    (isPaymentWaitingParticipationStatus(bid.participationStatus) ||
      (isBidRecordClosed(bid, now) && bid.rank === 1)) &&
    !isBidRecordPaymentExpired(bid, now)
  );
}

function isPaymentWaitingParticipationStatus(status: string | undefined) {
  return status === "AWAITING_PAYMENT" || status === "PENDING_PAYMENT";
}

function isPaymentConfirmedParticipationStatus(status: string | undefined) {
  return status === "CONFIRMED" || status === "PAYMENT_CONFIRMED";
}

function isBidRecordPaymentConfirmed(bid: BidRecord) {
  return (
    Boolean(bid.paidAt) ||
    isPaymentConfirmedParticipationStatus(bid.participationStatus)
  );
}

function isCancelledParticipationStatus(status: string | undefined) {
  return status === "CANCELLED" || status === "CANCELED";
}

function isDeletedProductStatus(status: string | undefined) {
  return status === "DELETED";
}

function isBidRecordPaymentExpired(bid: BidRecord, now: Date) {
  const isPaymentCandidate =
    isPaymentWaitingParticipationStatus(bid.participationStatus) ||
    (isBidRecordClosed(bid, now) && bid.rank === 1);

  if (
    isBidRecordPaymentConfirmed(bid) ||
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
    !isBidRecordPaymentConfirmed(bid) &&
    isTransferPaymentRequestedStatus(bid.participationStatus)
  );
}

function getNormalizedDeliveryStatus(status: string | null | undefined) {
  return status?.trim().toUpperCase();
}

function isDeliveryCompletedStatus(status: string | null | undefined) {
  const normalizedStatus = getNormalizedDeliveryStatus(status);

  return normalizedStatus === "DELIVERED" || normalizedStatus === "RECEIVED";
}

function isDeliveryInProgress(bid: BidRecord) {
  const normalizedStatus = getNormalizedDeliveryStatus(bid.deliveryStatus);

  return (
    normalizedStatus === "SHIPPING" ||
    isDeliveryCompletedStatus(normalizedStatus) ||
    Boolean(bid.trackingNumber)
  );
}

function getBidRecordProgressStepIndex(bid: BidRecord, now: Date) {
  if (
    isCancelledParticipationStatus(bid.participationStatus) ||
    isBidRecordPaymentExpired(bid, now)
  ) {
    return -1;
  }

  if (isDeliveryCompletedStatus(bid.deliveryStatus)) {
    return 3;
  }

  if (isDeliveryInProgress(bid)) {
    return 2;
  }

  if (isBidRecordPaymentConfirmed(bid)) {
    return 1;
  }

  if (isBidRecordTransferRequested(bid) || isBidRecordPaymentReady(bid, now)) {
    return 0;
  }

  return -1;
}

function getBidRecordProgressSteps(bid: BidRecord, now: Date) {
  const currentStepIndex = getBidRecordProgressStepIndex(bid, now);

  return bidProgressStepLabels.map((label, index) => ({
    isActive: currentStepIndex >= index,
    label,
  }));
}

function getUniqueLabels(labels: string[]) {
  return [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
}

function formatGroupedOptionLabel(labels: string[]) {
  const uniqueLabels = getUniqueLabels(labels);

  if (uniqueLabels.length === 0) {
    return "옵션 확인 필요";
  }

  if (uniqueLabels.length === 1) {
    return uniqueLabels[0];
  }

  return `${uniqueLabels[0]} 외 ${uniqueLabels.length - 1}개`;
}

function mergeBidRecordGroup(groupRecords: BidRecord[], now: Date) {
  const sortedRecords = [...groupRecords].sort((left, right) => {
    const rightProgress = getBidRecordProgressStepIndex(right, now);
    const leftProgress = getBidRecordProgressStepIndex(left, now);

    if (rightProgress !== leftProgress) {
      return rightProgress - leftProgress;
    }

    return right.amount - left.amount;
  });
  const representative =
    sortedRecords.find(
      (bid) =>
        isBidRecordPaymentReady(bid, now) || isBidRecordTransferRequested(bid),
    ) ?? sortedRecords[0];
  const totalAmount = groupRecords.reduce((sum, bid) => sum + bid.amount, 0);
  const paymentAmounts = groupRecords.map((bid) => bid.paymentAmount);
  const totalPaymentAmount = paymentAmounts.every(
    (amount): amount is number => typeof amount === "number",
  )
    ? paymentAmounts.reduce((sum, amount) => sum + amount, 0)
    : representative.paymentAmount;

  return {
    ...representative,
    amount: totalAmount,
    id: representative.id,
    optionLabel: formatGroupedOptionLabel(
      groupRecords.map((bid) => bid.optionLabel),
    ),
    paymentAmount: totalPaymentAmount,
    shippingAddress:
      representative.shippingAddress ??
      groupRecords.find((bid) => bid.shippingAddress)?.shippingAddress ??
      null,
  };
}

function getGroupedBidRecords(records: BidRecord[], now: Date) {
  const groups = new Map<string, BidRecord[]>();

  records.forEach((bid) => {
    const key = bid.productId || bid.id;
    const group = groups.get(key) ?? [];

    group.push(bid);
    groups.set(key, group);
  });

  return [...groups.values()].map((group) => mergeBidRecordGroup(group, now));
}

function getBidRecordPaymentStatusLabel(bid: BidRecord, now: Date) {
  if (isCancelledParticipationStatus(bid.participationStatus)) {
    return "취소";
  }

  if (isBidRecordPaymentConfirmed(bid)) {
    return "결제 완료";
  }

  if (isBidRecordTransferRequested(bid)) {
    return "관리자 확인 중";
  }

  if (isBidRecordPaymentExpired(bid, now)) {
    return "결제 만료";
  }

  if (isBidRecordPaymentReady(bid, now)) {
    return "결제 대기";
  }

  return isBidRecordClosed(bid, now) ? "모집 종료" : "참여중";
}

function getBidRecordPaymentStatusDescription(bid: BidRecord, now: Date) {
  if (isCancelledParticipationStatus(bid.participationStatus)) {
    return "취소된 참여예요.";
  }

  if (isBidRecordPaymentConfirmed(bid)) {
    return "관리자가 입금을 확인했어요.";
  }

  if (isBidRecordTransferRequested(bid)) {
    return "관리자가 입금을 확인하고 있어요.";
  }

  if (isBidRecordPaymentExpired(bid, now)) {
    return "입금 기한이 지나 참여가 취소됐을 수 있어요.";
  }

  if (isBidRecordPaymentReady(bid, now)) {
    return `입금 기한까지 ${formatPaymentRemainingTime(
      bid.deadline,
      now,
      bid.paymentDueAt,
      bid.createdAt,
    )}`;
  }

  return isBidRecordClosed(bid, now)
    ? "모집 종료된 분철이에요."
    : "진행 중인 참여예요.";
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

function formatCompactDeadline(value: string) {
  const match = value
    .trim()
    .match(/^\d{4}\D+(\d{1,2})\D+(\d{1,2})(?:\D+(\d{1,2}))?/);

  if (!match) {
    return value;
  }

  const [, month, day, hour] = match;
  const paddedDay = day.padStart(2, "0");

  return hour ? `${Number(month)}.${paddedDay} ${hour.padStart(2, "0")}시` : `${Number(month)}.${paddedDay}`;
}

function getBidRecordShippingAddressLabel(bid: BidRecord) {
  const address = bid.shippingAddress;

  if (!address) {
    return "배송지 확인 중";
  }

  return `${getConvenienceStoreLabel(address.storeType)} ${address.branchName}`;
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
  const cachedPayment = readCachedParticipationPayment(
    participation.participationId,
  );
  const participationStatus =
    participation.participationStatus ||
    cachedPayment?.participationStatus ||
    "";
  const rank =
    participation.closedRank ??
    (isPaymentWaitingParticipationStatus(participationStatus) ? 1 : 0);

  return {
    id: participation.participationId,
    amount: cachedPayment?.bidAmount ?? participation.bidAmount,
    deadline: formatApiDateTime(participation.buncheolDeadline),
    imageUrl:
      participation.thumbnailUrl ??
      getCachedProductImageUrl(participation.buncheolId),
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
    paymentAmount:
      participation.paymentAmount ?? cachedPayment?.paymentAmount ?? null,
    paymentDueAt:
      participation.paymentDueAt ?? cachedPayment?.paymentDueAt ?? null,
    createdAt: participation.createdAt,
    productId: participation.buncheolId,
    participationStatus,
    rank: rank > 0 ? rank : 0,
    shippingAddress:
      participation.shippingAddress ?? cachedPayment?.shippingAddress ?? null,
    shippingFee: participation.shippingFee ?? cachedPayment?.shippingFee ?? null,
    trackingNumber: participation.trackingNumber,
    hostBankAccount:
      participation.hostBankAccount ?? cachedPayment?.hostBankAccount ?? null,
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
  const imageUrl =
    buncheol.thumbnailUrl ?? getCachedProductImageUrl(buncheol.id);

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
    badge: buncheol.status === "RECRUITING" ? "모집중" : buncheol.status === "CONFIRMED" ? "진행확정" : buncheol.status === "CANCELLED" ? "취소" : "모집종료",
    liked: buncheol.bookmarked,
    tone: getToneFromId(buncheol.id),
    courier: "배송 방법 확인 필요",
    deadline: formatApiDateTime(buncheol.deadline),
    description: "",
    imageUrl,
    imageUrls: imageUrl ? [imageUrl] : [],
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
  const shouldRefreshPaymentState = paymentBidRecords.some(
    (bid) =>
      isBidRecordPaymentReady(bid, now) || isBidRecordTransferRequested(bid),
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
  const lockedPaymentDeliveryAddress =
    selectedPaymentBid?.shippingAddress ?? null;
  const paymentDeliveryAddress =
    lockedPaymentDeliveryAddress ??
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

    const filteredRecords = sourceRecords
      .filter((bid) => {
        if (
          filter !== "all" &&
          isCancelledParticipationStatus(bid.participationStatus)
        ) {
          return false;
        }

        if (filter === "payment") {
          return (
            isBidRecordPaymentReady(bid, now) ||
            isBidRecordTransferRequested(bid)
          );
        }

        if (filter === "confirmed") {
          return isBidRecordPaymentConfirmed(bid);
        }

        return true;
      });

    return getGroupedBidRecords(filteredRecords, now)
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

        if (isDeletedProductStatus(product.status)) {
          return false;
        }

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

    if (!selectedBid.hostBankAccount && authState.accessToken) {
      requestParticipationPaymentDetail(authState.accessToken, selectedBid.id)
        .then((paymentDetail) => {
          if (paymentStoreTypeRequestIdRef.current !== requestId) {
            return;
          }

          writeCachedParticipationPayment({
            bidAmount: paymentDetail.bidAmount,
            hostBankAccount: paymentDetail.hostBankAccount,
            participationId: paymentDetail.participationId,
            participationStatus: paymentDetail.paymentStatus,
            paymentAmount: paymentDetail.paymentAmount,
            paymentDueAt: paymentDetail.paymentDueAt,
            shippingAddress: selectedBid.shippingAddress ?? null,
            shippingFee: paymentDetail.shippingFee,
          });

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

    const shouldLoadPaymentBuncheolDetail =
      shouldLoadApiStoreTypes || !selectedBid.hostBankAccount;

    if (shouldLoadPaymentBuncheolDetail) {
      requestBuncheolDetail(
        authState.isLoggedIn ? authState.accessToken ?? undefined : undefined,
        selectedBid.productId,
      )
        .then((detail) => {
          if (paymentStoreTypeRequestIdRef.current !== requestId) {
            return;
          }

          const product = toProductDetailItem(detail);
          setApiBidRecords((current) =>
            current
              ? current.map((bid) =>
                  bid.id === selectedBid.id
                    ? {
                        ...bid,
                        courier: product.courier,
                        hostBankAccount:
                          bid.hostBankAccount ?? detail.hostBankAccount,
                        imageUrl: bid.imageUrl ?? product.imageUrl,
                        shippingMethods:
                          bid.shippingMethods ?? product.shippingMethods,
                      }
                    : bid,
                )
              : current,
          );

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
        <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-[0.95rem] bg-[#f4f5ef] p-1.5 ring-1 ring-black/[0.03]">
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
                  isActive
                    ? "bg-black text-white shadow-[0_8px_18px_rgba(0,0,0,0.12)]"
                    : "text-black/45"
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
              ["payment", "입금 필요"],
              ["confirmed", "확정"],
            ] as const
          ).map(([value, label]) => {
            const isActive = filter === value;

            return (
              <button
                className={`h-8 w-[76px] shrink-0 rounded-full border text-[13px] font-semibold tracking-[-0.04em] ${
                  isActive
                    ? "border-[#CFE86B] bg-[#E4F6A5] text-black shadow-[0_8px_18px_rgba(215,255,95,0.22)]"
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
              ["closed", "모집 종료"],
            ] as const
          ).map(([value, label]) => {
            const isActive = hostedFilter === value;

            return (
              <button
                className={`h-8 w-[76px] shrink-0 rounded-full border text-[13px] font-semibold tracking-[-0.04em] ${
                  isActive
                    ? "border-[#CFE86B] bg-[#E4F6A5] text-black shadow-[0_8px_18px_rgba(215,255,95,0.22)]"
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
              <div className="rounded-[0.95rem] border border-[#E4F6A5]/80 bg-[#F7FAEE] px-4 py-4">
                <p className="text-[14px] font-semibold text-black/45">
                  {historyMessage}
                </p>
              </div>
            ) : null}
            {isBidRecordsLoading ? (
              <BidHistoryListSkeleton />
            ) : records.length === 0 ? (
              <div className="rounded-[0.95rem] border border-[#E4F6A5]/80 bg-[#F7FAEE] px-4 py-6">
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
              const isCancelled = isCancelledParticipationStatus(
                bid.participationStatus,
              );
              const isPaymentExpired = isBidRecordPaymentExpired(bid, now);
              const isPaymentReady = isBidRecordPaymentReady(bid, now);
              const isPaymentConfirmed = isBidRecordPaymentConfirmed(bid);
              const isTransferRequested = isBidRecordTransferRequested(bid);
              const progressSteps = getBidRecordProgressSteps(bid, now);
              const shippingAddressLabel = getBidRecordShippingAddressLabel(bid);
              return (
                <article
                  className="rounded-[1rem] border border-black/[0.08] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.035)] transition-colors hover:bg-[#FBFCF7]"
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
                              ? "bg-[#D7FF5F] text-black shadow-[0_6px_14px_rgba(215,255,95,0.25)]"
                              : "bg-[#f1f1f1] text-black/55"
                          }`}
                        >
                          참여
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-[0.75rem] bg-[#F7FAEE] px-3 py-2 ring-1 ring-[#E4F6A5]/55">
                            <p className="text-[11px] font-medium text-black/35">
                              상품 금액
                            </p>
                            <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em]">
                              {formatPrice(bid.amount)}
                            </p>
                          </div>
                          <div className="rounded-[0.75rem] bg-[#F7FAEE] px-3 py-2 ring-1 ring-[#E4F6A5]/55">
                            <p className="text-[11px] font-medium text-black/35">
                              모집 기한
                            </p>
                            <p className="mt-1 truncate whitespace-nowrap text-[14px] font-semibold tracking-[-0.04em]">
                              {formatCompactDeadline(bid.deadline)}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-[0.75rem] bg-[#F7FAEE] px-3 py-2 ring-1 ring-[#E4F6A5]/55">
                          <p className="text-[11px] font-medium text-black/35">
                            배송지
                          </p>
                          <p className="mt-1 truncate text-[14px] font-semibold tracking-[-0.04em]">
                            {shippingAddressLabel}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[0.8rem] bg-[#F7FAEE] px-3 py-3 ring-1 ring-[#E4F6A5]/50">
                        <div className="relative">
                          <div className="absolute left-[12.5%] right-[12.5%] top-[9px] h-px bg-[#CAD6A0]" />
                          <div className="relative grid grid-cols-4 gap-1">
                            {progressSteps.map((step) => (
                              <div
                                className="flex min-w-0 flex-col items-center gap-1.5"
                                key={step.label}
                              >
                                <span
                                  className={`h-[18px] w-[18px] rounded-full border-2 ${
                                    step.isActive
                                      ? "border-[#CFE86B] bg-[#D7FF5F]"
                                      : "border-[#dedede] bg-white"
                                  }`}
                                />
                                <span
                                  className={`break-keep text-center text-[10px] font-semibold leading-3 ${
                                    step.isActive
                                      ? "text-black"
                                      : "text-black/35"
                                  }`}
                                >
                                  {step.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div
                        className={isPaymentReady ? "mt-4 flex justify-end" : "hidden"}
                      >
                        <div
                          className="hidden"
                        >
                          {isCancelled ? (
                            <p>{getBidRecordPaymentStatusDescription(bid, now)}</p>
                          ) : isClosed ? (
                            isPaymentConfirmed ? (
                              <>
                                <p>{getBidRecordPaymentStatusLabel(bid, now)}</p>
                                <p className="mt-0.5 text-black/45">
                                  {bid.paidAt && bid.paidAt !== "결제 완료"
                                    ? `결제일 ${bid.paidAt}`
                                    : getBidRecordPaymentStatusDescription(
                                        bid,
                                        now,
                                      )}
                                </p>
                              </>
                            ) : isTransferRequested ? (
                              <>
                                <p>{getBidRecordPaymentStatusLabel(bid, now)}</p>
                                <p className="mt-0.5 text-black/45">
                                  {getBidRecordPaymentStatusDescription(bid, now)}
                                </p>
                              </>
                            ) : isPaymentExpired ? (
                              <>
                                <p>{getBidRecordPaymentStatusLabel(bid, now)}</p>
                                <p className="mt-0.5 text-black/45">
                                  {getBidRecordPaymentStatusDescription(bid, now)}
                                </p>
                              </>
                            ) : isPaymentReady ? (
                              <>
                                <p>{getBidRecordPaymentStatusLabel(bid, now)}</p>
                                <p className="mt-0.5 text-black/45">
                                  {getBidRecordPaymentStatusDescription(bid, now)}
                                </p>
                              </>
                            ) : (
                              <p>{getBidRecordPaymentStatusDescription(bid, now)}</p>
                            )
                          ) : isPaymentReady ? (
                            <>
                              <p>{getBidRecordPaymentStatusLabel(bid, now)}</p>
                              <p className="mt-0.5 text-black/45">
                                {getBidRecordPaymentStatusDescription(bid, now)}
                              </p>
                            </>
                          ) : (
                            <p>{getBidRecordPaymentStatusDescription(bid, now)}</p>
                          )}
                        </div>
                        {isPaymentReady ? (
                          <button
                            className="shrink-0 rounded-full bg-black px-3 py-2 text-[13px] font-semibold text-[#D7FF5F] shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
                            onClick={() => openPaymentSheet(bid.id)}
                            type="button"
                          >
                            결제 정보
                          </button>
                        ) : null}
                      </div>
                      {bid.deliveryId && isPaymentConfirmed ? (
                        <div className="mt-3 rounded-[0.75rem] bg-[#F7FAEE] px-3 py-3 ring-1 ring-[#E4F6A5]/50">
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
                              <span className="shrink-0 rounded-full bg-[#E4F6A5] px-3 py-2 text-[12px] font-semibold text-black/65">
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
                <div className="rounded-[0.95rem] border border-[#E4F6A5]/80 bg-[#F7FAEE] px-4 py-4">
                  <p className="text-[14px] font-semibold text-black/45">
                    {hostedMessage}
                  </p>
                </div>
              ) : null}
              {isHostedProductsLoading ? (
                <BidHistoryListSkeleton />
              ) : hostedRecords.length === 0 ? (
                <div className="rounded-[0.95rem] border border-[#E4F6A5]/80 bg-[#F7FAEE] px-4 py-6">
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
                const isCancelled =
                  product.status === "CANCELLED" || product.status === "CANCELED";
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
                    className="rounded-[1rem] border border-black/[0.08] bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.035)] transition-colors hover:bg-[#FBFCF7]"
                    key={product.id}
                  >
                    <Link
                      className="block"
                      href={`/products/${product.id}?from=bids&hosted=true`}
                      onClick={rememberBidHistoryProductEntry}
                    >
                    <div className="flex items-start gap-3">
                      <div
                        className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-[0.9rem] bg-gradient-to-br ${product.tone}`}
                      >
                        {product.imageUrl ? (
                          <Image
                            alt=""
                            className="h-full w-full object-cover"
                            fill
                            sizes="80px"
                            src={product.imageUrl}
                            unoptimized
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-[15px] font-semibold leading-5">
                              {product.title}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                              isClosed
                                ? "bg-[#f3f3f3] text-black/50"
                                : "bg-[#D7FF5F] text-black shadow-[0_6px_14px_rgba(215,255,95,0.25)]"
                            }`}
                          >
                            {isCancelled ? "취소" : isClosed ? "모집 종료" : "모집중"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[13px] font-medium text-black/45">
                          {product.member} · {product.era}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-[#E4F6A5] px-2.5 py-1 text-[12px] font-semibold text-black/70">
                            옵션 {optionCount}개
                          </span>
                          <span className="rounded-full bg-[#F7FAEE] px-2.5 py-1 text-[12px] font-semibold text-black/60 ring-1 ring-[#E4F6A5]/60">
                            참여 {participantCount}명
                          </span>
                          <span className="max-w-full truncate rounded-full bg-[#F7FAEE] px-2.5 py-1 text-[12px] font-semibold text-black/60 ring-1 ring-[#E4F6A5]/60">
                            마감 {product.deadline}
                          </span>
                        </div>
                      </div>
                    </div>
                    </Link>
                    <div className="mt-3 flex justify-end gap-2 border-t border-black/[0.08] pt-3">
                      {product.isApiProduct ? (
                      <Link
                        className="inline-flex h-9 min-w-[88px] items-center justify-center rounded-full bg-black px-4 text-[13px] font-semibold text-[#D7FF5F] shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
                        href={`/products/${product.buncheolId ?? product.id}/manage`}
                        onClick={rememberBidHistoryManageEntry}
                      >
                        관리하기
                      </Link>
                      ) : null}
                      {product.isApiProduct ? (
                        <button
                          className="h-9 rounded-full border border-black/[0.08] bg-white px-4 text-[13px] font-semibold text-black/55 disabled:text-black/25"
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
            aria-label="결제 정보 닫기"
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
                  결제 정보
                </h2>
                <p className="mt-1 text-[13px] font-medium text-black/45">
                  계좌와 금액을 확인한 뒤 기한 내 입금해 주세요.
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

            <div className="mt-3 rounded-[0.9rem] bg-black px-4 py-3 text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
              <p className="text-[12px] font-semibold text-[#D7FF5F]/80">
                현재 상태
              </p>
              <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                {getBidRecordPaymentStatusLabel(selectedPaymentBid, now)}
              </p>
              <p className="mt-1 text-[12px] font-medium leading-5 text-white/60">
                {getBidRecordPaymentStatusDescription(selectedPaymentBid, now)}
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
                  className="h-9 shrink-0 rounded-full bg-black px-3 text-[12px] font-semibold text-[#D7FF5F] disabled:bg-black/10 disabled:text-black/30"
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
                송금 후 관리자가 입금을 확인하면 참여가 확정돼요.
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

            <div className="mt-4 rounded-[0.95rem] border-[1.5px] border-[#DDE7B8] bg-[#F7FAEE] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    {paymentDeliveryAddress ? (
                      <span className="rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-[#D7FF5F]">
                        {getConvenienceStoreLabel(paymentDeliveryAddress.storeType)}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-[#E4F6A5] px-2.5 py-1 text-[11px] font-semibold text-black/65">
                      배송지 고정
                    </span>
                  </div>
                  <p className="mt-2 truncate text-[14px] font-semibold tracking-[-0.04em]">
                    {paymentDeliveryAddress?.branchName ??
                      "결제 요청 배송지 확인 중"}
                  </p>
                </div>
                <span className="inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-white px-3 text-[12px] font-semibold text-black/45">
                  변경 불가
                </span>
              </div>
              <p className="mt-2 text-[12px] font-medium leading-5 text-black/45">
                결제 요청 후 배송지는 변경할 수 없어요.
              </p>
            </div>

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
              className="mt-4 h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-[#D7FF5F] shadow-[0_12px_24px_rgba(0,0,0,0.18)] disabled:bg-black/20 disabled:text-white/70"
              disabled={!selectedPaymentBankAccount}
              onClick={closePaymentSheet}
              type="button"
            >
              확인했어요
            </button>
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
                        ? "border-[#DDE7B8] bg-[#F7FAEE] shadow-[0_8px_18px_rgba(215,255,95,0.14)]"
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
                                ? "bg-black text-[#D7FF5F]"
                                : isDefault
                                ? "bg-black text-[#D7FF5F]"
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
                            ? "bg-black text-[#D7FF5F]"
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
              className="mt-3 h-12 w-full rounded-full bg-black text-[15px] font-semibold text-[#D7FF5F]"
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
