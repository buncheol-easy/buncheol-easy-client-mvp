"use client";

import Link from "next/link";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { MouseEvent } from "react";
import { BusinessFooter } from "@/components/BusinessFooter";
import { CloseIcon, ProfileIcon } from "@/components/icons";
import {
  addressReturnStateKey,
  lastAddedDeliveryAddressIdKey,
  type AddressReturnState,
} from "@/lib/address-return-state";
import {
  clearAuthCookies,
  clearAuthState,
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import { getFreshAccessToken } from "@/lib/auth-session";
import {
  ApiRequestError,
  deleteBuncheol,
  deleteShippingAddress,
  requestBookmarkedBuncheols,
  requestBuncheolDetail,
  requestLogout,
  requestMyHostedBuncheols,
  requestMyParticipations,
  requestParticipationPaymentDetail,
  requestShippingAddresses,
  requestUserProfile,
  updateBankAccount,
  updateShippingAddress,
  toProductDetailItem,
  type BankAccountInfo,
  type MyHostedBuncheol,
  type MyParticipation,
  type UserProfile,
} from "@/lib/auth-api";
import { clearHostedProducts } from "@/lib/hosted-products-store";
import {
  clearSettlementAccountState,
  getInitialSettlementAccountState,
  readSettlementAccountState,
  subscribeSettlementAccountState,
  type SettlementAccountState,
  writeSettlementAccountState,
} from "@/lib/settlement-account-store";
import {
  clearDeliveryAddressState,
  getInitialDeliveryAddressState,
  getDeliveryAddressStateFromSyncedAddresses,
  getDeliveryAddressStateWithDefaultAddress,
  readDeliveryAddressState,
  subscribeDeliveryAddressState,
  type StoredDeliveryAddressState,
  writeDeliveryAddressState,
} from "@/lib/delivery-address-store";
import {
  convenienceStoreTypeLabels,
  getAvailableConvenienceStoreTypes,
  getConvenienceStoreLabel,
  getDeliveryAddressDisplayAlias,
  getDeliveryAddressDisplayBranchName,
  getDefaultDeliveryAddressesByType,
  getPrioritizedDeliveryAddresses,
  type DeliveryAddress,
  type ConvenienceStoreType,
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
const settlementAccountPanelExitMs = 180;
const PRODUCT_PROFILE_ENTRY_INDEX_KEY = "product-profile-entry-index";

function getEmptySettlementAccountState(): SettlementAccountState {
  return {
    accountHolder: "",
    accountNumber: "",
    bankName: "",
  };
}

function sanitizeAccountNumber(value: string) {
  return value.replace(/[^\d-]/g, "");
}

function getDeliveryAddressDeleteErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError && error.status === 409) {
    return "진행 중인 참여에 사용된 배송지는 삭제할 수 없어요.";
  }

  if (
    error instanceof Error &&
    (error.message.includes("USR-030") ||
      error.message.includes(
        "SHIPPING_ADDRESS_DELETE_BLOCKED_BY_ACTIVE_PARTICIPATION",
      ))
  ) {
    return "진행 중인 참여에 사용된 배송지는 삭제할 수 없어요.";
  }

  return error instanceof Error
    ? error.message
    : "배송지를 삭제하지 못했어요.";
}

function getSettlementAccountState(profile: UserProfile | null) {
  const bankAccount = profile?.bankAccount;

  if (!bankAccount) {
    return getEmptySettlementAccountState();
  }

  return {
    accountHolder: bankAccount.holder,
    accountNumber: bankAccount.account,
    bankName: bankAccount.bank,
  };
}

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

