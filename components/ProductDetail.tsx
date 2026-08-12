"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
} from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { ProductDetailItem, ProductOption } from "@/lib/mock-products";
import {
  ApiRequestError,
  addBuncheolBookmark,
  deleteBuncheol,
  participateBuncheol,
  requestBuncheolDetail,
  requestBuncheolManagement,
  requestParticipationPaymentDetail,
  removeBuncheolBookmark,
  requestShippingAddresses,
  requestUserProfile,
  toProductDetailItem,
  updateBankAccount,
  createShippingAddress,
  type BankAccountInfo,
  type BuncheolManagementOption,
  type CvsStore,
} from "@/lib/auth-api";
import { trackEvent } from "@/lib/analytics";
import {
  createLoginHref,
  getCurrentBrowserHref,
} from "@/lib/auth-navigation";
import { getFreshAccessToken } from "@/lib/auth-session";
import { readAuthState, subscribeAuthState } from "@/lib/auth-store";
import {
  getBuncheolStatusBadgeLabel,
  getFlowType,
  isBuncheolCancelledStatus,
  isBuncheolConfirmedStatus,
  isBuncheolPaymentCollectingStatus,
  isBuncheolPurchasableStatus,
} from "@/lib/buncheol-states";
import { getSafeOpenChatHref } from "@/lib/open-chat-url";
import { FEATURES } from "@/lib/feature-flags";
import { getHistoryIndex } from "@/lib/history-index";
import {
  getDeliveryAddressStateFromSyncedAddresses,
  getInitialDeliveryAddressState,
  readDeliveryAddressState,
  subscribeDeliveryAddressState,
  writeDeliveryAddressState,
} from "@/lib/delivery-address-store";
import { lastAddedDeliveryAddressIdKey } from "@/lib/address-return-state";
import {
  getAvailableConvenienceStoreTypes,
  getConvenienceStoreLabel,
  getConvenienceStoreTypeFromShippingName,
  getDefaultDeliveryAddressesByType,
  getDeliveryAddressDisplayAlias,
  getDeliveryAddressDisplayBranchName,
  getPrioritizedDeliveryAddresses,
  maxDeliveryAddressCount,
  stripLeadingConvenienceStoreLabel,
  type DeliveryAddress,
} from "@/lib/mock-delivery-addresses";
import {
  accountNumberPattern,
  bankAccountFieldMaxLength,
  sanitizeAccountNumber,
} from "@/lib/bank-account";
import { writeSettlementAccountState } from "@/lib/settlement-account-store";
import {
  BackIcon,
  CloseIcon,
  EditIcon,
  ForwardIcon,
  HeartIcon,
  ShareIcon,
  TrashIcon,
} from "@/components/icons";
import { BottomNavigator } from "@/components/BottomNavigator";
import { BID_HISTORY_SKIP_ENTER_KEY, BidHistoryContent } from "@/components/BidHistoryContent";
import { useQueryClient } from "@tanstack/react-query";
import type { ProductCardItem } from "@/components/ProductCard";
import {
  buncheolsQueryKey,
  homeListingsQueryKey,
} from "@/lib/query-keys";
import { writeCachedParticipationPayment } from "@/lib/participation-payment-cache";
import {
  FAVORITES_SKIP_ENTER_KEY,
  FavoritesContent,
} from "@/components/FavoritesContent";
import { HOME_SKIP_ENTER_KEY, HomeContent } from "@/components/HomeContent";
import { PROFILE_SKIP_ENTER_KEY } from "@/components/ProfileContent";
import {
  SEARCH_SKIP_ENTER_KEY,
  SearchExperience,
} from "@/components/SearchExperience";
import { SwipeUnderlay } from "@/components/SwipeUnderlay";

type ProductDetailProps = {
  product: ProductDetailItem;
  backHref?: string;
  // 서버 렌더 시각(ms). 카운트다운(deadlineTick 파생 텍스트·기한 판정)의 하이드레이션
  // 첫 렌더를 SSR HTML 과 결정적으로 일치시켜 hydration mismatch 를 막는다.
  initialNowMs?: number;
  initialReturnSource?: "home" | "bids" | "favorites" | "upload";
  initialReturnQuery?: string;
  startEntered?: boolean;
  renderShell?: boolean;
  onExitingChange?: (isExiting: boolean) => void;
};

export const productDetailShellClassName =
  "product-detail-shell system-chrome-white system-chrome-bottom-white relative h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]";

export const productPagePanelClassName =
  "product-page-panel relative mx-auto flex h-full w-full max-w-[430px] flex-col overflow-hidden bg-white";

type ProductReturnUnderlayProps = {
  isEntered: boolean;
  isExiting: boolean;
  returnQuery?: string;
  returnSource?: "home" | "bids" | "favorites" | "upload";
};

export function ProductReturnUnderlay({
  isEntered,
  isExiting,
  returnQuery,
  returnSource,
}: ProductReturnUnderlayProps) {
  const shouldRenderHomeUnderlay =
    returnSource === "home" ||
    returnSource === "upload" ||
    (returnSource === undefined && returnQuery === undefined);

  return (
    <>
      {shouldRenderHomeUnderlay ? (
        <SwipeUnderlay
          className="product-detail-underlay"
          isEntered={isEntered}
          isExiting={isExiting}
        >
          <HomeContent skipEnterAnimation />
          <BottomNavigator />
        </SwipeUnderlay>
      ) : null}

      {returnSource === "bids" ? (
        <SwipeUnderlay
          className="product-detail-underlay"
          isEntered={isEntered}
          isExiting={isExiting}
        >
          <BidHistoryContent skipEnterAnimation />
          <BottomNavigator activeLabel="Bids" />
        </SwipeUnderlay>
      ) : null}

      {returnSource === "favorites" ? (
        <SwipeUnderlay
          className="product-detail-underlay"
          isEntered={isEntered}
          isExiting={isExiting}
        >
          <FavoritesContent skipEnterAnimation />
          <BottomNavigator activeLabel="Favorites" />
        </SwipeUnderlay>
      ) : null}

      {returnQuery !== undefined ? (
        <SwipeUnderlay
          className="product-detail-underlay"
          constrainWidth={false}
          isEntered={isEntered}
          isExiting={isExiting}
        >
          <SearchExperience query={returnQuery} skipEnterAnimation />
        </SwipeUnderlay>
      ) : null}
    </>
  );
}

const PRODUCT_BID_HISTORY_ENTRY_INDEX_KEY = "product-bid-history-entry-index";
const PRODUCT_BID_HISTORY_ENTRY_STATE_KEY = "__buncheolProductFromBidHistory";
const PRODUCT_FAVORITES_ENTRY_INDEX_KEY = "product-favorites-entry-index";
const PRODUCT_FAVORITES_ENTRY_STATE_KEY = "__buncheolProductFromFavorites";
const CHECKOUT_ADDRESS_RETURN_STATE_KEY =
  "buncheol-checkout-address-return-state";
const CHECKOUT_DRAFT_STATE_KEY = "buncheol-checkout-draft-state";
const checkoutDraftMaxAgeMs = 30 * 60 * 1000;

// 접수처 검색 시트는 체크아웃에서 필요할 때만 로드한다 (카카오 지도 SDK 포함).
const CvsStoreSearchSheet = dynamic(
  () =>
    import("@/components/CvsStoreSearchSheet").then(
      (module) => module.CvsStoreSearchSheet,
    ),
  { ssr: false },
);

// 서버 입금 기한 정책(선점 후 30분 칼컷, ParticipationService.PAYMENT_WINDOW)과 동일해야 한다.
const paymentWindowMs = 30 * 60 * 1000;
// C2C 입금 창 — 성사 확정·추가 모집(즉시입금) 후 24시간 (docs/46 §7.1-3).
const c2cPaymentWindowMs = 24 * 60 * 60 * 1000;
const sheetDragCloseThreshold = 72;
const kstOffsetHours = 9;

// applied 는 C2C 신청(무입금) 완료 화면 — 계좌·기한 없이 확정 대기를 안내한다.
type CheckoutSheetStep = "options" | "confirm" | "payment" | "applied";

type CheckoutDraftItem = {
  bidAmount: number;
  option: ProductOption;
};

type CheckoutPaymentItem = {
  bidAmount: number;
  option: ProductOption;
  participationId: string;
  paymentAmount: number;
  paymentDueAt?: string | null;
  participationStatus: string;
  shippingFee: number;
};

type CheckoutPaymentSummary = {
  deliveryAddress: DeliveryAddress | null;
  hostBankAccount: BankAccountInfo | null;
  items: CheckoutPaymentItem[];
  paymentDueAt?: string | null;
  productAmount: number;
  shippingAmount: number;
  totalAmount: number;
};

type CheckoutAddressReturnOption = {
  buncheolMemberId?: string;
  id: string;
  label?: string;
};

type CheckoutAddressReturnState = {
  addressId?: string | null;
  createdAt: number;
  options?: CheckoutAddressReturnOption[];
  optionIds: string[];
  productId: string;
  reopenAddressSheet: boolean;
};

function parseCheckoutAddressReturnOptions(
  value: unknown,
): CheckoutAddressReturnOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((option): CheckoutAddressReturnOption | null => {
      if (!option || typeof option.id !== "string") {
        return null;
      }

      return {
        buncheolMemberId:
          typeof option.buncheolMemberId === "string"
            ? option.buncheolMemberId
            : undefined,
        id: option.id,
        label: typeof option.label === "string" ? option.label : undefined,
      };
    })
    .filter(
      (option): option is CheckoutAddressReturnOption => option !== null,
    );
}

function parseCheckoutAddressReturnState(
  rawState: string | null,
  productId: string,
): CheckoutAddressReturnState | null {
  if (!rawState) {
    return null;
  }

  try {
    const parsedState = JSON.parse(rawState) as Partial<CheckoutAddressReturnState>;

    if (
      !parsedState ||
      parsedState.productId !== productId ||
      !Array.isArray(parsedState.optionIds)
    ) {
      return null;
    }

    return {
      createdAt:
        typeof parsedState.createdAt === "number"
          ? parsedState.createdAt
          : Date.now(),
      addressId:
        typeof parsedState.addressId === "string"
          ? parsedState.addressId
          : null,
      optionIds: parsedState.optionIds.filter(
        (optionId): optionId is string => typeof optionId === "string",
      ),
      options: parseCheckoutAddressReturnOptions(parsedState.options),
      productId: parsedState.productId,
      reopenAddressSheet: parsedState.reopenAddressSheet !== false,
    };
  } catch {
    return null;
  }
}

function getCheckoutReturnOptionsFromState(
  state: CheckoutAddressReturnState,
): CheckoutAddressReturnOption[] {
  const seenKeys = new Set<string>();
  const options: CheckoutAddressReturnOption[] = [
    ...state.optionIds.map((optionId) => ({ id: optionId })),
    ...(state.options ?? []),
  ];

  return options.filter((option) => {
    const key = option.buncheolMemberId ?? option.id ?? option.label;

    if (!key || seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);
    return true;
  });
}

type ProductHistoryState = {
  idx?: unknown;
  [PRODUCT_BID_HISTORY_ENTRY_STATE_KEY]?: unknown;
  [PRODUCT_FAVORITES_ENTRY_STATE_KEY]?: unknown;
};

