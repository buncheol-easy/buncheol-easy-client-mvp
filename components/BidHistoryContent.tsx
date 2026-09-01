"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { MouseEvent } from "react";
import {
  BanknoteIcon,
  CheckIcon,
  ClipboardListIcon,
  CloseIcon,
  PackageCheckIcon,
  TruckIcon,
  UsersRoundIcon,
} from "@/components/icons";
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
import { EmptyState } from "@/components/EmptyState";
import { createLoginHref } from "@/lib/auth-navigation";
import { useScrollDirectionHidden } from "@/lib/use-scroll-direction-hidden";
import { getFreshAccessToken } from "@/lib/auth-session";
import {
  cancelParticipation,
  deleteBuncheol,
  getShippingMethodsFromOptions,
  requestBuncheolDetail,
  requestMyHostedBuncheols,
  requestMyParticipations,
  requestParticipationPaymentDetail,
  requestBundlePaymentSent,
  requestParticipationPaymentSent,
  toProductDetailItem,
  type BankAccountInfo,
  type MyHostedBuncheol,
  type MyParticipation,
  type ShippingFeePaybackInfo,
} from "@/lib/auth-api";
import {
  getBuncheolStatusBadgeLabel,
  getFlowType,
  isBuncheolCancelledStatus,
  isBuncheolConfirmedStatus,
  isBuncheolDeletedStatus,
  isBuncheolHostCancelledStatus,
  isBuncheolPaymentCollectingStatus,
  isBuncheolRecruitingStatus,
  isDeliveryCompletedStatus,
  isDeliveryShippingStatus,
  isParticipationAppliedStatus,
  isParticipationAwaitingPaymentStatus,
  isParticipationCancelledStatus,
  isParticipationConfirmedStatus,
  isParticipationPaymentSentStatus,
  isUserCancelledReason,
  USER_CANCELLED_REASON,
} from "@/lib/buncheol-states";
import { FEATURES } from "@/lib/feature-flags";
import { getHistoryIndex } from "@/lib/history-index";
import { getSafeOpenChatHref } from "@/lib/open-chat-url";
import {
  formatPaybackDeadlineNotice,
  PAYBACK_CTA_LABEL,
  PAYBACK_EDIT_CTA_LABEL,
  PAYBACK_EVENT_BLOCK_LABEL,
  PAYBACK_RETRY_CTA_LABEL,
  PAYBACK_STATUS_LABELS,
} from "@/lib/shipping-fee-payback";
import { ShippingFeePaybackSheet } from "@/components/ShippingFeePaybackSheet";
import {
  getAvailableConvenienceStoreTypes,
  getConvenienceStoreLabel,
  getDefaultDeliveryAddressesByType,
  getDeliveryAddressDisplayBranchName,
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
import { SlidingFilterChips, SlidingTabs } from "@/components/SlidingTabs";
import {
  ConfirmSheet,
  type ConfirmSheetRequest,
} from "@/components/ConfirmSheet";

function formatPrice(price: number) {
  return `${price.toLocaleString("ko-KR")}원`;
}

const kstOffsetHours = 9;
const paymentDeadlineMinutes = 30;
// C2C 입금 창 — 성사 확정 후 24시간 (docs/46 §7.1-3). 카운트다운 상한 보정에 쓴다.
const c2cPaymentWindowMs = 24 * 60 * 60_000;
const PRODUCT_BID_HISTORY_ENTRY_INDEX_KEY = "product-bid-history-entry-index";
const BID_HISTORY_SCROLL_TOP_KEY = "bid-history-scroll-top";
const BID_HISTORY_VIEW_STATE_KEY = "bid-history-view-state";
export const BID_HISTORY_OPEN_PAYMENT_ID_KEY = "bid-history-open-payment-id";

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

// KST 달력 기준 날짜 차이 (마감일 - 오늘). 0 이면 오늘 마감.
function getKstDayDifference(deadlineDate: Date, now: Date) {
  const dayMs = 86_400_000;
  const kstOffsetMs = kstOffsetHours * 3_600_000;
  const deadlineDay = Math.floor(
    (deadlineDate.getTime() + kstOffsetMs) / dayMs,
  );
  const nowDay = Math.floor((now.getTime() + kstOffsetMs) / dayMs);

  return deadlineDay - nowDay;
}

function getPaymentDeadlineDate(
  deadline: string,
  paymentDueAt?: string | null,
  createdAt?: string | null,
  isC2C = false,
) {
  // C2C 는 기한이 서버 일괄 산정값(paymentDueAt) 하나뿐이다 — 선점+30분 폴백을 적용하면
  // 확정 전(기한 없음) 참여를 만료로 오판하므로, 값이 없으면 "기한 없음"(NaN)으로 둔다.
  if (isC2C) {
    return paymentDueAt ? new Date(paymentDueAt) : new Date(Number.NaN);
  }

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
  isC2C = false,
) {
  const paymentDeadline = getPaymentDeadlineDate(
    deadline,
    paymentDueAt,
    createdAt,
    isC2C,
  );

  if (Number.isNaN(paymentDeadline.getTime())) {
    return "입금 기한 확인 필요";
  }

  return formatRemainingTimeFromDate(paymentDeadline, now);
}

// 결제 정보 시트의 실시간 카운트다운 표기. 분철 상세와 동일하게 서버·클라이언트
// 시계 오차로 남은 시간이 입금 창(LEGACY 30분 / C2C 24시간)을 초과해 보이지 않도록
// 상한을 걸고, 진행 중인 초를 포함해 올림으로 표시한다.
function formatPaymentCountdown(
  deadline: string,
  now: Date,
  paymentDueAt?: string | null,
  createdAt?: string | null,
  isC2C = false,
) {
  const paymentDeadline = getPaymentDeadlineDate(
    deadline,
    paymentDueAt,
    createdAt,
    isC2C,
  );

  if (Number.isNaN(paymentDeadline.getTime())) {
    return "입금 기한 확인 필요";
  }

  const paymentWindowMs = isC2C
    ? c2cPaymentWindowMs
    : paymentDeadlineMinutes * 60_000;
  const remainingMilliseconds = Math.min(
    paymentDeadline.getTime() - now.getTime(),
    paymentWindowMs,
  );

  if (remainingMilliseconds <= 0) {
    return "기한 지남";
  }

  const totalSeconds = Math.ceil(remainingMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}시간 ${minutes.toString().padStart(2, "0")}분 남았어요`;
  }

  if (minutes > 0) {
    return `${minutes}분 ${seconds.toString().padStart(2, "0")}초 남았어요`;
  }

  return `${seconds}초 남았어요`;
}
type BidHistoryMode = "joined" | "hosted";
type BidHistoryFilter = "all" | "payment" | "confirmed";
type HostedHistoryFilter = "all" | "active" | "closed";
type BidHistoryViewState = {
  filter?: BidHistoryFilter;
  hostedFilter?: HostedHistoryFilter;
  mode?: BidHistoryMode;
};

// "진행 확정"은 내 입금·배송 축이 아니라 분철 축(마감 때 최소 인원 충족) 단계지만,
// 참여자 입장에서는 입금 확인 다음에 기다리는 관문이라 하나의 여정으로 묶어 보여준다.
//
// 단계 이름은 "입금"으로 통일한다 — 서비스의 다른 곳(입금 총액·입금 확인·"입금 필요" 필터,
// 그리고 아래 C2C 진행바)이 전부 "입금"인데 여기만 "결제"라, 같은 목록을 스크롤하다
// 두 벌의 단어를 만나게 된다. 5단계 vs 6단계 차이는 C2C 에 무입금 "신청" 단계가
// 실제로 하나 더 있어서이므로 그대로 둔다.
const bidProgressStepLabels = [
  "입금 대기",
  "입금 확인",
  "진행 확정",
  "배송 중",
  "배송 완료",
] as const;

// C2C 진행바 — 신청(무입금) 단계가 추가된 6단계 (docs/48 §6.2).
const c2cProgressStepLabels = [
  "신청",
  "입금 대기",
  "입금 확인",
  "진행 확정",
  "배송 중",
  "배송 완료",
] as const;

// 0원 참여는 입금 단계를 거치지 않는다 — 앞 두 단계만 참여 축으로 갈아끼우고 이후는 공용 라벨을 쓴다.
const freeProgressStepLabels = [
  "참여 접수",
  "참여 확정",
  ...bidProgressStepLabels.slice(2),
] as const;

// 라벨은 진행바(bidProgressStepLabels / c2cProgressStepLabels)와 같은 문자열을 재사용한다 —
// 두 곳이 어긋나면 안내 시트와 진행바가 서로 다른 단계 이름을 보여주게 된다.
//
// 안내가 두 벌인 이유: 입금 시점이 달라(LEGACY 즉시 30분 / C2C 확정 뒤 24시간) 한 벌로 합치면
// 한쪽이 반드시 오안내가 된다.
type StatusGuideItem = {
  icon: typeof BanknoteIcon;
  label: string;
  description: string;
};

const c2cParticipationStatusGuide = [
  {
    icon: ClipboardListIcon,
    label: c2cProgressStepLabels[0],
    description:
      "원하는 멤버 자리를 잡아둔 단계예요. 아직 입금하지 않아요 — 개최자가 성사를 확정하면 알림톡으로 입금 안내를 보내드려요.",
  },
  {
    icon: BanknoteIcon,
    label: c2cProgressStepLabels[1],
    // 재확인 요청은 이 단계에서만 일어난다 — 반려된 참여도 카드·진행바에선 여기 머문다.
    description:
      "성사가 확정돼 입금할 차례예요. 안내된 24시간 안에 개최자 계좌로 보내고, 송금 뒤 '보냈어요'를 꼭 눌러주세요. 개최자가 입금 내역을 못 찾으면 재확인을 요청하고, 이때 기한이 24시간 연장돼요.",
  },
  {
    icon: CheckIcon,
    label: c2cProgressStepLabels[2],
    description:
      "개최자가 입금을 확인한 상태예요. 이제 진행 확정을 기다리면 돼요.",
  },
  {
    icon: UsersRoundIcon,
    label: c2cProgressStepLabels[3],
    description:
      "입금이 확인된 참여자로 분철 진행이 확정된 상태예요. 개최자가 굿즈를 준비해 배송을 시작해요.",
  },
  {
    icon: TruckIcon,
    label: c2cProgressStepLabels[4],
    description:
      "개최자가 내가 지정한 배송지로 택배를 보냈고, 운송장이 등록된 상태예요.",
  },
  {
    icon: PackageCheckIcon,
    label: c2cProgressStepLabels[5],
    description: "택배가 선택한 편의점에 도착해 수령까지 끝났어요.",
  },
] as const satisfies readonly StatusGuideItem[];

// 0원 참여(서포터즈 코드) 전용 안내. 진행바를 freeProgressStepLabels(5칸) 축으로 가른 이상
// 시트도 같이 갈라야 한다 — 안 그러면 입금할 게 없는 사람에게 "24시간 안에 개최자 계좌로
// 보내고 '보냈어요'를 눌러주세요" 가 뜬다.
const freeParticipationStatusGuide = [
  {
    icon: ClipboardListIcon,
    label: freeProgressStepLabels[0],
    description:
      "받은 코드로 자리를 잡은 단계예요. 입금할 금액이 없어 따로 보낼 돈은 없어요.",
  },
  {
    icon: CheckIcon,
    label: freeProgressStepLabels[1],
    description:
      "참여가 확정된 상태예요. 입금 절차 없이 진행 확정을 기다리면 돼요.",
  },
  {
    icon: UsersRoundIcon,
    label: freeProgressStepLabels[2],
    description:
      "분철 진행이 확정된 상태예요. 개최자가 굿즈를 준비해 배송을 시작해요.",
  },
  {
    icon: TruckIcon,
    label: freeProgressStepLabels[3],
    description:
      "개최자가 내가 지정한 배송지로 택배를 보냈고, 운송장이 등록된 상태예요.",
  },
  {
    icon: PackageCheckIcon,
    label: freeProgressStepLabels[4],
    description: "택배가 선택한 편의점에 도착해 수령까지 끝났어요.",
  },
] as const satisfies readonly StatusGuideItem[];

const legacyParticipationStatusGuide = [
  {
    icon: BanknoteIcon,
    label: bidProgressStepLabels[0],
    description:
      "참여 후 30분 안에 꼭 입금해야 하는 단계예요. 계좌번호는 입금 정보 버튼에서 확인할 수 있어요.",
  },
  {
    icon: CheckIcon,
    label: bidProgressStepLabels[1],
    description:
      "관리자가 입금을 확인한 상태예요. 마감 때 최소 인원이 모이면 진행 확정으로 바뀌어요.",
  },
  {
    icon: UsersRoundIcon,
    label: bidProgressStepLabels[2],
    description:
      "최소 인원이 모여 분철 진행이 확정된 상태예요. 굿즈 준비 후 배송이 시작돼요.",
  },
  {
    icon: TruckIcon,
    label: bidProgressStepLabels[3],
    description:
      "내가 지정한 배송지로 택배가 발송돼 운송장이 등록된 상태예요.",
  },
  {
    icon: PackageCheckIcon,
    label: bidProgressStepLabels[4],
    description: "택배가 선택한 편의점에 도착해 수령까지 끝났어요.",
  },
] as const satisfies readonly StatusGuideItem[];

// 개최 탭 안내. 회원 개최는 서버가 C2C 로 강제하므로 한 벌만 둔다.
const hostingStatusGuide = [
  {
    icon: ClipboardListIcon,
    label: "신청 모으기",
    description:
      "모집 기한까지 신청이 쌓여요. 이 동안에는 아무도 입금하지 않고, 신청자와 배송지는 '관리하기'에서 볼 수 있어요.",
  },
  {
    icon: CheckIcon,
    label: "성사 확정",
    description:
      "진행하기로 마음먹었다면 성사 확정을 눌러요. 신청자 전원에게 내 정산 계좌와 24시간 입금 기한이 알림톡으로 나가요.",
  },
  {
    icon: BanknoteIcon,
    label: "입금 확인",
    description:
      "통장을 보고 명단에서 한 명씩 입금 확인을 눌러요. 내역을 못 찾으면 재확인을 요청할 수 있고, 그 참여자의 기한이 24시간 연장돼요.",
  },
  {
    icon: UsersRoundIcon,
    label: "진행 확정",
    description:
      "전원 입금이 확인되면 자동으로 진행 확정돼요. 기한이 지난 미입금 참여를 직접 정리하면 입금한 인원만으로 확정할 수도 있어요.",
  },
  {
    icon: TruckIcon,
    label: "운송장 등록",
    description:
      "진행 확정 후 참여자가 고른 편의점으로 발송하고, 참여자별로 운송장 번호를 등록해요.",
  },
  {
    icon: PackageCheckIcon,
    label: "배송 완료",
    description: "참여자가 편의점에서 받고 수령을 확인하면 분철이 끝나요.",
  },
] as const satisfies readonly StatusGuideItem[];

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

type BidRecord = {
  amount: number;
  deadline: string;
  id: string;
  imageUrl?: string;
  optionLabel: string;
  paidAt: string | null;
  participantCount: number;
  productId: string;
  rank: number;
  courier?: string;
  deliveryId?: string | null;
  deliveryStatus?: string | null;
  flowType?: string | null;
  shippingMethods?: ProductDetailItem["shippingMethods"];
  submittedAt: string;
  title: string;
  tone: string;
  buncheolStatus?: string;
  openChatUrl?: string | null;
  refundHolder?: string | null;
  // 소속 묶음 = 이체 1회의 단위. 「보냈어요」가 이 단위로 나간다.
  bundleId?: string | null;
  paymentAmount?: number | null;
  paymentDueAt?: string | null;
  paymentSentAt?: string | null;
  paymentRejectedAt?: string | null;
  createdAt?: string | null;
  participationStatus?: string;
  cancelReason?: string | null;
  // 서버가 취소 API 게이트와 같은 판정으로 내려주는 취소 가능 여부·사유 (docs/56 S-1).
  // 필드가 없는 구 응답이면 null.
  cancellability?: string | null;
  shippingAddress?: DeliveryAddress | null;
  shippingFee?: number | null;
  trackingNumber?: string | null;
  hostBankAccount?: BankAccountInfo | null;
  payback?: ShippingFeePaybackInfo | null;
};

// 분철 단위 플로우 분기 (docs/46 §0.1). 필드가 없는 구 응답·LEGACY 는 전부 false.
function isC2CBidRecord(bid: BidRecord) {
  return getFlowType(bid.flowType) === "C2C";
}

function isBidRecordClosed(bid: BidRecord, now: Date) {
  if (bid.buncheolStatus && !isBuncheolRecruitingStatus(bid.buncheolStatus)) {
    return true;
  }

  const deadlineDate = parseDeadline(bid.deadline);

  return (
    !Number.isNaN(deadlineDate.getTime()) &&
    deadlineDate.getTime() <= now.getTime()
  );
}

function isBidRecordPaymentReady(bid: BidRecord, now: Date) {
  if (isBidRecordCancelled(bid) || isBidRecordPaymentConfirmed(bid)) {
    return false;
  }

  // C2C 는 확정 후 AWAITING_PAYMENT 에서만 입금 단계다 — LEGACY 의
  // "마감+1순위" 폴백은 구 경매 응답 보정이라 C2C 에 적용하지 않는다.
  if (isC2CBidRecord(bid)) {
    return (
      isParticipationAwaitingPaymentStatus(bid.participationStatus) &&
      !isBidRecordPaymentExpired(bid, now)
    );
  }

  return (
    (isParticipationAwaitingPaymentStatus(bid.participationStatus) ||
      (isBidRecordClosed(bid, now) && bid.rank === 1)) &&
    !isBidRecordPaymentExpired(bid, now)
  );
}

// C2C "보냈어요" 상태는 개최자 확인 대기 중에도 계좌 재확인이 필요할 수 있어
// 결제 정보 시트 열람을 허용한다 (docs/46 §3-5 — 계좌 노출: AWAITING+PAYMENT_SENT).
function canViewBidRecordPaymentSheet(bid: BidRecord, now: Date) {
  return (
    isBidRecordPaymentReady(bid, now) ||
    (isC2CBidRecord(bid) &&
      isParticipationPaymentSentStatus(bid.participationStatus))
  );
}

// 서버 취소 판정 값 (docs/56 S-1 — server ParticipationCancellability).
const PARTICIPATION_CANCELLABLE = "CANCELLABLE";
const PARTICIPATION_CANCEL_BLOCKED_BY_STATUS = "BLOCKED_BY_STATUS";
const PARTICIPATION_CANCEL_BLOCKED_BY_HOST_CONFIRM = "BLOCKED_BY_HOST_CONFIRM";

// C2C 자발 취소 가능 구간 (docs/46 §5). 판정은 서버가 하고 화면은 그 값을 따르기만 한다 —
// 상태로 재판정하면 성사 확정을 거치지 않은 추가 모집(docs/46 §4.7-E1) 참여자까지 가둔다.
//
// 기한 축을 뺐다 — 예전 만료 가드의 근거가 "곧 서버가 자동 취소할 것" 이었고 C2C 에서 그 전제가
// 사라졌다. 이제 서버 값(cancellability)만 따른다 (docs/84 §3-1).
function canCancelBidRecord(bid: BidRecord) {
  if (!isC2CBidRecord(bid) || isBidRecordCancelled(bid)) {
    return false;
  }

  if (bid.cancellability) {
    return bid.cancellability === PARTICIPATION_CANCELLABLE;
  }

  // 폴백(필드 없는 구 응답·조회 실패) — 잘못 숨겨 가두는 것보다 눌러서 이유를 아는 편이 낫다.
  // 서버가 거부하면 그 사유가 토스트로 뜬다(runCancelParticipation).
  return (
    isParticipationAppliedStatus(bid.participationStatus) ||
    isParticipationAwaitingPaymentStatus(bid.participationStatus)
  );
}

// 낙관적 갱신용 판정 전이. 「보냈어요」 마킹이 상태만 올리고 판정을 그대로 두면 버튼과 사유가
// 어긋난다 — 다음 폴링이 정정하기까지 사용자가 보는 건 방금 누른 액션의 결과 화면이다.
function markPaymentSentCancellability(current: string | null | undefined) {
  // 서버 판정이 없으면(구 응답) 폴백 로직이 상태로 판정하므로 건드리지 않는다.
  if (!current) {
    return current ?? null;
  }

  // 이미 다른 사유로 막혀 있으면(성사 확정 등) 그 사유가 더 구체적이라 유지한다.
  return current === PARTICIPATION_CANCELLABLE
    ? PARTICIPATION_CANCEL_BLOCKED_BY_STATUS
    : current;
}


// 버튼만 사라지면 "취소가 왜 없지" 로 문의가 는다 — 왜 안 되는지 + 다음에 뭘 해야 하는지를 함께 보여준다.
// 서버 에러 문구(BCH-086 · BCH-092)와 같은 내용이다.
// 노출 범위는 사용자가 실제로 취소를 찾는 두 구간뿐 — 입금확인·배송 단계 카드까지 상시 안내를 띄우면
// 정작 필요한 곳에서 묻힌다(Wave 2 에서 완료 분철에 상시 노출됐던 문제, docs/56 §21-4).
function getBidRecordCancelBlockedNotice(bid: BidRecord) {
  if (!isC2CBidRecord(bid) || isBidRecordCancelled(bid)) {
    return null;
  }

  // 구간을 화면에서도 못박는다 — 지금 서버는 상태를 먼저 판정해 입금확인·배송 카드가 이 값을 받지
  // 않지만, 그 평가 순서에 안내 노출을 기대는 순간 서버 enum 이 바뀔 때 조용히 노이즈가 된다.
  if (
    bid.cancellability === PARTICIPATION_CANCEL_BLOCKED_BY_HOST_CONFIRM &&
    isParticipationAwaitingPaymentStatus(bid.participationStatus)
  ) {
    return "개최자가 성사 확정한 뒤에는 참여를 직접 취소할 수 없어요. 사정이 생겼다면 개최자에게 먼저 알려 주세요.";
  }

  if (
    bid.cancellability === PARTICIPATION_CANCEL_BLOCKED_BY_STATUS &&
    isParticipationPaymentSentStatus(bid.participationStatus)
  ) {
    return "입금을 보냈다고 알린 뒤에는 참여를 직접 취소할 수 없어요. 고객센터로 문의해 주세요.";
  }

  return null;
}

function isBidRecordPaymentConfirmed(bid: BidRecord) {
  return (
    Boolean(bid.paidAt) ||
    isParticipationConfirmedStatus(bid.participationStatus)
  );
}

// 분철이 취소(자동/개최자)됐는데 참여 취소가 아직 전파되지 않은 응답도 취소로 본다 —
// 취소 배지 아래 결제 대기 CTA 가 노출되는 모순을 막는다.
function isBidRecordCancelled(bid: BidRecord) {
  return (
    isParticipationCancelledStatus(bid.participationStatus) ||
    isBuncheolCancelledStatus(bid.buncheolStatus)
  );
}

// 취소된 참여의 취소 계열. 분철이 취소된 분철이라도 그 전에 입금 시간 초과로 취소된 참여는
// cancelReason 이 PAYMENT_TIMEOUT 이므로 분철 취소 건과 구분한다.
function getBidRecordCancellationKind(bid: BidRecord) {
  if (!isBidRecordCancelled(bid)) {
    return null;
  }

  // C2C 자발 취소 — 분철 취소·만료와 구분해 귀책을 정확히 표기한다 (docs/46 §5).
  if (isUserCancelledReason(bid.cancelReason)) {
    return "USER_CANCELLED";
  }

  if (bid.cancelReason === "PAYMENT_TIMEOUT") {
    return "PAYMENT_TIMEOUT";
  }

  if (
    bid.cancelReason === "BUNCHEOL_CANCELLED" ||
    isBuncheolCancelledStatus(bid.buncheolStatus)
  ) {
    return "BUNCHEOL_CANCELLED";
  }

  return "PAYMENT_TIMEOUT";
}

// 참여 내역 목록에서 감출 참여 (docs/56 H-05). 자발 취소(본인 귀책)만 감춘다 —
// 분철 취소·입금 기한 만료는 사용자 귀책이 아니고, 알림톡을 못 본 사용자에게는 유일한 흔적이다.
// 사유를 알 수 없는 취소는 getBidRecordCancellationKind 가 PAYMENT_TIMEOUT 으로 떨어뜨리므로
// 자동으로 남는 쪽이 된다.
// 입금 흔적(보냈어요 마킹·확인 완료·paidAt)이 있으면 사유가 USER_CANCELLED 여도 남긴다 —
// 서버가 참여자 요청에 의한 CS 취소를 같은 사유로 기록하면 환불을 추적할 유일한 근거가 사라진다.
function isHiddenCancelledBidRecord(bid: BidRecord) {
  return (
    getBidRecordCancellationKind(bid) === "USER_CANCELLED" &&
    !isBidRecordPaymentConfirmed(bid) &&
    !isParticipationPaymentSentStatus(bid.participationStatus)
  );
}

type BuncheolChipTone =
  | "dday"
  | "urgent"
  | "confirmed"
  | "closed"
  | "cancelled";

// 사진 아래 칩 — 분철 축 상태. 분철을 상징하는 사진에 붙여, 진행 바(내 결제·배송 축)와
// 위치로 구분한다. 모집중에는 라벨 대신 확정까지 남은 시간(D-day)을 보여준다.
function getBidRecordBuncheolChip(
  bid: BidRecord,
  now: Date,
): { label: string; tone: BuncheolChipTone } {
  if (
    isBuncheolCancelledStatus(bid.buncheolStatus) ||
    getBidRecordCancellationKind(bid) === "BUNCHEOL_CANCELLED"
  ) {
    return { label: "취소", tone: "cancelled" };
  }

  if (isBuncheolConfirmedStatus(bid.buncheolStatus)) {
    return { label: "진행 확정", tone: "confirmed" };
  }

  // C2C 입금 수집 구간 — "마감"으로 접히면 진행 중인 분철이 끝난 것처럼 보인다.
  // 이 칩은 썸네일 아래 56px 컬럼에 들어가므로 4글자를 넘기지 않는다.
  if (isBuncheolPaymentCollectingStatus(bid.buncheolStatus)) {
    return { label: "입금 진행", tone: "urgent" };
  }

  if (isBidRecordClosed(bid, now)) {
    return { label: "마감", tone: "closed" };
  }

  const deadlineDate = parseDeadline(bid.deadline);

  if (Number.isNaN(deadlineDate.getTime())) {
    return { label: "모집 중", tone: "dday" };
  }

  const dayDifference = getKstDayDifference(deadlineDate, now);

  return dayDifference <= 0
    ? { label: "오늘 마감", tone: "urgent" }
    : { label: `D-${dayDifference}`, tone: "dday" };
}

const buncheolChipToneClasses: Record<BuncheolChipTone, string> = {
  dday: "bg-[#f1f1f1] text-black/55",
  urgent: "bg-black text-[#D7FF5F]",
  // 확정은 결론이 난 차분한 긍정 상태 — 원색 라임은 urgent 전용으로 남기고 연한 틴트를 쓴다.
  confirmed: "bg-[#E4F6A5] text-black/70",
  closed: "bg-[#f1f1f1] text-black/45",
  cancelled: "bg-[#f1f1f1] text-black/45",
};

// 낼 돈이 없었던 참여(코드 참여 등)에는 환불 안내를 띄우지 않는다 — 가리킬 계좌 자체가 없다.
// 이 슬롯의 입금 총액(상품 + 배송비). 배송비를 모르는 구응답이면 임의 상수를 더하지 않고
// amount 만 쓴다. 시트·카드·확인 모달이 같은 식을 복제하면 숫자가 갈린다.
function getBidRecordPaymentTotal(bid: BidRecord) {
  const shippingFee =
    typeof bid.shippingFee === "number" ? bid.shippingFee : null;

  return (
    bid.paymentAmount ??
    (shippingFee !== null ? bid.amount + shippingFee : bid.amount)
  );
}

function isFreeBidRecord(bid: BidRecord) {
  if (typeof bid.paymentAmount === "number") {
    return bid.paymentAmount === 0;
  }

  return bid.amount === 0 && (bid.shippingFee ?? 0) === 0;
}

// 취소 카드에 보여줄 라벨·사유 문구. 분철 취소는 buncheolStatus 로 사유를 구분한다
// (CANCELLED = 최소 인원 미달 자동 취소, HOST_CANCELLED = 개최자 취소 — 워딩은 "개최자 사정"으로 완곡하게).
function getBidRecordCancellationNotice(bid: BidRecord) {
  const cancellationKind = getBidRecordCancellationKind(bid);

  if (!cancellationKind) {
    return null;
  }

  const isC2C = isC2CBidRecord(bid);

  if (cancellationKind === "USER_CANCELLED") {
    return {
      label: "참여 취소됨",
      description:
        "직접 취소한 참여예요. 분철이 모집 중이면 다시 신청할 수 있어요.",
    };
  }

  if (cancellationKind === "PAYMENT_TIMEOUT") {
    return {
      label: "참여 취소됨",
      // C2C 는 돈이 개최자에게 직접 가므로 "환불 계좌로 환불" 안내가 오안내다 (docs/46 §6.2).
      description: isFreeBidRecord(bid)
        ? "입금 기한이 지나 참여가 취소됐어요."
        : isC2C
          ? "입금 기한이 지나 참여가 취소됐어요. 이미 입금했다면 분철이지로 문의해 주세요."
          : "입금 기한이 지나 참여가 취소됐어요. 이미 입금했다면 등록한 환불 계좌로 환불돼요.",
    };
  }

  const buncheolCancelDescription = isBuncheolHostCancelledStatus(
    bid.buncheolStatus,
  )
    ? "개최자 사정으로 분철이 취소됐어요."
    : isBuncheolCancelledStatus(bid.buncheolStatus)
      ? isC2C
        ? "분철이 성사되지 않아 취소됐어요."
        : "최소 인원이 모이지 않아 분철이 취소됐어요."
      : "취소된 분철이에요.";

  return {
    label: "분철 취소됨",
    description: isFreeBidRecord(bid)
      ? buncheolCancelDescription
      : isC2C
        ? `${buncheolCancelDescription} 입금 전이었다면 돌려받을 금액이 없어요. 이미 입금했다면 분철이지로 문의해 주세요.`
        : `${buncheolCancelDescription} 이미 입금했다면 등록한 환불 계좌로 환불돼요.`,
  };
}

// 기한 경과 여부 — 표시 전용이라 아무것도 잠그지 않는다. C2C 기한은 "지나면 개최자가 정리에 나설 수
// 있는 시각" 이지 참여가 죽는 시각이 아니다 (docs/71 §8-1).
function isBidRecordPaymentOverdue(bid: BidRecord, now: Date) {
  const isC2C = isC2CBidRecord(bid);
  // C2C 는 AWAITING_PAYMENT 만 기한 대상 — APPLIED(기한 없음)·PAYMENT_SENT(개최자 확인 대기)는 제외한다.
  const isPaymentCandidate = isC2C
    ? isParticipationAwaitingPaymentStatus(bid.participationStatus)
    : isParticipationAwaitingPaymentStatus(bid.participationStatus) ||
      (isBidRecordClosed(bid, now) && bid.rank === 1);

  if (
    isBidRecordCancelled(bid) ||
    isBidRecordPaymentConfirmed(bid) ||
    !isPaymentCandidate
  ) {
    return false;
  }

  const paymentDeadline = getPaymentDeadlineDate(
    bid.deadline,
    bid.paymentDueAt,
    bid.createdAt,
    isC2C,
  );

  return (
    !Number.isNaN(paymentDeadline.getTime()) &&
    paymentDeadline.getTime() <= now.getTime()
  );
}

// 기한이 지나 참여가 곧 죽는 상태 — 액션을 잠그는 쪽이고 LEGACY 전용이다.
// 서버 만료 폴링이 flow_type = LEGACY 로 좁혀져 C2C 는 자동 취소되지 않는다. C2C 를 여기서 잠그면
// 살아 있는 참여인데 입금도 마킹도 못 하게 된다.
function isBidRecordPaymentExpired(bid: BidRecord, now: Date) {
  if (isC2CBidRecord(bid)) {
    return false;
  }

  return isBidRecordPaymentOverdue(bid, now);
}

function isDeliveryInProgress(bid: BidRecord) {
  return (
    isDeliveryShippingStatus(bid.deliveryStatus) ||
    isDeliveryCompletedStatus(bid.deliveryStatus) ||
    Boolean(bid.trackingNumber)
  );
}

// 배송비 돌려받기 상태는 서버 파생값(payback.status)을 그대로 신뢰한다 — 슬롯 0원 여부를
// 프론트에서 재판정하지 않는다. 플래그가 꺼지면 이벤트 UI 전체가 사라진다.
function getPaybackStatus(bid: BidRecord) {
  return bid.payback?.status ?? "NONE";
}

function isPaybackRequestable(bid: BidRecord) {
  const status = getPaybackStatus(bid);

  return (
    FEATURES.shippingFeePayback &&
    (status === "ELIGIBLE" || status === "REJECTED")
  );
}

function getPaybackBadgeLabel(bid: BidRecord) {
  if (!FEATURES.shippingFeePayback) {
    return null;
  }

  return PAYBACK_STATUS_LABELS[getPaybackStatus(bid)] ?? null;
}

function getBidRecordProgressStepIndex(bid: BidRecord, now: Date) {
  if (
    isBidRecordCancelled(bid) ||
    isBidRecordPaymentExpired(bid, now)
  ) {
    return -1;
  }

  if (isDeliveryCompletedStatus(bid.deliveryStatus)) {
    return 4;
  }

  if (isDeliveryInProgress(bid)) {
    return 3;
  }

  if (isBidRecordPaymentConfirmed(bid)) {
    return isBuncheolConfirmedStatus(bid.buncheolStatus) ? 2 : 1;
  }

  if (isBidRecordPaymentReady(bid, now)) {
    return 0;
  }

  return -1;
}

// C2C 6단계 — 신청(무입금) 단계가 앞에 붙는다 (docs/48 §6.2). "보냈어요"는 단계가 아니라
// 입금 대기 단계 안의 마킹 상태라 진행바가 아닌 배지·버튼으로 표현한다.
function getC2CBidRecordProgressStepIndex(bid: BidRecord, now: Date) {
  if (isBidRecordCancelled(bid) || isBidRecordPaymentExpired(bid, now)) {
    return -1;
  }

  if (isDeliveryCompletedStatus(bid.deliveryStatus)) {
    return 5;
  }

  if (isDeliveryInProgress(bid)) {
    return 4;
  }

  if (isBidRecordPaymentConfirmed(bid)) {
    return isBuncheolConfirmedStatus(bid.buncheolStatus) ? 3 : 2;
  }

  if (
    isParticipationAwaitingPaymentStatus(bid.participationStatus) ||
    isParticipationPaymentSentStatus(bid.participationStatus)
  ) {
    return 1;
  }

  if (isParticipationAppliedStatus(bid.participationStatus)) {
    return 0;
  }

  return -1;
}

// 0원 참여 전용 축. 라벨이 5칸이므로 인덱스도 반드시 5칸으로 뽑아야 한다 —
// C2C 6칸 축을 물리면 한 칸씩 앞서 표시된다(코드 참여는 생성 즉시 CONFIRMED 라
// 첫 화면부터 어긋나고, 배송 중인 건이 "배송 완료"로 보인다).
function getFreeBidRecordProgressStepIndex(bid: BidRecord, now: Date) {
  if (isBidRecordCancelled(bid) || isBidRecordPaymentExpired(bid, now)) {
    return -1;
  }

  if (isDeliveryCompletedStatus(bid.deliveryStatus)) {
    return 4;
  }

  if (isDeliveryInProgress(bid)) {
    return 3;
  }

  if (isBidRecordPaymentConfirmed(bid)) {
    return isBuncheolConfirmedStatus(bid.buncheolStatus) ? 2 : 1;
  }

  // 0원이라 입금 기한이 없어 "입금 가능" 판정을 쓸 수 없다. 확정 전은 전부 접수 단계로 둔다.
  return 0;
}

function getBidRecordProgressSteps(bid: BidRecord, now: Date) {
  const isC2C = isC2CBidRecord(bid);
  const labels = isFreeBidRecord(bid)
    ? freeProgressStepLabels
    : isC2C
      ? c2cProgressStepLabels
      : bidProgressStepLabels;
  const currentStepIndex = isFreeBidRecord(bid)
    ? getFreeBidRecordProgressStepIndex(bid, now)
    : isC2C
      ? getC2CBidRecordProgressStepIndex(bid, now)
      : getBidRecordProgressStepIndex(bid, now);

  // isCurrent 는 "지금 어디"를 점 하나로 표시하기 위한 것 — 라벨이 10px 이라
  // 채워진 점만으로는 진행된 구간과 현재 단계가 구분되지 않았다.
  return labels.map((label, index) => ({
    isActive: currentStepIndex >= index,
    isCurrent: currentStepIndex === index,
    label,
  }));
}

// 참여 1건 = 멤버 슬롯 1개(단일 선택 정책)라 참여 목록은 그룹핑 없이 참여 1건 = 카드 1장으로 그린다.
function getBidRecordOptionLabels(bid: BidRecord) {
  const label = bid.optionLabel.trim();

  return [label || "멤버 확인 필요"];
}

function findBidRecordById(records: BidRecord[], bidId: string | null) {
  if (!bidId) {
    return null;
  }

  return records.find((bid) => bid.id === bidId) ?? null;
}

function getBidRecordPaymentStatusLabel(bid: BidRecord, now: Date) {
  if (isBidRecordCancelled(bid)) {
    return "취소";
  }

  if (isBidRecordPaymentConfirmed(bid)) {
    return isFreeBidRecord(bid) ? "참여 확정" : "입금 확인";
  }

  if (isC2CBidRecord(bid)) {
    if (isParticipationAppliedStatus(bid.participationStatus)) {
      return "신청됨";
    }

    if (isParticipationPaymentSentStatus(bid.participationStatus)) {
      return "보냈어요";
    }
  }

  if (isBidRecordPaymentExpired(bid, now)) {
    return "입금 기한 만료";
  }

  // C2C 는 기한이 지나도 참여가 살아 있다 — "만료" 라고 쓰면 끝난 것으로 읽힌다.
  if (isBidRecordPaymentOverdue(bid, now)) {
    return "기한 지남";
  }

  if (isBidRecordPaymentReady(bid, now)) {
    return "입금 대기";
  }

  return isBidRecordClosed(bid, now) ? "모집 종료" : "참여중";
}

function getBidRecordPaymentStatusDescription(bid: BidRecord, now: Date) {
  const isC2C = isC2CBidRecord(bid);

  if (isBidRecordCancelled(bid)) {
    return (
      getBidRecordCancellationNotice(bid)?.description ??
      (isC2C || isFreeBidRecord(bid)
        ? "취소된 참여예요."
        : "취소된 참여예요. 이미 입금했다면 등록한 환불 계좌로 환불돼요.")
    );
  }

  if (isBidRecordPaymentConfirmed(bid)) {
    if (isFreeBidRecord(bid)) {
      return "참여가 확정됐어요. 입금할 금액은 없어요.";
    }
    return isC2C
      ? "개최자가 입금을 확인했어요."
      : "관리자가 입금을 확인했어요.";
  }

  if (isC2C && isParticipationAppliedStatus(bid.participationStatus)) {
    return "개최자가 성사를 확정하면 알림톡으로 입금 안내를 드려요. 아직 입금할 필요 없어요.";
  }

  if (isC2C && isParticipationPaymentSentStatus(bid.participationStatus)) {
    return "보냈어요 표시를 완료했어요. 개최자가 입금을 확인하면 참여가 확정돼요.";
  }

  if (isBidRecordPaymentExpired(bid, now)) {
    return "입금 기한이 지나 참여가 취소됐을 수 있어요.";
  }

  if (isBidRecordPaymentReady(bid, now)) {
    // ⚠️ overdue 검사가 ready 보다 뒤에 있으면 도달하지 못한다 — C2C 는 기한이 지나도 ready 다.
    if (isBidRecordPaymentOverdue(bid, now)) {
      // 재확인 요청(개최자가 입금 내역을 못 찾음)은 연장된 기한마저 지나도 여전히 가장 중요한
      // 정보다. 이걸 가리면 이미 보낸 사람이 "지금 보내셔도 됩니다" 만 보고 중복 송금한다.
      return isC2C && bid.paymentRejectedAt
        ? "개최자가 입금 내역을 찾지 못했어요. 보낸 내역을 다시 확인해 주세요. 기한이 지나 개최자가 참여를 취소할 수도 있어요."
        : "입금 기한이 지났어요. 지금 보내셔도 됩니다. 다만 기한이 지나면 개최자가 참여를 취소할 수 있어요.";
    }

    const remaining = formatPaymentRemainingTime(
      bid.deadline,
      now,
      bid.paymentDueAt,
      bid.createdAt,
      isC2C,
    );

    // 개최자가 "입금 못 찾음"으로 되돌린 경우. 서버가 입금 대기 구간에서만 값을 채우고 재마킹 시
    // 지우므로, 값이 있으면 지금이 재확인 구간이다. "반려"라고 쓰면 취소로 오해해 문의가 몰린다
    // (docs/53 Q-03, docs/54 2-1).
    if (isC2C && bid.paymentRejectedAt) {
      return `입금이 확인되지 않았어요 · 다시 확인해 주세요. 기한까지 ${remaining}`;
    }

    return `입금 기한까지 ${remaining}`;
  }

  return isBidRecordClosed(bid, now)
    ? "모집 종료된 분철이에요."
    : "진행 중인 참여예요.";
}

function isHostedProductClosed(product: ProductDetailItem, now: Date) {
  if (product.status && !isBuncheolRecruitingStatus(product.status)) {
    return true;
  }

  const deadlineDate = parseHistoryDeadline(product.deadline);

  return (
    !Number.isNaN(deadlineDate.getTime()) &&
    deadlineDate.getTime() <= now.getTime()
  );
}

// 개최 시각(ms). 값이 없거나 못 읽으면 null — 정렬에서 맨 뒤로 보낸다.
function getHostedProductOpenedAtTime(product: ProductDetailItem) {
  const parsed = product.createdAt
    ? Date.parse(product.createdAt)
    : Number.NaN;

  return Number.isNaN(parsed) ? null : parsed;
}

function formatApiDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  // 참여 카드(formatCompactDeadline)와 같은 모양으로 맞춘다 — 같은 화면의 두 탭이
  // "8.12 17시" 와 "2026년 07월 05일 14시" 로 달랐다. 연도는 올해가 아닐 때만 붙인다.
  const parts = new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: "numeric",
    hour12: false,
    month: "numeric",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(date);
  const partMap = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const currentYear = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(new Date());
  const yearPrefix = currentYear.includes(partMap.year)
    ? ""
    : `${partMap.year}년 `;

  return `${yearPrefix}${partMap.month}월 ${partMap.day}일 ${partMap.hour}시`;
}

function formatCompactDeadline(value: string) {
  const match = value
    .trim()
    .match(/^\d{4}\D+(\d{1,2})\D+(\d{1,2})(?:\D+(\d{1,2}))?/);

  if (!match) {
    return value;
  }

  // "8.12 17시" 같은 축약 대신 "8월 12일 17시" 로 쓴다 — 목록·상세·개최 기록이
  // 각각 다른 날짜 표기를 쓰고 있어 같은 정보가 매번 다른 모양으로 보였다.
  const [, month, day, hour] = match;

  return hour
    ? `${Number(month)}월 ${Number(day)}일 ${Number(hour)}시`
    : `${Number(month)}월 ${Number(day)}일`;
}

/*
 * 참여 요약 카드에서는 배송지를 보여주지 않는다.
 *
 * 참여 목록 API(/participations/me)는 배송지를 내려주지 않는다 — 이 값은 체크아웃을
 * 이 브라우저에서 진행했을 때 남는 로컬 캐시(participation-payment-cache)에만 있다.
 * 그래서 기기를 바꾸거나 캐시가 비면 영영 "배송지 확인 중"으로 남았는데, 실제로는
 * 확인 중인 게 아니라 클라이언트가 값을 모르는 것이라 문구부터 거짓말이었다.
 * 카드마다 상세를 조회해 채우는 건 이미 걷어낸 N+1 을 되살리는 일이라 하지 않는다.
 *
 * 배송지는 값이 확실한 곳에서만 보여준다 — 입금 정보 시트(상세 조회로 받아온다)와
 * 배송 시작 후의 배송 블록. 서버가 목록 응답에 배송지를 실어주면 그때 요약 카드로 올린다.
 */
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
    (isParticipationAwaitingPaymentStatus(participationStatus) ? 1 : 0);
  const shippingMethods = getShippingMethodsFromOptions(
    participation.shippingOptions ?? [],
  );
  // 서버 bidAmount 는 배송비 포함 입금 총액이다. shippingFee 를 빼 상품(멤버) 금액으로 환산해
  // amount 에 담고, 총액은 paymentAmount 로 유지한다. shippingFee 를 안 내려주는 구 응답이면
  // 분리할 수 없으므로 총액을 그대로 둔다.
  const serverShippingFee = participation.shippingFee;
  const serverItemAmount =
    typeof serverShippingFee === "number"
      ? Math.max(participation.bidAmount - serverShippingFee, 0)
      : participation.bidAmount;

  return {
    courier: shippingMethods[0]?.name,
    shippingMethods: shippingMethods.length > 0 ? shippingMethods : undefined,
    id: participation.participationId,
    amount: cachedPayment?.bidAmount ?? serverItemAmount,
    deadline: formatApiDateTime(participation.buncheolDeadline),
    imageUrl:
      participation.thumbnailUrl ??
      getCachedProductImageUrl(participation.buncheolId),
    optionLabel: participation.memberName,
    participantCount: 0,
    paidAt: isParticipationConfirmedStatus(participation.participationStatus)
      ? "입금 확인"
      : null,
    buncheolStatus: participation.buncheolStatus,
    deliveryId: participation.deliveryId,
    deliveryStatus: participation.deliveryStatus,
    flowType: participation.flowType ?? null,
    openChatUrl: participation.openChatUrl ?? null,
    // 입금자명 = 참여 시 등록한 환불계좌 예금주 (docs/53 Q-17). 서버는 입금 대기(AWAITING_PAYMENT·
    // PAYMENT_SENT)에서만 값을 채우는데, 결제 정보 시트가 열리는 조건(canViewBidRecordPaymentSheet)과
    // 같아 정작 필요한 구간에는 항상 값이 있다 — staging 응답으로 키 이름·노출 조건 실측 확인.
    // ⚠️ 개최자 화면 계열의 depositorName 을 fallback 으로 끌어오지 말 것 —
    // getBuncheolManagementWinnerFromRecord(auth-api.ts)의 후보 키와 HostedBuncheolManage 의
    // depositorName 은 참여자 닉네임을 담을 수 있어, 예금주가 아닌 이름이 입금자명으로 표시된다.
    refundHolder: participation.refundHolder ?? null,
    bundleId: participation.bundleId ?? null,
    paymentSentAt: participation.paymentSentAt ?? null,
    paymentRejectedAt: participation.paymentRejectedAt ?? null,
    paymentAmount:
      participation.paymentAmount ??
      cachedPayment?.paymentAmount ??
      (typeof serverShippingFee === "number" ? participation.bidAmount : null),
    paymentDueAt:
      participation.paymentDueAt ?? cachedPayment?.paymentDueAt ?? null,
    createdAt: participation.createdAt,
    productId: participation.buncheolId,
    participationStatus,
    cancelReason: participation.cancelReason ?? null,
    cancellability: participation.cancellability ?? null,
    rank: rank > 0 ? rank : 0,
    shippingAddress:
      participation.shippingAddress ?? cachedPayment?.shippingAddress ?? null,
    shippingFee: participation.shippingFee ?? cachedPayment?.shippingFee ?? null,
    trackingNumber: participation.trackingNumber,
    // 개최자 계좌는 세션 캐시에 저장하지 않으므로(v3) 서버 응답에만 의존한다.
    hostBankAccount: participation.hostBankAccount ?? null,
    submittedAt: "",
    title: participation.buncheolTitle,
    tone: getToneFromId(participation.buncheolId),
    payback: participation.payback ?? null,
  };
}

type BuncheolDetailCache = Map<string, ReturnType<typeof requestBuncheolDetail>>;

// 같은 분철에 여러 슬롯으로 참여한 경우 분철 상세를 한 번만 조회하도록 로드 단위로 dedupe 한다.
function getCachedBuncheolDetail(
  accessToken: string,
  buncheolId: string,
  cache?: BuncheolDetailCache,
) {
  if (!cache) {
    return requestBuncheolDetail(accessToken, buncheolId);
  }

  const cachedDetail = cache.get(buncheolId);

  if (cachedDetail) {
    return cachedDetail;
  }

  const detailPromise = requestBuncheolDetail(accessToken, buncheolId);
  cache.set(buncheolId, detailPromise);

  return detailPromise;
}

// 취소·삭제된 분철은 상세 조회가 404 를 반환하므로 호출하지 않는다.
// HOST_CANCELLED 는 isBidRecordCancelled 가 취소로 판정하므로 별도 검사가 필요 없다.
function isBuncheolDetailInaccessible(bid: BidRecord) {
  return (
    isBidRecordCancelled(bid) || isBuncheolDeletedStatus(bid.buncheolStatus)
  );
}

async function getBidRecordWithShippingData(
  accessToken: string,
  participation: MyParticipation,
  buncheolDetailCache?: BuncheolDetailCache,
  precomputedBidRecord?: BidRecord,
): Promise<BidRecord> {
  const bidRecord =
    precomputedBidRecord ?? getBidRecordFromParticipation(participation);
  // 목록 응답에 배송옵션이 포함돼 있으면(신규 백엔드) 썸네일·배송·계좌 정보도 함께 오므로
  // 참여 건마다 분철 상세/결제 상세를 추가 조회할 필요가 없다.
  const hasListShippingData = Boolean(participation.shippingOptions?.length);
  const shouldFetchBuncheolDetail =
    !hasListShippingData && !isBuncheolDetailInaccessible(bidRecord);
  const shouldFetchParticipationDetail =
    !hasListShippingData &&
    !isBidRecordCancelled(bidRecord) &&
    (isBidRecordPaymentConfirmed(bidRecord) || Boolean(bidRecord.deliveryId));

  if (!shouldFetchBuncheolDetail && !shouldFetchParticipationDetail) {
    return bidRecord;
  }

  const [productDetailResult, paymentDetailResult] =
    await Promise.allSettled([
      shouldFetchBuncheolDetail
        ? getCachedBuncheolDetail(
            accessToken,
            bidRecord.productId,
            buncheolDetailCache,
          )
        : Promise.resolve(null),
      shouldFetchParticipationDetail
        ? requestParticipationPaymentDetail(accessToken, bidRecord.id)
        : Promise.resolve(null),
    ]);

  let mergedBidRecord = bidRecord;

  if (
    paymentDetailResult.status === "fulfilled" &&
    paymentDetailResult.value
  ) {
    const paymentDetail = paymentDetailResult.value;
    const participationStatus =
      paymentDetail.paymentStatus || mergedBidRecord.participationStatus;

    mergedBidRecord = {
      ...mergedBidRecord,
      // 상태를 상세 응답으로 갈아끼우므로 취소 판정도 같은 응답 것으로 함께 갈아끼운다 —
      // 한쪽만 갱신하면 "보냈어요인데 취소 가능" 같은 짝이 어긋난 조합이 생긴다.
      cancellability:
        paymentDetail.cancellability ?? mergedBidRecord.cancellability ?? null,
      deliveryId: mergedBidRecord.deliveryId ?? paymentDetail.deliveryId ?? null,
      deliveryStatus:
        paymentDetail.deliveryStatus ?? mergedBidRecord.deliveryStatus ?? null,
      // 목록 응답에 flowType 이 빠지면 C2C 참여가 LEGACY(30분 창·만료 폴백)로
      // 퇴화하므로 상세 응답으로 보강한다. 오픈채팅·보냈어요 시각도 동일.
      flowType: mergedBidRecord.flowType ?? paymentDetail.flowType ?? null,
      openChatUrl:
        mergedBidRecord.openChatUrl ?? paymentDetail.openChatUrl ?? null,
      paymentSentAt:
        mergedBidRecord.paymentSentAt ?? paymentDetail.paymentSentAt ?? null,
      hostBankAccount:
        mergedBidRecord.hostBankAccount ?? paymentDetail.hostBankAccount,
      paidAt:
        mergedBidRecord.paidAt ??
        (isParticipationConfirmedStatus(participationStatus)
          ? "입금 확인"
          : null),
      participationStatus,
      paymentAmount:
        mergedBidRecord.paymentAmount ?? paymentDetail.paymentAmount ?? null,
      paymentDueAt:
        mergedBidRecord.paymentDueAt ?? paymentDetail.paymentDueAt ?? null,
      shippingAddress:
        mergedBidRecord.shippingAddress ?? paymentDetail.shippingAddress ?? null,
      shippingFee:
        mergedBidRecord.shippingFee ?? paymentDetail.shippingFee ?? null,
      trackingNumber:
        paymentDetail.trackingNumber ?? mergedBidRecord.trackingNumber ?? null,
    };
  }

  if (productDetailResult.status === "fulfilled" && productDetailResult.value) {
    const detail = productDetailResult.value;
    const product = toProductDetailItem(detail);

    return {
      ...mergedBidRecord,
      courier: product.courier,
      flowType: mergedBidRecord.flowType ?? detail.flowType ?? null,
      hostBankAccount:
        mergedBidRecord.hostBankAccount ?? detail.hostBankAccount,
      imageUrl: mergedBidRecord.imageUrl ?? product.imageUrl,
      openChatUrl: mergedBidRecord.openChatUrl ?? detail.openChatUrl ?? null,
      shippingMethods: product.shippingMethods,
    };
  }

  return mergedBidRecord;
}

// 서버 개최자 취소 판정 값 (docs/56 S-2 — server BuncheolHostCancellability).
const BUNCHEOL_HOST_CANCELLABLE = "CANCELLABLE";
const BUNCHEOL_HOST_CANCEL_BLOCKED_BY_CONFIRMED_PAYMENT =
  "BLOCKED_BY_CONFIRMED_PAYMENT";

// 개최자 취소(삭제) 가능 구간. 판정은 서버가 하고 화면은 그 값을 따르기만 한다 —
// Wave 2 에서 상태 집합으로 자체 판정했다가 정작 대상인 입금 수집중을 빠뜨렸다 (docs/56 §21-4).
// 필드가 없는 구 응답이면 버튼을 남긴다(폴백) — 서버가 거부하면 사유가 hostedMessage 로 뜬다.
function canDeleteHostedProduct(product: ProductDetailItem) {
  if (!product.isApiProduct) {
    return false;
  }

  return (
    !product.hostCancellability ||
    product.hostCancellability === BUNCHEOL_HOST_CANCELLABLE
  );
}

// 입금을 받은 뒤 막히는 경우만 안내한다 — 서버 BCH-093 과 같은 문구다. 진행 확정·이미 취소된
// 분철은 카드 배지가 이미 상태를 말하고 있어, 거기까지 상시 안내를 붙이면 노이즈가 된다.
function getHostedProductCancelBlockedNotice(product: ProductDetailItem) {
  return product.hostCancellability ===
    BUNCHEOL_HOST_CANCEL_BLOCKED_BY_CONFIRMED_PAYMENT
    ? "입금이 확인된 참여자가 있어 분철을 취소할 수 없어요. 받은 금액을 환불한 뒤 고객센터로 문의해 주세요."
    : null;
}

function getHostedProductFromBuncheol(
  buncheol: MyHostedBuncheol,
): ProductDetailItem {
  const imageUrl =
    buncheol.thumbnailUrl ?? getCachedProductImageUrl(buncheol.id);

  return {
    id: buncheol.id,
    buncheolId: buncheol.id,
    hostCancellability: buncheol.cancellability ?? null,
    title: buncheol.title,
    member: `멤버 ${buncheol.memberSlotCount}명`,
    optionCount: buncheol.memberSlotCount,
    targetMembers: buncheol.memberNames,
    uploadedAt: formatApiDateTime(buncheol.createdAt),
    // 정렬용 원본 개최 시각. uploadedAt 은 "시" 단위로 잘린 표시용 문자열이라 같은 시각에 연
    // 분철들을 구분하지 못한다 (toProductCardItem 과 같은 방식으로 원본을 함께 들고 간다).
    createdAt: buncheol.createdAt,
    era: buncheol.groupName,
    rating: "0.0",
    reviews: String(buncheol.activeParticipationCount),
    badge: getBuncheolStatusBadgeLabel(buncheol.status),
    liked: buncheol.bookmarked,
    tone: getToneFromId(buncheol.id),
    courier: "배송 방법 확인 필요",
    deadline: formatApiDateTime(buncheol.deadline),
    description: "",
    flowType: buncheol.flowType ?? null,
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
              <div className="min-w-0">
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-black/8" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-black/8" />
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
  const router = useRouter();
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
  // 도움말 버튼도 하단 탭과 같은 신호로 비켜난다 — 상시 떠 있으면 진행바 마지막 단계를 가린다.
  const isChromeScrolledAway = useScrollDirectionHidden();
  const [isStatusHelpSheetOpen, setIsStatusHelpSheetOpen] = useState(false);
  const [isStatusHelpSheetEntered, setIsStatusHelpSheetEntered] =
    useState(false);
  const [isStatusHelpSheetClosing, setIsStatusHelpSheetClosing] =
    useState(false);
  const statusHelpSheetCloseTimerRef = useRef<number | null>(null);
  const paymentCopyToastTimerRef = useRef<number | null>(null);
  const [paymentCopyToast, setPaymentCopyToast] = useState("");
  const [paybackSheetBidId, setPaybackSheetBidId] = useState<string | null>(
    null,
  );
  const paybackToastTimerRef = useRef<number | null>(null);
  const [paybackToast, setPaybackToast] = useState("");
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

  useEffect(() => {
    if (authState.isLoggedIn) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      router.replace(
        createLoginHref({ cancelTo: "/", returnTo: "/profile/bids" }),
      );
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [authState.isLoggedIn, router]);

  const { addresses: deliveryAddresses, defaultAddressIds } = storedAddressState;
  const [mode, setMode] = useState<BidHistoryMode>("joined");
  // 참여↔개최 탭이 스크롤 컨테이너를 공유하므로 탭별 위치를 따로 기억한다.
  const tabScrollTopRef = useRef<Record<BidHistoryMode, number>>({
    hosted: 0,
    joined: 0,
  });
  const pendingTabScrollModeRef = useRef<BidHistoryMode | null>(null);
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
  // C2C 참여 액션(보냈어요·취소) 진행 중인 참여 ID — 중복 호출 방지.
  const [pendingParticipationId, setPendingParticipationId] = useState<
    string | null
  >(null);
  const actionToastTimerRef = useRef<number | null>(null);
  const [actionToast, setActionToast] = useState("");
  // 되돌리기 어려운 참여 액션의 확인 요청 — 인앱 브라우저 confirm 억제 대응 (ConfirmSheet).
  const [confirmSheetRequest, setConfirmSheetRequest] =
    useState<ConfirmSheetRequest | null>(null);
  const [historyMessage, setHistoryMessage] = useState("");
  const [hostedMessage, setHostedMessage] = useState("");
  const isBidRecordsLoading = authState.isLoggedIn && apiBidRecords === null;
  const isHostedProductsLoading =
    authState.isLoggedIn && apiHostedProducts === null;

  const paymentBidRecords: BidRecord[] = useMemo(
    () => apiBidRecords ?? [],
    [apiBidRecords],
  );
  const selectedPaymentBid = findBidRecordById(
    paymentBidRecords,
    selectedPaymentBidId,
  );
  const selectedPaybackBid = findBidRecordById(
    paymentBidRecords,
    paybackSheetBidId,
  );
  // 리스트 상단 집계 배너용 — 칩 필터와 무관하게 전체 참여에서 신청/재신청 가능한 건을 센다.
  // 다만 목록에서 감춘 자발 취소 건은 제외한다 — 배너가 카드 없는 참여를 세고, 눌렀을 때
  // 숨겨진 참여의 환급 시트가 열리는 어긋남을 막는다 (docs/56 H-05).
  const actionablePaybackRecords = paymentBidRecords.filter(
    (bid) => isPaybackRequestable(bid) && !isHiddenCancelledBidRecord(bid),
  );
  // 감춘 자발 취소(항상 C2C)까지 세면 카드가 한 장도 없는 흐름의 안내가 뜬다.
  const visibleBidRecords = paymentBidRecords.filter(
    (bid) => !isHiddenCancelledBidRecord(bid),
  );
  const isStatusGuideC2C =
    visibleBidRecords.length === 0 || visibleBidRecords.some(isC2CBidRecord);
  // 유상 참여가 하나라도 섞이면 입금 안내가 필요하므로, 전부 0원일 때만 무입금 안내로 간다.
  const isStatusGuideFree =
    visibleBidRecords.length > 0 && visibleBidRecords.every(isFreeBidRecord);
  const isHostingHelpSheet = mode === "hosted";
  // 운영진의 LEGACY 개최만 있는 계정에 "직접 환불" 을 보여주면 없는 의무를 만든다.
  const hasC2CHostedProduct = (apiHostedProducts ?? []).some(
    (product) => getFlowType(product.flowType) === "C2C",
  );
  const statusHelpSheetGuide: readonly StatusGuideItem[] = isHostingHelpSheet
    ? hostingStatusGuide
    : isStatusGuideFree
      ? freeParticipationStatusGuide
      : isStatusGuideC2C
        ? c2cParticipationStatusGuide
        : legacyParticipationStatusGuide;
  // 입금 대기(기한 압박 구간)는 15초 주기로 빠르게 갱신한다.
  // C2C 는 기한이 지나도 입금 대기가 유지되므로 만료분을 빼지 않으면 15초 N+1 이 며칠이고 계속 돈다 —
  // 아래 "며칠까지 갈 수 있는 대기" 와 성격이 같아졌다.
  const hasUrgentPaymentPolling = paymentBidRecords.some(
    (bid) =>
      isBidRecordPaymentReady(bid, now) && !isBidRecordPaymentOverdue(bid, now),
  );
  // C2C 신청(개최자 확정 대기)·보냈어요(확인 대기)는 며칠까지 갈 수 있는 대기라
  // 폴링은 하되 60초 주기로 늦춘다 — 15초 N+1 요청이 무기한 도는 것 방지.
  const hasIdleC2CPolling = paymentBidRecords.some(
    (bid) =>
      isC2CBidRecord(bid) &&
      (isParticipationAppliedStatus(bid.participationStatus) ||
        isParticipationPaymentSentStatus(bid.participationStatus) ||
        // 기한이 지난 C2C 입금 대기 — 개최자가 정리할 때까지 며칠 갈 수 있다.
        isBidRecordPaymentOverdue(bid, now)),
  );
  const shouldRefreshPaymentState =
    hasUrgentPaymentPolling || hasIdleC2CPolling;
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
  // 🔴 시트가 보여주는 금액은 <b>묶음 합계</b>여야 한다 — 이체가 한 번이기 때문이다.
  // 슬롯 1건만 보여주면 확인 모달의 합계와 숫자가 갈리고, 그 모달이 "금액이 다르면 개최자가
  // 통장에서 찾지 못한다" 고 경고하는 화면이라 스스로를 무너뜨린다.
  const selectedPaymentBundleSlots = selectedPaymentBid
    ? getSameBundleRecords(
        selectedPaymentBid,
        isParticipationAwaitingPaymentStatus,
      )
    : [];
  // 마킹 전(입금 대기)이 아니면 위 목록이 비므로 선택 슬롯으로 폴백한다.
  const paymentAmountSources =
    selectedPaymentBundleSlots.length > 0
      ? selectedPaymentBundleSlots
      : selectedPaymentBid
        ? [selectedPaymentBid]
        : [];
  const paymentShippingFee = paymentAmountSources.some(
    (bid) => typeof bid.shippingFee === "number",
  )
    ? paymentAmountSources.reduce(
        (sum, bid) =>
          sum + (typeof bid.shippingFee === "number" ? bid.shippingFee : 0),
        0,
      )
    : null;
  const paymentTotalAmount = paymentAmountSources.reduce(
    (sum, bid) => sum + getBidRecordPaymentTotal(bid),
    0,
  );
  const paymentSlotCount = paymentAmountSources.length;
  const selectedPaymentBankAccount =
    selectedPaymentBid?.hostBankAccount ?? null;
  const selectedPaymentOptionLabels = selectedPaymentBid
    ? getBidRecordOptionLabels(selectedPaymentBid)
    : [];
  const selectedPaymentStatusLabel = selectedPaymentBid
    ? getBidRecordPaymentStatusLabel(selectedPaymentBid, now)
    : "";
  const selectedPaymentStatusDescription = selectedPaymentBid
    ? getBidRecordPaymentStatusDescription(selectedPaymentBid, now)
    : "";
  const isSelectedPaymentReady = selectedPaymentBid
    ? isBidRecordPaymentReady(selectedPaymentBid, now)
    : false;
  // C2C 는 기한이 지나도 입금 대기가 풀리지 않는다 — 남은 시간·재촉 문구를 그대로 두면
  // "기한 지남" 과 "기한 안에 입금해 주세요" 가 한 박스에 같이 뜬다.
  const isSelectedPaymentOverdue = selectedPaymentBid
    ? isBidRecordPaymentOverdue(selectedPaymentBid, now)
    : false;
  const isSelectedPaymentCountingDown =
    isSelectedPaymentReady && !isSelectedPaymentOverdue;
  const isSelectedPaymentC2C = selectedPaymentBid
    ? isC2CBidRecord(selectedPaymentBid)
    : false;
  const isSelectedPaymentSent = Boolean(
    selectedPaymentBid &&
      isSelectedPaymentC2C &&
      isParticipationPaymentSentStatus(selectedPaymentBid.participationStatus),
  );
  const selectedPaymentOpenChatHref = isSelectedPaymentC2C
    ? getSafeOpenChatHref(selectedPaymentBid?.openChatUrl)
    : null;
  const selectedPaymentRemainingTime = selectedPaymentBid
    ? formatPaymentCountdown(
        selectedPaymentBid.deadline,
        now,
        selectedPaymentBid.paymentDueAt,
        selectedPaymentBid.createdAt,
        isSelectedPaymentC2C,
      )
    : "";
  const selectedPaymentDeadlineMs = selectedPaymentBid
    ? getPaymentDeadlineDate(
        selectedPaymentBid.deadline,
        selectedPaymentBid.paymentDueAt,
        selectedPaymentBid.createdAt,
        isSelectedPaymentC2C,
      ).getTime()
    : Number.NaN;
  // 카운트다운에 초가 보이는 구간(1시간 미만)에만 1초 틱을 쓴다 — C2C 24시간 창에서
  // 화면 변화 없는 매초 리렌더 방지. 임계 통과는 60초 틱이 now 를 갱신하며 자연 전환된다.
  const shouldTickSelectedPaymentEverySecond =
    !isSelectedPaymentC2C ||
    (Number.isFinite(selectedPaymentDeadlineMs) &&
      selectedPaymentDeadlineMs - now.getTime() < 3_600_000);
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

      if (paybackToastTimerRef.current !== null) {
        window.clearTimeout(paybackToastTimerRef.current);
      }

      if (actionToastTimerRef.current !== null) {
        window.clearTimeout(actionToastTimerRef.current);
      }

      if (addressSheetCloseTimerRef.current !== null) {
        window.clearTimeout(addressSheetCloseTimerRef.current);
      }
    };
  }, []);

  // 결제 정보 시트가 열려 있는 동안에는 입금 마감 카운트다운을 분철 상세처럼 갱신한다(초가 보일 때만
  // 1초 틱). 기한이 지나면 카운트다운 자체가 사라지므로 틱도 멈춘다 — C2C 는 결제 대기가 안 풀려서
  // isSelectedPaymentReady 로는 안 멈추고, 표시가 "기한 지남" 고정인데 초당 리렌더만 돈다.
  useEffect(() => {
    if (!isPaymentSheetOpen || !isSelectedPaymentCountingDown) {
      return;
    }

    setNow(new Date());

    const timer = window.setInterval(
      () => {
        setNow(new Date());
      },
      shouldTickSelectedPaymentEverySecond ? 1_000 : 60_000,
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [
    isPaymentSheetOpen,
    isSelectedPaymentCountingDown,
    shouldTickSelectedPaymentEverySecond,
  ]);

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

        // 목록 응답만으로 즉시 렌더링하고, 건별 보강 데이터는 도착하는 대로 병합한다.
        const baseBidRecords = participations.map(getBidRecordFromParticipation);

        setApiBidRecords(baseBidRecords);
        setHistoryMessage("");

        const pendingPaymentId = window.sessionStorage.getItem(
          BID_HISTORY_OPEN_PAYMENT_ID_KEY,
        );
        const pendingPaymentRecord = pendingPaymentId
          ? baseBidRecords.find((bid) => bid.id === pendingPaymentId)
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

        const buncheolDetailCache: BuncheolDetailCache = new Map();

        participations.forEach((participation, participationIndex) => {
          const baseBidRecord = baseBidRecords[participationIndex];

          getBidRecordWithShippingData(
            accessToken,
            participation,
            buncheolDetailCache,
            baseBidRecord,
          )
            .then((enrichedBidRecord) => {
              if (!isActive || enrichedBidRecord === baseBidRecord) {
                return;
              }

              // 보강 도착 전에 결제 시트·주기 갱신으로 레코드가 이미 교체됐다면
              // (참조가 다르면) 구 데이터로 되돌리지 않는다.
              setApiBidRecords((bidRecords) =>
                bidRecords
                  ? bidRecords.map((bidRecord) =>
                      bidRecord === baseBidRecord
                        ? enrichedBidRecord
                        : bidRecord,
                    )
                  : bidRecords,
              );
            })
            .catch(() => {
              // 보강 실패 시 목록 응답 기반 레코드를 그대로 유지한다.
            });
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
        const buncheolDetailCache: BuncheolDetailCache = new Map();
        const bidRecords = await Promise.all(
          participations.map((participation) =>
            getBidRecordWithShippingData(
              accessToken,
              participation,
              buncheolDetailCache,
            ),
          ),
        );

        if (isActive) {
          setApiBidRecords(bidRecords);
        }
      } catch {
        // Keep the current list while the backend finishes deadline processing.
      }
    }

    let timer: number | null = null;
    // 입금 대기(기한 압박)는 15초, 확정·확인 대기(며칠 갈 수 있음)는 180초 —
    // 장기 대기 상태의 폴링이 무기한 고빈도로 돌지 않게 한다.
    const pollIntervalMs = hasUrgentPaymentPolling ? 15_000 : 180_000;

    function startPolling() {
      if (timer !== null) {
        return;
      }

      timer = window.setInterval(() => {
        void refreshParticipations();
      }, pollIntervalMs);
    }

    function stopPolling() {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    // 백그라운드 탭·웹뷰에서는 폴링을 멈추고, 복귀하면 즉시 1회 갱신 후 재개한다.
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        stopPolling();
      } else {
        void refreshParticipations();
        startPolling();
      }
    }

    void refreshParticipations();

    if (document.visibilityState !== "hidden") {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authState.isLoggedIn, shouldRefreshPaymentState, hasUrgentPaymentPolling]);

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

    const returnBid = findBidRecordById(paymentBidRecords, returnState.bidId);

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
  }, [
    defaultAddressIds,
    deliveryAddresses,
    paymentBidRecords,
  ]);

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
        if (isHiddenCancelledBidRecord(bid)) {
          return false;
        }

        if (
          filter !== "all" &&
          isParticipationCancelledStatus(bid.participationStatus)
        ) {
          return false;
        }

        if (filter === "payment") {
          // C2C 보냈어요(확인 대기)도 입금 축 탭에 남긴다 — 개최자 확인을 기다리는 동안
          // 계좌를 다시 확인할 수 있어야 한다 (docs/46 §3-5).
          return canViewBidRecordPaymentSheet(bid, now);
        }

        if (filter === "confirmed") {
          return isBidRecordPaymentConfirmed(bid);
        }

        return true;
      });

    // 참여 1건 = 카드 1장. 같은 분철이라도 참여(멤버)별로 각각 보여준다.
    // 서버가 최신 참여순(createdAt DESC)으로 내려주므로 재정렬하지 않고 그 순서를 유지한다
    // — 마감일 기준으로 다시 정렬하면 방금 참여한 건이 아래로 밀린다.
    return filteredRecords;
  }, [authState.isLoggedIn, filter, now, paymentBidRecords]);
  /*
   * 필터를 걸어 목록이 비었을 때 "아직 참여한 분철이 없어요"라고 하면 사실과 다르다 —
   * 참여는 있는데 이 조건에 맞는 게 없을 뿐이고, 화면에는 필터를 되돌릴 안내도 없었다.
   * 필터 이전 개수로 "정말 없음"과 "조건에 안 맞음"을 갈라 쓴다.
   */
  const hasAnyBidRecords = useMemo(
    () =>
      authState.isLoggedIn &&
      paymentBidRecords.some((bid) => !isHiddenCancelledBidRecord(bid)),
    [authState.isLoggedIn, paymentBidRecords],
  );
  const hostedRecords = useMemo(() => {
    if (!authState.isLoggedIn) {
      return [];
    }

    const sourceProducts = apiHostedProducts ?? [];

    return [...sourceProducts]
      .filter((product) => {
        const isClosed = isHostedProductClosed(product, now);

        if (isBuncheolDeletedStatus(product.status)) {
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
      // 취소된 분철을 아래로 내린 뒤 개최일 역순 = 최근에 연 분철이 맨 위 (docs/57 §3).
      // 마감일은 개최일과 다른 축이라, 나중에 연 분철의 마감일이 더 이르면 순서가 뒤집힌다.
      // 정렬 기준이 두 곳으로 나뉘면 뒤에 도는 쪽이 앞의 그룹핑을 덮어쓰므로 이 비교자 하나로 합친다.
      .sort((left, right) => {
        const cancelledDiff =
          (isBuncheolCancelledStatus(left.status) ? 1 : 0) -
          (isBuncheolCancelledStatus(right.status) ? 1 : 0);

        if (cancelledDiff !== 0) {
          return cancelledDiff;
        }

        const leftOpenedAt = getHostedProductOpenedAtTime(left);
        const rightOpenedAt = getHostedProductOpenedAtTime(right);

        // 개최일이 없는 구 응답은 맨 뒤로 내린다. 양쪽 다 없으면 기존 마감일 축으로 폴백해
        // 최소한 일정한 순서를 유지한다 (마감일도 못 읽으면 서버가 준 순서 그대로 둔다).
        if (leftOpenedAt === null || rightOpenedAt === null) {
          if (leftOpenedAt !== rightOpenedAt) {
            return leftOpenedAt === null ? 1 : -1;
          }

          const leftDeadline = parseHistoryDeadline(left.deadline).getTime();
          const rightDeadline = parseHistoryDeadline(right.deadline).getTime();
          const isLeftDeadlineValid = !Number.isNaN(leftDeadline);
          const isRightDeadlineValid = !Number.isNaN(rightDeadline);

          // 한쪽만 못 읽으면 읽은 쪽을 앞에 둔다. 여기서 0 을 돌려주면 "못 읽음"이 서로 다른
          // 두 건과 동시에 동률이 돼 비교자의 추이성이 깨지고 엔진마다 순서가 달라진다.
          if (isLeftDeadlineValid !== isRightDeadlineValid) {
            return isLeftDeadlineValid ? -1 : 1;
          }

          return isLeftDeadlineValid ? rightDeadline - leftDeadline : 0;
        }

        return rightOpenedAt - leftOpenedAt;
      });
  }, [
    apiHostedProducts,
    authState.isLoggedIn,
    hostedFilter,
    now,
  ]);
  const hasAnyHostedRecords = useMemo(
    () =>
      authState.isLoggedIn &&
      (apiHostedProducts ?? []).some(
        (product) => !isBuncheolDeletedStatus(product.status),
      ),
    [apiHostedProducts, authState.isLoggedIn],
  );

  function openPaymentSheet(bidId: string) {
    if (paymentSheetCloseTimerRef.current !== null) {
      window.clearTimeout(paymentSheetCloseTimerRef.current);
      paymentSheetCloseTimerRef.current = null;
    }

    const requestId = paymentStoreTypeRequestIdRef.current + 1;
    const currentTime = new Date();
    const selectedBid = findBidRecordById(paymentBidRecords, bidId);

    if (!selectedBid) {
      return;
    }

    // 만료 잠금은 LEGACY 전용이다 — C2C 는 기한이 지나도 시트를 연다.
    if (isBidRecordPaymentExpired(selectedBid, currentTime)) {
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

          // paymentDetail.bidAmount 는 파서 폴백 때문에 배송비 포함 총액일 수 있다. shippingFee 를
          // 알 때만 멤버가로 환산해 반영하고, 모르면 목록에서 계산한 기존 멤버가(amount)를 유지한다
          // — 총액으로 덮어쓰면 카드/시트의 "상품 금액" 과 캐시(bidAmount=멤버가)가 오염된다.
          const detailItemAmount =
            typeof paymentDetail.shippingFee === "number" &&
            paymentDetail.bidAmount > 0
              ? Math.max(paymentDetail.bidAmount - paymentDetail.shippingFee, 0)
              : null;

          writeCachedParticipationPayment({
            bidAmount: detailItemAmount ?? selectedBid.amount,
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
                        amount: detailItemAmount ?? bid.amount,
                        hostBankAccount:
                          paymentDetail.hostBankAccount ?? bid.hostBankAccount,
                        paymentAmount:
                          paymentDetail.paymentAmount ?? bid.paymentAmount,
                        paymentDueAt:
                          paymentDetail.paymentDueAt ?? bid.paymentDueAt,
                        participationStatus:
                          paymentDetail.paymentStatus ||
                          bid.participationStatus,
                        // 상태를 상세 응답으로 갈아끼우므로 판정도 같은 응답 것으로 함께 갈아끼운다
                        // (getBidRecordWithShippingData 와 같은 규칙).
                        cancellability:
                          paymentDetail.cancellability ??
                          bid.cancellability ??
                          null,
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

  // 제출 성공 시 서버 재조회 없이 해당 카드만 낙관적으로 REQUESTED 로 갱신한다.
  // 이미 REQUESTED 였던 건의 재제출은 잘못 올린 후기 링크 수정이라 토스트 문구를 구분한다.
  function handlePaybackRequested(participationId: string, tweetUrl: string) {
    const wasRequested = paymentBidRecords.some(
      (record) =>
        record.id === participationId &&
        record.payback?.status === "REQUESTED",
    );

    setApiBidRecords(
      (records) =>
        records?.map((record) =>
          record.id === participationId
            ? {
                ...record,
                payback: {
                  ...(record.payback ?? {}),
                  status: "REQUESTED" as const,
                  rejectReason: null,
                  requestedAt: new Date().toISOString(),
                  tweetUrl,
                },
              }
            : record,
        ) ?? records,
    );

    if (paybackToastTimerRef.current !== null) {
      window.clearTimeout(paybackToastTimerRef.current);
    }

    setPaybackToast(
      wasRequested
        ? "후기 링크를 수정했어요!"
        : "배송비 환급 신청 완료! 후기 확인 후 배송비를 보내드려요.",
    );
    paybackToastTimerRef.current = window.setTimeout(() => {
      setPaybackToast("");
      paybackToastTimerRef.current = null;
    }, 3200);
  }

  function openStatusHelpSheet() {
    if (statusHelpSheetCloseTimerRef.current !== null) {
      window.clearTimeout(statusHelpSheetCloseTimerRef.current);
      statusHelpSheetCloseTimerRef.current = null;
    }

    setIsStatusHelpSheetClosing(false);
    setIsStatusHelpSheetOpen(true);
    window.requestAnimationFrame(() => {
      setIsStatusHelpSheetEntered(true);
    });
  }

  function closeStatusHelpSheet() {
    if (statusHelpSheetCloseTimerRef.current !== null) {
      return;
    }

    setIsStatusHelpSheetClosing(true);
    setIsStatusHelpSheetEntered(false);
    statusHelpSheetCloseTimerRef.current = window.setTimeout(() => {
      statusHelpSheetCloseTimerRef.current = null;
      setIsStatusHelpSheetOpen(false);
      setIsStatusHelpSheetClosing(false);
    }, 280);
  }

  function changeMode(nextMode: BidHistoryMode) {
    if (nextMode === mode) {
      return;
    }

    // 직전 전환의 복원이 아직 안 끝났다면 컨테이너에는 이전 탭의 잔여 위치가
    // 남아 있으므로 저장하지 않는다 — 저장값 오염 방지.
    if (scrollContainerRef.current && pendingTabScrollModeRef.current === null) {
      tabScrollTopRef.current[mode] = scrollContainerRef.current.scrollTop;
    }

    pendingTabScrollModeRef.current = nextMode;
    setMode(nextMode);
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
      addressId: selectedPaymentAddressId ?? paymentDeliveryAddress?.id ?? null,
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

  function showActionToast(message: string) {
    if (actionToastTimerRef.current !== null) {
      window.clearTimeout(actionToastTimerRef.current);
    }

    setActionToast(message);
    actionToastTimerRef.current = window.setTimeout(() => {
      setActionToast("");
      actionToastTimerRef.current = null;
    }, 3200);
  }

  // 같은 분철 내 내 활성 참여를 함께 다루는 대상 목록 — 다슬롯 합산 입금 1회 전제
  // (docs/46 §4.7-A4: 서버 API 는 참여 단위, FE 가 일괄 반복 호출).
  // 이체 단위가 묶음이라 마킹 대상도 묶음으로 좁힌다.
  //
  // ⚠️ 묶음을 모르는 응답(서버 승격 전)에서는 <b>구 동작인 분철 기준</b>으로 되돌린다. 자기 슬롯만
  // 잡으면 다슬롯 사용자의 묶음이 쪼개져(1건만 PAYMENT_SENT) 개최자 입금확인이 409 로 영구히 막힌다
  // — 이 변경이 없애려는 바로 그 상태다.
  function getSameBundleRecords(
    bid: BidRecord,
    statusFilter: (status: string | undefined) => boolean,
  ) {
    return paymentBidRecords.filter(
      (record) =>
        isC2CBidRecord(record) &&
        statusFilter(record.participationStatus) &&
        (bid.bundleId
          ? record.bundleId === bid.bundleId
          : record.productId === bid.productId),
    );
  }

  // 「보냈어요」 사전 확인 — 되돌릴 수단이 없으므로(셀프 철회 제거, docs/71 §8-2) 이 모달이 유일한
  // 방어선이다. 금액·입금자명·계좌를 다시 보여주는 것이 설계의 핵심 — 사후 복구를 사전 경고로 바꿨다.
  function requestMarkPaymentSent(bid: BidRecord) {
    if (pendingParticipationId) {
      return;
    }

    const account = bid.hostBankAccount;

    // 버튼이 이미 disabled 라 도달하지 않지만, 계좌 없이 마킹되면 "안 보낸 돈을 보냈다" 가 되므로 남긴다.
    if (!account) {
      showActionToast(
        "개최자 계좌를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.",
      );
      return;
    }

    const targets = getSameBundleRecords(
      bid,
      isParticipationAwaitingPaymentStatus,
    );
    // 폴링이 상태를 바꿔 대상이 사라졌을 수 있다 — 모달을 띄우면 확인해도 아무 일이 안 일어난다.
    if (targets.length === 0) {
      showActionToast(
        "참여 상태가 바뀌었어요. 새로고침 후 다시 확인해 주세요.",
      );
      return;
    }

    const memberNames = targets.flatMap((target) =>
      getBidRecordOptionLabels(target),
    );
    // 묶음 총액 — 배송비는 묶음에 1회만 붙고 서버가 그 몫을 슬롯 하나에 실어 보낸다.
    const bundleTotal = targets.reduce(
      (sum, target) => sum + getBidRecordPaymentTotal(target),
      0,
    );

    setConfirmSheetRequest({
      cancelLabel: "아직 안 보냈어요",
      confirmLabel: "보냈어요",
      details: [
        { label: "보낼 금액", value: formatPrice(bundleTotal) },
        ...(bid.refundHolder
          ? [{ label: "입금자명", value: bid.refundHolder }]
          : []),
        {
          label: "받는 계좌",
          value: `${account.bank} ${account.account}${
            account.holder ? ` (${account.holder})` : ""
          }`.trim(),
        },
        ...(memberNames.length > 0
          ? [{ label: "멤버", value: memberNames.join(" · ") }]
          : []),
      ],
      onConfirm: () => {
        setConfirmSheetRequest(null);
        void handleMarkPaymentSent(bid);
      },
      title: "정말 보내셨나요?",
      warnings: [
        "금액이나 입금자명이 다르면 개최자가 통장에서 찾지 못할 수 있어요.",
        "한 번 누르면 되돌릴 수 없어요.",
      ],
    });
  }

  // C2C "보냈어요" — 묶음 단위 1회 요청. 이체가 한 번이므로 신고도 한 번이다.
  async function handleMarkPaymentSent(bid: BidRecord) {
    const accessToken = authState.accessToken;

    if (!accessToken) {
      showActionToast("로그인이 만료됐어요. 다시 로그인해 주세요.");
      return;
    }

    if (pendingParticipationId) {
      return;
    }

    const targets = getSameBundleRecords(
      bid,
      isParticipationAwaitingPaymentStatus,
    );

    if (targets.length === 0) {
      return;
    }

    setPendingParticipationId(bid.id);

    try {
      if (bid.bundleId) {
        await requestBundlePaymentSent(accessToken, bid.bundleId);
      } else {
        // 묶음을 모르는 응답 — 구 동작 그대로 슬롯마다 부른다. 한 건이라도 실패하면 전부 실패로
        // 다루어 화면과 서버가 갈리지 않게 한다(부분 성공을 낙관적으로 반영하지 않는다).
        for (const target of targets) {
          await requestParticipationPaymentSent(accessToken, target.id);
        }
      }

      const sentAt = new Date().toISOString();
      const markedIds = new Set(targets.map((target) => target.id));
      setApiBidRecords((records) =>
        records
          ? records.map((record) =>
              markedIds.has(record.id)
                ? {
                    ...record,
                    participationStatus: "PAYMENT_SENT",
                    // 상태를 낙관적으로 올리면 취소 판정도 같은 전이를 반영해야 한다 —
                    // 상태만 올리면 서버 판정이 CANCELLABLE 로 남아 취소 버튼이 그대로 노출된다.
                    cancellability: markPaymentSentCancellability(
                      record.cancellability,
                    ),
                    paymentSentAt: record.paymentSentAt ?? sentAt,
                  }
                : record,
            )
          : records,
      );

      setHistoryMessage("");
      showActionToast(
        "보냈어요 표시 완료! 개최자가 입금을 확인하면 알려드릴게요.",
      );
      closePaymentSheet();
    } catch (error) {
      // historyMessage 는 시트 백드롭(z-40)에 가려 안 보인다 — 시트 위(z-50) 토스트로 알린다.
      showActionToast(
        error instanceof Error
          ? error.message
          : "보냈어요 표시에 실패했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setPendingParticipationId(null);
    }
  }

  // C2C 자발 취소 — 참여(슬롯) 단위 취소 (docs/46 §4.7-A5: 다슬롯이어도 1건씩).
  function requestCancelParticipation(bid: BidRecord) {
    if (pendingParticipationId) {
      return;
    }

    const isApplied = isParticipationAppliedStatus(bid.participationStatus);

    setConfirmSheetRequest({
      confirmLabel: isApplied ? "신청 취소" : "참여 취소",
      description: isApplied
        ? "취소한 자리는 다른 사람이 선점할 수 있어요."
        : "이미 입금했다면 취소하지 말고 '보냈어요'를 눌러주세요.",
      onConfirm: () => {
        setConfirmSheetRequest(null);
        void runCancelParticipation(bid);
      },
      title: isApplied ? "신청을 취소할까요?" : "참여를 취소할까요?",
    });
  }

  async function runCancelParticipation(bid: BidRecord) {
    const accessToken = authState.accessToken;

    if (!accessToken) {
      showActionToast("로그인이 만료됐어요. 다시 로그인해 주세요.");
      return;
    }

    if (pendingParticipationId) {
      return;
    }

    setPendingParticipationId(bid.id);

    try {
      await cancelParticipation(accessToken, bid.id);
      setApiBidRecords((records) =>
        records
          ? records.map((record) =>
              record.id === bid.id
                ? {
                    ...record,
                    participationStatus: "CANCELLED",
                    cancelReason: USER_CANCELLED_REASON,
                  }
                : record,
            )
          : records,
      );
      setHistoryMessage("");
      // 자발 취소 건은 목록에서 사라지므로(docs/56 H-05) 카드가 증발한 것처럼 보이지 않게 알린다.
      showActionToast("참여를 취소했어요. 취소한 참여는 목록에서 사라져요.");
    } catch (error: unknown) {
      const failureMessage =
        error instanceof Error
          ? error.message
          : "참여를 취소하지 못했어요. 잠시 후 다시 시도해 주세요.";

      setHistoryMessage(failureMessage);
      // 서버가 성사 확정 후 취소를 거부하면(BCH-092) 그 사유가 사용자에게 닿아야 한다 —
      // historyMessage 는 목록 맨 위라 카드까지 스크롤한 상태에서는 보이지 않는다 (docs/56 H-09).
      showActionToast(failureMessage);
    } finally {
      setPendingParticipationId(null);
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

  // 스크롤 복원 단일 이펙트 — 탭 전환 복원(우선)과 세션스토리지 복원(페이지 재진입)을
  // 한 rAF 에서 처리한다. 과거엔 두 이펙트가 같은 조건에 반응해 등록 순서로 경합했고,
  // ref 가드로 봉합돼 있었다.
  useLayoutEffect(() => {
    if (mode === "joined" && isBidRecordsLoading) {
      return;
    }

    if (mode === "hosted" && isHostedProductsLoading) {
      return;
    }

    const pendingTabMode = pendingTabScrollModeRef.current;

    // 다른 탭의 전환 복원이 예약된 상태면 이 렌더에서는 아무것도 하지 않는다.
    if (pendingTabMode !== null && pendingTabMode !== mode) {
      return;
    }

    const restoreFrame = window.requestAnimationFrame(() => {
      if (!scrollContainerRef.current) {
        pendingTabScrollModeRef.current = null;
        return;
      }

      // 탭 전환 복원이 세션스토리지 복원보다 우선한다.
      if (pendingTabMode === mode) {
        scrollContainerRef.current.scrollTop = tabScrollTopRef.current[mode];
        pendingTabScrollModeRef.current = null;
        return;
      }

      const storedScrollTop = window.sessionStorage.getItem(
        BID_HISTORY_SCROLL_TOP_KEY,
      );

      if (!storedScrollTop) {
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
        {/* 제목은 탭과 무관하게 고정한다 — 탭을 누를 때마다 h1 이 "참여 내역 ↔ 개최 기록"으로
            바뀌면 같은 페이지 안에서 화면 정체성이 흔들리고, 브라우저 탭 제목과도 어긋난다.
            둘의 구분은 바로 아래 탭이 이미 하고 있다. */}
        <div className="bid-history-header__copy flex h-10 flex-col justify-center">
          <h1 className="bid-history-header__title text-[22px] font-semibold leading-none tracking-[-0.06em]">
            내 분철
          </h1>
        </div>
      </header>

      <div className="shrink-0 px-4 pb-4">
        <div className="mb-3">
          <SlidingTabs
            onChange={changeMode}
            tabs={[
              { label: "참여한 분철", value: "joined" },
              { label: "개최한 분철", value: "hosted" },
            ]}
            value={mode}
          />
        </div>

        <div className={mode === "joined" ? "" : "hidden"}>
          <SlidingFilterChips
            onChange={setFilter}
            tabs={[
              { label: "전체", value: "all" },
              { label: "입금 필요", value: "payment" },
              { label: "확정", value: "confirmed" },
            ]}
            value={filter}
          />
        </div>
        <div className={mode === "hosted" ? "" : "hidden"}>
          <SlidingFilterChips
            onChange={setHostedFilter}
            tabs={[
              { label: "전체", value: "all" },
              { label: "진행 중", value: "active" },
              { label: "모집 종료", value: "closed" },
            ]}
            value={hostedFilter}
          />
        </div>
      </div>

      <main
        // 도움말 버튼(absolute bottom-5, h-12)이 스크롤 맨 아래에서 마지막 카드를 덮는다 —
        // 하단 여백을 버튼 높이(48px)+오프셋(20px) 이상으로 잡는다 (docs/53 Q-21).
        className="app-page-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-24"
        ref={scrollContainerRef}
      >
        {/* 필터 칩 전환은 모션 없이 즉시 반영 — key 는 참여↔개최 전환에만 걸어 재생한다. */}
        <div
          className={shouldSkipEnterAnimation ? "" : "tab-content-enter"}
          key={mode}
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
            {!isBidRecordsLoading && actionablePaybackRecords.length > 0 ? (
              // 환급 액션이 카드 하단에 묻히지 않게, 목록 진입 즉시 보이는 집계 배너로 알린다.
              <button
                className="flex w-full items-center justify-between gap-3 rounded-[0.95rem] bg-black px-4 py-3.5 text-left shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
                onClick={() =>
                  setPaybackSheetBidId(actionablePaybackRecords[0].id)
                }
                type="button"
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#D7FF5F]/80">
                    {PAYBACK_EVENT_BLOCK_LABEL}
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold tracking-[-0.04em] text-white">
                    💸 배송비를 돌려받을 수 있는 참여가{" "}
                    {actionablePaybackRecords.length}건 있어요
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#D7FF5F] px-3 py-1.5 text-[12px] font-semibold text-black">
                  돌려받기
                </span>
              </button>
            ) : null}
            {isBidRecordsLoading ? (
              <BidHistoryListSkeleton />
            ) : records.length === 0 ? (
              authState.isLoggedIn ? (
                filter !== "all" && hasAnyBidRecords ? (
                  <EmptyState
                    action={{
                      label: "전체 보기",
                      onClick: () => setFilter("all"),
                    }}
                    description={
                      filter === "payment"
                        ? "입금할 차례가 오면 여기에 모아 보여드려요."
                        : "개최자가 입금을 확인하면 여기로 옮겨져요."
                    }
                    title={
                      filter === "payment"
                        ? "입금이 필요한 참여가 없어요"
                        : "확정된 참여가 없어요"
                    }
                  />
                ) : (
                  <EmptyState
                    action={{ href: "/", label: "진행 중인 분철 둘러보기" }}
                    description="원하는 멤버를 골라 참여하면 진행 상황이 여기에 쌓여요."
                    title="아직 참여한 분철이 없어요"
                  />
                )
              ) : (
                <EmptyState
                  action={{
                    href: createLoginHref({
                      cancelTo: "/profile/bids",
                      returnTo: "/profile/bids",
                    }),
                    label: "카카오로 시작하기",
                  }}
                  description="입금 확인부터 편의점 수령까지 한 화면에서 볼 수 있어요."
                  secondaryAction={{ href: "/", label: "먼저 분철 둘러보기" }}
                  title="참여한 분철의 진행 상황을 보여드려요"
                />
              )
            ) : null}
            {!isBidRecordsLoading && records.length > 0 ? (
            <div className="content-reveal space-y-3">
            {records.map((bid) => {
              const isCancelled = isBidRecordCancelled(bid);
              const cancellationNotice = getBidRecordCancellationNotice(bid);
              const buncheolChip = getBidRecordBuncheolChip(bid, now);
              const isPaymentConfirmed = isBidRecordPaymentConfirmed(bid);
              const isC2C = isC2CBidRecord(bid);
              const isPaymentSent =
                isC2C &&
                isParticipationPaymentSentStatus(bid.participationStatus);
              const isOverdue = isBidRecordPaymentOverdue(bid, now);
              const canOpenPaymentSheet = canViewBidRecordPaymentSheet(
                bid,
                now,
              );
              const canCancel = canCancelBidRecord(bid);
              const cancelBlockedNotice = getBidRecordCancelBlockedNotice(bid);
              const isActionPending = pendingParticipationId !== null;
              const safeOpenChatHref =
                isC2C && !isCancelled
                  ? getSafeOpenChatHref(bid.openChatUrl)
                  : null;
              const progressSteps = getBidRecordProgressSteps(bid, now);
              const cardShippingFee =
                typeof bid.shippingFee === "number" ? bid.shippingFee : null;
              const cardTotalAmount = getBidRecordPaymentTotal(bid);
              const isPaybackActionable = isPaybackRequestable(bid);
              const isPaybackRejected =
                isPaybackActionable && getPaybackStatus(bid) === "REJECTED";
              const paybackDeadlineNotice =
                isPaybackActionable && bid.payback?.submitDeadline
                  ? formatPaybackDeadlineNotice(bid.payback.submitDeadline)
                  : null;
              return (
                <article
                  className={`overflow-hidden rounded-[1rem] border bg-white px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.035)] transition-colors hover:bg-[#FBFCF7] ${
                    isPaybackRejected
                      ? "border-[#F3C1C1]"
                      : isPaybackActionable
                        ? "border-[#CFE86B]"
                        : "border-black/[0.08]"
                  }`}
                  key={bid.id}
                >
                  {isPaybackActionable ? (
                    // 배송 완료 카드에서 지금 중요한 액션이라, 카드 하단 블록과 별개로 상단 스트립으로도 노출한다.
                    <div className="-mx-4 -mt-4 mb-3.5">
                      <button
                        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${
                          isPaybackRejected
                            ? "bg-[#c03131] text-white"
                            : "bg-[#D7FF5F] text-black"
                        }`}
                        onClick={() => setPaybackSheetBidId(bid.id)}
                        type="button"
                      >
                        <span className="min-w-0 truncate text-[12px] font-semibold tracking-[-0.02em]">
                          {isPaybackRejected
                            ? "후기를 다시 확인해 주세요"
                            : "💸 후기를 작성하고 배송비를 돌려받을 수 있어요"}
                        </span>
                        <span aria-hidden="true" className="shrink-0 text-[13px] font-semibold">
                          →
                        </span>
                      </button>
                    </div>
                  ) : null}
                  <div className="flex items-start gap-3">
                    <div className="flex w-14 shrink-0 flex-col items-center gap-1.5">
                      <Link
                        aria-label={`${bid.title} 상세 보기`}
                        className={`relative h-14 w-14 overflow-hidden rounded-[0.85rem] bg-gradient-to-br ${bid.tone}`}
                        href={`/products/${bid.productId}?from=bids`}
                        onClick={rememberBidHistoryProductEntry}
                      >
                        {bid.imageUrl ? (
                          <Image
                            alt=""
                            // 취소 분철은 색은 유지한 채 라이트 블러로만 비활성 처리. 56px 썸네일이라
                            // 식별 가능한 2px 만 흐리고, scale-110 으로 블러 가장자리 번짐을 프레임 밖으로 밀어낸다.
                            className={`h-full w-full object-cover${
                              buncheolChip.tone === "cancelled"
                                ? " scale-110 blur-[2px]"
                                : ""
                            }`}
                            fill
                            sizes="56px"
                            src={bid.imageUrl}
                            unoptimized
                          />
                        ) : null}
                      </Link>
                      {/* 썸네일 폭(56px)에 갇힌 칩이라 라벨이 길면 글자가 잘려 나갔다
                          ("입금 모으는 중" → "입금 모으는"). 넘치면 말줄임으로 드러나게 한다. */}
                      <span
                        className={`w-full truncate whitespace-nowrap rounded-full px-1 py-0.5 text-center text-[10px] font-semibold ${buncheolChipToneClasses[buncheolChip.tone]}`}
                      >
                        {buncheolChip.label}
                      </span>
                      {/* 잠금이 풀리면서 기한 지난 카드가 기한 안 카드와 시각적으로 같아졌다.
                          "개최자가 취소할 수 있는 구간" 에 들어온 것을 목록에서도 알린다. */}
                      {isOverdue ? (
                        <span className="w-full truncate whitespace-nowrap rounded-full bg-black px-1 py-0.5 text-center text-[10px] font-semibold text-[#D7FF5F]">
                          기한 지남
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        className="block min-w-0"
                        href={`/products/${bid.productId}?from=bids`}
                        onClick={rememberBidHistoryProductEntry}
                      >
                        <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                          {bid.title}
                        </p>
                        <p className="mt-1 text-[13px] font-medium text-black/45">
                          {bid.optionLabel}
                        </p>
                      </Link>

                      {/*
                        같은 무게의 연둣빛 박스 5개가 나열돼 있어 "지금 뭘 해야 하는지"가
                        보이지 않고 카드 하나가 화면 1.5개를 먹었다.
                        실제로 중요한 건 "얼마를 넣어야 하는가"(입금 총액) 하나이므로
                        그것만 큰 글씨로 세우고, 나머지는 라벨-값 목록으로 접어 넣는다.
                      */}
                      <div className="mt-4 rounded-[0.75rem] bg-[#F7FAEE] px-3 py-2.5 ring-1 ring-[#E4F6A5]/55">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-[11px] font-medium text-black/35">
                            {isFreeBidRecord(bid) ? "참여 금액" : "입금 총액"}
                          </p>
                          <p className="text-[17px] font-semibold tracking-[-0.05em]">
                            {formatPrice(cardTotalAmount)}
                          </p>
                        </div>
                        <dl className="mt-2 space-y-1 border-t border-[#E4F6A5]/80 pt-2 text-[12px]">
                          <div className="flex items-baseline justify-between gap-2">
                            <dt className="shrink-0 font-medium text-black/35">
                              상품 금액
                            </dt>
                            <dd className="font-semibold tracking-[-0.03em]">
                              {formatPrice(bid.amount)}
                            </dd>
                          </div>
                          <div className="flex items-baseline justify-between gap-2">
                            <dt className="shrink-0 font-medium text-black/35">
                              배송비
                            </dt>
                            <dd className="font-semibold tracking-[-0.03em]">
                              {cardShippingFee !== null
                                ? formatPrice(cardShippingFee)
                                : "-"}
                            </dd>
                          </div>
                          <div className="flex items-baseline justify-between gap-2">
                            <dt className="shrink-0 font-medium text-black/35">
                              모집 기한
                            </dt>
                            <dd className="truncate font-semibold tracking-[-0.03em]">
                              {formatCompactDeadline(bid.deadline)}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="mt-4 rounded-[0.8rem] bg-[#F7FAEE] px-3 py-3 ring-1 ring-[#E4F6A5]/50">
                        {isCancelled && cancellationNotice ? (
                          <div className="mb-3 flex flex-col items-center gap-1.5">
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-black/45 ring-1 ring-black/10 shadow-[0_4px_10px_rgba(0,0,0,0.04)]">
                              {cancellationNotice.label}
                            </span>
                            {/* break-keep 없이는 좁은 폭에서 "환불돼 / 요." 처럼 어절 중간이
                                끊긴다 — 한국어는 단어 안에서 줄을 넘기지 않는다. */}
                            <p className="break-keep text-center text-[11px] font-medium leading-4 text-black/40">
                              {cancellationNotice.description}
                            </p>
                          </div>
                        ) : null}
                        <div className="relative">
                          {/* 연결선 여백 = 첫·마지막 점의 열 중심(열 폭의 절반) — 5열 10%, 6열 8.33% */}
                          <div
                            className={
                              progressSteps.length === 6
                                ? "absolute left-[8.333%] right-[8.333%] top-[9px] h-px bg-[#CAD6A0]"
                                : "absolute left-[10%] right-[10%] top-[9px] h-px bg-[#CAD6A0]"
                            }
                          />
                          {/* gap 은 0.5(2px) — 6단계 라벨이 한 줄에 들어갈 수 있는 폭을
                              한 칸이라도 더 벌기 위한 값이다. 아래 라벨의 tracking 과 함께
                              "한 줄로 필요한 폭"을 395px → 373px 로 낮춘다 (실측).
                              그래야 iPhone SE(375) · iPhone 12~15(390) 에서 접히지 않는다. */}
                          <div
                            className={`relative grid gap-0.5 ${
                              progressSteps.length === 6
                                ? "grid-cols-6"
                                : "grid-cols-5"
                            }`}
                          >
                            {progressSteps.map((step) => (
                              <div
                                className="flex min-w-0 flex-col items-center gap-1.5"
                                key={step.label}
                              >
                                {/* 현재 단계에만 링을 둘러 "지금 어디"를 표시한다 —
                                    라벨이 10px 이라 채워진 점만으로는 지나온 구간과
                                    현재 단계가 구분되지 않았다. */}
                                <span
                                  className={`h-[18px] w-[18px] rounded-full border-2 ${
                                    step.isActive
                                      ? "border-[#CFE86B] bg-[#D7FF5F]"
                                      : "border-[#dedede] bg-white"
                                  } ${
                                    step.isCurrent
                                      ? "ring-2 ring-[#CFE86B]/45 ring-offset-1 ring-offset-[#F7FAEE]"
                                      : ""
                                  }`}
                                />
                                <span
                                  className={`break-keep text-center text-[10px] leading-3 tracking-[-0.06em] ${
                                    step.isCurrent
                                      ? "font-bold text-black"
                                      : step.isActive
                                        ? "font-semibold text-black/70"
                                        : "font-semibold text-black/35"
                                  }`}
                                >
                                  {step.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {safeOpenChatHref ? (
                        <a
                          className="mt-3 flex items-center justify-between gap-3 rounded-[0.75rem] bg-[#F7FAEE] px-3 py-2.5 ring-1 ring-[#E4F6A5]/50"
                          href={safeOpenChatHref}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <span className="text-[12px] font-medium text-black/45">
                            개최자 오픈채팅
                          </span>
                          <span className="shrink-0 text-[12px] font-semibold text-black/70">
                            참여하기 →
                          </span>
                        </a>
                      ) : null}
                      {cancelBlockedNotice ? (
                        <p className="mt-3 text-[12px] font-medium leading-5 text-black/45">
                          {cancelBlockedNotice}
                        </p>
                      ) : null}
                      {canOpenPaymentSheet || canCancel || isPaymentSent ? (
                        <div className="mt-4 flex items-center justify-end gap-2">
                          {isPaymentSent ? (
                            <span className="rounded-full bg-[#E4F6A5] px-2.5 py-1.5 text-[12px] font-semibold text-black/70">
                              입금 확인 대기
                            </span>
                          ) : null}
                          {canCancel ? (
                            <button
                              className="shrink-0 rounded-full border border-black/[0.08] bg-white px-3 py-2 text-[13px] font-semibold text-black/55 disabled:text-black/25"
                              disabled={isActionPending}
                              onClick={() => requestCancelParticipation(bid)}
                              type="button"
                            >
                              {isParticipationAppliedStatus(
                                bid.participationStatus,
                              )
                                ? "신청 취소"
                                : "참여 취소"}
                            </button>
                          ) : null}
                          {canOpenPaymentSheet ? (
                            <button
                              className="shrink-0 rounded-full bg-black px-3 py-2 text-[13px] font-semibold text-[#D7FF5F] shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
                              onClick={() => openPaymentSheet(bid.id)}
                              type="button"
                            >
                              입금 정보
                            </button>
                          ) : null}
                        </div>
                      ) : null}
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
                          </div>
                        </div>
                      ) : null}
                      {isPaybackRequestable(bid) &&
                      getPaybackStatus(bid) === "REJECTED" ? (
                        // 반려는 재제출이 필요한 상태라, 이벤트 톤(연두)과 확실히 구분되는 붉은 카드로 표시한다.
                        <div className="mt-3 rounded-[0.75rem] border border-[#F3C1C1] bg-[#fff2f2] px-3 py-3">
                          <p className="text-[11px] font-medium text-[#c03131]/70">
                            {PAYBACK_EVENT_BLOCK_LABEL}
                          </p>
                          <p className="mt-1 text-[13px] font-semibold leading-5 text-[#c03131]">
                            후기를 다시 확인해 주세요
                          </p>
                          {bid.payback?.rejectReason ? (
                            <p className="mt-0.5 break-keep text-[12px] font-medium leading-5 text-black/55">
                              반려 사유: {bid.payback.rejectReason}
                            </p>
                          ) : null}
                          {paybackDeadlineNotice ? (
                            <p className="mt-0.5 break-keep text-[12px] font-medium leading-5 text-black/55">
                              {paybackDeadlineNotice}
                            </p>
                          ) : null}
                          <div className="mt-2 flex justify-end">
                            <button
                              className="shrink-0 rounded-full bg-black px-3 py-2 text-[13px] font-semibold text-[#D7FF5F] shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
                              onClick={() => setPaybackSheetBidId(bid.id)}
                              type="button"
                            >
                              {PAYBACK_RETRY_CTA_LABEL}
                            </button>
                          </div>
                        </div>
                      ) : isPaybackRequestable(bid) ? (
                        <div className="mt-3 rounded-[0.75rem] bg-[#F7FAEE] px-3 py-3 ring-1 ring-[#E4F6A5]/50">
                          <p className="text-[11px] font-medium text-black/35">
                            {PAYBACK_EVENT_BLOCK_LABEL}
                          </p>
                          <p className="mt-1 text-[13px] font-semibold leading-5 text-black/60">
                            X에 후기를 올리면 배송비를 돌려드려요
                          </p>
                          {paybackDeadlineNotice ? (
                            <p className="mt-0.5 break-keep text-[12px] font-medium leading-5 text-black/45">
                              {paybackDeadlineNotice}
                            </p>
                          ) : null}
                          <div className="mt-2 flex justify-end">
                            <button
                              className="shrink-0 rounded-full bg-black px-3 py-2 text-[13px] font-semibold text-[#D7FF5F] shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
                              onClick={() => setPaybackSheetBidId(bid.id)}
                              type="button"
                            >
                              {PAYBACK_CTA_LABEL}
                            </button>
                          </div>
                        </div>
                      ) : getPaybackBadgeLabel(bid) ? (
                        <div className="mt-3 rounded-[0.75rem] bg-[#F7FAEE] px-3 py-3 ring-1 ring-[#E4F6A5]/50">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] font-medium text-black/35">
                              {PAYBACK_EVENT_BLOCK_LABEL}
                            </p>
                            {getPaybackStatus(bid) === "COMPLETED" ? (
                              <span className="shrink-0 rounded-full bg-[#D7FF5F] px-2.5 py-1 text-[12px] font-semibold text-black shadow-[0_6px_14px_rgba(215,255,95,0.25)]">
                                환급 완료
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[13px] font-semibold leading-5 text-black/60">
                            {getPaybackBadgeLabel(bid)}
                          </p>
                          {getPaybackStatus(bid) === "REQUESTED" ? (
                            <div className="mt-2 flex justify-end">
                              <button
                                className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black/55 ring-1 ring-black/10"
                                onClick={() => setPaybackSheetBidId(bid.id)}
                                type="button"
                              >
                                {PAYBACK_EDIT_CTA_LABEL}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
            </div>
            ) : null}
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
                authState.isLoggedIn ? (
                  hostedFilter !== "all" && hasAnyHostedRecords ? (
                    <EmptyState
                      action={{
                        label: "전체 보기",
                        onClick: () => setHostedFilter("all"),
                      }}
                      description={
                        hostedFilter === "active"
                          ? "모집 중인 분철이 생기면 여기에 보여요."
                          : "모집이 끝나면 여기로 옮겨져요."
                      }
                      title={
                        hostedFilter === "active"
                          ? "진행 중인 분철이 없어요"
                          : "모집이 끝난 분철이 없어요"
                      }
                    />
                  ) : (
                    <EmptyState
                      action={{ href: "/upload", label: "분철 개최하기" }}
                      description="내가 연 분철의 입금 확인·운송장 등록을 여기서 관리해요."
                      title="아직 개최한 분철이 없어요"
                    />
                  )
                ) : (
                  <EmptyState
                    action={{
                      href: createLoginHref({
                        cancelTo: "/profile/bids",
                        returnTo: "/profile/bids",
                      }),
                      label: "카카오로 시작하기",
                    }}
                    description="분철을 열면 입금 확인과 배송을 여기서 관리해요."
                    title="내가 개최한 분철을 모아서 보여드려요"
                  />
                )
              ) : null}
              {!isHostedProductsLoading && hostedRecords.length > 0 ? (
              <div className="content-reveal space-y-3">
              {hostedRecords.map((product) => {
                const isClosed = isHostedProductClosed(product, now);
                const isCancelled = isBuncheolCancelledStatus(product.status);
                const optionCount =
                  product.optionCount ??
                  product.targetMembers?.length ??
                  product.options.length;
                const participantCount = product.options.reduce(
                  (total, option) => total + option.participantCount,
                  0,
                );
                const canDelete = canDeleteHostedProduct(product);
                const cancelBlockedNotice =
                  getHostedProductCancelBlockedNotice(product);

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
                              isBuncheolConfirmedStatus(product.status)
                                ? "bg-[#E4F6A5] text-black/70"
                                : isClosed
                                  ? "bg-[#f3f3f3] text-black/50"
                                  : "bg-[#D7FF5F] text-black shadow-[0_6px_14px_rgba(215,255,95,0.25)]"
                            }`}
                          >
                            {isCancelled
                              ? "취소"
                              : isBuncheolConfirmedStatus(product.status)
                                ? "진행 확정"
                                : isClosed
                                  ? "모집 종료"
                                  : "모집 중"}
                          </span>
                        </div>
                        {/* 부제에서 "멤버 N명"을 뺐다 — 바로 아래 칩이 같은 말을 반복하고 있었다. */}
                        <p className="mt-1 truncate text-[13px] font-medium text-black/45">
                          {product.era}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-[#E4F6A5] px-2.5 py-1 text-[12px] font-semibold text-black/70">
                            멤버 {optionCount}명
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
                    {cancelBlockedNotice ? (
                      <p className="mt-3 text-[12px] font-medium leading-5 text-black/45">
                        {cancelBlockedNotice}
                      </p>
                    ) : null}
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
                      {canDelete ? (
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
              ) : null}
            </div>
          )}
        </div>
      </main>

      <button
        aria-label={isHostingHelpSheet ? "개최 진행 안내 보기" : "참여 상태 안내 보기"}
        className={`motion-icon-button floating-help-button absolute bottom-5 right-4 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-black text-[18px] font-semibold text-[#D7FF5F] shadow-[0_14px_30px_rgba(0,0,0,0.28)] ${
          isChromeScrolledAway ? "floating-help-button--scrolled-away" : ""
        }`}
        onClick={openStatusHelpSheet}
        type="button"
      >
        ?
      </button>

      {isStatusHelpSheetOpen ? (
        <div
          className={`bid-sheet-backdrop fixed inset-0 z-40 flex items-end ${
            isStatusHelpSheetEntered && !isStatusHelpSheetClosing
              ? "bid-sheet-backdrop-active"
              : ""
          }`}
        >
          <button
            aria-label={
              isHostingHelpSheet ? "개최 진행 안내 닫기" : "참여 상태 안내 닫기"
            }
            className="absolute inset-0 cursor-default"
            onClick={closeStatusHelpSheet}
            type="button"
          />
          <section
            className={`bid-sheet-panel relative mx-auto flex max-h-[calc(100%-2.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[1.4rem] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
              isStatusHelpSheetEntered && !isStatusHelpSheetClosing
                ? "bid-sheet-panel-active"
                : ""
            }`}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[21px] font-semibold tracking-[-0.06em]">
                  {isHostingHelpSheet ? "개최 진행 안내" : "참여 상태 안내"}
                </h2>
                <p className="mt-1 text-[13px] font-medium text-black/45">
                  {isHostingHelpSheet
                    ? "내가 연 분철은 이런 순서로 진행돼요."
                    : isStatusGuideC2C
                      ? "회원이 개최한 분철은 이런 순서로 진행돼요."
                      : "참여한 분철은 이런 순서로 진행돼요."}
                </p>
              </div>
              <button
                aria-label="닫기"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
                onClick={closeStatusHelpSheet}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1 sheet-scroll">
              <div className="rounded-[0.95rem] bg-[#f7f7f7] px-4 py-4">
                {statusHelpSheetGuide.map((item, index) => (
                  <div className="flex gap-3" key={item.label}>
                    <div className="flex flex-col items-center">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[#CFE86B] bg-[#D7FF5F]">
                        <item.icon className="h-3.5 w-3.5" />
                      </span>
                      {index < statusHelpSheetGuide.length - 1 ? (
                        <span className="w-px flex-1 bg-[#CAD6A0]" />
                      ) : null}
                    </div>
                    <div
                      className={
                        index < statusHelpSheetGuide.length - 1 ? "pb-4" : ""
                      }
                    >
                      <p className="text-[13px] font-semibold tracking-[-0.04em]">
                        {item.label}
                      </p>
                      <p className="mt-1 text-[12px] font-medium leading-5 text-black/50">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {isHostingHelpSheet ? (
                <>
                  <p className="px-1 pt-3 text-[12px] font-medium leading-5 text-black/40">
                    각 단계의 버튼은 분철 카드의 &lsquo;관리하기&rsquo; 안에
                    있어요. 참여자에게는 단계가 바뀔 때마다 알림톡이 나가요.
                  </p>
                  {hasC2CHostedProduct ? (
                    <p className="px-1 pt-2 text-[12px] font-medium leading-5 text-black/40">
                      대금은 분철이지를 거치지 않고 내 계좌로 바로 들어와요.
                      입금한 참여자가 취소되면 환불은 개최자가 직접 해야 하고,
                      &lsquo;관리하기&rsquo;에서 환불이 필요한 참여와 계좌를
                      확인할 수 있어요.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="px-1 pt-3 text-[12px] font-medium leading-5 text-black/40">
                  사진 아래 칩은 분철 자체의 상태예요. 모집 중에는 마감까지 남은
                  날(D-day)을, 마감 후에는 진행 확정·취소 여부를 보여줘요.
                </p>
              )}
              {isHostingHelpSheet ? null : isStatusGuideC2C ? (
                <>
                  <p className="px-1 pt-2 text-[12px] font-medium leading-5 text-black/40">
                    성사가 확정되지 않거나 입금 기한이 지나면 참여가 취소될 수
                    있어요. 입금 전이었다면 돌려받을 금액이 없고, 이미
                    입금했다면 분철이지로 문의해 주세요.
                  </p>
                  <p className="px-1 pt-2 text-[12px] font-medium leading-5 text-black/40">
                    성사 확정 전까지는 참여를 직접 취소할 수 있어요. 확정된
                    뒤에는 개최자에게 먼저 알려 주세요.
                  </p>
                  <p className="px-1 pt-2 text-[12px] font-medium leading-5 text-black/40">
                    분철이지는 통신판매중개자이며, 대금은 개최자 계좌로 직접
                    입금돼요. 분철이지가 직접 개최한 분철은 신청 단계 없이 참여
                    즉시 30분 안에 입금하면 돼요.
                  </p>
                </>
              ) : (
                <>
                  <p className="px-1 pt-2 text-[12px] font-medium leading-5 text-black/40">
                    마감 때 최소 인원이 모이지 않거나 입금 기한이 지나면 참여가
                    취소될 수 있어요. 이미 입금했다면 등록한 환불 계좌로
                    환불돼요.
                  </p>
                  <p className="px-1 pt-2 text-[12px] font-medium leading-5 text-black/40">
                    위 순서는 분철이지가 직접 개최한 분철 기준이에요. 회원이
                    개최한 분철은 신청(무입금) 후 개최자가 성사를 확정하면 24시간
                    입금 안내를 받고, 송금 뒤 &lsquo;보냈어요&rsquo;를 눌러야
                    해요.
                  </p>
                </>
              )}
            </div>

            <button
              className="mt-4 h-12 w-full shrink-0 rounded-full bg-[#CFE86B] text-[15px] font-semibold text-black shadow-[0_10px_24px_rgba(120,132,82,0.2)]"
              onClick={closeStatusHelpSheet}
              type="button"
            >
              확인했어요
            </button>
          </section>
        </div>
      ) : null}

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
            className={`bid-sheet-panel relative mx-auto flex max-h-[calc(100%-2.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[1.4rem] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
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
                  {isSelectedPaymentC2C
                    ? "계좌 확인 후 입금하고 '보냈어요'를 눌러주세요."
                    : "계좌와 금액을 확인한 뒤 기한 내 입금해 주세요."}
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

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 sheet-scroll">
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

            <div className="mt-3 rounded-[0.9rem] bg-black px-4 py-3 text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-semibold text-[#D7FF5F]/80">
                  {isSelectedPaymentCountingDown ? "입금 마감까지" : "현재 상태"}
                </p>
                {/* 카운트다운이 아닐 때는 아래 24px 본문이 같은 라벨을 크게 쓴다 — 한 박스에 두 번 찍지 않는다. */}
                {isSelectedPaymentCountingDown ? (
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70">
                    {selectedPaymentStatusLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[24px] font-semibold tracking-[-0.06em]">
                {isSelectedPaymentCountingDown
                  ? selectedPaymentRemainingTime
                  : selectedPaymentStatusLabel}
              </p>
              <p className="mt-1 text-[12px] font-medium leading-5 text-white/60">
                {isSelectedPaymentCountingDown
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
              {selectedPaymentBid.refundHolder ? (
                // 입금자명은 LEGACY 자동 입금확인(페이액션)의 매칭 키이고, C2C 에서는 개최자가 통장에서
                // 찾는 유일한 단서다. 주문 직후 "입금 안내" 시트에만 있어서 나중에 이 시트로 계좌를 다시
                // 확인한 사용자는 안내 없이 송금하게 됐다 (docs/53 Q-17). 문구는 상세 체크아웃과 동일하게 맞춘다.
                <>
                  <p className="mt-3 text-[12px] font-medium leading-5 text-black/45">
                    입금자명{" "}
                    <span className="rounded-full bg-[#E4F6A5] px-2 py-0.5 font-semibold text-black/70">
                      {selectedPaymentBid.refundHolder}
                    </span>
                  </p>
                  <p className="mt-1.5 text-[12px] font-medium leading-5 text-black/45">
                    {isSelectedPaymentC2C
                      ? "이 이름으로 보내야 개최자가 입금을 확인할 수 있어요."
                      : "이 이름으로 보내야 자동으로 확인돼요. 다른 이름으로 보내면 확인이 늦어질 수 있어요."}
                  </p>
                </>
              ) : null}
              {/*
                중개자 고지(전상법 §20①)를 별도 문단으로 두지 않고 안내 문장에 흡수했다 (docs/56 H-06).
                고지 자체를 뺄 수는 없다 — 약관 제9조와 /broker-notice 가 "분철 상세 화면 및 참여·입금
                화면에 표시된다"고 공표하고 있고, 신청(APPLIED) 후 알림톡을 받고 오는 경로에서는
                사용자가 개최자 계좌를 보는 화면이 이 시트뿐이다.
              */}
              <p className="mt-3 text-[12px] font-medium leading-5 text-black/45">
                {isSelectedPaymentC2C
                  ? "송금 후 아래 '보냈어요'를 누르면 개최자가 입금을 확인해요. 분철이지는 통신판매중개자이며, 대금은 개최자 계좌로 직접 입금돼요."
                  : "송금 후 관리자가 입금을 확인하면 참여가 확정돼요."}
              </p>
              {selectedPaymentOpenChatHref ? (
                <a
                  className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-black/55 underline underline-offset-2"
                  href={selectedPaymentOpenChatHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  개최자 오픈채팅 참여하기 →
                </a>
              ) : null}
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
                    {paymentDeliveryAddress
                      ? getDeliveryAddressDisplayBranchName(paymentDeliveryAddress)
                      : "배송지 확인 중"}
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
                <span>
                  {paymentShippingFee !== null
                    ? formatPrice(paymentShippingFee)
                    : "-"}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[15px] font-semibold tracking-[-0.04em]">
                  결제 예정 금액
                  {paymentSlotCount > 1 ? (
                    <span className="ml-1 text-[12px] font-medium text-black/40">
                      자리 {paymentSlotCount}개 합계
                    </span>
                  ) : null}
                </span>
                <span className="text-[22px] font-semibold tracking-[-0.05em]">
                  {formatPrice(paymentTotalAmount)}
                </span>
              </div>
            </div>

            {isSelectedPaymentC2C && isSelectedPaymentReady ? (
              <button
                className="mt-4 h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-[#D7FF5F] shadow-[0_12px_24px_rgba(0,0,0,0.18)] disabled:bg-black/20 disabled:text-white/70"
                disabled={
                  !selectedPaymentBankAccount ||
                  pendingParticipationId !== null
                }
                onClick={() => requestMarkPaymentSent(selectedPaymentBid)}
                type="button"
              >
                {pendingParticipationId !== null
                  ? "표시하는 중"
                  : "입금 보냈어요"}
              </button>
            ) : isSelectedPaymentSent ? (
              // 되돌리는 전이가 없다 (docs/71 §8-2) — 잘못 눌렀으면 개최자에게 알리는 것이 유일한 경로다.
              <p className="mt-4 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3.5 text-[12px] font-medium leading-5 text-black/45">
                보냈다고 표시한 뒤에는 되돌릴 수 없어요. 잘못 눌렀다면 개최자에게
                알려 주세요.
              </p>
            ) : (
              <button
                className="mt-4 h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-[#D7FF5F] shadow-[0_12px_24px_rgba(0,0,0,0.18)] disabled:bg-black/20 disabled:text-white/70"
                disabled={!selectedPaymentBankAccount}
                onClick={closePaymentSheet}
                type="button"
              >
                확인했어요
              </button>
            )}
          </section>
        </div>
      ) : null}

      <ConfirmSheet
        onCancel={() => setConfirmSheetRequest(null)}
        request={confirmSheetRequest}
      />

      {actionToast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-6">
          <p
            aria-live="polite"
            className="soft-panel-enter rounded-full bg-black/92 px-4 py-3 text-center text-[12px] font-semibold tracking-[-0.04em] text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
            role="status"
          >
            {actionToast}
          </p>
        </div>
      ) : null}

      {selectedPaybackBid ? (
        <ShippingFeePaybackSheet
          key={selectedPaybackBid.id}
          onClose={() => setPaybackSheetBidId(null)}
          onRequested={handlePaybackRequested}
          target={{
            participationId: selectedPaybackBid.id,
            buncheolId: selectedPaybackBid.productId,
            optionLabel: selectedPaybackBid.optionLabel,
            shippingFee:
              typeof selectedPaybackBid.shippingFee === "number"
                ? selectedPaybackBid.shippingFee
                : null,
            payback: selectedPaybackBid.payback ?? null,
          }}
        />
      ) : null}

      {paybackToast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-6">
          <p
            aria-live="polite"
            className="soft-panel-enter rounded-full bg-black/92 px-4 py-3 text-center text-[12px] font-semibold tracking-[-0.04em] text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
            role="status"
          >
            {paybackToast}
          </p>
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
              className="sheet-scroll mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
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
                          {getDeliveryAddressDisplayBranchName(address)}
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