function parseHostedDeadline(deadline: string) {
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
const shippingFee = 3200;

type ProfileBidEntry = {
  amount: number;
  buncheolStatus?: string;
  deadline: string;
  id: string;
  imageUrl?: string;
  member: string;
  optionLabel: string;
  optionLabels?: string[];
  paidAt?: string | null;
  payerName?: string;
  participantCount: number;
  paymentAmount?: number | null;
  paymentDueAt?: string | null;
  createdAt?: string | null;
  participationStatus?: string;
  deliveryId?: string | null;
  deliveryStatus?: string | null;
  shippingAddress?: DeliveryAddress | null;
  productId: string;
  rank: number;
  courier?: string;
  shippingFee?: number | null;
  shippingMethods?: ProductDetailItem["shippingMethods"];
  submittedAt: string;
  title: string;
  tone: string;
  trackingNumber?: string | null;
  hostBankAccount?: BankAccountInfo | null;
};

function ProfileListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div
      aria-label="마이페이지 목록을 불러오는 중"
      className="mt-4 space-y-3"
      role="status"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          className="rounded-[1rem] border border-black/10 px-4 py-4"
          key={`profile-list-skeleton-${index}`}
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

function isRecruitingStatus(status: string | undefined) {
  return !status || status === "RECRUITING";
}

function isDeletedProductStatus(status: string | undefined) {
  return status === "DELETED";
}

function isProfileBidClosed(bid: ProfileBidEntry, now: Date) {
  if (bid.buncheolStatus && !isRecruitingStatus(bid.buncheolStatus)) {
    return !isRecruitingStatus(bid.buncheolStatus);
  }

  const deadlineDate = parseDeadline(bid.deadline);

  return (
    !Number.isNaN(deadlineDate.getTime()) &&
    deadlineDate.getTime() <= now.getTime()
  );
}

function isProfileBidPaymentReady(bid: ProfileBidEntry, now: Date) {
  return (
    !isProfileBidPaymentConfirmed(bid) &&
    (isPaymentWaitingParticipationStatus(bid.participationStatus) ||
      (isProfileBidClosed(bid, now) && bid.rank === 1)) &&
    !isProfileBidPaymentExpired(bid, now)
  );
}

function isPaymentWaitingParticipationStatus(status: string | undefined) {
  return status === "AWAITING_PAYMENT" || status === "PENDING_PAYMENT";
}

function isPaymentConfirmedParticipationStatus(status: string | undefined) {
  return status === "CONFIRMED" || status === "PAYMENT_CONFIRMED";
}

function isProfileBidPaymentConfirmed(bid: ProfileBidEntry) {
  return (
    Boolean(bid.paidAt) ||
    isPaymentConfirmedParticipationStatus(bid.participationStatus)
  );
}

function isCancelledParticipationStatus(status: string | undefined) {
  return status === "CANCELLED" || status === "CANCELED";
}

function isProfileBidPaymentExpired(bid: ProfileBidEntry, now: Date) {
  const isPaymentCandidate =
    isPaymentWaitingParticipationStatus(bid.participationStatus) ||
    (isProfileBidClosed(bid, now) && bid.rank === 1);

  if (
    isProfileBidPaymentConfirmed(bid) ||
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

function isProfileBidTransferRequested(bid: ProfileBidEntry) {
  return (
    !isProfileBidPaymentConfirmed(bid) &&
    isTransferPaymentRequestedStatus(bid.participationStatus)
  );
}

function getProfileBidPaymentStatusLabel(bid: ProfileBidEntry, now: Date) {
  if (isCancelledParticipationStatus(bid.participationStatus)) {
    return "취소";
  }

  if (isProfileBidPaymentConfirmed(bid)) {
    return "결제 완료";
  }

  if (isProfileBidTransferRequested(bid)) {
    return "관리자 확인 중";
  }

  if (isProfileBidPaymentExpired(bid, now)) {
    return "결제 만료";
  }

  if (isProfileBidPaymentReady(bid, now)) {
    return "결제 대기";
  }

  return isProfileBidClosed(bid, now) ? "모집 종료" : "참여중";
}

function getProfileBidPaymentStatusDescription(bid: ProfileBidEntry, now: Date) {
  if (isCancelledParticipationStatus(bid.participationStatus)) {
    return "취소된 참여예요.";
  }

  if (isProfileBidPaymentConfirmed(bid)) {
    return "관리자가 입금을 확인했어요.";
  }

  if (isProfileBidTransferRequested(bid)) {
    return "관리자가 입금을 확인하고 있어요.";
  }

  if (isProfileBidPaymentExpired(bid, now)) {
    return "입금 기한이 지나 참여가 취소됐을 수 있어요.";
  }

  if (isProfileBidPaymentReady(bid, now)) {
    return `입금 기한까지 ${formatPaymentRemainingTime(
      bid.deadline,
      now,
      bid.paymentDueAt,
      bid.createdAt,
    )}`;
  }

  return isProfileBidClosed(bid, now)
    ? "모집 종료된 분철이에요."
    : "진행 중인 참여예요.";
}

function shouldKeepProfileDeliveryReachable(bid: ProfileBidEntry) {
  return Boolean(bid.deliveryId && isProfileBidPaymentConfirmed(bid));
}

function getProfileUniqueLabels(labels: string[]) {
  return [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
}

function formatProfileGroupedOptionLabel(labels: string[]) {
  const uniqueLabels = getProfileUniqueLabels(labels);

  if (uniqueLabels.length === 0) {
    return "멤버 확인 필요";
  }

  if (uniqueLabels.length === 1) {
    return uniqueLabels[0];
  }

  return `${uniqueLabels[0]} 외 ${uniqueLabels.length - 1}개`;
}

function getProfileBidOptionLabels(bid: ProfileBidEntry) {
  const optionLabels = getProfileUniqueLabels(
    bid.optionLabels && bid.optionLabels.length > 0
      ? bid.optionLabels
      : [bid.optionLabel],
  );

  return optionLabels.length > 0 ? optionLabels : ["멤버 확인 필요"];
}

function getProfileBidGroupPriority(bid: ProfileBidEntry, now: Date) {
  if (isProfileBidPaymentReady(bid, now) || isProfileBidTransferRequested(bid)) {
    return 4;
  }

  if (shouldKeepProfileDeliveryReachable(bid)) {
    return 3;
  }

  if (isProfileBidPaymentConfirmed(bid)) {
    return 2;
  }

  return isProfileBidClosed(bid, now) ? 1 : 0;
}

function mergeProfileBidEntryGroup(
  groupEntries: ProfileBidEntry[],
  now: Date,
) {
  const sortedEntries = [...groupEntries].sort((left, right) => {
    const progressDiff =
      getProfileBidGroupPriority(right, now) -
      getProfileBidGroupPriority(left, now);

    if (progressDiff !== 0) {
      return progressDiff;
    }

    return right.amount - left.amount;
  });
  const representative =
    sortedEntries.find(
      (bid) =>
        isProfileBidPaymentReady(bid, now) ||
        isProfileBidTransferRequested(bid),
    ) ?? sortedEntries[0];
  const totalAmount = groupEntries.reduce((sum, bid) => sum + bid.amount, 0);
  const paymentAmounts = groupEntries.map((bid) => bid.paymentAmount);
  const hasCompletePaymentAmounts = paymentAmounts.every(
    (amount): amount is number => typeof amount === "number",
  );
  const totalPaymentAmount = hasCompletePaymentAmounts
    ? paymentAmounts.reduce((sum, amount) => sum + amount, 0)
    : groupEntries.length === 1
      ? representative.paymentAmount
      : null;
  const shippingFees = groupEntries.map((bid) => bid.shippingFee);
  const totalShippingFee = shippingFees.every(
    (amount): amount is number => typeof amount === "number",
  )
    ? shippingFees.reduce((sum, amount) => sum + amount, 0)
    : representative.shippingFee;
  const optionLabels = getProfileUniqueLabels(
    groupEntries.flatMap((bid) => bid.optionLabels ?? [bid.optionLabel]),
  );

  return {
    ...representative,
    amount: totalAmount,
    deliveryId:
      representative.deliveryId ??
      groupEntries.find((bid) => bid.deliveryId)?.deliveryId ??
      null,
    deliveryStatus:
      representative.deliveryStatus ??
      groupEntries.find((bid) => bid.deliveryStatus)?.deliveryStatus ??
      null,
    hostBankAccount:
      representative.hostBankAccount ??
      groupEntries.find((bid) => bid.hostBankAccount)?.hostBankAccount ??
      null,
    id: representative.id,
    optionLabel: formatProfileGroupedOptionLabel(
      optionLabels,
    ),
    optionLabels,
    paymentAmount: totalPaymentAmount,
    shippingAddress:
      representative.shippingAddress ??
      groupEntries.find((bid) => bid.shippingAddress)?.shippingAddress ??
      null,
    shippingFee: totalShippingFee ?? null,
    trackingNumber:
      representative.trackingNumber ??
      groupEntries.find((bid) => bid.trackingNumber)?.trackingNumber ??
      null,
  };
}

function getProfileBidGroupKey(bid: ProfileBidEntry) {
  return bid.productId || bid.id;
}

function getGroupedProfileBidEntries(records: ProfileBidEntry[], now: Date) {
  const groups = new Map<string, ProfileBidEntry[]>();

  records.forEach((bid) => {
    const key = getProfileBidGroupKey(bid);
    const group = groups.get(key) ?? [];

    group.push(bid);
    groups.set(key, group);
  });

  return [...groups.values()].map((group) =>
    mergeProfileBidEntryGroup(group, now),
  );
}

function findGroupedProfileBidEntryById(
  groupedEntries: ProfileBidEntry[],
  sourceEntries: ProfileBidEntry[],
  bidId: string | null,
  now: Date,
) {
  if (!bidId) {
    return null;
  }

  const groupedEntry = groupedEntries.find((bid) => bid.id === bidId);

  if (groupedEntry) {
    return groupedEntry;
  }

  const sourceEntry = sourceEntries.find((bid) => bid.id === bidId);

  if (!sourceEntry) {
    return null;
  }

  const groupKey = getProfileBidGroupKey(sourceEntry);
  const groupEntries = sourceEntries.filter(
    (bid) => getProfileBidGroupKey(bid) === groupKey,
  );

  return mergeProfileBidEntryGroup(groupEntries, now);
}

function isProfileHostedProductActive(product: ProductDetailItem, now: Date) {
  if (product.status && !isRecruitingStatus(product.status)) {
    return false;
  }

  const deadlineDate = parseHostedDeadline(product.deadline);

  return (
    Number.isNaN(deadlineDate.getTime()) ||
    deadlineDate.getTime() > now.getTime()
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

function getProfileBidEntryFromParticipation(
  participation: MyParticipation,
): ProfileBidEntry {
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

async function getProfileBidEntryWithShippingData(
  accessToken: string,
  participation: MyParticipation,
): Promise<ProfileBidEntry> {
  const bidEntry = getProfileBidEntryFromParticipation(participation);
  const shouldFetchParticipationDetail =
    isProfileBidPaymentConfirmed(bidEntry) ||
    isProfileBidTransferRequested(bidEntry) ||
    Boolean(bidEntry.deliveryId);
  const [productDetailResult, paymentDetailResult] =
    await Promise.allSettled([
      requestBuncheolDetail(accessToken, bidEntry.productId),
      shouldFetchParticipationDetail
        ? requestParticipationPaymentDetail(accessToken, bidEntry.id)
        : Promise.resolve(null),
    ]);

  let mergedBidEntry = bidEntry;

  if (
    paymentDetailResult.status === "fulfilled" &&
    paymentDetailResult.value
  ) {
    const paymentDetail = paymentDetailResult.value;
    const participationStatus =
      paymentDetail.paymentStatus || mergedBidEntry.participationStatus;

    mergedBidEntry = {
      ...mergedBidEntry,
      deliveryId: mergedBidEntry.deliveryId ?? paymentDetail.deliveryId ?? null,
      deliveryStatus:
        paymentDetail.deliveryStatus ?? mergedBidEntry.deliveryStatus ?? null,
      hostBankAccount:
        mergedBidEntry.hostBankAccount ?? paymentDetail.hostBankAccount,
      paidAt:
        mergedBidEntry.paidAt ??
        (isPaymentConfirmedParticipationStatus(participationStatus)
          ? "결제 완료"
          : null),
      participationStatus,
      paymentAmount:
        mergedBidEntry.paymentAmount ?? paymentDetail.paymentAmount ?? null,
      paymentDueAt:
        mergedBidEntry.paymentDueAt ?? paymentDetail.paymentDueAt ?? null,
      shippingAddress:
        mergedBidEntry.shippingAddress ?? paymentDetail.shippingAddress ?? null,
      shippingFee:
        mergedBidEntry.shippingFee ?? paymentDetail.shippingFee ?? null,
      trackingNumber:
        paymentDetail.trackingNumber ?? mergedBidEntry.trackingNumber ?? null,
    };
  }

  if (productDetailResult.status === "fulfilled") {
    const detail = productDetailResult.value;
    const product = toProductDetailItem(detail);

    return {
      ...mergedBidEntry,
      courier: product.courier,
      hostBankAccount:
        mergedBidEntry.hostBankAccount ?? detail.hostBankAccount,
      imageUrl: mergedBidEntry.imageUrl ?? product.imageUrl,
      shippingMethods: product.shippingMethods,
    };
  }

  return mergedBidEntry;
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

type ProfileContentProps = {
  skipEnterAnimation?: boolean;
};

export const PROFILE_SKIP_ENTER_KEY = "skip-profile-enter-animation";

type AddressSheetMode = "manage" | "select";
export function ProfileContent({
  skipEnterAnimation = false,
}: ProfileContentProps) {
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const [shouldSkipEnterAnimation] = useState(() => {
    if (skipEnterAnimation || typeof window === "undefined") {
      return skipEnterAnimation;
    }

    const shouldSkip =
      window.sessionStorage.getItem(PROFILE_SKIP_ENTER_KEY) === "true";
    window.sessionStorage.removeItem(PROFILE_SKIP_ENTER_KEY);

    return shouldSkip;
  });
  const [selectedPaymentBidId, setSelectedPaymentBidId] = useState<
    string | null
  >(null);
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);
  const [isPaymentSheetEntered, setIsPaymentSheetEntered] = useState(false);
  const [isPaymentSheetClosing, setIsPaymentSheetClosing] = useState(false);
  const addressSyncRequestIdRef = useRef(0);
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
  const storedSettlementAccount = useSyncExternalStore(
    subscribeSettlementAccountState,
    readSettlementAccountState,
    getInitialSettlementAccountState,
  );
  const { addresses: deliveryAddresses, defaultAddressIds } = storedAddressState;
  const [addressSheetMode, setAddressSheetMode] =
    useState<AddressSheetMode>("manage");
  const [isAddressSheetOpen, setIsAddressSheetOpen] = useState(false);
  const [isAddressSheetEntered, setIsAddressSheetEntered] = useState(false);
  const [isAddressSheetClosing, setIsAddressSheetClosing] = useState(false);
  const [isDefaultAddressLoading, setIsDefaultAddressLoading] = useState(false);
  const addressSheetCloseTimerRef = useRef<number | null>(null);
  const paymentStoreTypeRequestIdRef = useRef(0);
  const [manageAddressSnapshot, setManageAddressSnapshot] = useState<
    DeliveryAddress[]
  >([]);
  const [isEditingSettlementAccount, setIsEditingSettlementAccount] =
    useState(false);
  const [isSettlementAccountPanelExiting, setIsSettlementAccountPanelExiting] =
    useState(false);
  const [settlementAccountForm, setSettlementAccountForm] =
    useState<SettlementAccountState>(() => getEmptySettlementAccountState());
  const [isSettlementAccountFormDirty, setIsSettlementAccountFormDirty] =
    useState(false);
  const [settlementAccountMessage, setSettlementAccountMessage] = useState("");
  const [isSavingSettlementAccount, setIsSavingSettlementAccount] =
    useState(false);
  const settlementAccountPanelCloseTimerRef = useRef<number | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isUserProfileLoading, setIsUserProfileLoading] = useState(false);
  const [userProfileMessage, setUserProfileMessage] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [apiBidEntries, setApiBidEntries] = useState<ProfileBidEntry[] | null>(
    null,
  );
  const [apiHostedProducts, setApiHostedProducts] = useState<
    ProductDetailItem[] | null
  >(null);
  const [bookmarkedProductCount, setBookmarkedProductCount] = useState<
    number | null
  >(null);
  const [hostedProductMessage, setHostedProductMessage] = useState("");
  const [deletingHostedProductId, setDeletingHostedProductId] = useState<
    string | null
  >(null);

  const isBidEntriesLoading = authState.isLoggedIn && apiBidEntries === null;
  const isHostedProductsLoading =
    authState.isLoggedIn && apiHostedProducts === null;
  const isBookmarkedProductCountLoading =
    authState.isLoggedIn && bookmarkedProductCount === null;
  const allBids: ProfileBidEntry[] = useMemo(
    () => (authState.isLoggedIn ? apiBidEntries ?? [] : []),
    [apiBidEntries, authState.isLoggedIn],
  );
  const activeBids = useMemo(
    () =>
      allBids.filter((bid) => {
        const isClosed = isProfileBidClosed(bid, now);

        if (isCancelledParticipationStatus(bid.participationStatus)) {
          return false;
        }

        return (
          !isClosed ||
          isProfileBidPaymentReady(bid, now) ||
          isProfileBidTransferRequested(bid) ||
          isProfileBidPaymentConfirmed(bid) ||
          shouldKeepProfileDeliveryReachable(bid)
        );
      }),
    [allBids, now],
  );
  const groupedActiveBids = useMemo(
    () => getGroupedProfileBidEntries(activeBids, now),
    [activeBids, now],
  );
  const shouldRefreshPaymentState = allBids.some(
    (bid) =>
      isProfileBidPaymentReady(bid, now) || isProfileBidTransferRequested(bid),
  );
  const hostedProducts = useMemo(
    () =>
      authState.isLoggedIn && apiHostedProducts
        ? apiHostedProducts.filter((product) =>
            !isDeletedProductStatus(product.status),
          )
        : [],
    [apiHostedProducts, authState.isLoggedIn],
  );
  const settlementAccount = useMemo(
    () => {
      if (!authState.isLoggedIn) {
        return getEmptySettlementAccountState();
      }

      const profileSettlementAccount = getSettlementAccountState(userProfile);
      const hasProfileSettlementAccount =
        profileSettlementAccount.bankName.trim().length > 0 &&
        profileSettlementAccount.accountNumber.trim().length > 0 &&
        profileSettlementAccount.accountHolder.trim().length > 0;

      return hasProfileSettlementAccount
        ? profileSettlementAccount
        : storedSettlementAccount;
    },
    [authState.isLoggedIn, storedSettlementAccount, userProfile],
  );
  const hasSettlementAccount =
    settlementAccount.bankName.trim().length > 0 &&
    settlementAccount.accountNumber.trim().length > 0 &&
    settlementAccount.accountHolder.trim().length > 0;
  const canSaveSettlementAccount =
    settlementAccountForm.bankName.trim().length > 0 &&
    settlementAccountForm.bankName.trim().length <= 50 &&
    settlementAccountForm.accountNumber.trim().length > 0 &&
    settlementAccountForm.accountNumber.replace(/\D/g, "").length <= 50 &&
    settlementAccountForm.accountHolder.trim().length > 0 &&
    settlementAccountForm.accountHolder.trim().length <= 50 &&
    settlementAccountForm.accountNumber.replace(/\D/g, "").length > 0;

  const selectedPaymentBid = findGroupedProfileBidEntryById(
    groupedActiveBids,
    activeBids,
    selectedPaymentBidId,
    now,
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
  const selectedPaymentOptionLabels = selectedPaymentBid
    ? getProfileBidOptionLabels(selectedPaymentBid)
    : [];
  const selectedPaymentStatusLabel = selectedPaymentBid
    ? getProfileBidPaymentStatusLabel(selectedPaymentBid, now)
    : "";
  const selectedPaymentStatusDescription = selectedPaymentBid
    ? getProfileBidPaymentStatusDescription(selectedPaymentBid, now)
    : "";
  const isSelectedPaymentReady = selectedPaymentBid
    ? isProfileBidPaymentReady(selectedPaymentBid, now)
    : false;
  const selectedPaymentRemainingTime = selectedPaymentBid
    ? formatPaymentRemainingTime(
        selectedPaymentBid.deadline,
        now,
        selectedPaymentBid.paymentDueAt,
        selectedPaymentBid.createdAt,
      )
    : "";
  const syncDeliveryAddresses = useCallback(async (
    accessToken: string,
    options: { clearBeforeSync?: boolean } = {},
  ) => {
    const requestId = addressSyncRequestIdRef.current + 1;

    addressSyncRequestIdRef.current = requestId;

    if (options.clearBeforeSync) {
      clearDeliveryAddressState();
    }

    try {
      const addresses = await requestShippingAddresses(accessToken);
      const nextState = getDeliveryAddressStateFromSyncedAddresses(addresses);
      const isLatest = requestId === addressSyncRequestIdRef.current;

      if (isLatest) {
        writeDeliveryAddressState(nextState);
      }

      return { isLatest, nextState };
    } catch (error) {
      if (
        options.clearBeforeSync &&
        requestId === addressSyncRequestIdRef.current
      ) {
        clearDeliveryAddressState();
      }

      throw error;
    }
  }, []);
  const invalidateAddressSyncRequests = useCallback(() => {
    addressSyncRequestIdRef.current += 1;
  }, []);
  const profileDisplayName = authState.isLoggedIn
    ? userProfile?.nickname || (isUserProfileLoading ? "회원 정보 확인 중" : "분철 회원")
    : "로그인이 필요합니다";
  const profileSummaryContent = (
    <>
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-black">
        <ProfileIcon />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[20px] font-semibold tracking-[-0.05em]">
          {profileDisplayName}
        </p>
        {!authState.isLoggedIn ? (
          <p className="mt-1 text-[13px] font-medium text-white/55">
            눌러서 로그인하기
          </p>
        ) : null}
      </div>
    </>
  );

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

      if (settlementAccountPanelCloseTimerRef.current !== null) {
        window.clearTimeout(settlementAccountPanelCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!authState.isLoggedIn || !authState.accessToken) {
      setApiBidEntries([]);
      setApiHostedProducts([]);
      setBookmarkedProductCount(0);
      setHostedProductMessage("");
      return;
    }

    let isActive = true;

    setApiBidEntries(null);
    setApiHostedProducts(null);
    setBookmarkedProductCount(null);
    setHostedProductMessage("");

    async function loadApiProfileLists() {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        if (isActive) {
          setApiBidEntries([]);
          setApiHostedProducts([]);
          setBookmarkedProductCount(0);
        }

        return;
      }

      const [participations, buncheols, bookmarks] = await Promise.allSettled([
        requestMyParticipations(accessToken),
        requestMyHostedBuncheols(accessToken),
        requestBookmarkedBuncheols(accessToken),
      ]);

      if (!isActive) {
        return;
      }

      if (participations.status === "fulfilled") {
        const bidEntries = await Promise.all(
          participations.value.map((participation) =>
            getProfileBidEntryWithShippingData(accessToken, participation),
          ),
        );

        if (!isActive) {
          return;
        }

        setApiBidEntries(bidEntries);
      } else {
        setApiBidEntries([]);
      }

      if (buncheols.status === "fulfilled") {
        setApiHostedProducts(buncheols.value.map(getHostedProductFromBuncheol));
        setHostedProductMessage("");
      } else {
        setApiHostedProducts([]);
      }

      if (bookmarks.status === "fulfilled") {
        setBookmarkedProductCount(bookmarks.value.length);
      } else {
        setBookmarkedProductCount(0);
      }
    }

    loadApiProfileLists().catch(() => {
      if (isActive) {
        setApiBidEntries([]);
        setApiHostedProducts([]);
        setBookmarkedProductCount(0);
      }
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
        const bidEntries = await Promise.all(
          participations.map((participation) =>
            getProfileBidEntryWithShippingData(accessToken, participation),
          ),
        );

        if (isActive) {
          setApiBidEntries(bidEntries);
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
    if (!authState.isLoggedIn || !authState.accessToken) {
      setUserProfile(null);
      setSettlementAccountForm(getEmptySettlementAccountState());
      setIsSettlementAccountFormDirty(false);
      setIsEditingSettlementAccount(false);
      setUserProfileMessage("");
      setSettlementAccountMessage("");
      return;
    }

    let isActive = true;

    setIsUserProfileLoading(true);
    setUserProfileMessage("");

    getFreshAccessToken()
      .then((accessToken) =>
        accessToken ? requestUserProfile(accessToken) : null,
      )
      .then((profile) => {
        if (!isActive) {
          return;
        }

        if (!profile) {
          return;
        }

        setUserProfile(profile);
        const profileSettlementAccount = getSettlementAccountState(profile);
        const hasProfileSettlementAccount =
          profileSettlementAccount.bankName.trim().length > 0 &&
          profileSettlementAccount.accountNumber.trim().length > 0 &&
          profileSettlementAccount.accountHolder.trim().length > 0;

        if (hasProfileSettlementAccount) {
          writeSettlementAccountState(profileSettlementAccount);
        }
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setUserProfileMessage(
          error instanceof Error
            ? error.message
            : "회원 정보를 불러오지 못했어요.",
        );
      })
      .finally(() => {
        if (isActive) {
          setIsUserProfileLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, authState.isLoggedIn]);

  useEffect(() => {
    if (!authState.isLoggedIn || !authState.accessToken) {
      invalidateAddressSyncRequests();
      clearDeliveryAddressState();
      setIsDefaultAddressLoading(false);
      return;
    }

    let isActive = true;

    setIsDefaultAddressLoading(true);

    getFreshAccessToken()
      .then((accessToken) =>
        accessToken
          ? syncDeliveryAddresses(accessToken, { clearBeforeSync: true })
          : null,
      )
      .then(() => {
        // The sync helper commits only if this is still the newest request.
      })
      .catch(() => {})
      .finally(() => {
        if (isActive) {
          setIsDefaultAddressLoading(false);
        }
      });

    return () => {
      isActive = false;
      invalidateAddressSyncRequests();
    };
  }, [
    authState.accessToken,
    authState.isLoggedIn,
    invalidateAddressSyncRequests,
    syncDeliveryAddresses,
  ]);

  useEffect(() => {
    if (isEditingSettlementAccount || isSettlementAccountFormDirty) {
      return;
    }

    setSettlementAccountForm(settlementAccount);
  }, [
    isEditingSettlementAccount,
    isSettlementAccountFormDirty,
    settlementAccount,
  ]);

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

    if (returnState.source !== "profile") {
      return;
    }

    window.sessionStorage.removeItem(addressReturnStateKey);
    const lastAddedAddressId = window.sessionStorage.getItem(
      lastAddedDeliveryAddressIdKey,
    );
    window.sessionStorage.removeItem(lastAddedDeliveryAddressIdKey);

    const returnBid = findGroupedProfileBidEntryById(
      groupedActiveBids,
      activeBids,
      returnState.bidId ?? null,
      now,
    );

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
      setAddressSheetMode("select");
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
  }, [activeBids, defaultAddressIds, deliveryAddresses, groupedActiveBids, now]);

  useEffect(() => {
    if (!isAddressSheetOpen) {
      return;
    }

    window.scrollTo(0, 0);
  }, [isAddressSheetOpen]);

  useLayoutEffect(() => {
    if (!isAddressSheetOpen) {
      return;
    }

    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyInset = body.style.inset;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;

    documentElement.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.inset = "0";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    const scrollContainer = scrollContainerRef.current;
    const previousScrollContainerOverflow = scrollContainer?.style.overflow;
    const previousScrollContainerOverscrollBehavior =
      scrollContainer?.style.overscrollBehavior;

    if (scrollContainer) {
      scrollContainer.style.overflow = "hidden";
      scrollContainer.style.overscrollBehavior = "none";
    }

    return () => {
      documentElement.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.inset = previousBodyInset;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;

      if (scrollContainer) {
        scrollContainer.style.overflow = previousScrollContainerOverflow ?? "";
        scrollContainer.style.overscrollBehavior =
          previousScrollContainerOverscrollBehavior ?? "";
      }

      window.scrollTo(0, scrollY);
    };
  }, [isAddressSheetOpen]);

  useEffect(() => {
    document.body.classList.toggle("is-address-sheet-open", isAddressSheetOpen);

    return () => {
      document.body.classList.remove("is-address-sheet-open");
    };
  }, [isAddressSheetOpen]);

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

  function rememberScrollPosition() {
    if (!scrollContainerRef.current) {
      return;
    }

    window.sessionStorage.setItem(
      "profile-scroll-top",
      String(scrollContainerRef.current.scrollTop),
    );
  }

  function rememberAddressAddReturn() {
    const returnState: AddressReturnState = {
      source: "profile",
      bidId: selectedPaymentBidId,
      addressId: selectedPaymentAddressId ?? paymentDeliveryAddress?.id ?? null,
    };

    window.sessionStorage.removeItem(lastAddedDeliveryAddressIdKey);
    window.sessionStorage.setItem(
      addressReturnStateKey,
      JSON.stringify(returnState),
    );
  }

  function startSettlementAccountEdit() {
    if (settlementAccountPanelCloseTimerRef.current !== null) {
      window.clearTimeout(settlementAccountPanelCloseTimerRef.current);
      settlementAccountPanelCloseTimerRef.current = null;
    }

    setSettlementAccountForm(settlementAccount);
    setIsSettlementAccountFormDirty(false);
    setIsSettlementAccountPanelExiting(false);
    setSettlementAccountMessage("");
    setIsEditingSettlementAccount(true);
  }

  function closeSettlementAccountPanel({
    message = "",
    nextForm = settlementAccount,
  }: {
    message?: string;
    nextForm?: SettlementAccountState;
  } = {}) {
    if (settlementAccountPanelCloseTimerRef.current !== null) {
      window.clearTimeout(settlementAccountPanelCloseTimerRef.current);
    }

    setIsSettlementAccountPanelExiting(true);
    setSettlementAccountForm(nextForm);
    setIsSettlementAccountFormDirty(false);
    setSettlementAccountMessage(message);

    settlementAccountPanelCloseTimerRef.current = window.setTimeout(() => {
      setIsEditingSettlementAccount(false);
      setIsSettlementAccountPanelExiting(false);
      settlementAccountPanelCloseTimerRef.current = null;
    }, settlementAccountPanelExitMs);
  }

  function cancelSettlementAccountEdit() {
    closeSettlementAccountPanel();
  }

  function updateSettlementAccountForm(
    field: keyof SettlementAccountState,
    value: string,
  ) {
    setIsSettlementAccountFormDirty(true);
    setSettlementAccountForm((current) => ({
      ...current,
      [field]: field === "accountNumber" ? sanitizeAccountNumber(value) : value,
    }));
  }

  async function saveSettlementAccount() {
    if (
      !authState.isLoggedIn ||
      !canSaveSettlementAccount ||
      isSavingSettlementAccount
    ) {
      return;
    }

    const nextSettlementAccount = {
      accountHolder: settlementAccountForm.accountHolder.trim(),
      accountNumber: settlementAccountForm.accountNumber.trim(),
      bankName: settlementAccountForm.bankName.trim(),
    };

    setIsSavingSettlementAccount(true);
    setSettlementAccountMessage("");

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        return;
      }

      await updateBankAccount(accessToken, {
        account: nextSettlementAccount.accountNumber.replace(/\D/g, ""),
        bank: nextSettlementAccount.bankName,
        holder: nextSettlementAccount.accountHolder,
      });
      setUserProfile((current) => ({
        email: current?.email ?? "",
        nickname: current?.nickname ?? "",
        phoneNumber: current?.phoneNumber ?? "",
        provider: current?.provider ?? "",
        bankAccount: {
          account: nextSettlementAccount.accountNumber.replace(/\D/g, ""),
          bank: nextSettlementAccount.bankName,
          holder: nextSettlementAccount.accountHolder,
        },
      }));

      writeSettlementAccountState(nextSettlementAccount);
      closeSettlementAccountPanel({
        message: "계좌 정보가 저장됐어요.",
        nextForm: nextSettlementAccount,
      });
    } catch (error) {
      setSettlementAccountMessage(
        error instanceof Error ? error.message : "계좌 정보를 저장하지 못했어요.",
      );
    } finally {
      setIsSavingSettlementAccount(false);
    }
  }

  function openPaymentSheet(bidId: string) {
    if (paymentSheetCloseTimerRef.current !== null) {
      window.clearTimeout(paymentSheetCloseTimerRef.current);
      paymentSheetCloseTimerRef.current = null;
    }

    const requestId = paymentStoreTypeRequestIdRef.current + 1;
    const currentTime = new Date();
    const selectedBid = findGroupedProfileBidEntryById(
      groupedActiveBids,
      activeBids,
      bidId,
      currentTime,
    );

    if (!selectedBid) {
      return;
    }

    if (isProfileBidPaymentExpired(selectedBid, currentTime)) {
      setUserProfileMessage(
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
      prioritizedDeliveryAddresses.some((address) => {
        if (address.id !== current) {
          return false;
        }

        return (
          allowedStoreTypes.length === 0 ||
          allowedStoreTypes.includes(address.storeType)
        );
      })
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

          setApiBidEntries((current) =>
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
          setApiBidEntries((current) =>
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

  function rememberProfileProductEntry(event: MouseEvent<HTMLAnchorElement>) {
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
      window.sessionStorage.removeItem(PRODUCT_PROFILE_ENTRY_INDEX_KEY);
      return;
    }

    window.sessionStorage.setItem(
      PRODUCT_PROFILE_ENTRY_INDEX_KEY,
      String(historyIndex + 1),
    );
  }

  function rememberProfilePanelEntry(event: MouseEvent<HTMLAnchorElement>) {
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
  }

  async function handleDeleteHostedProduct(product: ProductDetailItem) {
    const buncheolId = product.buncheolId ?? product.id;

    if (!authState.isLoggedIn || deletingHostedProductId) {
      return;
    }

    if (!window.confirm("이 분철을 삭제할까요?")) {
      return;
    }

    setDeletingHostedProductId(buncheolId);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        return;
      }

      await deleteBuncheol(accessToken, buncheolId);
      setApiHostedProducts((current) =>
        current
          ? current.filter(
              (item) => (item.buncheolId ?? item.id) !== buncheolId,
            )
          : current,
      );
      setHostedProductMessage("");
    } catch (error: unknown) {
      setHostedProductMessage(
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

  function commitDeliveryAddressState(nextState: StoredDeliveryAddressState) {
    writeDeliveryAddressState(nextState);
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

  function clearUserSessionState() {
    invalidateAddressSyncRequests();
    clearAuthCookies();
    clearAuthState();
    clearDeliveryAddressState();
    clearHostedProducts();
    clearSettlementAccountState();
    setSelectedPaymentBidId(null);
    setSelectedPaymentAddressId(null);
    setManageAddressSnapshot([]);
    setIsEditingSettlementAccount(false);
    setUserProfile(null);
    setSettlementAccountForm(getEmptySettlementAccountState());
    setIsSettlementAccountFormDirty(false);
    window.sessionStorage.removeItem(addressReturnStateKey);
    window.sessionStorage.removeItem(lastAddedDeliveryAddressIdKey);
  }

  async function handleLogout() {
    const accessToken = authState.accessToken;

    try {
      if (accessToken) {
        await requestLogout(accessToken);
      }
    } finally {
      clearUserSessionState();
    }
  }

  function selectPaymentAddress(addressId: string) {
    setSelectedPaymentAddressId(addressId);
  }

  async function setAsDefaultAddress(addressId: string) {
    const selectedAddress = deliveryAddresses.find(
      (address) => address.id === addressId,
    );

    if (!selectedAddress) {
      return;
    }

    if (authState.isLoggedIn) {
      try {
        const accessToken = await getFreshAccessToken();

        if (!accessToken) {
          return;
        }

        await updateShippingAddress(accessToken, selectedAddress.id, {
          alias: selectedAddress.alias,
          branchName: selectedAddress.branchName,
          isDefault: true,
          storeType: selectedAddress.storeType,
        });
        const { isLatest, nextState } = await syncDeliveryAddresses(accessToken);

        if (isLatest) {
          commitDeliveryAddressState(
            getDeliveryAddressStateWithDefaultAddress(nextState, addressId),
          );
        }
      } catch (error) {
        setUserProfileMessage(
          error instanceof Error
            ? error.message
            : "기본 배송지를 변경하지 못했어요.",
        );
      }

      return;
    }

    commitDeliveryAddressState(
      getDeliveryAddressStateWithDefaultAddress(storedAddressState, addressId),
    );
  }

  async function deleteDeliveryAddress(addressId: string) {
    if (deliveryAddresses.length <= 1) {
      return;
    }

    const targetAddress = deliveryAddresses.find(
      (address) => address.id === addressId,
    );

    if (!targetAddress) {
      return;
    }

    if (authState.isLoggedIn) {
      try {
        const accessToken = await getFreshAccessToken();

        if (!accessToken) {
          return;
        }

        await deleteShippingAddress(accessToken, addressId);
        const { isLatest, nextState } = await syncDeliveryAddresses(accessToken);

        if (isLatest && addressId === selectedPaymentAddressId) {
          setSelectedPaymentAddressId(nextState.addresses[0]?.id ?? null);
        }

        if (isLatest && addressSheetMode === "manage") {
          setManageAddressSnapshot(
            getPrioritizedDeliveryAddresses(
              nextState.addresses,
              nextState.defaultAddressIds,
            ),
          );
        }
      } catch (error) {
        setUserProfileMessage(getDeliveryAddressDeleteErrorMessage(error));
      }

      return;
    }

    const nextAddresses = deliveryAddresses.filter(
      (address) => address.id !== addressId,
    );
    const sameTypeAddresses = nextAddresses.filter(
      (address) => address.storeType === targetAddress.storeType,
    );

    commitDeliveryAddressState({
      addresses: nextAddresses,
      defaultAddressIds:
        defaultAddressIds[targetAddress.storeType] === addressId
          ? {
              ...defaultAddressIds,
              [targetAddress.storeType]: sameTypeAddresses[0]?.id ?? null,
            }
          : defaultAddressIds,
    });

    if (addressId === selectedPaymentAddressId) {
      setSelectedPaymentAddressId(nextAddresses[0]?.id ?? null);
    }

    if (addressSheetMode === "manage") {
      setManageAddressSnapshot((snapshot) =>
        snapshot.filter((address) => address.id !== addressId),
      );
    }
  }

  useLayoutEffect(() => {
    const storedScrollTop = window.sessionStorage.getItem("profile-scroll-top");

    if (!storedScrollTop || !scrollContainerRef.current) {
      return;
    }

    scrollContainerRef.current.scrollTop = Number(storedScrollTop);

    if (!skipEnterAnimation) {
      window.sessionStorage.removeItem("profile-scroll-top");
    }
  }, [skipEnterAnimation]);

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${
        shouldSkipEnterAnimation ? "" : "tab-content-enter"
      } relative overflow-hidden`}
    >
      <header className="profile-header shrink-0 px-4 py-3">
        <div className="profile-header__copy flex h-10 flex-col justify-center">
          <p className="profile-header__eyebrow text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-black/35">
            My Page
          </p>
          <h1 className="profile-header__title mt-1 text-[22px] font-semibold leading-none tracking-[-0.06em]">
            마이페이지
          </h1>
        </div>
      </header>

      <main
        className="min-h-0 flex-1 overflow-y-auto bg-[#f7f7f7] px-4 pb-6 pt-4"
        ref={scrollContainerRef}
      >
        <section className="rounded-[1.15rem] bg-black p-4 text-white shadow-[0_18px_42px_rgba(0,0,0,0.18)] ring-1 ring-[#AAB67C]/35">
          {authState.isLoggedIn ? (
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {profileSummaryContent}
              </div>
              <button
                className="h-8 shrink-0 rounded-full bg-white/10 px-3 text-[12px] font-semibold text-white/65"
                onClick={handleLogout}
                type="button"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <Link
              aria-label="로그인이 필요합니다. 로그인 화면으로 이동"
              className="flex items-center gap-3"
              href="/login?returnTo=/profile"
            >
              {profileSummaryContent}
            </Link>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-[0.8rem] bg-white/10 px-3 py-3">
              <p className="text-[11px] font-medium text-[#DDE7B8]">참여중</p>
              <p className="mt-1 text-[19px] font-semibold">
                {isBidEntriesLoading ? (
                  <span className="block h-6 w-8 animate-pulse rounded-full bg-white/20" />
                ) : (
                  activeBids.length
                )}
              </p>
            </div>
            <div className="rounded-[0.8rem] bg-white/10 px-3 py-3">
              <p className="text-[11px] font-medium text-[#DDE7B8]">개최</p>
              <p className="mt-1 text-[19px] font-semibold">
                {isHostedProductsLoading ? (
                  <span className="block h-6 w-8 animate-pulse rounded-full bg-white/20" />
                ) : (
                  hostedProducts.length
                )}
              </p>
            </div>
            <div className="rounded-[0.8rem] bg-white/10 px-3 py-3">
              <p className="text-[11px] font-medium text-[#DDE7B8]">찜</p>
              <p className="mt-1 text-[19px] font-semibold">
                {isBookmarkedProductCountLoading ? (
                  <span className="block h-6 w-8 animate-pulse rounded-full bg-white/20" />
                ) : (
                  bookmarkedProductCount ?? 0
                )}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[1.2rem] border border-black/10 bg-white p-3.5 shadow-[0_14px_34px_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                정산 계좌
              </h2>
              <p className="mt-1 text-[13px] font-medium text-black/45">
                개최한 분철 정산금을 받을 계좌를 입력해 주세요.
              </p>
            </div>
            {authState.isLoggedIn &&
            !isEditingSettlementAccount &&
            !isSettlementAccountPanelExiting ? (
              <button
                className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold ${
                  hasSettlementAccount
                    ? "bg-[#f4f4f4] text-black/55"
                    : "bg-[#CFE86B] text-black shadow-[0_8px_20px_rgba(120,132,82,0.22)]"
                }`}
                onClick={startSettlementAccountEdit}
                type="button"
              >
                {hasSettlementAccount ? "수정" : "등록"}
              </button>
            ) : null}
          </div>

          {!authState.isLoggedIn ? (
            <div className="mt-4 rounded-[0.95rem] bg-[#f7f7f7] px-4 py-6">
              <p className="text-[14px] font-medium text-black/45">
                로그인 후 이용할 수 있어요.
              </p>
            </div>
          ) : isEditingSettlementAccount || isSettlementAccountFormDirty ? (
            <div
              className={`mt-3 rounded-[1rem] bg-[#f7f7f7] px-2 py-2 ${
                isSettlementAccountPanelExiting
                  ? "settlement-account-panel-exit"
                  : "settlement-account-panel-enter"
              }`}
            >
              <div className="grid gap-1.5">
                <label className="block rounded-[0.85rem] bg-white px-3 py-2 ring-1 ring-black/10 transition focus-within:ring-black/35">
                  <span className="text-[12px] font-semibold text-black/45">
                    은행
                  </span>
                  <input
                    className="mt-0.5 h-6 w-full bg-transparent text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25"
                    maxLength={50}
                    onChange={(event) =>
                      updateSettlementAccountForm(
                        "bankName",
                        event.currentTarget.value,
                      )
                    }
                    placeholder="국민은행"
                    value={settlementAccountForm.bankName}
                  />
                </label>
                <label className="block rounded-[0.85rem] bg-white px-3 py-2 ring-1 ring-black/10 transition focus-within:ring-black/35">
                  <span className="text-[12px] font-semibold text-black/45">
                    계좌번호
                  </span>
                  <input
                    className="mt-0.5 h-6 w-full bg-transparent text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25"
                    inputMode="numeric"
                    maxLength={60}
                    onChange={(event) =>
                      updateSettlementAccountForm(
                        "accountNumber",
                        event.currentTarget.value,
                      )
                    }
                    placeholder="000000-00-000000"
                    value={settlementAccountForm.accountNumber}
                  />
                </label>
                <label className="block rounded-[0.85rem] bg-white px-3 py-2 ring-1 ring-black/10 transition focus-within:ring-black/35">
                  <span className="text-[12px] font-semibold text-black/45">
                    예금주
                  </span>
                  <input
                    className="mt-0.5 h-6 w-full bg-transparent text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25"
                    maxLength={50}
                    onChange={(event) =>
                      updateSettlementAccountForm(
                        "accountHolder",
                        event.currentTarget.value,
                      )
                    }
                    placeholder="김분철"
                    value={settlementAccountForm.accountHolder}
                  />
                </label>
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                {hasSettlementAccount ||
                isSettlementAccountFormDirty ||
                isEditingSettlementAccount ? (
                  <button
                    className="h-9 flex-1 rounded-full bg-white text-[14px] font-semibold text-black/55 ring-1 ring-black/10"
                    disabled={isSettlementAccountPanelExiting}
                    onClick={cancelSettlementAccountEdit}
                    type="button"
                  >
                    취소
                  </button>
                ) : null}
                <button
                  className="h-9 flex-1 rounded-full bg-[#CFE86B] text-[14px] font-semibold text-black shadow-[0_8px_20px_rgba(120,132,82,0.2)] disabled:bg-black/20 disabled:text-white"
                  disabled={
                    !canSaveSettlementAccount ||
                    isSavingSettlementAccount ||
                    isSettlementAccountPanelExiting
                  }
                  onClick={saveSettlementAccount}
                  type="button"
                >
                  {isSavingSettlementAccount ? "저장 중" : "저장"}
                </button>
              </div>
            </div>
          ) : hasSettlementAccount ? (
            <div className="mt-4 rounded-[1rem] bg-black px-4 py-4 text-white shadow-[0_16px_36px_rgba(0,0,0,0.16)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white/50">
                    {settlementAccount.bankName}
                  </p>
                  <p className="mt-1 break-all text-[17px] font-semibold tracking-[-0.04em]">
                    {settlementAccount.accountNumber}
                  </p>
                  <p className="mt-1 text-[13px] font-medium text-white/50">
                    예금주 {settlementAccount.accountHolder}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#DDE7B8] px-2.5 py-1 text-[11px] font-semibold text-black">
                  저장됨
                </span>
              </div>
            </div>
          ) : (
            <button
              className="mt-4 flex w-full items-center justify-between rounded-[1rem] border border-dashed border-black/15 bg-[#f8f8f8] px-4 py-5 text-left"
              onClick={startSettlementAccountEdit}
              type="button"
            >
              <span>
                <span className="block text-[14px] font-semibold text-black/70">
                  정산 계좌를 등록해 주세요.
                </span>
                <span className="mt-1 block text-[13px] font-medium text-black/40">
                  등록하면 개최한 분철 정산금을 받을 수 있어요.
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-[#CFE86B] px-3 py-2 text-[12px] font-semibold text-black">
                등록
              </span>
            </button>
          )}

          {settlementAccountMessage ? (
            <p className="mt-3 rounded-full bg-[#f7f7f7] px-3 py-2 text-[13px] font-semibold text-black/45">
              {settlementAccountMessage}
            </p>
          ) : null}
        </section>

        <section className="mt-4 rounded-[1.2rem] border border-black/10 bg-white p-3.5 shadow-[0_14px_34px_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                기본 배송지
              </h2>
              <p className="mt-1 text-[13px] font-medium text-black/45">
                결제할 때 바로 사용할 지점을 확인해요.
              </p>
            </div>
            <Link
              className="shrink-0 rounded-full bg-[#f4f4f4] px-3.5 py-2 text-[13px] font-semibold text-black/55"
              href={
                authState.isLoggedIn
                  ? "/profile/addresses"
                  : "/login?returnTo=/profile/addresses"
              }
              onClick={rememberProfilePanelEntry}
            >
              배송지 관리
            </Link>
          </div>
          <div className="mt-2.5 grid gap-1.5">
            {(["gs25", "cu"] as const).map((storeType) => {
              const address = defaultDeliveryAddresses[storeType];

              return (
                <div
                  className={`rounded-[0.9rem] border px-3.5 py-2.5 ${
                    address
                      ? "border-black/10 bg-[#f7f7f7]"
                      : "border-dashed border-black/15 bg-white"
                  }`}
                  key={storeType}
                >
                  <div className="flex min-h-9 items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-[#DDE7B8] px-2.5 py-1 text-[11px] font-semibold text-black">
                          {convenienceStoreTypeLabels[storeType]}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black/45">
                          {address ? "기본" : "미등록"}
                        </span>
                      </div>
                      <p className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.04em]">
                        {!authState.isLoggedIn ? (
                          "로그인 후 이용할 수 있어요"
                        ) : isDefaultAddressLoading ? (
                          <span className="block h-4 w-32 animate-pulse rounded-full bg-black/10" />
                        ) : (
                          address?.branchName ?? "등록된 배송지가 없어요"
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-6 border-t border-black/10 pt-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                참여 현황
              </h2>
              <p className="mt-1 text-[13px] font-medium text-black/45">
                참여 상태와 결제 진행을 여기서 확인해요.
              </p>
            </div>
            <span className="shrink-0 text-[13px] font-semibold text-black/45">
              {isBidEntriesLoading ? "확인 중" : `${activeBids.length}개`}
            </span>
          </div>

          {isBidEntriesLoading ? (
            <ProfileListSkeleton />
          ) : activeBids.length > 0 ? (
            <div className="mt-4 space-y-3">
              {activeBids.map((bid) => {
                const isPaymentReady = isProfileBidPaymentReady(bid, now);
                const isPaymentConfirmed = isProfileBidPaymentConfirmed(bid);
                const isTransferRequested =
                  isProfileBidTransferRequested(bid);
                return (
                  <article
                    className="rounded-[1rem] border border-black/10 px-4 py-4"
                    key={bid.id}
                  >
                    <div className="flex items-start gap-3">
                      <Link
                        aria-label={`${bid.title} 상세 보기`}
                        className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-[0.85rem] bg-gradient-to-br ${bid.tone}`}
                        href={`/products/${bid.productId}?from=profile`}
                        onClick={rememberProfileProductEntry}
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
                            href={`/products/${bid.productId}?from=profile`}
                            onClick={rememberProfileProductEntry}
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
                                {getProfileBidPaymentStatusLabel(bid, now)}
                              </p>
                            </div>
                          </div>
                          <div className="rounded-[0.75rem] bg-[#f7f7f7] px-3 py-2">
                            <p className="text-[11px] font-medium text-black/35">
                              모집 기한
                            </p>
                            <p className="mt-1 break-keep text-[14px] font-semibold leading-5 tracking-[-0.04em]">
                              {bid.deadline}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div
                            className={`min-w-0 text-[12px] font-medium ${
                              isPaymentReady ||
                              isTransferRequested ||
                              isPaymentConfirmed
                                ? "text-black"
                                : "text-black/35"
                            }`}
                          >
                            <>
                              <p>{getProfileBidPaymentStatusLabel(bid, now)}</p>
                              <p className="mt-0.5 text-black/45">
                                {getProfileBidPaymentStatusDescription(bid, now)}
                              </p>
                            </>
                          </div>
                          {isPaymentReady ? (
                            <button
                              className="shrink-0 rounded-full bg-black px-3 py-2 text-[13px] font-semibold text-white"
                              onClick={() => openPaymentSheet(bid.id)}
                              type="button"
                            >
                              결제 정보
                            </button>
                          ) : null}
                        </div>
                        {bid.deliveryId && isPaymentConfirmed ? (
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
            <div className="mt-4 rounded-[0.95rem] bg-[#f7f7f7] px-4 py-6">
              <p className="text-[14px] font-medium text-black/45">
                {authState.isLoggedIn
                  ? "참여 중인 분철이 없습니다."
                  : "로그인 후 이용할 수 있어요."}
              </p>
            </div>
          )}

        </section>

        <section className="mt-6 border-t border-black/10 pt-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                개최한 분철
              </h2>
              <p className="mt-1 text-[13px] font-medium text-black/45">
                결제 확인과 배송 준비를 이어서 확인해요.
              </p>
            </div>
            <span className="shrink-0 text-[13px] font-semibold text-black/45">
              {isHostedProductsLoading
                ? "확인 중"
                : `${hostedProducts.length}개`}
            </span>
          </div>

          {hostedProductMessage ? (
            <p className="mt-3 rounded-[0.8rem] bg-[#f7f7f7] px-3 py-2 text-[13px] font-semibold text-black/55">
              {hostedProductMessage}
            </p>
          ) : null}

          {isHostedProductsLoading ? (
            <ProfileListSkeleton />
          ) : hostedProducts.length > 0 ? (
            <div className="mt-4 space-y-3">
              {hostedProducts.map((product) => {
                const isClosed = !isProfileHostedProductActive(product, now);
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
                  <div
                    className="rounded-[1rem] border border-black/10 px-4 py-4 transition-colors hover:bg-black/[0.02]"
                    key={product.id}
                  >
                    <Link
                      className="block"
                      href={`/products/${product.id}?from=profile`}
                      onClick={rememberProfileProductEntry}
                    >
                      <article className="flex items-start gap-3">
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
                            {isCancelled ? "취소" : isClosed ? "모집 종료" : "모집중"}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
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
                          <div className="rounded-[0.75rem] bg-[#f7f7f7] px-3 py-2">
                            <p className="text-[11px] font-medium text-black/35">
                              상태
                            </p>
                            <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em]">
                              {isCancelled ? "취소" : isClosed ? "모집 종료" : "진행 중"}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 truncate text-[12px] font-medium text-black/40">
                          모집 기한 {product.deadline}
                        </p>
                      </div>
                      </article>
                    </Link>
                    <div className="mt-4 flex justify-end gap-2 border-t border-black/10 pt-4">
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
                          onClick={() => void handleDeleteHostedProduct(product)}
                          type="button"
                        >
                          삭제
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : authState.isLoggedIn ? (
            <Link
              className="mt-4 block rounded-[0.95rem] border border-dashed border-black/15 bg-[#f7f7f7] px-4 py-6"
              href="/upload"
            >
              <p className="text-[14px] font-semibold text-black/70">
                개최한 분철이 없습니다.
              </p>
              <p className="mt-1 text-[13px] font-medium text-black/40">
                상품 등록으로 첫 분철을 열어보세요.
              </p>
            </Link>
          ) : (
            <div className="mt-4 rounded-[0.95rem] bg-[#f7f7f7] px-4 py-6">
              <p className="text-[14px] font-medium text-black/45">
                로그인 후 이용할 수 있어요.
              </p>
            </div>
          )}
        </section>

        {authState.isLoggedIn ? (
          <Link
            className="mt-4 block rounded-[1.2rem] border border-black/10 bg-white p-4 shadow-[0_14px_34px_rgba(0,0,0,0.04)]"
            href="/profile/account"
            onClick={rememberScrollPosition}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold tracking-[-0.04em] text-black/70">
                  회원 정보
                </h2>
                <p className="mt-1 truncate text-[13px] font-medium text-black/40">
                  닉네임, 로그인 계정 관리
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[#f4f4f4] px-3.5 py-2 text-[12px] font-semibold text-black/45">
                수정
              </span>
            </div>
            {userProfileMessage ? (
              <p className="mt-2 text-[13px] font-semibold text-black/45">
                {userProfileMessage}
              </p>
            ) : null}
          </Link>
        ) : null}
        <div className="relative -mx-4 -mb-6 mt-6 bg-[#f7f7f7]">
          <BusinessFooter variant="compact" />
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
                className="motion-icon-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
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
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedPaymentOptionLabels.map((optionLabel) => (
                  <span
                    className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold tracking-[-0.04em] text-black/65"
                    key={optionLabel}
                  >
                    {optionLabel}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-3 rounded-[0.9rem] bg-black px-4 py-3 text-white ring-1 ring-[#AAB67C]/35">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-semibold text-[#DDE7B8]">
                  {isSelectedPaymentReady ? "입금 마감까지" : "현재 상태"}
                </p>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70">
                  {selectedPaymentStatusLabel}
                </span>
              </div>
              <p className="mt-1 text-[24px] font-semibold tracking-[-0.06em]">
                {isSelectedPaymentReady
                  ? selectedPaymentRemainingTime
                  : selectedPaymentStatusLabel}
              </p>
              <p className="mt-1 text-[12px] font-medium leading-5 text-white/60">
                {isSelectedPaymentReady
                  ? "기한 안에 아래 계좌로 입금해 주세요."
                  : selectedPaymentStatusDescription}
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
                  className="h-9 shrink-0 rounded-full bg-[#DDE7B8] px-3 text-[12px] font-semibold text-black shadow-[0_8px_20px_rgba(120,132,82,0.18)] disabled:bg-black/10 disabled:text-black/30"
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
                    className="soft-panel-enter rounded-full bg-[#DDE7B8] px-4 py-3 text-center text-[12px] font-semibold tracking-[-0.04em] text-black shadow-[0_12px_28px_rgba(120,132,82,0.2)]"
                    role="status"
                  >
                    {paymentCopyToast}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-3 rounded-[0.85rem] border border-[#DDE7B8] bg-[#F7FAEE] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    {paymentDeliveryAddress ? (
                      <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold text-[#D7FF5F]">
                        {getConvenienceStoreLabel(paymentDeliveryAddress.storeType)}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-[#E4F6A5] px-2 py-0.5 text-[10px] font-semibold text-black/55">
                      배송지 고정
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-[13px] font-semibold tracking-[-0.04em]">
                    {paymentDeliveryAddress?.branchName ??
                      "결제 요청 배송지 확인 중"}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-black/40">
                  변경 불가
                </span>
              </div>
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
              className="mt-4 h-14 w-full rounded-full bg-[#CFE86B] text-[17px] font-semibold tracking-[-0.04em] text-black shadow-[0_12px_28px_rgba(120,132,82,0.24)] disabled:bg-black/20 disabled:text-white/70"
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
            aria-label={
              addressSheetMode === "manage"
                ? "배송지 관리 닫기"
                : "다른 배송지 선택 닫기"
            }
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
                  {addressSheetMode === "manage"
                    ? "배송지 관리"
                    : "다른 배송지 선택"}
                </h2>
                <p className="mt-1 text-[13px] font-medium text-black/45">
                  {addressSheetMode === "manage"
                    ? "배송지를 추가하고 기본 배송지를 설정해요."
                    : "이번 결제에 사용할 배송지를 골라 주세요."}
                </p>
              </div>
              <button
                aria-label="닫기"
                className="motion-icon-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
                onClick={closeAddressSheet}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>

            <div
              className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pb-4 pr-1"
              style={{
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
              }}
            >
              {(
                addressSheetMode === "select"
                  ? eligiblePaymentAddresses
                  : manageAddressSnapshot
              ).map((address) => {
                const displayAlias = getDeliveryAddressDisplayAlias(address);
                const displayBranchName =
                  getDeliveryAddressDisplayBranchName(address);
                const isDefault =
                  address.id === defaultAddressIds[address.storeType];
                const isSelected =
                  address.id ===
                  (selectedPaymentAddressId ?? paymentDeliveryAddress?.id);

                return (
                  <div
                    className={`w-full rounded-[0.9rem] border-[1.5px] px-3.5 py-2.5 text-left transition-colors ${
                      addressSheetMode === "select"
                        ? isSelected
                          ? "border-[#C8D4A5] bg-[#F3F5EA]"
                          : "border-[#ededed] bg-white"
                        : isDefault
                        ? "border-[#C8D4A5] bg-[#F3F5EA]"
                        : "border-[#ededed] bg-white"
                    }`}
                    key={address.id}
                    onKeyDown={(event) => {
                      if (event.currentTarget !== event.target) {
                        return;
                      }

                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (addressSheetMode === "manage") {
                          setAsDefaultAddress(address.id);
                        } else {
                          selectPaymentAddress(address.id);
                        }
                      }
                    }}
                    onClick={() => {
                      if (addressSheetMode === "manage") {
                        setAsDefaultAddress(address.id);
                        return;
                      }

                      selectPaymentAddress(address.id);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1 pr-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              addressSheetMode === "select"
                                ? isSelected
                                  ? "bg-[#DDE7B8] text-black"
                                  : isDefault
                                  ? "bg-[#DDE7B8] text-black"
                                  : "bg-white text-black/45"
                                : isDefault
                                ? "bg-[#DDE7B8] text-black"
                                : "bg-white text-black/45"
                            }`}
                          >
                            {getConvenienceStoreLabel(address.storeType)}
                          </span>
                          {displayAlias ? (
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                "bg-black/10 text-black/60"
                              }`}
                            >
                              {displayAlias}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 truncate text-[14px] font-semibold tracking-[-0.04em]">
                          {displayBranchName}
                        </p>
                      </div>
                      {addressSheetMode === "select" ? (
                        <span
                        className={`inline-flex h-8 w-[4.25rem] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                          isSelected
                            ? "bg-[#DDE7B8] text-black"
                            : "bg-white text-black/45"
                        }`}
                        >
                          {isSelected ? "선택됨" : "선택"}
                        </span>
                      ) : isDefault ? (
                        <div className="flex w-[8.3rem] shrink-0 items-center justify-end gap-2">
                          <span className="inline-flex h-8 items-center rounded-full bg-[#DDE7B8] px-2.5 text-[12px] font-semibold text-black transition-colors duration-300 ease-out">
                            기본
                          </span>
                        </div>
                      ) : (
                        <div className="flex w-[8.3rem] shrink-0 items-center justify-end gap-2">
                          <button
                            className="h-8 rounded-full bg-white px-2.5 text-[12px] font-semibold text-black/55 ring-1 ring-black/10 transition-colors duration-300 ease-out"
                            onClick={(event) => {
                              event.stopPropagation();
                              setAsDefaultAddress(address.id);
                            }}
                            type="button"
                          >
                            기본 설정
                          </button>
                          <button
                            aria-label={`${getConvenienceStoreLabel(address.storeType)} ${address.branchName} 배송지 삭제`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-black/35 ring-1 ring-black/10 transition-colors duration-300 ease-out"
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteDeliveryAddress(address.id);
                            }}
                            type="button"
                          >
                            <CloseIcon />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {addressSheetMode === "select" && eligiblePaymentAddresses.length === 0 ? (
                <div className="rounded-[0.95rem] border border-dashed border-black/12 bg-[#f7f7f7] px-4 py-5 text-center text-[14px] font-medium text-black/45">
                  선택 가능한 배송지가 없어요.
                </div>
              ) : null}

              {/*
                <div
                  className="idol-selection-enter rounded-[0.95rem] border-[1.5px] border-[#ededed] bg-[#f7f7f7] px-5 pb-4 pt-5"
                  key="address-form"
                >
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold tracking-[-0.04em]">
                        새 배송지 추가
                      </p>
                      <button
                        className="text-[12px] font-semibold text-black/35"
                        disabled={!isAddressFormOpen}
                        onClick={() => {
                          setIsAddressFormOpen(false);
                          resetNewAddressDraft();
                        }}
                        type="button"
                      >
                        닫기
                      </button>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-[0.8rem] bg-white/80 p-1">
                      {convenienceStoreTypes.map((storeType) => (
                        <button
                          className={`h-9 rounded-[0.65rem] text-[13px] font-semibold transition-colors duration-300 ease-out ${
                            newAddressStoreType === storeType
                              ? "bg-black text-white"
                              : "text-black/45"
                          }`}
                          key={storeType}
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          onTouchStart={(event) => {
                            event.preventDefault();
                          }}
                          disabled={!isAddressFormOpen}
                          onClick={() => setNewAddressStoreType(storeType)}
                          type="button"
                        >
                          {convenienceStoreTypeLabels[storeType]}
                        </button>
                      ))}
                    </div>
                    <input
                      className="mt-2 h-9 w-full rounded-[0.65rem] bg-white px-3 text-[13px] font-medium outline-none placeholder:text-black/30"
                      disabled={!isAddressFormOpen}
                      onChange={(event) => setNewAddressAlias(event.target.value)}
                      onFocus={() => {
                        setIsAddressInputFocused(true);
                      }}
                      onBlur={() => {
                        window.setTimeout(() => {
                          const activeElement = document.activeElement;
                          if (
                            activeElement instanceof HTMLInputElement &&
                            addressListRef.current?.contains(activeElement)
                          ) {
                            return;
                          }
                          setIsAddressInputFocused(false);
                        }, 0);
                      }}
                      placeholder="별칭 (예: 집, 회사)"
                      style={{ scrollMarginBottom: "6rem" }}
                      value={newAddressAlias}
                    />
                    <input
                      className="mt-2 h-9 w-full rounded-[0.65rem] bg-white px-3 text-[13px] font-medium outline-none placeholder:text-black/30"
                      disabled={!isAddressFormOpen}
                      onChange={(event) =>
                        setNewAddressBranchName(event.target.value)
                      }
                      onFocus={() => {
                        setIsAddressInputFocused(true);
                      }}
                      onBlur={() => {
                        window.setTimeout(() => {
                          const activeElement = document.activeElement;
                          if (
                            activeElement instanceof HTMLInputElement &&
                            addressListRef.current?.contains(activeElement)
                          ) {
                            return;
                          }
                          setIsAddressInputFocused(false);
                        }, 0);
                      }}
                      placeholder="편의점 지점명"
                      style={{ scrollMarginBottom: "1rem" }}
                      value={newAddressBranchName}
                    />
                    <button
                      className="mt-3 h-9 w-full rounded-full bg-black text-[13px] font-semibold text-white disabled:bg-black/20"
                      disabled={!isAddressFormOpen || !newAddressBranchName.trim()}
                      onClick={addDeliveryAddress}
                      type="button"
                    >
                      배송지 추가
                    </button>
                  </div>
              ) : (
                <div
                  className="idol-selection-enter"
                  key="address-add-button"
                >
                  <Link
                    className="flex h-[4.25rem] w-full items-center justify-center rounded-[0.95rem] border-[1.5px] border-[#ededed] bg-white text-[14px] font-semibold text-black/45"
                    href="/profile/addresses"
                  >
                    + 새 배송지 추가
                  </Link>
                </div>
              )}

              */}
              <div className="idol-selection-enter" key="address-add-link">
                <Link
                  className="flex h-14 w-full items-center justify-center rounded-[0.9rem] border border-dashed border-black/15 bg-[#f7f7f7] text-[14px] font-semibold text-black/45"
                  href="/profile/addresses?openAdd=1&returnTo=profile"
                  onNavigate={rememberAddressAddReturn}
                >
                  + 새 배송지 추가
                </Link>
              </div>
            </div>

            {addressSheetMode === "select" ? (
              <button
                className="mt-3 h-12 w-full rounded-full bg-black text-[15px] font-semibold text-white"
                onClick={closeAddressSheet}
                type="button"
              >
                이 배송지로 받기
              </button>
            ) : null}
          </section>
        </div>
      ) : null}

    </div>
  );
}