function OptionAvatar({
  option,
  size = "md",
}: {
  option: ProductOption;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClassName =
    size === "lg" ? "h-12 w-12" : size === "sm" ? "h-10 w-10" : "h-11 w-11";
  const textClassName =
    size === "lg" ? "text-[13px]" : size === "sm" ? "text-[12px]" : "text-[12px]";

  return (
    <div
      className={`relative flex ${sizeClassName} shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${
        option.avatarTone ?? "from-zinc-100 via-white to-zinc-400"
      } ${textClassName} font-semibold tracking-[-0.04em] text-black ring-1 ring-black/10`}
    >
      {option.imageUrl ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${JSON.stringify(option.imageUrl)})` }}
        />
      ) : (
        option.avatarInitials ?? option.label.slice(0, 2)
      )}
    </div>
  );
}

function getHistoryState() {
  return window.history.state as ProductHistoryState | null;
}

function hasBidHistoryEntryState() {
  return getHistoryState()?.[PRODUCT_BID_HISTORY_ENTRY_STATE_KEY] === true;
}

function hasFavoritesEntryState() {
  return getHistoryState()?.[PRODUCT_FAVORITES_ENTRY_STATE_KEY] === true;
}

function priceToNumber(price: string) {
  return Number(price.replace(/[^0-9]/g, ""));
}

function formatPrice(price: number) {
  return `${price.toLocaleString("ko-KR")}원`;
}

function parseKoreaDateTime(value: string) {
  const match = value
    .trim()
    .match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})(?:\D+(\d{1,2})(?::\d{2})?)?/);

  if (match) {
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

  const isoDate = new Date(value);

  return Number.isNaN(isoDate.getTime()) ? new Date(Number.NaN) : isoDate;
}

function getStartingBid(option: ProductOption) {
  return option.startingBid ?? option.price ?? option.currentBid;
}

function getOptionPriceLabel() {
  return "구매가";
}

function getBidBaseline(option: ProductOption) {
  return getStartingBid(option);
}

function isDeadlineClosed(deadline: string, now = Date.now()) {
  const deadlineDate = parseKoreaDateTime(deadline);

  return (
    !Number.isNaN(deadlineDate.getTime()) &&
    deadlineDate.getTime() <= now
  );
}

function formatPurchaseDeadlineCountdown(deadline: string, now = Date.now()) {
  const deadlineDate = parseKoreaDateTime(deadline);

  if (Number.isNaN(deadlineDate.getTime())) {
    return deadline;
  }

  const remainingMilliseconds = deadlineDate.getTime() - now;

  if (remainingMilliseconds <= 0) {
    return "구매 마감";
  }

  const totalSeconds = Math.floor(remainingMilliseconds / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    seconds.toString().padStart(2, "0"),
  ].join(":");

  if (days > 0) {
    return `${days}일 ${clock} 남음`;
  }

  return `${clock} 남음`;
}

function parseCheckoutDateTime(value: string | null | undefined) {
  if (!value) {
    return new Date(Number.NaN);
  }

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  return parseKoreaDateTime(value);
}

function formatPaymentDueCountdown(
  value: string | null | undefined,
  now = Date.now(),
  windowMs = paymentWindowMs,
) {
  const dueDate = parseCheckoutDateTime(value);

  if (Number.isNaN(dueDate.getTime())) {
    return "-";
  }

  // 입금 기한은 입금 창(LEGACY 30분 / C2C 24시간)을 넘을 수 없다. 서버 절대시각과
  // 클라이언트 시계의 오차로 남은시간이 창을 초과해 보이지 않도록 상한을 건다.
  const remainingMilliseconds = Math.min(
    dueDate.getTime() - now,
    windowMs,
  );

  if (remainingMilliseconds <= 0) {
    return "입금 마감";
  }

  // 서버가 초 단위(UTC)로 내려주는 기한을 내림하면 응답 지연만큼 한 단계
  // 일찍 줄어들어 보이므로, 진행 중인 초를 포함해 올림으로 표시한다.
  const totalSeconds = Math.ceil(remainingMilliseconds / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}일 ${hours.toString().padStart(2, "0")}시간 남음`;
  }

  if (hours > 0) {
    return `${hours}시간 ${minutes.toString().padStart(2, "0")}분 남음`;
  }

  return `${minutes}분 ${seconds.toString().padStart(2, "0")}초 남음`;
}

// 참여 직후 받은 입금 기한을 응답 수신 시각 + 입금 창으로 상한 보정한다.
// 서버·클라이언트 시계가 어긋나도 방금 시작한 카운트다운이 창을 넘거나
// 실제 만료보다 늦게 끝나 보이지 않는다 (만료 판정 자체는 서버가 한다).
function clampPaymentDueAt(
  dueAt: string | null | undefined,
  receivedAt: number,
  windowMs = paymentWindowMs,
): string | null | undefined {
  if (!dueAt) {
    return dueAt;
  }

  const dueDate = parseCheckoutDateTime(dueAt);

  if (Number.isNaN(dueDate.getTime())) {
    return dueAt;
  }

  const maxDueAtMs = receivedAt + windowMs;

  return dueDate.getTime() > maxDueAtMs
    ? new Date(maxDueAtMs).toISOString()
    : dueAt;
}

const PURCHASE_OPTION_LABELS = {
  applied: "신청이 완료된 멤버예요",
  complete: "구매가 완료됐어요",
  paymentWaiting: "입금 대기중",
  unavailable: "선택할 수 없는 멤버예요",
} as const;

// 멤버 슬롯 칩에 실제로 노출되는 문구. PURCHASE_OPTION_LABELS 는 상태 판별용 내부 값이라 분리한다.
const MEMBER_STATUS_CHIP_LABELS = {
  myApplied: "내가 신청한 멤버",
  myComplete: "내가 구매한 멤버",
  myPaymentWaiting: "내 주문이 진행중이에요",
  otherApplied: "다른 사람이 신청했어요",
  otherComplete: "매진",
  otherPaymentWaiting: "다른 사람이 주문 진행중이에요",
} as const;

// 멤버 슬롯 오버레이 칩 공통 스타일 — 버튼/스팬 분기가 같은 모양을 유지하도록 한 곳에 둔다.
// max-w+truncate 는 좁은 뷰포트·글꼴 확대에서 긴 라벨이 잘릴 때 말줄임으로 처리하기 위함.
const memberStatusChipClassName =
  "max-w-[calc(100%-2rem)] truncate rounded-full bg-black/70 px-3.5 py-1.5 text-[12px] font-semibold text-white backdrop-blur";

// 서버 participatedByMe(상세 응답) 또는 이 세션에서 방금 참여한 로컬 상태로 "내 참여"를 판별한다.
function isOptionParticipatedByMe(option: ProductOption, myBid?: number) {
  return (
    option.participatedByMe === true ||
    Boolean(option.myParticipationId) ||
    Boolean(myBid)
  );
}

function getOptionPaymentWaitingLabel(
  option: ProductOption,
  now = Date.now(),
  isMine = false,
  windowMs = paymentWindowMs,
) {
  const baseLabel = isMine
    ? MEMBER_STATUS_CHIP_LABELS.myPaymentWaiting
    : MEMBER_STATUS_CHIP_LABELS.otherPaymentWaiting;
  const dueAt = option.purchasePaymentDueAt;

  if (!dueAt) {
    return baseLabel;
  }

  const dueDate = parseCheckoutDateTime(dueAt);

  if (Number.isNaN(dueDate.getTime()) || dueDate.getTime() <= now) {
    return baseLabel;
  }

  return `${baseLabel} · ${formatPaymentDueCountdown(dueAt, now, windowMs)}`;
}

function getTargetTags(product: ProductDetailItem) {
  const tags = product.targetMembers ?? [product.member];

  return tags
    .filter((tag, index, tags) => tag && tags.indexOf(tag) === index)
    .map((tag) => `#${tag}`);
}

function getProductImageUrls(product: ProductDetailItem) {
  // 캐러셀은 등록 순(imageUrls)을 그대로 보여준다 — 대표사진(imageUrl)을 앞으로 당기지 않는다.
  // imageUrls 가 없는 로컬/레거시 데이터만 imageUrl 로 폴백한다.
  const orderedImageUrls =
    (product.imageUrls?.length ?? 0) > 0
      ? (product.imageUrls as string[])
      : [product.imageUrl];

  return orderedImageUrls.filter(
    (imageUrl, index, imageUrls): imageUrl is string => {
      return Boolean(imageUrl) && imageUrls.indexOf(imageUrl) === index;
    },
  );
}

function formatCheckoutDateTime(value: string | null | undefined) {
  const date = parseCheckoutDateTime(value);

  if (Number.isNaN(date.getTime())) {
    return value ?? "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getBankAccountKey(account: BankAccountInfo | null | undefined) {
  if (!account) {
    return "";
  }

  return [account.bank, account.account, account.holder]
    .map((value) => value.trim())
    .join("|");
}

function getEarliestPaymentDueAt(items: CheckoutPaymentItem[]) {
  return items.reduce<string | null>((earliestDueAt, item) => {
    if (!item.paymentDueAt) {
      return earliestDueAt;
    }

    if (!earliestDueAt) {
      return item.paymentDueAt;
    }

    const itemDate = new Date(item.paymentDueAt);
    const earliestDate = new Date(earliestDueAt);

    if (Number.isNaN(itemDate.getTime())) {
      return earliestDueAt;
    }

    if (Number.isNaN(earliestDate.getTime())) {
      return item.paymentDueAt;
    }

    return itemDate.getTime() < earliestDate.getTime()
      ? item.paymentDueAt
      : earliestDueAt;
  }, null);
}

function getMyBidsFromOptions(options: ProductOption[]) {
  return options.reduce<Record<string, number>>((bids, option) => {
    if (typeof option.myBidAmount === "number" && option.myBidAmount > 0) {
      bids[option.id] = option.myBidAmount;
    }

    return bids;
  }, {});
}

function isConfirmedOptionPurchase(option: ProductOption) {
  const status = option.purchasePaymentStatus?.toUpperCase();
  const saleStatus = option.saleStatus?.toUpperCase();

  return Boolean(
    option.purchasePaymentConfirmedAt ||
      saleStatus === "SOLD" ||
      status === "CONFIRMED" ||
      status === "PAYMENT_CONFIRMED" ||
      status === "PAID",
  );
}

function isInactiveOptionPurchaseStatus(status: string | undefined) {
  return [
    "CANCELLED",
    "CANCELED",
    "EXPIRED",
    "FAILED",
    "REFUNDED",
    "REJECTED",
  ].includes(status?.toUpperCase() ?? "");
}

function hasOptionPurchaseState(option: ProductOption) {
  if (isInactiveOptionPurchaseStatus(option.purchasePaymentStatus)) {
    return false;
  }

  return Boolean(
    option.purchaseParticipationId ||
      option.purchasePaymentStatus ||
      option.purchasePaymentConfirmedAt ||
      option.purchasePaymentDueAt,
  );
}

function isUnavailablePurchaseOption(option: ProductOption) {
  return option.available === false;
}

function getOptionPurchaseOverlayLabel(
  option: ProductOption,
  myBid?: number,
  shouldUseParticipantCount = false,
) {
  const saleStatus = option.saleStatus?.toUpperCase();

  // C2C 신청(무입금)이 선점한 슬롯 (docs/46 §4.6 — BuncheolMemberSaleStatus.APPLIED).
  if (saleStatus === "APPLIED") {
    return PURCHASE_OPTION_LABELS.applied;
  }

  if (saleStatus === "AWAITING_PAYMENT") {
    return PURCHASE_OPTION_LABELS.paymentWaiting;
  }

  if (saleStatus === "SOLD") {
    return PURCHASE_OPTION_LABELS.complete;
  }

  if (saleStatus === "AVAILABLE") {
    return null;
  }

  const isConfirmed = isConfirmedOptionPurchase(option);

  if (myBid) {
    return isConfirmed
      ? PURCHASE_OPTION_LABELS.complete
      : PURCHASE_OPTION_LABELS.paymentWaiting;
  }

  if (hasOptionPurchaseState(option)) {
    return isConfirmed
      ? PURCHASE_OPTION_LABELS.complete
      : PURCHASE_OPTION_LABELS.paymentWaiting;
  }

  if (shouldUseParticipantCount && option.participantCount > 0) {
    return PURCHASE_OPTION_LABELS.paymentWaiting;
  }

  if (isUnavailablePurchaseOption(option)) {
    return PURCHASE_OPTION_LABELS.unavailable;
  }

  if (option.available === true) {
    return null;
  }

  return null;
}

function getOptionPurchaseBlockChipLabel(
  overlayLabel: string | null,
  option?: ProductOption,
  now = Date.now(),
  isMine = false,
  windowMs = paymentWindowMs,
) {
  if (!overlayLabel) {
    return null;
  }

  if (overlayLabel === PURCHASE_OPTION_LABELS.unavailable) {
    return "구매 불가";
  }

  if (overlayLabel === PURCHASE_OPTION_LABELS.applied) {
    return isMine
      ? MEMBER_STATUS_CHIP_LABELS.myApplied
      : MEMBER_STATUS_CHIP_LABELS.otherApplied;
  }

  if (overlayLabel === PURCHASE_OPTION_LABELS.complete) {
    return isMine
      ? MEMBER_STATUS_CHIP_LABELS.myComplete
      : MEMBER_STATUS_CHIP_LABELS.otherComplete;
  }

  if (overlayLabel === PURCHASE_OPTION_LABELS.paymentWaiting) {
    return option
      ? getOptionPaymentWaitingLabel(option, now, isMine, windowMs)
      : isMine
        ? MEMBER_STATUS_CHIP_LABELS.myPaymentWaiting
        : MEMBER_STATUS_CHIP_LABELS.otherPaymentWaiting;
  }

  return overlayLabel;
}

function getManagementOptionPurchaseState(option: BuncheolManagementOption) {
  const winner = option.winner;

  if (
    winner?.participationId ||
    winner?.paymentStatus ||
    winner?.paymentConfirmedAt ||
    winner?.paymentDueAt
  ) {
    return {
      purchasePaymentConfirmedAt: winner.paymentConfirmedAt ?? undefined,
      purchasePaymentDueAt: winner.paymentDueAt ?? undefined,
      purchasePaymentStatus:
        winner.paymentStatus ??
        (winner.paymentConfirmedAt ? "CONFIRMED" : "AWAITING_PAYMENT"),
      purchaseParticipationId: winner.participationId ?? undefined,
    };
  }

  const participant = option.participants?.find(
    (item) => !isInactiveOptionPurchaseStatus(item.status),
  );

  if (!participant) {
    return {};
  }

  return {
    purchasePaymentDueAt: participant.dueAt ?? undefined,
    purchasePaymentStatus: participant.status || "AWAITING_PAYMENT",
    purchaseParticipationId: participant.participationId,
  };
}

function mergeManagementOptionPurchaseStates(
  options: ProductOption[],
  managementOptions: BuncheolManagementOption[],
) {
  const optionsById = new Map(
    managementOptions.map((option) => [option.buncheolMemberId, option]),
  );
  const optionsByName = new Map(
    managementOptions.map((option) => [option.memberName, option]),
  );

  return options.map((option) => {
    const managementOption =
      optionsById.get(option.buncheolMemberId ?? option.id) ??
      optionsByName.get(option.label);

    if (!managementOption) {
      return option;
    }

    return {
      ...option,
      ...getManagementOptionPurchaseState(managementOption),
      participantCount: Math.max(
        option.participantCount,
        managementOption.participationCount,
        managementOption.participants?.length ?? 0,
      ),
    };
  });
}

export function ProductDetail({
  backHref,
  product,
  initialNowMs,
  initialReturnSource,
  initialReturnQuery,
  startEntered = false,
  renderShell = true,
  onExitingChange,
}: ProductDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    readAuthState,
  );
  const deliveryAddressState = useSyncExternalStore(
    subscribeDeliveryAddressState,
    readDeliveryAddressState,
    getInitialDeliveryAddressState,
  );
  const didNavigateBack = useRef(false);
  const didRestoreCheckoutAddressReturnRef = useRef(false);
  // 복원한 체크아웃 상태 보관용. StrictMode 재실행·상세 재조회로 아래 리셋
  // effect가 복원 직후 다시 돌면 상태가 지워지므로, 리셋될 때마다 재적용한다.
  const pendingCheckoutRestoreRef = useRef<CheckoutAddressReturnState | null>(
    null,
  );
  const shouldApplyCheckoutRestoreRef = useRef(false);
  const sheetEnterAnimationFrameRef = useRef<number | null>(null);
  const sheetCloseFallbackTimerRef = useRef<number | null>(null);
  const sheetDragStartYRef = useRef<number | null>(null);
  const checkoutSelectedOptionsRef = useRef<CheckoutAddressReturnOption[]>([]);
  const checkoutAddressSheetEnterAnimationFrameRef = useRef<number | null>(null);
  const checkoutAddressSheetCloseFallbackTimerRef = useRef<number | null>(null);
  const checkoutCopyToastTimerRef = useRef<number | null>(null);
  const productImagePointerStartXRef = useRef<number | null>(null);
  const wasProductImageDraggedRef = useRef(false);
  const [returnQuery] = useState<string | undefined>(initialReturnQuery);
  const [isEntered, setIsEntered] = useState(startEntered);
  const [isExiting, setIsExiting] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSheetEntered, setIsSheetEntered] = useState(false);
  const [isSheetClosing, setIsSheetClosing] = useState(false);
  const [sheetDragOffset, setSheetDragOffset] = useState(0);
  const [checkoutStep, setCheckoutStep] =
    useState<CheckoutSheetStep>("options");
  const [checkoutDeliveryAddress, setCheckoutDeliveryAddress] =
    useState<DeliveryAddress | null>(null);
  const [isCheckoutAddressSheetOpen, setIsCheckoutAddressSheetOpen] =
    useState(false);
  const [isCheckoutAddressSheetEntered, setIsCheckoutAddressSheetEntered] =
    useState(false);
  const [isCheckoutAddressSheetClosing, setIsCheckoutAddressSheetClosing] =
    useState(false);
  const [checkoutRefundAccount, setCheckoutRefundAccount] =
    useState<BankAccountInfo | null>(null);
  // 체크아웃 이탈 없는 계좌 등록 시트 — 마이페이지 왕복(복원 로직 포함)을 대체한다.
  const [isRefundAccountSheetOpen, setIsRefundAccountSheetOpen] =
    useState(false);
  const [refundAccountForm, setRefundAccountForm] = useState({
    account: "",
    bank: "",
    holder: "",
  });
  const [refundAccountError, setRefundAccountError] = useState("");
  const [isRefundAccountSaving, setIsRefundAccountSaving] = useState(false);
  const [isRefundAccountSheetEntered, setIsRefundAccountSheetEntered] =
    useState(false);
  // 체크아웃 이탈 없는 배송지 추가 — 접수처 검색 시트에서 바로 등록한다.
  const [isCvsStoreSearchOpen, setIsCvsStoreSearchOpen] = useState(false);
  const [isCheckoutAddressCreatePending, setIsCheckoutAddressCreatePending] =
    useState(false);
  // setState 스냅샷 가드는 await 사이 재진입을 못 막는다 — ref 로 즉시 잠근다 (ConfirmSheet 와 동일 패턴).
  const checkoutAddressCreateRef = useRef(false);
  // 공유 시트가 뜨는 동안 재진입을 막는다 (checkoutAddressCreateRef 와 동일 패턴).
  const isSharePendingRef = useRef(false);
  const productToastTimerRef = useRef<number | null>(null);
  const [productToast, setProductToast] = useState("");
  const [checkoutPaymentSummary, setCheckoutPaymentSummary] =
    useState<CheckoutPaymentSummary | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutCopyToast, setCheckoutCopyToast] = useState("");
  const [auctionOptions, setAuctionOptions] = useState<ProductOption[]>(
    product.options,
  );
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [myBids, setMyBids] = useState<Record<string, number>>(() =>
    getMyBidsFromOptions(product.options),
  );
  const [isLiked, setIsLiked] = useState(product.liked === true);
  const [isBookmarkPending, setIsBookmarkPending] = useState(false);
  const [isDeletePending, setIsDeletePending] = useState(false);
  const [isBidSubmitPending, setIsBidSubmitPending] = useState(false);
  const [isHostedByMeFromApi, setIsHostedByMeFromApi] = useState(
    product.isHostedByMe === true,
  );
  const [currentProductImageIndex, setCurrentProductImageIndex] = useState(0);
  const [productImageDragOffset, setProductImageDragOffset] = useState(0);
  const [isProductImageDragging, setIsProductImageDragging] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  // 서버 렌더 시각으로 시작해 하이드레이션 첫 렌더가 SSR HTML 과 정확히 일치하게
  // 만든다(Date.now() 로 시작하면 초 단위 카운트다운 텍스트가 항상 어긋나 매 진입마다
  // hydration 폴백이 발생). 마운트 직후 아래 effect 의 setDeadlineTick(Date.now()) 가
  // 클라이언트 시계로 즉시 넘긴다.
  const [deadlineTick, setDeadlineTick] = useState(
    () => initialNowMs ?? Date.now(),
  );
  const buncheolId = product.buncheolId ?? product.id;

  const selectedCheckoutItems = useMemo<CheckoutDraftItem[]>(() => {
    return auctionOptions
      .filter(
        (option) =>
          bidAmounts[option.id] === "selected" &&
          !getOptionPurchaseOverlayLabel(
            option,
            myBids[option.id],
            product.isApiProduct === true,
          ),
      )
      .map((option) => ({
        bidAmount: priceToNumber(getBidBaseline(option)),
        option,
      }));
  }, [auctionOptions, bidAmounts, myBids, product.isApiProduct]);

  const activeBidCount = selectedCheckoutItems.length;

  const totalBidAmount = useMemo(() => {
    return selectedCheckoutItems.reduce(
      (sum, item) => sum + item.bidAmount,
      0,
    );
  }, [selectedCheckoutItems]);

  function getCheckoutReturnOptionsForAmounts(
    amounts: Record<string, string>,
  ): CheckoutAddressReturnOption[] {
    return auctionOptions
      .filter(
        (option) =>
          amounts[option.id] === "selected" &&
          !getOptionPurchaseOverlayLabel(
            option,
            myBids[option.id],
            product.isApiProduct === true,
          ),
      )
      .map((option) => ({
        buncheolMemberId: option.buncheolMemberId,
        id: option.id,
        label: option.label,
      }));
  }

  function getCheckoutReturnOptionsFromItems(
    items: CheckoutDraftItem[],
  ): CheckoutAddressReturnOption[] {
    return items.map(({ option }) => ({
      buncheolMemberId: option.buncheolMemberId,
      id: option.id,
      label: option.label,
    }));
  }

  function getRestorableCheckoutOptionIds(
    restorableOptions: CheckoutAddressReturnOption[],
  ) {
    return auctionOptions.reduce<string[]>((optionIds, option) => {
      const isSelected = restorableOptions.some(
        (returnOption) =>
          returnOption.id === option.id ||
          (returnOption.buncheolMemberId &&
            returnOption.buncheolMemberId === option.buncheolMemberId) ||
          (returnOption.label && returnOption.label === option.label),
      );

      if (
        isSelected &&
        !getOptionPurchaseOverlayLabel(
          option,
          myBids[option.id],
          product.isApiProduct === true,
        )
      ) {
        optionIds.push(option.id);
      }

      return optionIds;
    }, []);
  }

  function getCheckoutReturnOptionsFromOptionIds(optionIds: string[]) {
    return auctionOptions
      .filter((option) => optionIds.includes(option.id))
      .map((option) => ({
        buncheolMemberId: option.buncheolMemberId,
        id: option.id,
        label: option.label,
      }));
  }

  function restoreCheckoutSelectionFromReturnOptions(
    returnOptions: CheckoutAddressReturnOption[],
  ) {
    // 참여 1건 = 멤버 1명(단일 선택 정책). 구버전 세션에 다중 선택이 저장돼 있어도 1개만 복원한다.
    const restorableOptionIds = getRestorableCheckoutOptionIds(
      returnOptions,
    ).slice(0, 1);

    if (restorableOptionIds.length === 0) {
      return false;
    }

    checkoutSelectedOptionsRef.current =
      getCheckoutReturnOptionsFromOptionIds(restorableOptionIds);
    setBidAmounts(
      restorableOptionIds.reduce<Record<string, string>>((amounts, optionId) => {
        amounts[optionId] = "selected";
        return amounts;
      }, {}),
    );

    return true;
  }

  const sortedAuctionOptions = [...auctionOptions].sort((left, right) => {
    const leftHasBid = Boolean(
      getOptionPurchaseOverlayLabel(
        left,
        myBids[left.id],
        product.isApiProduct === true,
      ),
    );
    const rightHasBid = Boolean(
      getOptionPurchaseOverlayLabel(
        right,
        myBids[right.id],
        product.isApiProduct === true,
      ),
    );

    if (leftHasBid === rightHasBid) {
      return 0;
    }

    return leftHasBid ? -1 : 1;
  });

  const shippingMethods =
    product.shippingMethods ??
    (product.isApiProduct
      ? []
      : [{ name: product.courier, price: "판매자 안내" }]);
  // 배송비 0원 옵션이 허용되면서 옵션별 요금 차이(예: GS25 0원 / CU 3,000원)가 실제로 생길 수 있다.
  // 첫 옵션 고정 참조는 선택한 편의점과 요금이 어긋나므로, 선택한 수령 편의점(storeType)의 옵션
  // 요금을 쓰고 주소 미선택 시에만 첫 옵션으로 폴백한다.
  const checkoutStoreShippingMethod = checkoutDeliveryAddress
    ? shippingMethods.find(
        (method) =>
          getConvenienceStoreTypeFromShippingName(method.name) ===
          checkoutDeliveryAddress.storeType,
      )
    : undefined;
  const estimatedShippingFee = priceToNumber(
    (checkoutStoreShippingMethod ?? shippingMethods[0])?.price ?? "",
  );
  const estimatedShippingAmount = activeBidCount > 0 ? estimatedShippingFee : 0;
  const estimatedCheckoutTotal = totalBidAmount + estimatedShippingAmount;
  const availableShippingStoreTypes = getAvailableConvenienceStoreTypes(
    product.shippingMethods,
    product.courier,
  );
  // 접수처 검색 시트에 넘길 허용 브랜드 — 상품이 취급하지 않는 편의점 배송지를
  // 등록해 결제 불가 루프에 빠지는 것 방지 (storeType "cu"/"gs25" → 브랜드 "CU"/"GS25").
  const checkoutAllowedCvsBrands =
    availableShippingStoreTypes.length > 0
      ? availableShippingStoreTypes.map((storeType) =>
          storeType === "cu" ? ("CU" as const) : ("GS25" as const),
        )
      : undefined;
  const isAddressLimitReached =
    deliveryAddressState.addresses.length >= maxDeliveryAddressCount;
  function getBidDeliveryAddressFromState(
    addressState: typeof deliveryAddressState,
  ) {
    const defaultDeliveryAddresses = getDefaultDeliveryAddressesByType(
      addressState.addresses,
      addressState.defaultAddressIds,
    );
    const prioritizedDeliveryAddresses = getPrioritizedDeliveryAddresses(
      addressState.addresses,
      addressState.defaultAddressIds,
    );

    return (
      availableShippingStoreTypes
        .map((storeType) => defaultDeliveryAddresses[storeType])
        .find((address) => address !== null) ??
      prioritizedDeliveryAddresses.find((address) =>
        availableShippingStoreTypes.length > 0
          ? availableShippingStoreTypes.includes(address.storeType)
          : true,
      ) ??
      null
    );
  }
  function getCheckoutEligibleDeliveryAddressesFromState(
    addressState: typeof deliveryAddressState,
  ) {
    return getPrioritizedDeliveryAddresses(
      addressState.addresses,
      addressState.defaultAddressIds,
    ).filter((address) =>
      availableShippingStoreTypes.length > 0
        ? availableShippingStoreTypes.includes(address.storeType)
        : true,
    );
  }
  function getPreferredDeliveryAddressFromState(
    addressState: typeof deliveryAddressState,
    preferredAddressId?: string | null,
  ) {
    const eligibleAddresses =
      getCheckoutEligibleDeliveryAddressesFromState(addressState);
    const preferredAddress = preferredAddressId
      ? eligibleAddresses.find((address) => address.id === preferredAddressId)
      : null;

    return (
      preferredAddress ??
      getBidDeliveryAddressFromState(addressState) ??
      eligibleAddresses[0] ??
      null
    );
  }
  async function syncDeliveryAddressState(accessToken: string) {
    const addresses = await requestShippingAddresses(accessToken);
    const nextAddressState = getDeliveryAddressStateFromSyncedAddresses(addresses);

    writeDeliveryAddressState(nextAddressState);
    return nextAddressState;
  }

  function showProductToast(message: string) {
    if (productToastTimerRef.current !== null) {
      window.clearTimeout(productToastTimerRef.current);
    }

    setProductToast(message);
    productToastTimerRef.current = window.setTimeout(() => {
      setProductToast("");
      productToastTimerRef.current = null;
    }, 3200);
  }

  useEffect(() => {
    return () => {
      if (productToastTimerRef.current !== null) {
        window.clearTimeout(productToastTimerRef.current);
      }
    };
  }, []);

  // 계좌 시트 등장 트랜지션 — 다른 시트들의 rAF 2단계 진입 패턴과 동일.
  useEffect(() => {
    if (!isRefundAccountSheetOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setIsRefundAccountSheetEntered(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      setIsRefundAccountSheetEntered(false);
    };
  }, [isRefundAccountSheetOpen]);

  // 체크아웃 안에서 환불계좌를 등록한다 — 저장 성공 시 진행 중이던 주문을 그대로 잇는다.
  async function saveCheckoutRefundAccount() {
    const bank = refundAccountForm.bank.trim();
    const account = refundAccountForm.account.trim();
    const holder = refundAccountForm.holder.trim();

    if (!bank || !account || !holder) {
      setRefundAccountError("은행·계좌번호·예금주를 모두 입력해 주세요.");
      return;
    }

    if (!accountNumberPattern.test(account)) {
      setRefundAccountError("하이픈(-)은 숫자 사이에만 넣을 수 있어요.");
      return;
    }

    // maxLength 속성은 붙여넣기·IME 조합에서 우회될 수 있어 저장 시점에 재검증한다.
    if (
      bank.length > bankAccountFieldMaxLength ||
      holder.length > bankAccountFieldMaxLength ||
      account.replace(/\D/g, "").length > bankAccountFieldMaxLength
    ) {
      setRefundAccountError(
        `은행·계좌번호·예금주는 ${bankAccountFieldMaxLength}자 이내로 입력해 주세요.`,
      );
      return;
    }

    setIsRefundAccountSaving(true);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        setRefundAccountError("로그인이 만료됐어요. 다시 로그인해 주세요.");
        return;
      }

      await updateBankAccount(accessToken, { account, bank, holder });
      setCheckoutRefundAccount({ account, bank, holder });
      // 마이페이지 계좌 폼과 같은 공용 스토어를 갱신해 화면 간 표기가 어긋나지 않게 한다.
      writeSettlementAccountState({
        accountHolder: holder,
        accountNumber: account,
        bankName: bank,
      });
      setRefundAccountError("");
      setIsRefundAccountSheetOpen(false);
      showProductToast("환불계좌를 등록했어요. 이어서 주문해 주세요.");
    } catch (error: unknown) {
      setRefundAccountError(
        error instanceof Error ? error.message : "계좌를 저장하지 못했어요.",
      );
    } finally {
      setIsRefundAccountSaving(false);
    }
  }

  // 접수처 선택 즉시 배송지를 등록하고 이번 체크아웃 배송지로 잡는다 — 페이지 이탈 없음.
  async function handleCheckoutStoreSelected(store: CvsStore) {
    if (checkoutAddressCreateRef.current) {
      return;
    }

    checkoutAddressCreateRef.current = true;
    setIsCvsStoreSearchOpen(false);

    const storeType = store.brand === "CU" ? ("cu" as const) : ("gs25" as const);

    // 시트가 브랜드를 제한하지만, 매핑 실패 등으로 새어 들어온 비취급 브랜드는 여기서 차단한다.
    if (
      availableShippingStoreTypes.length > 0 &&
      !availableShippingStoreTypes.includes(storeType)
    ) {
      checkoutAddressCreateRef.current = false;
      setCheckoutError(
        `이 분철은 ${availableShippingStoreTypes
          .map(getConvenienceStoreLabel)
          .join("·")} 지점으로만 받을 수 있어요.`,
      );
      return;
    }

    if (isAddressLimitReached) {
      checkoutAddressCreateRef.current = false;
      setCheckoutError(
        `배송지는 최대 ${maxDeliveryAddressCount}개까지 등록할 수 있어요. 배송지 관리에서 정리한 뒤 다시 시도해 주세요.`,
      );
      return;
    }

    const accessToken = await getFreshAccessToken();

    if (!accessToken) {
      checkoutAddressCreateRef.current = false;
      setCheckoutError("로그인이 만료됐어요. 다시 로그인해 주세요.");
      return;
    }
    // 지점명에 브랜드 라벨이 이미 있으면 한 번만 붙인 형태로 저장한다 — 관리 화면과 동일 규칙
    // (서버 storeType 판별이 지점명 문구에 의존할 수 있음).
    const strippedStoreName =
      stripLeadingConvenienceStoreLabel(storeType, store.name) || store.name;

    setIsCheckoutAddressCreatePending(true);

    try {
      const previousAddressIds = new Set(
        deliveryAddressState.addresses.map((address) => address.id),
      );

      await createShippingAddress(accessToken, {
        branchName: `${getConvenienceStoreLabel(storeType)} ${strippedStoreName}`,
        isDefault: !deliveryAddressState.defaultAddressIds[storeType],
        storeCode: store.storeCode || undefined,
        storeType,
      });

      const nextAddressState = await syncDeliveryAddressState(accessToken);
      // 신규 id 우선, 서버가 동일 지점을 dedupe 했다면 storeCode 로 재탐색한다.
      const addedAddress =
        nextAddressState.addresses.find(
          (address) => !previousAddressIds.has(address.id),
        ) ??
        (store.storeCode
          ? nextAddressState.addresses.find(
              (address) => address.storeCode === store.storeCode,
            ) ?? null
          : null);

      if (addedAddress) {
        setCheckoutDeliveryAddress(addedAddress);
        setCheckoutError("");
        showProductToast("배송지를 등록했어요. 이어서 주문해 주세요.");
      } else {
        setCheckoutError(
          "배송지 등록 결과를 확인하지 못했어요. 목록에서 배송지를 선택해 주세요.",
        );
      }
    } catch (error: unknown) {
      let message =
        error instanceof Error ? error.message : "배송지를 등록하지 못했어요.";

      // 로컬 목록이 낡아 서버가 개수 제한으로 거부했는지 재동기화로 판정한다 — 관리 화면과 동일.
      try {
        const nextAddressState = await syncDeliveryAddressState(accessToken);

        if (nextAddressState.addresses.length >= maxDeliveryAddressCount) {
          message = `배송지는 최대 ${maxDeliveryAddressCount}개까지 등록할 수 있어요. 사용하지 않는 배송지를 삭제한 뒤 다시 시도해 주세요.`;
        }
      } catch {
        // 재동기화 실패 시 원래 에러 메시지를 그대로 보여 준다.
      }

      setCheckoutError(message);
    } finally {
      checkoutAddressCreateRef.current = false;
      setIsCheckoutAddressCreatePending(false);
    }
  }
  const bidDeliveryAddress =
    getBidDeliveryAddressFromState(deliveryAddressState);
  const checkoutEligibleDeliveryAddresses =
    getCheckoutEligibleDeliveryAddressesFromState(deliveryAddressState);

  useEffect(() => {
    if (selectedCheckoutItems.length === 0) {
      return;
    }

    const returnOptions = selectedCheckoutItems.map(({ option }) => ({
      buncheolMemberId: option.buncheolMemberId,
      id: option.id,
      label: option.label,
    }));

    checkoutSelectedOptionsRef.current = returnOptions;

    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(
      CHECKOUT_DRAFT_STATE_KEY,
      JSON.stringify({
        createdAt: Date.now(),
        addressId:
          checkoutDeliveryAddress?.id ?? bidDeliveryAddress?.id ?? null,
        optionIds: returnOptions.map((option) => option.id),
        options: returnOptions,
        productId: buncheolId,
        reopenAddressSheet: false,
      } satisfies CheckoutAddressReturnState),
    );
  }, [
    bidDeliveryAddress?.id,
    buncheolId,
    checkoutDeliveryAddress?.id,
    selectedCheckoutItems,
  ]);

  const targetTags = getTargetTags(product);
  const productImages = getProductImageUrls(product);
  const visibleProductImageIndex = Math.min(
    currentProductImageIndex,
    Math.max(0, productImages.length - 1),
  );
  const productImageTrackOffset = `calc(-${
    visibleProductImageIndex * 100
  }% + ${productImageDragOffset}px)`;
  const isPublicPreview = product.isPublicPreview === true;
  const isBidUnavailable = product.isBidUnavailable === true;
  const isDeadlinePassed = isDeadlineClosed(product.deadline, deadlineTick);
  const purchaseDeadlineCountdown = formatPurchaseDeadlineCountdown(
    product.deadline,
    deadlineTick,
  );
  // 취소 판정은 개최자 취소(HOST_CANCELLED)를 포함한다 — 중앙 모듈 기준.
  const isCancelledProduct = isBuncheolCancelledStatus(product.status);
  const isConfirmedProduct = isBuncheolConfirmedStatus(product.status);
  const isC2CProduct = getFlowType(product.flowType) === "C2C";
  // E1(docs/46 §4.7): C2C 확정 후(PAYMENT_COLLECTING) 빈 슬롯은 즉시입금으로 추가 신청을
  // 받는다 — deadline(신청 마감)이 지났어도 열어둔다. 분철 CONFIRMED 후에는 서버가 차단.
  const isC2CCollectingProduct =
    isC2CProduct && isBuncheolPaymentCollectingStatus(product.status);
  // 확정·취소 분철은 기한이 남아 있어도 더 살 수 없으므로 카운트다운 대신 상태 문구를,
  // C2C 입금 수집 중에는 기한이 지나도 빈 슬롯 즉시입금 신청이 열려 있으므로
  // 카운트다운의 "구매 마감" 대신 추가 신청 가능 문구를 보여준다.
  const purchaseDeadlineDisplay = isCancelledProduct
    ? getBuncheolStatusBadgeLabel(product.status)
    : isConfirmedProduct
      ? "구매 마감"
      : isC2CCollectingProduct && isDeadlinePassed
        ? "추가 신청 가능"
        : purchaseDeadlineCountdown;
  const isPurchasableStatus =
    isBuncheolPurchasableStatus(product.status) || isC2CCollectingProduct;
  const isDeadlineBlocked = isDeadlinePassed && !isC2CCollectingProduct;
  const shouldDimProductMedia =
    !isPublicPreview &&
    (!isPurchasableStatus || isCancelledProduct || isDeadlineBlocked);
  const productOptionBlockLabel = isPublicPreview
    ? null
    : isCancelledProduct
      ? "분철 취소"
      : isDeadlineBlocked
        ? "구매 마감"
        : isConfirmedProduct
          ? "진행 확정"
          : !isPurchasableStatus || isBidUnavailable
            ? "구매 불가"
            : null;
  const hasSelectableOption = auctionOptions.some(
    (option) =>
      !getOptionPurchaseOverlayLabel(
        option,
        myBids[option.id],
        product.isApiProduct === true,
      ),
  );
  const isHostedProduct =
    product.isHostedByMe === true || isHostedByMeFromApi === true;
  // 오픈 이벤트 무료 분철(전 슬롯 0원) 판정. 참여 전 화면이라 서버 payback 상태가 없어
  // 옵션 가격으로 판정하고, 플래그가 꺼지면 이벤트 UI 전체가 사라진다.
  const isShippingFeePaybackProduct =
    FEATURES.shippingFeePayback &&
    auctionOptions.length > 0 &&
    auctionOptions.every(
      (option) => priceToNumber(getBidBaseline(option)) === 0,
    );
  const canEditProduct =
    product.id.startsWith("uploaded-") || isHostedProduct;
  const canDeleteProduct = product.isApiProduct && isHostedProduct;
  // 임시 저장 분철(uploaded-)은 브라우저 로컬에만 있어 공유해도 열리지 않는다.
  const canShareProduct = product.isApiProduct === true;
  // 단일 선택 정책: 분철당 참여 1건(멤버 1명). 상세 응답의 participatedByMe/내 참여 목록은
  // 활성(입금확인중·확정) 참여만 표시하므로, 취소·만료된 참여는 재참여를 막지 않는다. 서버도 동일하게 거부한다.
  const hasMyActiveParticipation = auctionOptions.some((option) =>
    isOptionParticipatedByMe(option, myBids[option.id]),
  );
  // C2C 는 1인 다슬롯 허용(docs/46 §7.1-11) — 활성 참여가 있어도 다른 멤버에 추가 신청 가능.
  // 추가 신청 판정은 서버 응답(participatedByMe)만 신뢰한다 — 로컬 myBids 는 같은 세션에서
  // 취소한 뒤에도 남아 "배송비 0원" 오판(서버는 첫 참여로 부과)을 만들 수 있다.
  const hasMyServerParticipation = auctionOptions.some(
    (option) => option.participatedByMe === true,
  );
  const isAdditionalC2CApplication = isC2CProduct && hasMyServerParticipation;
  const productOpenChatHref = isC2CProduct
    ? getSafeOpenChatHref(product.openChatUrl)
    : null;
  const canBidProduct =
    !isPublicPreview &&
    !isBidUnavailable &&
    !isHostedProduct &&
    (!hasMyActiveParticipation || isC2CProduct) &&
    !isDeadlineBlocked &&
    isPurchasableStatus &&
    hasSelectableOption;
  const isMainBidButtonDisabled =
    !isPublicPreview && (isBidUnavailable || !canBidProduct);
  const optionParticipationCount = auctionOptions.reduce((sum, option) => {
    const explicitCount = Math.max(0, option.participantCount);
    const occupiedSlotCount =
      hasOptionPurchaseState(option) || isUnavailablePurchaseOption(option)
        ? 1
        : 0;

    return sum + Math.max(explicitCount, occupiedSlotCount);
  }, 0);
  const parsedProductParticipationCount = Number.parseInt(product.reviews, 10);
  const currentParticipationCount = Math.max(
    optionParticipationCount,
    Number.isNaN(parsedProductParticipationCount)
      ? 0
      : parsedProductParticipationCount,
  );
  const minHeadcount =
    typeof product.minHeadcount === "number" && product.minHeadcount > 0
      ? product.minHeadcount
      : null;
  const participationTargetCount = minHeadcount ?? auctionOptions.length;
  const participationProgressRatio =
    isConfirmedProduct
      ? 1
      : participationTargetCount > 0
      ? Math.min(1, currentParticipationCount / participationTargetCount)
      : 0;
  const participationProgressPercent = `${Math.round(
    participationProgressRatio * 100,
  )}%`;
  const remainingHeadcount =
    isConfirmedProduct
      ? 0
      : minHeadcount !== null
      ? Math.max(0, minHeadcount - currentParticipationCount)
      : null;

  function getBidUnavailableMessage() {
    if (isHostedProduct) {
      return "내가 연 분철은 구매할 수 없어요";
    }

    if (isCancelledProduct) {
      return "취소된 분철이에요";
    }

    // C2C 다슬롯 허용 — 이미 참여했어도 다른 멤버 신청을 막지 않는다.
    if (hasMyActiveParticipation && !isC2CProduct) {
      return "이미 참여한 분철이에요";
    }

    if (isDeadlineBlocked) {
      return isC2CProduct ? "신청 기한이 지났어요" : "구매 기한이 지났어요";
    }

    if (!hasSelectableOption) {
      return isC2CProduct
        ? "신청 가능한 멤버가 없어요"
        : "구매 가능한 멤버가 없어요";
    }

    if (isConfirmedProduct) {
      return "진행 확정된 분철이에요";
    }

    return "지금은 구매할 수 없는 분철이에요";
  }

  function getSelectedCheckoutReturnOptions(): CheckoutAddressReturnOption[] {
    const currentReturnOptions = getCheckoutReturnOptionsForAmounts(bidAmounts);

    if (currentReturnOptions.length > 0) {
      checkoutSelectedOptionsRef.current = currentReturnOptions;
      return currentReturnOptions;
    }

    return checkoutSelectedOptionsRef.current;
  }

  function rememberCheckoutAddressReturnState(
    reopenAddressSheet = true,
    preferredAddressId?: string | null,
  ) {
    if (typeof window === "undefined") {
      return;
    }

    const previousReturnState = parseCheckoutAddressReturnState(
      window.sessionStorage.getItem(CHECKOUT_ADDRESS_RETURN_STATE_KEY),
      buncheolId,
    );
    const previousDraftState = parseCheckoutAddressReturnState(
      window.sessionStorage.getItem(CHECKOUT_DRAFT_STATE_KEY),
      buncheolId,
    );
    let returnOptions = getSelectedCheckoutReturnOptions();

    if (returnOptions.length === 0 && previousReturnState) {
      returnOptions = getCheckoutReturnOptionsFromState(previousReturnState);
    }

    if (returnOptions.length === 0 && previousDraftState) {
      returnOptions = getCheckoutReturnOptionsFromState(previousDraftState);
    }

    if (returnOptions.length === 0) {
      return;
    }

    const nextReturnState: CheckoutAddressReturnState = {
      createdAt: Date.now(),
      addressId:
        preferredAddressId ??
        checkoutDeliveryAddress?.id ??
        bidDeliveryAddress?.id ??
        previousDraftState?.addressId ??
        null,
      optionIds: returnOptions.map((option) => option.id),
      options: returnOptions,
      productId: buncheolId,
      reopenAddressSheet,
    };

    window.sessionStorage.setItem(
      CHECKOUT_ADDRESS_RETURN_STATE_KEY,
      JSON.stringify(nextReturnState),
    );
    window.sessionStorage.setItem(
      CHECKOUT_DRAFT_STATE_KEY,
      JSON.stringify({
        ...nextReturnState,
        reopenAddressSheet: false,
      } satisfies CheckoutAddressReturnState),
    );
  }

  // NOTE: 아래 URL 쿼리(checkoutStep/addressSheet/checkoutOption/checkoutAddress) 복원
  // 분기의 생산자(마이페이지·배송지 관리 왕복)는 이 PR 에서 제거됐다. 과거 공유된 링크
  // 호환용으로 한시 유지하며, 후속 정리 대상이다.
  useEffect(() => {
    const paymentDueAt = checkoutPaymentSummary?.paymentDueAt;
    const paymentDueDate = parseCheckoutDateTime(paymentDueAt);
    const shouldTickPaymentDue =
      !Number.isNaN(paymentDueDate.getTime()) &&
      paymentDueDate.getTime() > Date.now();
    const shouldTickOptionPaymentDue = auctionOptions.some((option) => {
      const optionPaymentDueDate = parseCheckoutDateTime(
        option.purchasePaymentDueAt,
      );

      return (
        !Number.isNaN(optionPaymentDueDate.getTime()) &&
        optionPaymentDueDate.getTime() > Date.now()
      );
    });

    if (
      isDeadlineClosed(product.deadline) &&
      !shouldTickPaymentDue &&
      !shouldTickOptionPaymentDue
    ) {
      setDeadlineTick(Date.now());
      return;
    }

    // 결제 완료 직후 첫 렌더가 이전 tick(최대 1초 전)으로 계산되면
    // 다음 tick에서 표시가 2초 건너뛰므로 즉시 현재 시각으로 맞춘다.
    setDeadlineTick(Date.now());

    const intervalId = window.setInterval(() => {
      setDeadlineTick(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [auctionOptions, checkoutPaymentSummary?.paymentDueAt, product.deadline]);

  useEffect(() => {
    setIsLiked(product.liked === true);
  }, [product.id, product.liked]);

  useEffect(() => {
    setAuctionOptions(product.options);
    setMyBids(getMyBidsFromOptions(product.options));
    checkoutSelectedOptionsRef.current = [];
    setBidAmounts({});
    setIsHostedByMeFromApi(product.isHostedByMe === true);
    setCheckoutStep("options");
    setCheckoutDeliveryAddress(null);
    setCheckoutRefundAccount(null);
    setCheckoutPaymentSummary(null);
    setCheckoutError("");
    setCheckoutCopyToast("");

    // 이 리셋이 복원된 체크아웃 상태를 지웠을 수 있으므로 재적용을 예약한다.
    if (pendingCheckoutRestoreRef.current?.productId === buncheolId) {
      shouldApplyCheckoutRestoreRef.current = true;
    }
  }, [buncheolId, product.id, product.isHostedByMe, product.options]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!didRestoreCheckoutAddressReturnRef.current) {
      let returnState: CheckoutAddressReturnState | null = null;
      const rawState = window.sessionStorage.getItem(
        CHECKOUT_ADDRESS_RETURN_STATE_KEY,
      );
      const draftState = parseCheckoutAddressReturnState(
        window.sessionStorage.getItem(CHECKOUT_DRAFT_STATE_KEY),
        buncheolId,
      );

      returnState = parseCheckoutAddressReturnState(rawState, buncheolId);

      window.sessionStorage.removeItem(CHECKOUT_ADDRESS_RETURN_STATE_KEY);

      if (!returnState) {
        const params = new URLSearchParams(window.location.search);
        const shouldRestoreCheckout =
          params.get("checkoutStep") === "confirm" ||
          params.get("addressSheet") === "1";
        const queryOptionIds = [
          ...params.getAll("checkoutOption"),
          ...(params.get("checkoutOptions")?.split(",") ?? []),
        ].filter(Boolean);

        if (shouldRestoreCheckout) {
          returnState = {
            createdAt: Date.now(),
            addressId: params.get("checkoutAddress"),
            optionIds: [...new Set(queryOptionIds)],
            options: [...new Set(queryOptionIds)].map((optionId) => ({
              id: optionId,
            })),
            productId: buncheolId,
            reopenAddressSheet: params.get("addressSheet") === "1",
          };
        }
      }

      if (returnState && draftState) {
        const returnOptions = getCheckoutReturnOptionsFromState(returnState);
        const draftOptions = getCheckoutReturnOptionsFromState(draftState);

        if (returnOptions.length === 0 && draftOptions.length > 0) {
          returnState = {
            ...draftState,
            addressId: returnState.addressId ?? draftState.addressId,
            createdAt: Math.max(returnState.createdAt, draftState.createdAt),
            reopenAddressSheet: returnState.reopenAddressSheet,
          };
        }
      }

      if (
        !returnState ||
        Date.now() - returnState.createdAt > checkoutDraftMaxAgeMs
      ) {
        return;
      }

      // 이미 참여한 분철이면(다른 탭에서 참여 후 복귀 등) 체크아웃을 복원하지 않는다 —
      // 배송지·계좌까지 채운 뒤 제출 시점에야 거절당하는 헛걸음을 막는다.
      if (hasMyActiveParticipation) {
        return;
      }

      didRestoreCheckoutAddressReturnRef.current = true;
      pendingCheckoutRestoreRef.current = returnState;
      shouldApplyCheckoutRestoreRef.current = true;
    }

    const checkoutReturnState = pendingCheckoutRestoreRef.current;

    if (!shouldApplyCheckoutRestoreRef.current || !checkoutReturnState) {
      return;
    }

    shouldApplyCheckoutRestoreRef.current = false;

    const restorableOptions =
      getCheckoutReturnOptionsFromState(checkoutReturnState);
    // 참여 1건 = 멤버 1명(단일 선택 정책). 구버전 세션에 다중 선택이 저장돼 있어도 1개만 복원한다.
    const restorableOptionIds = auctionOptions
      .reduce<string[]>((optionIds, option) => {
        const isSelected = restorableOptions.some(
          (returnOption) =>
            returnOption.id === option.id ||
            (returnOption.buncheolMemberId &&
              returnOption.buncheolMemberId === option.buncheolMemberId) ||
            (returnOption.label && returnOption.label === option.label),
        );

        if (
          isSelected &&
          !getOptionPurchaseOverlayLabel(
            option,
            myBids[option.id],
            product.isApiProduct === true,
          )
        ) {
          optionIds.push(option.id);
        }

        return optionIds;
      }, [])
      .slice(0, 1);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);

      if (params.has("checkoutStep") || params.has("addressSheet")) {
        params.delete("checkoutStep");
        params.delete("addressSheet");
        params.delete("checkoutAddress");
        params.delete("checkoutOption");
        params.delete("checkoutOptions");
        const query = params.toString();

        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${query ? `?${query}` : ""}`,
        );
      }
    }

    if (restorableOptionIds.length > 0) {
      checkoutSelectedOptionsRef.current = auctionOptions
        .filter((option) => restorableOptionIds.includes(option.id))
        .map((option) => ({
          buncheolMemberId: option.buncheolMemberId,
          id: option.id,
          label: option.label,
        }));
      setBidAmounts(
        restorableOptionIds.reduce<Record<string, string>>((amounts, optionId) => {
          amounts[optionId] = "selected";
          return amounts;
        }, {}),
      );
    }

    setCheckoutStep("confirm");
    setCheckoutPaymentSummary(null);
    setCheckoutError("");
    setCheckoutCopyToast("");
    setIsSheetOpen(true);
    setIsSheetClosing(false);

    sheetEnterAnimationFrameRef.current = window.requestAnimationFrame(() => {
      sheetEnterAnimationFrameRef.current = null;
      setIsSheetEntered(true);
    });

    const lastAddedAddressId = window.sessionStorage.getItem(
      lastAddedDeliveryAddressIdKey,
    );

    const restoreAddressSheet = async () => {
      let nextAddressState = deliveryAddressState;

      if (product.isApiProduct && authState.isLoggedIn) {
        const accessToken = await getFreshAccessToken();

        if (accessToken) {
          try {
            nextAddressState = await syncDeliveryAddressState(accessToken);
          } catch {
            nextAddressState = deliveryAddressState;
          }
        }
      }

      const defaultDeliveryAddresses = getDefaultDeliveryAddressesByType(
        nextAddressState.addresses,
        nextAddressState.defaultAddressIds,
      );
      const eligibleAddresses = getPrioritizedDeliveryAddresses(
        nextAddressState.addresses,
        nextAddressState.defaultAddressIds,
      ).filter((address) =>
        availableShippingStoreTypes.length > 0
          ? availableShippingStoreTypes.includes(address.storeType)
          : true,
      );
      const defaultAddress =
        availableShippingStoreTypes
          .map((storeType) => defaultDeliveryAddresses[storeType])
          .find((address) => address !== null) ?? null;
      const lastAddedAddress =
        lastAddedAddressId
          ? eligibleAddresses.find((address) => address.id === lastAddedAddressId)
          : null;
      const previousSelectedAddress =
        checkoutReturnState.addressId
          ? eligibleAddresses.find(
              (address) => address.id === checkoutReturnState.addressId,
            )
          : null;
      const restoredAddress =
        lastAddedAddress ??
        previousSelectedAddress ??
        defaultAddress ??
        eligibleAddresses[0] ??
        null;

      setCheckoutDeliveryAddress(restoredAddress);

      if (lastAddedAddressId) {
        window.sessionStorage.removeItem(lastAddedDeliveryAddressIdKey);
      }

      if (checkoutReturnState.reopenAddressSheet) {
        if (checkoutAddressSheetCloseFallbackTimerRef.current !== null) {
          window.clearTimeout(checkoutAddressSheetCloseFallbackTimerRef.current);
          checkoutAddressSheetCloseFallbackTimerRef.current = null;
        }

        setIsCheckoutAddressSheetOpen(true);
        setIsCheckoutAddressSheetClosing(false);

        checkoutAddressSheetEnterAnimationFrameRef.current =
          window.requestAnimationFrame(() => {
            checkoutAddressSheetEnterAnimationFrameRef.current = null;
            setIsCheckoutAddressSheetEntered(true);
          });
      }
    };

    void restoreAddressSheet();
    // TODO(#99): hasMyActiveParticipation 이 deps 에서 빠져 있다. 추가하면 주소 시트 복원
    // 타이밍이 바뀌어 회귀 가능성이 있어(참여 상태 변경마다 복원이 재실행됨) 수동 QA 와 함께
    // 별도 PR 에서 처리한다. 그때까지 신규 warning 유입을 막기 위해 이 지점만 억제한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    auctionOptions,
    authState.isLoggedIn,
    availableShippingStoreTypes,
    buncheolId,
    deliveryAddressState,
    myBids,
    product.isApiProduct,
  ]);

  // 상세 재조회 세대 번호. 겹치거나 늦게 도착한 응답이 최신 상태를 덮어쓰지 않게 한다.
  const detailRefreshRequestIdRef = useRef(0);

  const refreshDetailOptions = useCallback(async () => {
    if (
      !product.isApiProduct ||
      isPublicPreview ||
      !authState.isLoggedIn ||
      !authState.accessToken
    ) {
      return;
    }

    const accessToken = authState.accessToken;
    const requestId = ++detailRefreshRequestIdRef.current;
    const isStale = () => detailRefreshRequestIdRef.current !== requestId;

    try {
      const detail = await requestBuncheolDetail(accessToken, buncheolId);

      if (isStale()) {
        return;
      }

      const isHosted = detail.isHostedByMe === true;
      const refreshedProduct = toProductDetailItem(detail);
      const refreshedMyBids = getMyBidsFromOptions(refreshedProduct.options);
      setIsHostedByMeFromApi(isHosted);
      setAuctionOptions(refreshedProduct.options);
      setMyBids(refreshedMyBids);
      setBidAmounts((current) =>
        refreshedProduct.options.reduce<Record<string, string>>(
          (nextAmounts, option) => {
            if (
              current[option.id] === "selected" &&
              !getOptionPurchaseOverlayLabel(
                option,
                refreshedMyBids[option.id],
                product.isApiProduct === true,
              )
            ) {
              nextAmounts[option.id] = "selected";
            }

            return nextAmounts;
          },
          {},
        ),
      );

      if (!isHosted && product.isHostedByMe !== true) {
        return;
      }

      try {
        const managementDetail = await requestBuncheolManagement(
          accessToken,
          buncheolId,
        );

        if (!isStale()) {
          setAuctionOptions((currentOptions) =>
            mergeManagementOptionPurchaseStates(
              currentOptions,
              managementDetail.options,
            ),
          );
        }
      } catch {
        // Detail data still renders; management state is only a host-side overlay hint.
      }
    } catch {
      // The submit path still handles permission failures with a user-facing message.
    }
  }, [
    authState.accessToken,
    authState.isLoggedIn,
    buncheolId,
    isPublicPreview,
    product.isHostedByMe,
    product.isApiProduct,
  ]);

  useEffect(() => {
    setIsHostedByMeFromApi(product.isHostedByMe === true);
    void refreshDetailOptions();

    return () => {
      detailRefreshRequestIdRef.current += 1;
    };
  }, [product.isHostedByMe, refreshDetailOptions]);

  // 재조회를 이미 트리거한 만료 기한. 서버 자동 취소가 늦어도 tick마다 재조회가 반복되지 않게 한다.
  const refreshedExpiredDueAtsRef = useRef<Set<string>>(new Set());
  const didSeedExpiredDueAtsRef = useRef(false);

  useEffect(() => {
    const expiredDueAts = auctionOptions
      .map((option) => option.purchasePaymentDueAt)
      .filter((dueAt): dueAt is string => {
        if (!dueAt) {
          return false;
        }

        const dueTime = parseCheckoutDateTime(dueAt).getTime();

        return !Number.isNaN(dueTime) && dueTime <= deadlineTick;
      });

    // 첫 평가 시점에 이미 지나 있던 기한은 마운트 재조회가 커버하므로 기록만 한다.
    if (!didSeedExpiredDueAtsRef.current) {
      didSeedExpiredDueAtsRef.current = true;
      expiredDueAts.forEach((dueAt) =>
        refreshedExpiredDueAtsRef.current.add(dueAt),
      );
      return;
    }

    const hasNewlyExpiredDueAt = expiredDueAts.some(
      (dueAt) => !refreshedExpiredDueAtsRef.current.has(dueAt),
    );

    if (!hasNewlyExpiredDueAt) {
      return;
    }

    expiredDueAts.forEach((dueAt) =>
      refreshedExpiredDueAtsRef.current.add(dueAt),
    );
    void refreshDetailOptions();
  }, [auctionOptions, deadlineTick, refreshDetailOptions]);

  function togglePurchaseOption(optionId: string) {
    const option = auctionOptions.find((item) => item.id === optionId);

    if (
      !option ||
      getOptionPurchaseOverlayLabel(
        option,
        myBids[optionId],
        product.isApiProduct === true,
      )
    ) {
      return;
    }

    setBidAmounts((current) => {
      let nextAmounts: Record<string, string>;

      if (current[optionId] === "selected") {
        nextAmounts = { ...current };
        delete nextAmounts[optionId];
      } else {
        // 참여 1건 = 멤버 1명(단일 선택 정책). 새 멤버를 선택하면 기존 선택을 해제한다.
        nextAmounts = { [optionId]: "selected" };
      }

      checkoutSelectedOptionsRef.current =
        getCheckoutReturnOptionsForAmounts(nextAmounts);

      return nextAmounts;
    });
  }

  function applySubmittedBidState(
    participationResults: Map<
      string,
      { bidAmount: number; participationId: string }
    >,
    onlyParticipationResults = false,
  ) {
    // 진행 중인 재조회를 무효화해, 참여 이전 스냅샷이 방금 반영한 내 참여를 덮어쓰지 않게 한다.
    detailRefreshRequestIdRef.current += 1;
    setAuctionOptions((currentOptions) =>
      currentOptions.map((option) => {
        if (onlyParticipationResults && !participationResults.has(option.id)) {
          return option;
        }

        const apiResult = participationResults.get(option.id);

        if (!apiResult) {
          return option;
        }

        const fixedPrice = priceToNumber(getBidBaseline(option));
        const participationAmount = apiResult.bidAmount || fixedPrice;
        const previousParticipationAmount = myBids[option.id] ?? 0;

        return {
          ...option,
          currentBid: formatPrice(participationAmount),
          participantCount:
            previousParticipationAmount > 0
              ? option.participantCount
              : option.participantCount + 1,
          myBidAmount: participationAmount,
          myParticipationId: apiResult.participationId,
        };
      }),
    );
    setMyBids((current) => {
      const nextBids = { ...current };

      participationResults.forEach((apiResult, optionId) => {
        const option = auctionOptions.find((item) => item.id === optionId);
        const fixedPrice = option ? priceToNumber(getBidBaseline(option)) : 0;

        nextBids[optionId] = apiResult.bidAmount || fixedPrice;
      });

      return nextBids;
    });
    setBidAmounts((current) => {
      const nextAmounts = { ...current };

      participationResults.forEach((_, optionId) => {
        delete nextAmounts[optionId];
      });

      return nextAmounts;
    });
  }

  async function handleProceedToCheckoutConfirm() {
    if (isBidSubmitPending) {
      return;
    }

    if (!canBidProduct) {
      window.alert(getBidUnavailableMessage());
      return;
    }

    if (selectedCheckoutItems.length === 0) {
      return;
    }

    // 사용자가 직접 선택을 다시 진행하면 이전 복귀 복원 상태는 폐기한다.
    pendingCheckoutRestoreRef.current = null;
    checkoutSelectedOptionsRef.current =
      getCheckoutReturnOptionsFromItems(selectedCheckoutItems);
    setCheckoutError("");
    setIsBidSubmitPending(true);

    if (product.isApiProduct) {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        const returnHref = `/products/${encodeURIComponent(buncheolId)}`;
        router.push(
          createLoginHref({
            cancelTo: getCurrentBrowserHref(),
            returnTo: returnHref,
          }),
        );
        return;
      }

      const preferredAddressId =
        checkoutDeliveryAddress?.id ?? bidDeliveryAddress?.id ?? null;
      let nextBidDeliveryAddress = checkoutDeliveryAddress ?? bidDeliveryAddress;

      try {
        const nextAddressState = await syncDeliveryAddressState(accessToken);

        nextBidDeliveryAddress = getPreferredDeliveryAddressFromState(
          nextAddressState,
          preferredAddressId,
        );
      } catch {
        nextBidDeliveryAddress = checkoutDeliveryAddress ?? bidDeliveryAddress;
      }

      const shippingAddressId = Number(nextBidDeliveryAddress?.id);

      if (!Number.isFinite(shippingAddressId)) {
        setIsBidSubmitPending(false);
        void openCheckoutAddressSheet();
        return;
      }

      let refundAccount = checkoutRefundAccount;

      if (!refundAccount) {
        try {
          const profile = await requestUserProfile(accessToken);

          refundAccount = profile.bankAccount;
          setCheckoutRefundAccount(refundAccount);
        } catch {
          refundAccount = null;
        }
      }

      if (!refundAccount?.bank || !refundAccount.account || !refundAccount.holder) {
        setIsBidSubmitPending(false);
        setRefundAccountError("");
        setIsRefundAccountSheetOpen(true);
        return;
      }

      setCheckoutDeliveryAddress(nextBidDeliveryAddress);
      setCheckoutRefundAccount(refundAccount);
    } else {
      setCheckoutDeliveryAddress(bidDeliveryAddress);
      setCheckoutRefundAccount(null);
    }

    setCheckoutStep("confirm");
    setIsBidSubmitPending(false);
  }

  async function handleSubmitBids() {
    if (isBidSubmitPending) {
      return;
    }

    if (!canBidProduct) {
      window.alert(getBidUnavailableMessage());
      return;
    }

    const submittedBids = selectedCheckoutItems.map((item) => ({ ...item }));

    if (submittedBids.length === 0) {
      return;
    }

    // 참여 1건 = 멤버 1명(단일 선택 정책). 구버전에서 저장된 다중 선택 복원 등 예외 경로를 방어한다.
    if (submittedBids.length > 1) {
      window.alert("멤버는 한 번에 1명씩 참여할 수 있어요. 참여할 멤버를 하나만 선택해 주세요.");
      return;
    }

    trackEvent("participation_started", {
      buncheol_id: buncheolId,
      option_count: submittedBids.length,
    });

    const participationResults = new Map<
      string,
      { bidAmount: number; participationId: string }
    >();
    const paymentItems: CheckoutPaymentItem[] = [];
    const bankAccountKeys = new Set<string>();
    let checkoutHostBankAccount: BankAccountInfo | null = null;

    if (product.isApiProduct) {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        const returnHref = `/products/${encodeURIComponent(buncheolId)}`;
        router.push(
          createLoginHref({
            cancelTo: getCurrentBrowserHref(),
            returnTo: returnHref,
          }),
        );
        return;
      }

      setIsBidSubmitPending(true);

      const preferredAddressId =
        checkoutDeliveryAddress?.id ?? bidDeliveryAddress?.id ?? null;
      let nextBidDeliveryAddress = checkoutDeliveryAddress ?? bidDeliveryAddress;

      try {
        const nextAddressState = await syncDeliveryAddressState(accessToken);

        nextBidDeliveryAddress = getPreferredDeliveryAddressFromState(
          nextAddressState,
          preferredAddressId,
        );
      } catch {
        nextBidDeliveryAddress = checkoutDeliveryAddress ?? bidDeliveryAddress;
      }

      const shippingAddressId = Number(nextBidDeliveryAddress?.id);

      if (!Number.isFinite(shippingAddressId)) {
        setIsBidSubmitPending(false);
        void openCheckoutAddressSheet();
        return;
      }

      let refundAccount = checkoutRefundAccount;

      if (!refundAccount) {
        try {
          const profile = await requestUserProfile(accessToken);

          refundAccount = profile.bankAccount;
          setCheckoutRefundAccount(refundAccount);
        } catch {
          refundAccount = null;
        }
      }

      if (!refundAccount?.bank || !refundAccount.account || !refundAccount.holder) {
        setIsBidSubmitPending(false);
        setRefundAccountError("");
        setIsRefundAccountSheetOpen(true);
        return;
      }

      let didRequestParticipation = false;

      try {
        const checkoutRequestItems = submittedBids.map(
          ({ bidAmount, option }) => {
            const buncheolMemberId = Number(
              option.buncheolMemberId ?? option.id,
            );

            if (!Number.isFinite(buncheolMemberId)) {
              throw new Error("구매할 멤버 정보를 확인하지 못했어요.");
            }

            return {
              bidAmount,
              buncheolMemberId,
              option,
            };
          },
        );

        didRequestParticipation = true;
        const result = await participateBuncheol(accessToken, buncheolId, {
          buncheolMemberId: checkoutRequestItems[0].buncheolMemberId,
          refundAccount,
          shippingAddressId,
        });

        // 내 참여로 슬롯 상태가 바뀌었다 — 목록 쿼리를 무효화해 복귀 시 fresh 로 가져온다.
        void queryClient.invalidateQueries({ queryKey: buncheolsQueryKey });
        const resultParticipationIds =
          result.participationIds.length > 0
            ? result.participationIds
            : result.participationId
              ? [result.participationId]
              : [];

        if (resultParticipationIds.length < checkoutRequestItems.length) {
          throw new Error("참여 결과를 확인할 수 없어요.");
        }

        const firstParticipationId = resultParticipationIds[0] ?? "";
        // C2C 신청(무입금): 서버가 dueAt·계좌 없이 APPLIED 로 생성한다 (docs/46 §3-1).
        // 확정 후 추가 모집(E1, PAYMENT_COLLECTING)은 즉시입금 구간이라 dueAt 누락 응답이
        // 와도 신청 완료로 오판하지 않도록 제외한다 — 입금 안내 경로(보충 조회 포함)를 태운다.
        const isC2CAppliedResult =
          isC2CProduct && !isC2CCollectingProduct && !result.paymentDueAt;
        let paymentDetail:
          | Awaited<ReturnType<typeof requestParticipationPaymentDetail>>
          | null = null;

        if (
          !isC2CAppliedResult &&
          firstParticipationId &&
          (!result.hostBankAccount ||
            result.paymentAmount === null ||
            !result.paymentDueAt)
        ) {
          try {
            paymentDetail = await requestParticipationPaymentDetail(
              accessToken,
              firstParticipationId,
            );
          } catch {
            paymentDetail = null;
          }
        }

        const hostBankAccount =
          result.hostBankAccount ?? paymentDetail?.hostBankAccount ?? null;

        if (hostBankAccount) {
          checkoutHostBankAccount ??= hostBankAccount;
          bankAccountKeys.add(getBankAccountKey(hostBankAccount));
        }

        const totalBidAmount = checkoutRequestItems.reduce(
          (sum, item) => sum + item.bidAmount,
          0,
        );
        // 다슬롯 추가 신청은 배송비가 첫 참여에 귀속돼 0 이다 (docs/46 §4.7-A2) —
        // 확인 스텝 표기와 동일하게 폴백 금액에서도 배송비를 더하지 않는다.
        const totalPaymentAmount =
          result.paymentAmount ??
          paymentDetail?.paymentAmount ??
          totalBidAmount +
            (isAdditionalC2CApplication ? 0 : estimatedShippingFee);
        const sharedShippingFee = Math.max(
          totalPaymentAmount - totalBidAmount,
          0,
        );
        const sharedPaymentDueAt = clampPaymentDueAt(
          result.paymentDueAt ?? paymentDetail?.paymentDueAt,
          Date.now(),
          isC2CProduct ? c2cPaymentWindowMs : paymentWindowMs,
        );
        // 참여 생성 응답에는 상태 필드가 없어 파서가 AWAITING_PAYMENT 로 폴백한다 —
        // C2C 신청은 APPLIED 로 바로잡는다 (dueAt 부재 = 확정 전 신청).
        const sharedParticipationStatus = isC2CAppliedResult
          ? "APPLIED"
          : result.participationStatus ||
            paymentDetail?.paymentStatus ||
            "AWAITING_PAYMENT";

        checkoutRequestItems.forEach(({ bidAmount, option }, index) => {
          const participationId = resultParticipationIds[index] ?? "";
          const nextShippingFee = index === 0 ? sharedShippingFee : 0;
          const nextPaymentAmount = bidAmount + nextShippingFee;

          if (participationId) {
            // 개최자 계좌는 세션 캐시에 저장하지 않는다(v3) — 화면 노출은 메모리 상태로만.
            writeCachedParticipationPayment({
              bidAmount,
              participationId,
              participationStatus: sharedParticipationStatus,
              paymentAmount: nextPaymentAmount,
              paymentDueAt: sharedPaymentDueAt,
              shippingAddress: nextBidDeliveryAddress,
              shippingFee: nextShippingFee,
            });
          }

          participationResults.set(option.id, {
            bidAmount,
            participationId,
          });

          paymentItems.push({
            bidAmount,
            option,
            participationId,
            paymentAmount: nextPaymentAmount,
            paymentDueAt: sharedPaymentDueAt,
            participationStatus: sharedParticipationStatus,
            shippingFee: nextShippingFee,
          });
        });

        if (bankAccountKeys.size > 1) {
          throw new Error(
            "선택한 멤버의 입금 계좌가 달라요. 참여 내역에서 각각 확인해 주세요.",
          );
        }
      } catch (error: unknown) {
        if (participationResults.size > 0) {
          applySubmittedBidState(participationResults, true);
        }

        const errorMessage =
          error instanceof Error ? error.message : "구매를 시작하지 못했어요.";
        const isForbidden =
          error instanceof ApiRequestError && error.status === 403;
        const didDeadlinePass = isDeadlineClosed(product.deadline);
        const isHostParticipationBlocked =
          errorMessage.includes("PARTICIPATION_HOST_CANNOT_PARTICIPATE") ||
          errorMessage.includes("HOST_CANNOT_PARTICIPATE") ||
          errorMessage.includes("BUNCHEOL_HOST_CANNOT_PARTICIPATE") ||
          errorMessage.includes("개최자") ||
          errorMessage.includes("본인") ||
          errorMessage.includes("내가 연");

        if (isHostParticipationBlocked) {
          setIsHostedByMeFromApi(true);
          setCheckoutError(
            "내가 연 분철은 구매할 수 없어요. 구매 계정으로 전환해 주세요.",
          );
        } else if (didDeadlinePass) {
          setCheckoutError("구매 기한이 지났어요.");
        } else if (isForbidden) {
          setCheckoutError(
            "구매 권한이 없어요. 테스트 리모콘에서 구매 계정으로 다시 전환한 뒤 시도해 주세요.",
          );
        } else {
          setCheckoutError(errorMessage);
        }

        // 요청이 서버에 닿은 뒤의 실패는 참여가 생성됐을 수 있다.
        // 상세를 재조회해 슬롯 상태가 낡은 채 남지 않게 한다.
        if (didRequestParticipation) {
          void refreshDetailOptions();
        }
        setIsBidSubmitPending(false);
        return;
      }

      applySubmittedBidState(participationResults, true);
      setCheckoutPaymentSummary({
        deliveryAddress: nextBidDeliveryAddress,
        hostBankAccount: checkoutHostBankAccount,
        items: paymentItems,
        paymentDueAt: getEarliestPaymentDueAt(paymentItems),
        productAmount: paymentItems.reduce(
          (sum, item) => sum + item.bidAmount,
          0,
        ),
        shippingAmount: paymentItems.reduce(
          (sum, item) => sum + item.shippingFee,
          0,
        ),
        totalAmount: paymentItems.reduce(
          (sum, item) => sum + item.paymentAmount,
          0,
        ),
      });
      pendingCheckoutRestoreRef.current = null;
      // C2C 신청은 입금 안내 대신 신청 완료 화면으로 — 계좌·기한이 아직 없다.
      setCheckoutStep(
        paymentItems.some((item) => item.participationStatus === "APPLIED")
          ? "applied"
          : "payment",
      );
      setIsBidSubmitPending(false);
      return;
    } else {
      submittedBids.forEach(({ bidAmount, option }) => {
        participationResults.set(option.id, {
          bidAmount,
          participationId: `local-${option.id}`,
        });
      });
    }

    applySubmittedBidState(participationResults);
    setIsBidSubmitPending(false);
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

    if (initialReturnSource === "home") {
      router.replace("/");
      return;
    }

    if (returnQuery !== undefined) {
      router.replace(
        returnQuery ? `/search?q=${encodeURIComponent(returnQuery)}` : "/search",
      );
      return;
    }

    if (initialReturnSource === "bids") {
      if (hasBidHistoryEntryState()) {
        router.back();
        return;
      }

      router.replace("/profile/bids");
      return;
    }

    if (initialReturnSource === "favorites") {
      if (hasFavoritesEntryState()) {
        router.back();
        return;
      }

      router.replace("/favorites");
      return;
    }

    if (initialReturnSource === "upload") {
      router.replace("/");
      return;
    }

    router.replace("/");
  }, [backHref, initialReturnSource, returnQuery, router]);

  useEffect(() => {
    const enterAnimationFrame = window.requestAnimationFrame(() => {
      setIsEntered(true);
    });

    return () => {
      window.cancelAnimationFrame(enterAnimationFrame);
    };
  }, []);

  // renderShell=false일 때 언더레이를 소유한 부모가 퇴장 전환을 따라가도록 알린다.
  useEffect(() => {
    onExitingChange?.(isExiting);
  }, [isExiting, onExitingChange]);

  useEffect(() => {
    const historyIndex = getHistoryIndex();
    const expectedBidHistoryEntryIndex = window.sessionStorage.getItem(
      PRODUCT_BID_HISTORY_ENTRY_INDEX_KEY,
    );
    const expectedFavoritesEntryIndex = window.sessionStorage.getItem(
      PRODUCT_FAVORITES_ENTRY_INDEX_KEY,
    );
    window.sessionStorage.removeItem(PRODUCT_BID_HISTORY_ENTRY_INDEX_KEY);
    window.sessionStorage.removeItem(PRODUCT_FAVORITES_ENTRY_INDEX_KEY);

    if (
      initialReturnSource === "bids" &&
      historyIndex !== null &&
      expectedBidHistoryEntryIndex === String(historyIndex)
    ) {
      window.history.replaceState(
        {
          ...(getHistoryState() ?? {}),
          [PRODUCT_BID_HISTORY_ENTRY_STATE_KEY]: true,
        },
        "",
      );
    }

    if (
      initialReturnSource === "favorites" &&
      historyIndex !== null &&
      expectedFavoritesEntryIndex === String(historyIndex)
    ) {
      window.history.replaceState(
        {
          ...(getHistoryState() ?? {}),
          [PRODUCT_FAVORITES_ENTRY_STATE_KEY]: true,
        },
        "",
      );
    }

  }, [initialReturnSource]);

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

      if (checkoutAddressSheetEnterAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(
          checkoutAddressSheetEnterAnimationFrameRef.current,
        );
      }

      if (checkoutAddressSheetCloseFallbackTimerRef.current !== null) {
        window.clearTimeout(checkoutAddressSheetCloseFallbackTimerRef.current);
      }

      if (checkoutCopyToastTimerRef.current !== null) {
        window.clearTimeout(checkoutCopyToastTimerRef.current);
      }
    };
  }, []);

  function handleBack() {
    if (isCheckoutAddressSheetOpen) {
      closeCheckoutAddressSheet();
      return;
    }

    if (isSheetOpen) {
      closeSheet();
      return;
    }

    if (returnQuery !== undefined) {
      window.sessionStorage.setItem(SEARCH_SKIP_ENTER_KEY, "true");
    } else {
      window.sessionStorage.removeItem(SEARCH_SKIP_ENTER_KEY);
    }

    window.sessionStorage.removeItem(PROFILE_SKIP_ENTER_KEY);

    if (initialReturnSource === "home") {
      window.sessionStorage.setItem(HOME_SKIP_ENTER_KEY, "true");
    } else {
      window.sessionStorage.removeItem(HOME_SKIP_ENTER_KEY);
    }

    if (initialReturnSource === "bids") {
      window.sessionStorage.setItem(BID_HISTORY_SKIP_ENTER_KEY, "true");
    } else {
      window.sessionStorage.removeItem(BID_HISTORY_SKIP_ENTER_KEY);
    }

    if (initialReturnSource === "favorites") {
      window.sessionStorage.setItem(FAVORITES_SKIP_ENTER_KEY, "true");
    } else {
      window.sessionStorage.removeItem(FAVORITES_SKIP_ENTER_KEY);
    }

    setIsExiting(true);
  }

  function openEditProduct() {
    const returnSourceQuery = initialReturnSource
      ? `&from=${initialReturnSource}`
      : "";

    router.push(
      `/upload?edit=${encodeURIComponent(product.id)}${returnSourceQuery}`,
    );
  }

  async function handleBookmarkClick() {
    const accessToken = authState.accessToken;
    const returnHref = `/products/${encodeURIComponent(buncheolId)}`;

    if (!authState.isLoggedIn || !accessToken) {
      router.push(
        createLoginHref({
          cancelTo: getCurrentBrowserHref(),
          returnTo: returnHref,
        }),
      );
      return;
    }

    if (isBookmarkPending) {
      return;
    }

    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setIsBookmarkPending(true);

    try {
      if (nextLiked) {
        await addBuncheolBookmark(accessToken, buncheolId);
      } else {
        await removeBuncheolBookmark(accessToken, buncheolId);
      }

      // 내 찜 변경을 홈 카드에도 반영해, 뒤로가기 시 하트 상태가 어긋나 보이지 않게 한다.
      // 찜은 로그인 상태에서만 가능하므로 로그인 목록 캐시만 갱신하면 된다.
      queryClient.setQueryData<ProductCardItem[]>(
        homeListingsQueryKey(true),
        (current) =>
          current?.map((item) =>
            (item.productId ?? item.id) === buncheolId
              ? { ...item, liked: nextLiked }
              : item,
          ),
      );
    } catch {
      setIsLiked(!nextLiked);
    } finally {
      setIsBookmarkPending(false);
    }
  }

  async function handleDeleteProduct() {
    const accessToken = authState.accessToken;

    if (!authState.isLoggedIn || !accessToken || isDeletePending) {
      return;
    }

    if (!window.confirm("이 분철을 삭제할까요?")) {
      return;
    }

    setIsDeletePending(true);

    try {
      await deleteBuncheol(accessToken, buncheolId);

      // 삭제된 분철이 목록에 남지 않도록 목록 쿼리를 무효화한다.
      void queryClient.invalidateQueries({ queryKey: buncheolsQueryKey });

      if (initialReturnSource === "bids") {
        window.sessionStorage.setItem(BID_HISTORY_SKIP_ENTER_KEY, "true");
        router.replace("/profile/bids");
        return;
      }

      router.replace("/");
    } catch (error: unknown) {
      window.alert(
        error instanceof Error
          ? error.message
          : "분철을 삭제하지 못했어요.",
      );
    } finally {
      setIsDeletePending(false);
    }
  }

  function startProductImageSwipe(event: PointerEvent<HTMLDivElement>) {
    if (productImages.length <= 1) {
      return;
    }

    productImagePointerStartXRef.current = event.clientX;
    setIsProductImageDragging(true);
    setProductImageDragOffset(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveProductImageSwipe(event: PointerEvent<HTMLDivElement>) {
    const startX = productImagePointerStartXRef.current;

    if (startX === null || productImages.length <= 1) {
      return;
    }

    const distanceX = event.clientX - startX;
    event.preventDefault();

    const isFirstImage = visibleProductImageIndex === 0;
    const isLastImage = visibleProductImageIndex === productImages.length - 1;
    const dampenedDistance =
      (isFirstImage && distanceX > 0) || (isLastImage && distanceX < 0)
        ? distanceX * 0.28
        : distanceX;

    setProductImageDragOffset(dampenedDistance);
  }

  function finishProductImageSwipe(event: PointerEvent<HTMLDivElement>) {
    const startX = productImagePointerStartXRef.current;
    productImagePointerStartXRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsProductImageDragging(false);
    setProductImageDragOffset(0);

    if (startX === null || productImages.length <= 1) {
      return;
    }

    const distance = event.clientX - startX;
    wasProductImageDraggedRef.current = Math.abs(distance) >= 10;

    if (Math.abs(distance) < 44) {
      return;
    }

    setCurrentProductImageIndex((current) => {
      const nextIndex = distance < 0 ? current + 1 : current - 1;

      return Math.max(0, Math.min(productImages.length - 1, nextIndex));
    });
  }

  function cancelProductImageSwipe() {
    productImagePointerStartXRef.current = null;
    setIsProductImageDragging(false);
    setProductImageDragOffset(0);
  }

  // 스와이프 후 발생하는 click 을 탭으로 오인하지 않도록 걸러낸다.
  function consumeProductImageTap() {
    if (wasProductImageDraggedRef.current) {
      wasProductImageDraggedRef.current = false;
      return false;
    }

    return true;
  }

  function openSheet() {
    if (!canBidProduct) {
      return;
    }

    if (sheetCloseFallbackTimerRef.current !== null) {
      window.clearTimeout(sheetCloseFallbackTimerRef.current);
      sheetCloseFallbackTimerRef.current = null;
    }

    setCheckoutStep("options");
    setCheckoutPaymentSummary(null);
    setCheckoutError("");
    setCheckoutCopyToast("");
    setIsSheetOpen(true);
    setIsSheetClosing(false);

    sheetEnterAnimationFrameRef.current = window.requestAnimationFrame(() => {
      sheetEnterAnimationFrameRef.current = null;
      setIsSheetEntered(true);
    });
  }

  function handleBidButtonClick() {
    if (isPublicPreview) {
      const returnHref = `/products/${encodeURIComponent(buncheolId)}`;

      router.push(
        createLoginHref({
          cancelTo: getCurrentBrowserHref(),
          returnTo: returnHref,
        }),
      );
      return;
    }

    if (isBidUnavailable) {
      return;
    }

    if (!canBidProduct) {
      return;
    }

    openSheet();
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
    if (isSheetClosing) {
      return;
    }

    // 시트를 직접 닫으면 복귀 복원 상태는 소진된 것으로 본다.
    pendingCheckoutRestoreRef.current = null;

    if (sheetEnterAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(sheetEnterAnimationFrameRef.current);
      sheetEnterAnimationFrameRef.current = null;
    }

    sheetDragStartYRef.current = null;
    setSheetDragOffset(0);
    setIsSheetClosing(true);
    setIsSheetEntered(false);

    if (sheetCloseFallbackTimerRef.current !== null) {
      window.clearTimeout(sheetCloseFallbackTimerRef.current);
    }

    sheetCloseFallbackTimerRef.current = window.setTimeout(() => {
      finishCloseSheet();
    }, 260);

    // payment·applied 단계 = 참여가 서버에 반영된 상태. 닫는 즉시 재조회해
    // 슬롯 점유 상태(saleStatus)를 맞춘다 — C2C 신청(APPLIED)도 슬롯을 선점한다.
    if (checkoutStep === "payment" || checkoutStep === "applied") {
      void refreshDetailOptions();
    }
  }

  function startSheetDrag(event: PointerEvent<HTMLButtonElement>) {
    if (isSheetClosing) {
      return;
    }

    sheetDragStartYRef.current = event.clientY;
    setSheetDragOffset(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveSheetDrag(event: PointerEvent<HTMLButtonElement>) {
    const startY = sheetDragStartYRef.current;

    if (startY === null) {
      return;
    }

    event.preventDefault();
    setSheetDragOffset(Math.max(0, event.clientY - startY));
  }

  function finishSheetDrag(event: PointerEvent<HTMLButtonElement>) {
    const startY = sheetDragStartYRef.current;
    sheetDragStartYRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (startY !== null && event.clientY - startY >= sheetDragCloseThreshold) {
      closeSheet();
      return;
    }

    setSheetDragOffset(0);
  }

  function cancelSheetDrag() {
    sheetDragStartYRef.current = null;
    setSheetDragOffset(0);
  }

  function finishCloseCheckoutAddressSheet() {
    if (checkoutAddressSheetCloseFallbackTimerRef.current !== null) {
      window.clearTimeout(checkoutAddressSheetCloseFallbackTimerRef.current);
      checkoutAddressSheetCloseFallbackTimerRef.current = null;
    }

    setIsCheckoutAddressSheetOpen(false);
    setIsCheckoutAddressSheetClosing(false);
  }

  function closeCheckoutAddressSheet() {
    if (checkoutAddressSheetEnterAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(
        checkoutAddressSheetEnterAnimationFrameRef.current,
      );
      checkoutAddressSheetEnterAnimationFrameRef.current = null;
    }

    setIsCheckoutAddressSheetClosing(true);
    setIsCheckoutAddressSheetEntered(false);

    if (checkoutAddressSheetCloseFallbackTimerRef.current !== null) {
      window.clearTimeout(checkoutAddressSheetCloseFallbackTimerRef.current);
    }

    checkoutAddressSheetCloseFallbackTimerRef.current = window.setTimeout(() => {
      finishCloseCheckoutAddressSheet();
    }, 260);
  }

  function confirmCheckoutAddressSelection() {
    if (selectedCheckoutItems.length === 0) {
      const draftState =
        typeof window === "undefined"
          ? null
          : parseCheckoutAddressReturnState(
              window.sessionStorage.getItem(CHECKOUT_DRAFT_STATE_KEY),
              buncheolId,
            );
      const draftOptions = draftState
        ? getCheckoutReturnOptionsFromState(draftState)
        : [];

      restoreCheckoutSelectionFromReturnOptions(
        checkoutSelectedOptionsRef.current.length > 0
          ? checkoutSelectedOptionsRef.current
          : draftOptions,
      );
    }

    const selectedAddress =
      checkoutDeliveryAddress ??
      bidDeliveryAddress ??
      checkoutEligibleDeliveryAddresses[0] ??
      null;

    if (!selectedAddress) {
      setIsCvsStoreSearchOpen(true);
      return;
    }

    setCheckoutDeliveryAddress(selectedAddress);
    setCheckoutStep("confirm");
    setCheckoutPaymentSummary(null);
    setCheckoutError("");
    setCheckoutCopyToast("");

    if (sheetCloseFallbackTimerRef.current !== null) {
      window.clearTimeout(sheetCloseFallbackTimerRef.current);
      sheetCloseFallbackTimerRef.current = null;
    }

    if (sheetEnterAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(sheetEnterAnimationFrameRef.current);
      sheetEnterAnimationFrameRef.current = null;
    }

    setIsSheetOpen(true);
    setIsSheetClosing(false);
    setIsSheetEntered(false);

    sheetEnterAnimationFrameRef.current = window.requestAnimationFrame(() => {
      sheetEnterAnimationFrameRef.current = null;
      setIsSheetEntered(true);
    });

    closeCheckoutAddressSheet();
  }

  async function openCheckoutAddressSheet() {
    let nextAddressState = deliveryAddressState;

    if (product.isApiProduct && authState.isLoggedIn) {
      const accessToken = await getFreshAccessToken();

      if (accessToken) {
        try {
          nextAddressState = await syncDeliveryAddressState(accessToken);
        } catch {
          nextAddressState = deliveryAddressState;
        }
      }
    }

    const nextEligibleDeliveryAddresses =
      getCheckoutEligibleDeliveryAddressesFromState(nextAddressState);

    if (
      nextEligibleDeliveryAddresses.length === 0 &&
      nextAddressState.addresses.length < maxDeliveryAddressCount
    ) {
      // 배송지가 하나도 없으면 이탈 대신 접수처 검색 시트로 바로 등록한다.
      // 상한(5개)까지 찼는데 전부 비취급 브랜드면 시트를 열어 관리 링크로 안내한다.
      setIsCvsStoreSearchOpen(true);
      return;
    }

    if (checkoutAddressSheetCloseFallbackTimerRef.current !== null) {
      window.clearTimeout(checkoutAddressSheetCloseFallbackTimerRef.current);
      checkoutAddressSheetCloseFallbackTimerRef.current = null;
    }

    const preferredAddressId =
      checkoutDeliveryAddress?.id ?? bidDeliveryAddress?.id ?? null;

    setCheckoutDeliveryAddress(
      (current) => {
        const currentAddress = current
          ? nextEligibleDeliveryAddresses.find(
              (address) => address.id === current.id,
            )
          : null;

        return (
          currentAddress ??
          getPreferredDeliveryAddressFromState(
            nextAddressState,
            preferredAddressId,
          )
        );
      },
    );
    setIsCheckoutAddressSheetOpen(true);
    setIsCheckoutAddressSheetClosing(false);

    checkoutAddressSheetEnterAnimationFrameRef.current =
      window.requestAnimationFrame(() => {
        checkoutAddressSheetEnterAnimationFrameRef.current = null;
        setIsCheckoutAddressSheetEntered(true);
      });
  }

  async function copyCheckoutText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCheckoutCopyToast(`${label}를 복사했어요.`);
    } catch {
      setCheckoutCopyToast(`${label} 복사에 실패했어요.`);
    }

    if (checkoutCopyToastTimerRef.current !== null) {
      window.clearTimeout(checkoutCopyToastTimerRef.current);
    }

    checkoutCopyToastTimerRef.current = window.setTimeout(() => {
      setCheckoutCopyToast("");
      checkoutCopyToastTimerRef.current = null;
    }, 1800);
  }

  async function handleShareProduct() {
    // 공유 시트가 뜨는 사이 한 번 더 누르면 Web Share 가 InvalidStateError 로 거절한다.
    // 그대로 두면 시트가 열린 채 복사 폴백이 돌아 토스트와 중복 이벤트가 남는다.
    if (isSharePendingRef.current) {
      return;
    }

    isSharePendingRef.current = true;

    try {
      // 진입 경로(?from=...)나 검색어가 링크에 섞이지 않도록 상세 canonical 경로만 공유한다.
      // origin 은 현재 접속한 환경을 그대로 쓴다 — 스테이징에서 운영 링크가 나가지 않게 한다.
      // (NEXT_PUBLIC_SITE_URL 은 배포 워크플로가 주입하지 않아 SITE_URL 은 항상 운영 도메인이다.)
      const shareUrl = `${window.location.origin}/products/${encodeURIComponent(
        buncheolId,
      )}`;

      if (typeof navigator.share === "function") {
        try {
          // title 만 넘기면 대상 앱 대부분이 이를 무시해 링크만 남는다. text 로 제목을 함께 싣는다.
          await navigator.share({
            title: product.title,
            text: product.title,
            url: shareUrl,
          });
          trackEvent("buncheol_shared", {
            buncheol_id: buncheolId,
            method: "web_share",
          });

          return;
        } catch (error) {
          // 공유 시트를 사용자가 그냥 닫은 경우는 실패가 아니라 취소다. 링크 복사로 넘기지 않는다.
          // DOMException 대신 Error 로 reject 하는 웹뷰까지 취소로 인정한다.
          if (error instanceof Error && error.name === "AbortError") {
            return;
          }
        }
      }

      // Web Share 미지원(데스크톱 브라우저 다수) 또는 공유 실패 시 링크 복사로 대체한다.
      try {
        await navigator.clipboard.writeText(shareUrl);
        trackEvent("buncheol_shared", {
          buncheol_id: buncheolId,
          method: "clipboard",
        });
        showProductToast("분철 링크를 복사했어요.");
      } catch {
        showProductToast("링크 복사에 실패했어요.");
      }
    } finally {
      isSharePendingRef.current = false;
    }
  }

  function openBidHistory() {
    window.sessionStorage.setItem(BID_HISTORY_SKIP_ENTER_KEY, "true");
    router.push("/profile/bids");
  }

  const panelAndSheets = (
    <>
      <div
        className={`${productPagePanelClassName} ${
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
        <header className="product-detail-header shrink-0 px-4 pb-2 pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="product-detail-action motion-icon-button mr-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-white"
              onClick={handleBack}
              aria-label="이전 화면"
            >
              <BackIcon />
            </button>
            {canEditProduct ? (
              <button
                type="button"
                className="product-detail-action inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black"
                onClick={openEditProduct}
                aria-label="분철 수정"
              >
                <EditIcon />
              </button>
            ) : null}
            {canDeleteProduct ? (
              <button
                type="button"
                className="product-detail-action inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black disabled:text-black/25"
                onClick={handleDeleteProduct}
                aria-label="분철 삭제"
                disabled={isDeletePending}
              >
                <TrashIcon />
              </button>
            ) : null}
            {canShareProduct ? (
              <button
                type="button"
                className="product-detail-action motion-icon-button inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black"
                onClick={() => void handleShareProduct()}
                aria-label="분철 공유"
              >
                <ShareIcon />
              </button>
            ) : null}
            {!canEditProduct ? (
              <button
                type="button"
                className={`product-detail-action motion-icon-button inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 ${
                  isLiked
                    ? "bg-[#DDE7B8] text-black shadow-[0_8px_22px_rgba(120,132,82,0.22)]"
                    : "bg-white text-black"
                }`}
                aria-label={isLiked ? "찜 해제" : "찜하기"}
                disabled={isBookmarkPending}
                onClick={handleBookmarkClick}
              >
                <HeartIcon filled={isLiked} />
              </button>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto pb-32">
          <section className="px-4">
            <div
              className={`product-hero-media product-detail-media relative overflow-hidden rounded-[1.35rem] bg-gradient-to-br ${product.tone}`}
            >
              {productImages.length > 0 ? (
                <>
                  <div
                    className="h-full cursor-zoom-in touch-none select-none overflow-hidden"
                    onClick={() => {
                      if (consumeProductImageTap()) {
                        setIsImageViewerOpen(true);
                      }
                    }}
                    onPointerCancel={cancelProductImageSwipe}
                    onPointerDown={startProductImageSwipe}
                    onPointerMove={moveProductImageSwipe}
                    onPointerUp={finishProductImageSwipe}
                  >
                    <div
                      className={`flex h-full ${
                        isProductImageDragging
                          ? ""
                          : "transition-transform duration-300 ease-out"
                      }`}
                      style={{
                        transform: `translateX(${productImageTrackOffset})`,
                      }}
                    >
                      {productImages.map((imageUrl, imageIndex) => (
                        <div
                          className="h-full w-full shrink-0 overflow-hidden"
                          key={imageUrl}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt=""
                            className="h-full w-full object-cover"
                            draggable={false}
                            fetchPriority={imageIndex === 0 ? "high" : "auto"}
                            loading={imageIndex === 0 ? "eager" : "lazy"}
                            src={imageUrl}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  {shouldDimProductMedia ? (
                    <div className="pointer-events-none absolute inset-0 bg-black/35" />
                  ) : null}
                  {productImages.length > 1 ? (
                    <div className="absolute bottom-4 right-4 rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur">
                      {visibleProductImageIndex + 1}/{productImages.length}
                    </div>
                  ) : null}
                </>
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
              <div
                className={`absolute left-5 top-5 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] shadow-[0_8px_18px_rgba(0,0,0,0.18)] ${
                  isPurchasableStatus &&
                  !isCancelledProduct &&
                  !isDeadlineBlocked
                    ? "bg-[#DDE7B8] text-black"
                    : "bg-black/75 text-white backdrop-blur"
                }`}
              >
                {product.badge}
              </div>
            </div>
          </section>

          <section className="px-5 pt-6">
            <p className="text-[13px] font-semibold leading-5 text-black/40">
              {targetTags.join(" ")}
            </p>

            {/* 제목 전문 노출은 이 화면(분철 상세)에서만 한다(docs/56 H-03).
                목록·카드·개최 관리는 기존 truncate/line-clamp 를 유지한다. */}
            <h1 className="mt-4 break-words text-[27px] font-semibold leading-[1.18] tracking-[-0.06em]">
              {product.title}
            </h1>
            <div className="mt-7 overflow-hidden rounded-[1.15rem] border border-black/10 bg-white shadow-[0_14px_34px_rgba(0,0,0,0.045)]">
              <div className="grid grid-cols-[0.86fr_1.14fr] divide-x divide-black/10 border-b border-black/10">
                <div className="min-w-0 px-4 py-3.5">
                  <p className="text-[12px] font-medium text-black/45">구매처</p>
                  <p className="mt-1 truncate text-[16px] font-semibold tracking-[-0.04em]">
                    {product.purchaseSource ?? "공식 판매처"}
                  </p>
                </div>
                <div className="min-w-0 px-4 py-3.5">
                  <p className="text-[12px] font-medium text-black/45">
                    구매 기한
                  </p>
                  <p className="mt-1 text-[15px] font-semibold leading-6 tracking-[-0.04em] tabular-nums">
                    {purchaseDeadlineDisplay}
                  </p>
                </div>
              </div>
              <div className="px-4 py-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-medium text-black/45">
                      참여 현황
                    </p>
                    <p className="mt-1 text-[22px] font-semibold tracking-[-0.06em]">
                      {isConfirmedProduct ? (
                        "진행 확정"
                      ) : (
                        <>
                          현재 {currentParticipationCount.toLocaleString("ko-KR")}
                          {minHeadcount !== null
                            ? `/${minHeadcount.toLocaleString("ko-KR")}`
                            : ""}
                          명
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="h-full rounded-full bg-[#CFE86B] transition-[width] duration-500"
                    style={{ width: participationProgressPercent }}
                  />
                </div>
                <p className="mt-2 text-[12px] font-semibold text-black/40">
                  {isConfirmedProduct
                    ? "마감된 분철이에요. 아래 멤버에서 입금 대기/구매 완료 기록을 확인해요."
                    : remainingHeadcount === null
                    ? "개최자가 정한 진행 기준을 확인하고 있어요."
                    : remainingHeadcount > 0
                      ? `분철 진행 최소 인원까지 ${remainingHeadcount.toLocaleString("ko-KR")}명 남았어요. 인원을 채우면 진행이 확정돼요.`
                      : "분철 진행 최소 인원을 채웠어요."}
                </p>
              </div>
            </div>

            {shippingMethods.length > 0 ? (
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
              <p className="mt-3 text-[12px] font-medium leading-5 text-black/40">
                이 분철에서 이용할 수 있는 배송 방법과 배송비예요. 참여할 때 이
                중에서 택배 받을 편의점 지점을 고르고, 배송비는 상품 금액과 함께
                입금해요.
              </p>
            </div>
            ) : null}

            <div className="mt-8 border-t border-black/10 pt-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                상품 설명
              </h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-7 tracking-[-0.04em] text-black/65">
                {product.description.trim() ||
                  "개최자가 아직 상품 설명을 적지 않았어요."}
              </p>
            </div>

            {isC2CProduct ? (
              // flow_type 기반 책임 표시 구분 (docs/46 §7.1-4): C2C 분철은 중개 거래임을
              // 상세에서 상시 고지한다. LEGACY(운영진 개최)는 기존 직접판매 표기 유지.
              <div className="mt-6 rounded-[0.95rem] border border-black/10 bg-[#fafafa] px-4 py-4">
                <p className="text-[13px] font-semibold tracking-[-0.04em]">
                  개최자가 직접 진행하는 분철이에요
                </p>
                <p className="mt-1.5 text-[12px] font-medium leading-5 text-black/45">
                  분철이지는 통신판매중개자로 거래 당사자가 아니며, 대금은
                  개최자 계좌로 직접 입금돼요. 상품·거래에 관한 책임은 개최자에게
                  있어요.
                </p>
                {productOpenChatHref ? (
                  <a
                    className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-black/60 underline underline-offset-2"
                    href={productOpenChatHref}
                    rel="noreferrer"
                    target="_blank"
                  >
                    개최자 오픈채팅 참여하기 →
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="mt-8 border-t border-black/10 pt-6">
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-[18px] font-semibold">
                  멤버
                </h2>
                <p className="text-[12px] font-semibold text-black/35">
                  {auctionOptions.length.toLocaleString("ko-KR")}명
                </p>
              </div>
              <div className="mt-4 overflow-hidden rounded-[0.95rem] border border-black/10 bg-white">
                {auctionOptions.map((option) => {
                  const overlayLabel =
                    getOptionPurchaseOverlayLabel(
                      option,
                      myBids[option.id],
                      product.isApiProduct === true,
                    ) ?? productOptionBlockLabel;
                  const isMine = isOptionParticipatedByMe(
                    option,
                    myBids[option.id],
                  );
                  const blockChipLabel = getOptionPurchaseBlockChipLabel(
                    overlayLabel,
                    option,
                    deadlineTick,
                    isMine,
                    isC2CProduct ? c2cPaymentWindowMs : paymentWindowMs,
                  );
                  // 내 진행중 주문·C2C 신청 칩은 참여 내역으로 이동하는 버튼으로 렌더한다.
                  const isMyPaymentWaitingChip =
                    isMine &&
                    (overlayLabel === PURCHASE_OPTION_LABELS.paymentWaiting ||
                      overlayLabel === PURCHASE_OPTION_LABELS.applied);

                  return (
                    <div
                      key={option.id}
                      className={`relative flex min-h-[72px] items-center justify-between gap-3 overflow-hidden border-b border-black/[0.06] px-4 py-3 last:border-b-0 ${
                        overlayLabel
                          ? "bg-[#fafafa]"
                          : "bg-white"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={overlayLabel ? "opacity-45" : ""}>
                          <OptionAvatar option={option} size="md" />
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`truncate text-[16px] font-semibold ${
                              overlayLabel ? "text-black/45" : "text-black"
                            }`}
                          >
                            {option.label}
                          </p>
                          {overlayLabel ? null : (
                            <p className="mt-0.5 text-[12px] font-semibold text-black/35">
                              구매 가능 멤버
                            </p>
                          )}
                        </div>
                      </div>
                      <div
                        className={`shrink-0 text-right ${
                          overlayLabel ? "opacity-45" : ""
                        }`}
                      >
                        <p className="text-[11px] font-semibold text-black/35">
                          {getOptionPriceLabel()}
                        </p>
                        <p className="mt-0.5 text-[16px] font-semibold">
                          {getBidBaseline(option)}
                        </p>
                        {isShippingFeePaybackProduct ? (
                          <p className="mt-0.5 text-[11px] font-semibold text-[#7A8A3A]">
                            배송비만 결제
                          </p>
                        ) : null}
                      </div>
                      {blockChipLabel ? (
                        <div
                          aria-hidden={isMyPaymentWaitingChip ? undefined : true}
                          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/55 backdrop-blur-[0.5px]"
                        >
                          {isMyPaymentWaitingChip ? (
                            <button
                              type="button"
                              aria-label={`${blockChipLabel}, 내 참여 내역 보기`}
                              className={`relative pointer-events-auto inline-flex items-center gap-0.5 after:absolute after:-inset-3 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2 ${memberStatusChipClassName}`}
                              onClick={openBidHistory}
                            >
                              {/* 텍스트 › 는 칩 글자보다 작게 보여 눌러도 되는지 안 읽혔다(docs/56 H-04).
                                  라벨은 계속 말줄임하고, 화살표만 아이콘으로 키워 고정한다. */}
                              <span className="min-w-0 truncate">
                                {blockChipLabel}
                              </span>
                              <ForwardIcon className="h-[1.15rem] w-[1.15rem] shrink-0" />
                            </button>
                          ) : (
                            <span className={memberStatusChipClassName}>
                              {blockChipLabel}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {isShippingFeePaybackProduct ? (
                <div className="mt-4 rounded-[0.95rem] border border-[#DDE7B8] bg-[#F7FAEE] px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-[#D7FF5F]">
                      무료 분철 이벤트
                    </span>
                    <p className="text-[13px] font-semibold tracking-[-0.04em]">
                      배송비는 환급되니 걱정 마세요!
                    </p>
                  </div>
                  <ol className="mt-3 space-y-1.5 text-[13px] font-medium leading-5 text-black/60">
                    <li>1. 지금은 배송비만 입금하고 참여해요.</li>
                    <li>2. 택배를 수령해요.</li>
                    <li>
                      3. 참여 내역의 [후기 쓰고 배송비 돌려받기] 버튼을 눌러 X에
                      후기를 작성해요.
                    </li>
                    <li>4. 작성한 후기 링크로 신청해 주시면 배송비를 환급해 드려요!</li>
                  </ol>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <div className="product-detail-bid-bar absolute bottom-0 left-0 right-0 z-20 bg-white px-5 pb-5 pt-3 shadow-[0_-12px_34px_rgba(0,0,0,0.08)]">
          {!isHostedProduct &&
          !isCancelledProduct &&
          !isDeadlineBlocked &&
          isPurchasableStatus ? (
            <p className="mb-2 text-center text-[11px] font-medium text-black/40">
              {isC2CProduct
                ? isC2CCollectingProduct
                  ? "빈 자리는 바로 입금하는 추가 신청으로 참여해요."
                  : "지금은 신청만 하고, 개최자가 확정하면 입금해요."
                : "분철당 1명의 멤버에게 1번만 참여할 수 있어요."}
            </p>
          ) : null}
          <button
            type="button"
            className="h-14 w-full rounded-full bg-[#CFE86B] text-[17px] font-semibold tracking-[-0.04em] text-black shadow-[0_12px_28px_rgba(120,132,82,0.24)] disabled:bg-black/20 disabled:text-white"
            disabled={isMainBidButtonDisabled}
            onClick={
              isMainBidButtonDisabled ? undefined : handleBidButtonClick
            }
          >
            {isPublicPreview
              ? isC2CProduct
                ? "로그인 후 신청하기"
                : "로그인 후 구매하기"
              : isBidUnavailable
                ? isC2CProduct
                  ? "신청하기"
                  : "구매하기"
                : canBidProduct
                  ? isC2CProduct && !isC2CCollectingProduct
                    ? "신청하기"
                    : "구매하기"
                  : getBidUnavailableMessage()}
          </button>
        </div>

        {isSheetOpen ? (
          <div
            className={`bid-sheet-backdrop absolute inset-0 z-40 flex items-end ${
              isSheetEntered && !isSheetClosing ? "bid-sheet-backdrop-active" : ""
            }`}
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              onClick={closeSheet}
              aria-label="멤버 선택 닫기"
            />
            <section
              className={`bid-sheet-panel relative w-full rounded-t-[1.4rem] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
                isSheetEntered && !isSheetClosing ? "bid-sheet-panel-active" : ""
              }`}
              style={
                sheetDragOffset > 0 && !isSheetClosing
                  ? {
                      transform: `translateY(${sheetDragOffset}px) scale(1)`,
                      transition: "none",
                    }
                  : undefined
              }
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
              <button
                aria-label="모달을 아래로 내려 닫기"
                className="mx-auto mb-3 flex h-5 w-16 touch-none cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
                onPointerCancel={cancelSheetDrag}
                onPointerDown={startSheetDrag}
                onPointerMove={moveSheetDrag}
                onPointerUp={finishSheetDrag}
                type="button"
              >
                <span className="h-1 w-10 rounded-full bg-black/15" />
              </button>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[21px] font-semibold tracking-[-0.06em]">
                    {checkoutStep === "payment"
                      ? "입금 안내"
                      : checkoutStep === "applied"
                        ? "신청 완료"
                        : checkoutStep === "confirm"
                          ? isC2CProduct && !isC2CCollectingProduct
                            ? "신청 확인"
                            : "주문 확인"
                          : "멤버 선택"}
                  </h2>
                  <p className="mt-1 text-[13px] font-medium text-black/45">
                    {checkoutStep === "payment"
                      ? "입금 마감 시간 내에 아래 계좌로 입금해 주세요."
                      : checkoutStep === "applied"
                        ? "개최자가 성사를 확정하면 입금 안내를 드려요."
                        : checkoutStep === "confirm"
                          ? isC2CProduct && !isC2CCollectingProduct
                            ? "신청 단계에서는 입금하지 않아요. 개최자가 확정하면 입금 안내를 받아요."
                            : "주문하면 입금 계좌와 마감 시각이 안내돼요."
                          : isC2CProduct
                            ? "신청할 멤버를 선택해 주세요. 여러 멤버에 각각 신청할 수 있어요."
                            : "구매할 멤버를 선택해 주세요. 분철당 1명의 멤버에게 1번만 참여할 수 있어요."}
                  </p>
                </div>
                <button
                  type="button"
                  className="motion-icon-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
                  onClick={closeSheet}
                  aria-label="닫기"
                >
                  <CloseIcon />
                </button>
              </div>

              {checkoutStep === "options" ? (
                <>
                  <div className="mt-3 max-h-[44dvh] space-y-1.5 overflow-y-auto pr-1 [touch-action:pan-y]">
                    {sortedAuctionOptions.map((option) => {
                      const isSelected = bidAmounts[option.id] === "selected";
                      const overlayLabel =
                        getOptionPurchaseOverlayLabel(
                          option,
                          myBids[option.id],
                          product.isApiProduct === true,
                        ) ?? productOptionBlockLabel;
                      const displayedOverlayLabel =
                        getOptionPurchaseBlockChipLabel(
                          overlayLabel,
                          option,
                          deadlineTick,
                          isOptionParticipatedByMe(option, myBids[option.id]),
                          isC2CProduct ? c2cPaymentWindowMs : paymentWindowMs,
                        );

                      return (
                        <button
                          key={option.id}
                          className={`relative w-full overflow-hidden rounded-[0.85rem] border px-3 py-1.5 text-left transition-colors disabled:cursor-default ${
                            overlayLabel
                              ? "border-black/10 bg-[#f7f7f7]"
                              : isSelected
                              ? "border-[#C8D4A5] bg-[#F3F5EA]"
                              : "border-black/10 bg-white"
                          }`}
                          disabled={Boolean(overlayLabel)}
                          onClick={() => togglePurchaseOption(option.id)}
                          type="button"
                        >
                          <div
                            className={`flex items-center justify-between gap-2.5 ${
                              overlayLabel ? "opacity-65" : ""
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <OptionAvatar option={option} size="sm" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                                    {option.label}
                                  </p>
                                </div>
                                <p className="mt-0.5 text-[12px] font-medium tracking-[-0.04em] text-black/45">
                                  {displayedOverlayLabel ?? "구매 가능"}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 text-right">
                              <p className="text-[15px] font-semibold tracking-[-0.04em]">
                                {getBidBaseline(option)}
                              </p>
                              <span
                                className={`inline-flex h-7 min-w-[52px] items-center justify-center rounded-full px-2.5 text-[12px] font-semibold transition-colors ${
                                  overlayLabel
                                    ? "bg-black/10 text-black/35"
                                    : isSelected
                                      ? "bg-[#DDE7B8] text-black"
                                      : "bg-[#f7f7f7] text-black/55"
                                }`}
                              >
                                {overlayLabel
                                  ? "선택 불가"
                                  : isSelected
                                    ? "해제"
                                    : "선택"}
                              </span>
                            </div>
                          </div>
                          {overlayLabel ? (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-[0.5px]">
                              <span className="whitespace-nowrap rounded-full bg-black/70 px-3.5 py-1.5 text-[12px] font-semibold text-white backdrop-blur">
                                {displayedOverlayLabel}
                              </span>
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-black/10 pt-4">
                    <span className="text-[14px] font-medium text-black/45">
                      선택 멤버 {activeBidCount}명
                    </span>
                    <span className="text-[22px] font-semibold tracking-[-0.05em]">
                      {formatPrice(totalBidAmount)}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="mt-4 h-14 w-full rounded-full bg-[#CFE86B] text-[17px] font-semibold tracking-[-0.04em] text-black shadow-[0_12px_28px_rgba(120,132,82,0.24)] disabled:bg-black/20 disabled:text-white"
                    disabled={
                      activeBidCount === 0 || isBidSubmitPending || !canBidProduct
                    }
                    onClick={() => void handleProceedToCheckoutConfirm()}
                  >
                    {isBidSubmitPending ? "확인 중" : "다음"}
                  </button>
                </>
              ) : null}

              {checkoutStep === "confirm" ? (
                <>
                  <div className="mt-5 max-h-[48dvh] space-y-3 overflow-y-auto pr-1 [touch-action:pan-y]">
                    <div className="rounded-[0.95rem] bg-[#f7f7f7] px-4 py-4">
                      <p className="text-[12px] font-semibold text-black/40">선택 멤버</p>
                      <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                        {selectedCheckoutItems[0]?.option.label ?? "-"}
                        {selectedCheckoutItems.length > 1
                          ? ` 외 ${selectedCheckoutItems.length - 1}개`
                          : ""}
                      </p>
                      <div className="mt-3 space-y-2">
                        {selectedCheckoutItems.map(({ bidAmount, option }) => (
                          <div
                            key={option.id}
                            className="flex items-center justify-between gap-3 text-[13px] font-semibold tracking-[-0.04em]"
                          >
                            <span className="truncate text-black/55">{option.label}</span>
                            <span className="shrink-0">{formatPrice(bidAmount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[0.95rem] border border-black/10 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-black/40">배송지</p>
                          {/* 추가 신청은 서버가 첫 참여 배송지 스냅샷을 강제한다(docs/46 §4.7-A1).
                              현재 선택값을 그대로 보여주면 실제 배송지와 다를 수 있어 문구로 대체한다. */}
                          <p className="mt-1 truncate text-[15px] font-semibold tracking-[-0.04em]">
                            {isAdditionalC2CApplication
                              ? "첫 신청 때 선택한 배송지"
                              : checkoutDeliveryAddress
                                ? `${getConvenienceStoreLabel(checkoutDeliveryAddress.storeType)} ${getDeliveryAddressDisplayBranchName(checkoutDeliveryAddress)}`
                                : "등록된 배송지 없음"}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-5 text-black/40">
                            {isAdditionalC2CApplication
                              ? "첫 신청 배송지로 함께 배송돼요."
                              : checkoutDeliveryAddress?.address ??
                                "배송지를 등록해 주세요."}
                          </p>
                        </div>
                        {isAdditionalC2CApplication ? null : (
                          <button
                            className="h-9 shrink-0 rounded-full bg-[#f3f3f3] px-3 text-[12px] font-semibold text-black/55"
                            onClick={() => void openCheckoutAddressSheet()}
                            type="button"
                          >
                            {checkoutDeliveryAddress
                              ? "변경"
                              : checkoutEligibleDeliveryAddresses.length > 0
                                ? "선택"
                                : "추가"}
                          </button>
                        )}
                      </div>
                      <p className="mt-2.5 text-[12px] font-medium leading-5 text-black/40">
                        {isAdditionalC2CApplication
                          ? "추가 신청은 첫 신청과 같은 배송지·입금자명으로 묶여요. 배송비도 추가로 부과되지 않아요."
                          : "택배가 도착하면 선택한 편의점 지점에 직접 방문해서 수령해요."}
                      </p>
                    </div>

                    <div className="rounded-[0.95rem] bg-black px-4 py-4 text-white ring-1 ring-[#AAB67C]/35">
                      <div className="flex items-center justify-between text-[13px] font-semibold text-white/60">
                        <span>상품 금액</span>
                        <span>{formatPrice(totalBidAmount)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[13px] font-semibold text-white/60">
                        <span>예상 배송비</span>
                        <span>
                          {isAdditionalC2CApplication
                            ? "0원 (첫 신청에 포함)"
                            : formatPrice(estimatedShippingAmount)}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-4">
                        <span className="text-[14px] font-semibold text-white/70">총 예상 금액</span>
                        <span className="text-[22px] font-semibold tracking-[-0.05em] text-[#DDE7B8]">
                          {formatPrice(
                            isAdditionalC2CApplication
                              ? totalBidAmount
                              : estimatedCheckoutTotal,
                          )}
                        </span>
                      </div>
                      {isShippingFeePaybackProduct ? (
                        <p className="mt-3 border-t border-white/15 pt-3 text-[12px] font-semibold leading-5 text-[#DDE7B8]">
                          이 분철은 전액 무료로 진행되는 이벤트 분철이에요.
                          <br />
                          배송비 {formatPrice(estimatedShippingAmount)}은 보증금
                          개념으로 받고 있어요.
                          <br />
                          택배를 수령한 뒤 이벤트 후기를 남겨주시면 등록한 환불
                          계좌로 그대로 돌려드려요.
                        </p>
                      ) : null}
                    </div>

                    <p className="px-1 text-[12px] font-medium leading-5 text-black/45">
                      {isC2CProduct && !isC2CCollectingProduct
                        ? "신청 단계에서는 입금하지 않아요. 개최자가 성사를 확정하면 알림톡으로 입금 안내를 드리고, 확정 전에는 언제든 무료로 취소할 수 있어요."
                        : isC2CCollectingProduct
                          ? "신청하면 24시간 입금 기한이 정해져요. 기한 내에 입금하지 않으면 신청이 자동 취소돼요."
                          : "주문하면 입금 마감 시각이 정해져요. 마감 시간 내에 입금하지 않으면 주문이 자동 취소돼요."}
                    </p>
                    {isC2CProduct ? (
                      // 중개자 고지(전상법 §20① — docs/41 §3.3-1) + 미성년자 §13③ 취소 가능성 고지
                      // (docs/43 §2-5): 계약 체결 화면에 미리 노출한다.
                      <p className="px-1 text-[11px] font-medium leading-4 text-black/35">
                        분철이지는 통신판매중개자로 거래 당사자가 아니며, 대금은
                        개최자 계좌로 직접 입금됩니다. 미성년자가 법정대리인
                        동의 없이 체결한 계약은 본인 또는 법정대리인이 취소할 수
                        있습니다.
                      </p>
                    ) : null}
                    {checkoutError ? (
                      <p
                        className="error-shake rounded-[0.85rem] bg-[#fff2f2] px-4 py-3 text-[12px] font-semibold leading-5 text-[#c03131]"
                        key={checkoutError}
                      >
                        {checkoutError}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-[0.42fr_0.58fr] gap-2">
                    <button
                      className="h-14 rounded-full bg-[#f3f3f3] text-[15px] font-semibold tracking-[-0.04em] text-black/60"
                      onClick={() => setCheckoutStep("options")}
                      type="button"
                    >
                      이전
                    </button>
                    <button
                      className="h-14 rounded-full bg-[#CFE86B] text-[17px] font-semibold tracking-[-0.04em] text-black shadow-[0_12px_28px_rgba(120,132,82,0.24)] disabled:bg-black/20 disabled:text-white"
                      disabled={
                        isBidSubmitPending ||
                        activeBidCount === 0 ||
                        !canBidProduct ||
                        !checkoutDeliveryAddress
                      }
                      onClick={() => void handleSubmitBids()}
                      type="button"
                    >
                      {isC2CProduct && !isC2CCollectingProduct
                        ? isBidSubmitPending
                          ? "신청 접수 중"
                          : "이대로 신청할게요!"
                        : isBidSubmitPending
                          ? "주문 접수 중"
                          : "이대로 주문할게요!"}
                    </button>
                  </div>
                </>
              ) : null}

              {checkoutStep === "payment" ? (
                checkoutPaymentSummary ? (
                  <>
                    <div className="mt-5 max-h-[48dvh] space-y-3 overflow-y-auto pr-1 [touch-action:pan-y]">
                      <div className="rounded-[0.95rem] bg-black px-4 py-4 text-white ring-1 ring-[#AAB67C]/35">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[12px] font-semibold text-[#DDE7B8]">
                              입금 마감
                            </p>
                            <p className="mt-1 text-[23px] font-semibold tracking-[-0.05em] text-white">
                              {formatPaymentDueCountdown(
                                checkoutPaymentSummary.paymentDueAt,
                                deadlineTick,
                                isC2CProduct
                                  ? c2cPaymentWindowMs
                                  : paymentWindowMs,
                              )}
                            </p>
                          </div>
                          <p className="shrink-0 pt-1 text-right text-[12px] font-semibold leading-5 text-white/45">
                            {formatCheckoutDateTime(
                              checkoutPaymentSummary.paymentDueAt,
                            )}
                          </p>
                        </div>
                        <p className="mt-3 text-[12px] font-medium leading-5 text-white/60">
                          마감 전까지 입금하지 않으면 자동 취소돼요.
                        </p>
                      </div>

                      <div className="rounded-[0.95rem] bg-[#f7f7f7] px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[12px] font-semibold text-black/40">
                            선택 멤버
                          </p>
                          <span className="text-[12px] font-semibold text-black/35">
                            {checkoutPaymentSummary.items.length}명
                          </span>
                        </div>
                        <div className="mt-2 space-y-2">
                          {checkoutPaymentSummary.items.map((item) => (
                            <div
                              className="flex items-center justify-between gap-3 rounded-[0.75rem] bg-white px-3 py-2"
                              key={item.participationId}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-semibold tracking-[-0.04em]">
                                  {item.option.label}
                                </p>
                              </div>
                              <span className="shrink-0 text-[13px] font-semibold tracking-[-0.04em]">
                                {formatPrice(item.bidAmount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="relative rounded-[0.95rem] border border-black/10 px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-black/40">입금 계좌</p>
                            <p className="mt-1 truncate text-[15px] font-semibold tracking-[-0.04em]">
                              {checkoutPaymentSummary.hostBankAccount
                                ? `${checkoutPaymentSummary.hostBankAccount.bank} ${checkoutPaymentSummary.hostBankAccount.account}`.trim()
                                : "계좌 정보 확인 중"}
                            </p>
                            <p className="mt-1 text-[12px] font-medium text-black/40">
                              {checkoutPaymentSummary.hostBankAccount?.holder
                                ? `예금주 ${checkoutPaymentSummary.hostBankAccount.holder}`
                                : "참여 내역에서 다시 확인해 주세요."}
                            </p>
                          </div>
                          <button
                            className="h-9 shrink-0 rounded-full bg-[#DDE7B8] px-3 text-[12px] font-semibold text-black shadow-[0_8px_20px_rgba(120,132,82,0.18)] disabled:bg-black/10 disabled:text-black/30"
                            disabled={!checkoutPaymentSummary.hostBankAccount}
                            onClick={() =>
                              checkoutPaymentSummary.hostBankAccount
                                ? void copyCheckoutText(
                                    checkoutPaymentSummary.hostBankAccount.account,
                                    "계좌번호",
                                  )
                                : undefined
                            }
                            type="button"
                          >
                            계좌 복사
                          </button>
                        </div>
                        {checkoutRefundAccount?.holder ? (
                          <>
                            <p className="mt-3 text-[12px] font-medium leading-5 text-black/45">
                              입금자명{" "}
                              <span className="rounded-full bg-[#E4F6A5] px-2 py-0.5 font-semibold text-black/70">
                                {checkoutRefundAccount.holder}
                              </span>
                            </p>
                            <p className="mt-1.5 text-[12px] font-medium leading-5 text-black/45">
                              {isC2CProduct
                                ? "이 이름으로 보내야 개최자가 입금을 확인할 수 있어요."
                                : "이 이름으로 보내야 자동으로 확인돼요. 다른 이름으로 보내면 확인이 늦어질 수 있어요."}
                            </p>
                          </>
                        ) : null}
                        <p className="mt-3 text-[12px] font-medium leading-5 text-black/45">
                          {isC2CProduct
                            ? "송금 후 참여 내역에서 '보냈어요'를 꼭 눌러주세요. 개최자가 입금을 확인하면 참여가 확정돼요."
                            : "송금 후 관리자가 입금을 확인하면 참여가 확정돼요. 진행 상황은 참여 내역에서 확인할 수 있어요."}
                        </p>
                        {/* 중개자 고지(전상법 §20①)는 계약 체결 화면인 confirm 스텝과
                            분철 상세 본문에 남아 있다. 결제 정보 단계에서는 같은 문구가
                            반복돼 안내가 묻힌다는 지적으로 제거했다(docs/56 H-06). */}
                        {checkoutCopyToast ? (
                          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
                            <p className="soft-panel-enter rounded-full bg-[#DDE7B8] px-4 py-3 text-center text-[12px] font-semibold tracking-[-0.04em] text-black shadow-[0_12px_28px_rgba(120,132,82,0.2)]">
                              {checkoutCopyToast}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-[0.95rem] bg-black px-4 py-4 text-white ring-1 ring-[#AAB67C]/35">
                        <div className="flex items-center justify-between text-[13px] font-semibold text-white/60">
                          <span>상품 금액</span>
                          <span>{formatPrice(checkoutPaymentSummary.productAmount)}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[13px] font-semibold text-white/60">
                          <span>배송비</span>
                          <span>{formatPrice(checkoutPaymentSummary.shippingAmount)}</span>
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-4">
                          <span className="text-[14px] font-semibold text-white/70">총 입금액</span>
                          <span className="text-[23px] font-semibold tracking-[-0.05em] text-[#DDE7B8]">
                            {formatPrice(checkoutPaymentSummary.totalAmount)}
                          </span>
                        </div>
                        {isShippingFeePaybackProduct ? (
                          <p className="mt-3 border-t border-white/15 pt-3 text-[12px] font-semibold leading-5 text-[#DDE7B8]">
                            이 분철은 전액 무료로 진행되는 이벤트 분철이에요.
                            <br />
                            배송비{" "}
                            {formatPrice(checkoutPaymentSummary.shippingAmount)}은
                            보증금 개념으로 받고 있어요.
                            <br />
                            택배를 수령한 뒤 이벤트 후기를 남겨주시면 등록한 환불
                            계좌로 그대로 돌려드려요.
                          </p>
                        ) : null}
                      </div>

                    </div>

                    <div className="mt-4 grid grid-cols-[0.52fr_0.48fr] gap-2">
                      <button
                        className="h-14 rounded-full bg-[#CFE86B] text-[16px] font-semibold tracking-[-0.04em] text-black shadow-[0_12px_28px_rgba(120,132,82,0.24)]"
                        onClick={closeSheet}
                        type="button"
                      >
                        확인했어요
                      </button>
                      <button
                        className="h-14 rounded-full bg-[#f3f3f3] text-[15px] font-semibold tracking-[-0.04em] text-black/60"
                        onClick={openBidHistory}
                        type="button"
                      >
                        참여 내역 보기
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-5 rounded-[0.95rem] bg-[#f7f7f7] px-4 py-5 text-[14px] font-semibold text-black/45">
                    입금 정보를 불러오고 있어요.
                  </div>
                )
              ) : null}

              {checkoutStep === "applied" && checkoutPaymentSummary ? (
                <>
                  <div className="mt-5 max-h-[48dvh] space-y-3 overflow-y-auto pr-1 [touch-action:pan-y]">
                    <div className="rounded-[0.95rem] bg-black px-4 py-4 text-white ring-1 ring-[#AAB67C]/35">
                      <p className="text-[12px] font-semibold text-[#DDE7B8]">
                        신청 완료
                      </p>
                      <p className="mt-1 text-[20px] font-semibold tracking-[-0.05em] text-white">
                        신청이 접수됐어요!
                      </p>
                      <p className="mt-3 text-[12px] font-medium leading-5 text-white/60">
                        지금은 입금하지 않아도 돼요. 개최자가 성사를 확정하면
                        알림톡으로 입금 계좌와 기한을 안내드려요.
                      </p>
                    </div>

                    <div className="rounded-[0.95rem] bg-[#f7f7f7] px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[12px] font-semibold text-black/40">
                          신청한 멤버
                        </p>
                        <span className="text-[12px] font-semibold text-black/35">
                          {checkoutPaymentSummary.items.length}개
                        </span>
                      </div>
                      <div className="mt-2 space-y-2">
                        {checkoutPaymentSummary.items.map((item) => (
                          <div
                            className="flex items-center justify-between gap-3 rounded-[0.75rem] bg-white px-3 py-2"
                            key={item.participationId}
                          >
                            <p className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.04em]">
                              {item.option.label}
                            </p>
                            <span className="shrink-0 text-[13px] font-semibold tracking-[-0.04em]">
                              {formatPrice(item.bidAmount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[0.95rem] bg-[#f7f7f7] px-4 py-4">
                      <div className="flex items-center justify-between text-[13px] font-semibold text-black/55">
                        <span>성사 시 입금할 금액</span>
                        <span className="text-[16px] tracking-[-0.04em] text-black">
                          {formatPrice(checkoutPaymentSummary.totalAmount)}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] font-medium leading-5 text-black/40">
                        배송비 포함 예상 금액이에요. 정확한 금액은 성사 확정
                        알림에서 다시 안내드려요.
                      </p>
                    </div>

                    <p className="px-1 text-[12px] font-medium leading-5 text-black/45">
                      개최자 확정 전에는 참여 내역에서 언제든 무료로 취소할 수
                      있어요.
                    </p>
                    {/* 중개자 고지는 신청 직전 화면(confirm 스텝)에서 이미 노출된다.
                        신청 완료 안내에서 다시 반복하지 않는다(docs/56 H-06). */}
                  </div>

                  <div className="mt-4 grid grid-cols-[0.52fr_0.48fr] gap-2">
                    <button
                      className="h-14 rounded-full bg-[#CFE86B] text-[16px] font-semibold tracking-[-0.04em] text-black shadow-[0_12px_28px_rgba(120,132,82,0.24)]"
                      onClick={closeSheet}
                      type="button"
                    >
                      확인했어요
                    </button>
                    <button
                      className="h-14 rounded-full bg-[#f3f3f3] text-[15px] font-semibold tracking-[-0.04em] text-black/60"
                      onClick={openBidHistory}
                      type="button"
                    >
                      참여 내역 보기
                    </button>
                  </div>
                </>
              ) : null}
            </section>
          </div>
        ) : null}

        {isCheckoutAddressSheetOpen ? (
          <div
            className={`bid-sheet-backdrop fixed inset-0 z-50 flex items-end ${
              isCheckoutAddressSheetEntered && !isCheckoutAddressSheetClosing
                ? "bid-sheet-backdrop-active"
                : ""
            }`}
          >
            <button
              aria-label="배송지 선택 닫기"
              className="absolute inset-0 cursor-default"
              onClick={closeCheckoutAddressSheet}
              type="button"
            />
            <section
              className={`bid-sheet-panel relative mx-auto flex max-h-[72dvh] w-full max-w-[430px] flex-col rounded-t-[1.4rem] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
                isCheckoutAddressSheetEntered && !isCheckoutAddressSheetClosing
                  ? "bid-sheet-panel-active"
                  : ""
              }`}
              onTransitionEnd={(event) => {
                if (
                  isCheckoutAddressSheetClosing &&
                  event.currentTarget === event.target &&
                  event.propertyName === "transform"
                ) {
                  finishCloseCheckoutAddressSheet();
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
                    이번 결제에 사용할 배송지를 골라 주세요.
                  </p>
                </div>
                <button
                  aria-label="닫기"
                  className="motion-icon-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
                  onClick={closeCheckoutAddressSheet}
                  type="button"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="mt-4 max-h-[42dvh] space-y-2 overflow-y-auto pr-1">
                {checkoutEligibleDeliveryAddresses.map((address) => {
                  const displayAlias = getDeliveryAddressDisplayAlias(address);
                  const displayBranchName =
                    getDeliveryAddressDisplayBranchName(address);
                  const isDefault =
                    address.id ===
                    deliveryAddressState.defaultAddressIds[address.storeType];
                  const isSelected =
                    address.id ===
                    (checkoutDeliveryAddress?.id ?? bidDeliveryAddress?.id);

                  return (
                    <button
                      className={`w-full rounded-[0.95rem] border-[1.5px] px-4 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "border-[#C8D4A5] bg-[#F3F5EA]"
                          : "border-[#ededed] bg-white"
                      }`}
                      key={address.id}
                      onClick={() => {
                        setCheckoutDeliveryAddress(address);
                        rememberCheckoutAddressReturnState(true, address.id);
                      }}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1 pr-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                isSelected || isDefault
                                  ? "bg-[#DDE7B8] text-black"
                                  : "bg-[#f3f3f3] text-black/45"
                              }`}
                            >
                              {getConvenienceStoreLabel(address.storeType)}
                            </span>
                            {displayAlias ? (
                              <span className="rounded-full bg-black/10 px-2.5 py-1 text-[11px] font-semibold text-black/60">
                                {displayAlias}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 truncate text-[14px] font-semibold tracking-[-0.04em]">
                            {displayBranchName}
                          </p>
                        </div>
                        <span
                          className={`inline-flex h-8 w-[4.25rem] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                            isSelected
                              ? "bg-[#DDE7B8] text-black"
                              : "bg-[#f3f3f3] text-black/45"
                          }`}
                        >
                          {isSelected ? "선택됨" : "선택"}
                        </span>
                      </div>
                    </button>
                  );
                })}

                <button
                  className="flex h-14 w-full items-center justify-center rounded-[0.95rem] border border-dashed border-black/15 bg-[#f7f7f7] text-[14px] font-semibold text-black/45"
                  disabled={isCheckoutAddressCreatePending}
                  onClick={() =>
                    isAddressLimitReached
                      ? router.push("/profile/addresses")
                      : setIsCvsStoreSearchOpen(true)
                  }
                  type="button"
                >
                  {isCheckoutAddressCreatePending
                    ? "배송지 등록 중"
                    : isAddressLimitReached
                      ? `배송지가 가득 찼어요 (최대 ${maxDeliveryAddressCount}개) · 관리로 이동`
                      : "+ 새 배송지 추가"}
                </button>
              </div>

              <button
                className="mt-3 h-12 w-full rounded-full bg-[#CFE86B] text-[15px] font-semibold text-black shadow-[0_10px_24px_rgba(120,132,82,0.2)]"
                onClick={confirmCheckoutAddressSelection}
                type="button"
              >
                여기서 받을게요!
              </button>
            </section>
          </div>
        ) : null}

        {isRefundAccountSheetOpen ? (
          <div
            className={`bid-sheet-backdrop fixed inset-0 z-50 flex items-end ${
              isRefundAccountSheetEntered ? "bid-sheet-backdrop-active" : ""
            }`}
          >
            <button
              aria-label="계좌 등록 닫기"
              className="absolute inset-0 cursor-default"
              onClick={() => {
                // 저장 요청이 나간 뒤 닫히면 성공 여부를 알 수 없다 — 저장 중엔 닫지 않는다.
                if (!isRefundAccountSaving) {
                  setIsRefundAccountSheetOpen(false);
                }
              }}
              type="button"
            />
            <section
              className={`bid-sheet-panel relative mx-auto max-h-[calc(100dvh-2.5rem)] w-full max-w-[430px] overflow-y-auto rounded-t-[1.4rem] bg-white px-5 pb-6 pt-4 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
                isRefundAccountSheetEntered ? "bid-sheet-panel-active" : ""
              }`}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
              <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                환불계좌 등록
              </h2>
              <p className="mt-1 text-[13px] font-medium leading-5 text-black/45">
                입금자명 확인과 환불에 쓰는 계좌예요. 등록하면 주문을 바로 이어갈
                수 있어요.
              </p>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-[12px] font-semibold text-black/45">
                    은행
                  </span>
                  <input
                    className="mt-1.5 h-12 w-full rounded-[0.9rem] border border-black/10 px-4 text-[15px] tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;

                      setRefundAccountForm((current) => ({
                        ...current,
                        bank: nextValue,
                      }));
                    }}
                    maxLength={bankAccountFieldMaxLength}
                    placeholder="국민은행"
                    value={refundAccountForm.bank}
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold text-black/45">
                    계좌번호
                  </span>
                  <input
                    className="mt-1.5 h-12 w-full rounded-[0.9rem] border border-black/10 px-4 text-[15px] tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                    inputMode="tel"
                    onChange={(event) => {
                      const nextValue = sanitizeAccountNumber(
                        event.currentTarget.value,
                      );

                      setRefundAccountForm((current) => ({
                        ...current,
                        account: nextValue,
                      }));
                    }}
                    maxLength={bankAccountFieldMaxLength}
                    placeholder="숫자 또는 하이픈 입력"
                    value={refundAccountForm.account}
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold text-black/45">
                    예금주
                  </span>
                  <input
                    className="mt-1.5 h-12 w-full rounded-[0.9rem] border border-black/10 px-4 text-[15px] tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;

                      setRefundAccountForm((current) => ({
                        ...current,
                        holder: nextValue,
                      }));
                    }}
                    maxLength={bankAccountFieldMaxLength}
                    placeholder="김분철"
                    value={refundAccountForm.holder}
                  />
                </label>
              </div>

              {refundAccountError ? (
                <p className="error-shake mt-3 rounded-[0.85rem] bg-[#fff2f2] px-4 py-3 text-[12px] font-semibold leading-5 text-[#c03131]">
                  {refundAccountError}
                </p>
              ) : null}

              <button
                className="mt-4 h-[52px] w-full rounded-full bg-black text-[15px] font-semibold tracking-[-0.04em] text-[#D7FF5F] disabled:bg-black/15 disabled:text-black/35"
                disabled={isRefundAccountSaving}
                onClick={() => void saveCheckoutRefundAccount()}
                type="button"
              >
                {isRefundAccountSaving ? "저장 중" : "계좌 등록하고 이어가기"}
              </button>
            </section>
          </div>
        ) : null}

        {isCvsStoreSearchOpen ? (
          // 시트 내부 z-40 이 배송지 선택 시트(z-50)에 가리지 않도록 z-[60] 스태킹
          // 컨텍스트로 감싼다 — DOM 순서가 아닌 명시적 레이어로 위에 띄운다.
          // ⚠️ 이 래퍼가 새 스태킹 컨텍스트라, 이 시트 위에 무언가를 띄우려면
          // z-index 를 래퍼 기준으로 계산해야 한다.
          <div className="relative z-[60]">
            <CvsStoreSearchSheet
              allowedBrands={checkoutAllowedCvsBrands}
              onClose={() => setIsCvsStoreSearchOpen(false)}
              onSelect={(store) => void handleCheckoutStoreSelected(store)}
            />
          </div>
        ) : null}

        {productToast ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-6">
            <p
              aria-live="polite"
              className="soft-panel-enter rounded-full bg-black/92 px-4 py-3 text-center text-[12px] font-semibold tracking-[-0.04em] text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
              role="status"
            >
              {productToast}
            </p>
          </div>
        ) : null}

        {isImageViewerOpen && productImages.length > 0 ? (
          <div className="fixed inset-0 z-[60] flex flex-col bg-black">
            <div className="flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
              {productImages.length > 1 ? (
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold text-white">
                  {visibleProductImageIndex + 1}/{productImages.length}
                </span>
              ) : (
                <span />
              )}
              <button
                aria-label="이미지 크게 보기 닫기"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
                onClick={() => setIsImageViewerOpen(false)}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>
            <div
              className="min-h-0 flex-1 touch-none select-none overflow-hidden"
              onClick={() => {
                if (consumeProductImageTap()) {
                  setIsImageViewerOpen(false);
                }
              }}
              onPointerCancel={cancelProductImageSwipe}
              onPointerDown={startProductImageSwipe}
              onPointerMove={moveProductImageSwipe}
              onPointerUp={finishProductImageSwipe}
            >
              <div
                className={`flex h-full ${
                  isProductImageDragging
                    ? ""
                    : "transition-transform duration-300 ease-out"
                }`}
                style={{
                  transform: `translateX(${productImageTrackOffset})`,
                }}
              >
                {productImages.map((imageUrl, imageIndex) => (
                  <div
                    className="flex h-full w-full shrink-0 items-center justify-center"
                    key={imageUrl}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={`${product.title} 이미지 ${imageIndex + 1}`}
                      className="max-h-full w-full object-contain"
                      draggable={false}
                      src={imageUrl}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]" />
          </div>
        ) : null}
      </div>
    </>
  );

  if (!renderShell) {
    return panelAndSheets;
  }

  return (
    <main className={productDetailShellClassName}>
      <ProductReturnUnderlay
        isEntered={isEntered}
        isExiting={isExiting}
        returnQuery={returnQuery}
        returnSource={initialReturnSource}
      />
      {panelAndSheets}
    </main>
  );
}
