"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { ProfileIcon } from "@/components/icons";
import {
  addressReturnStateKey,
  lastAddedDeliveryAddressIdKey,
} from "@/lib/address-return-state";
import { createLoginHref } from "@/lib/auth-navigation";
import {
  authProfileSetupReturnHrefStorageKey,
  clearAuthCookies,
  clearAuthState,
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import { getFreshAccessToken } from "@/lib/auth-session";
import {
  isUserProfileComplete,
  requestBookmarkedBuncheols,
  requestBuncheolDetail,
  requestLogout,
  requestMyHostedBuncheols,
  requestMyParticipations,
  requestParticipationPaymentDetail,
  requestShippingAddresses,
  requestUserProfile,
  updateBankAccount,
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
  readDeliveryAddressState,
  subscribeDeliveryAddressState,
  writeDeliveryAddressState,
} from "@/lib/delivery-address-store";
import {
  convenienceStoreTypeLabels,
  getDeliveryAddressDisplayBranchName,
  getDefaultDeliveryAddressesByType,
  type DeliveryAddress,
} from "@/lib/mock-delivery-addresses";
import type { ProductDetailItem } from "@/lib/mock-products";
import {
  readCachedParticipationPayment,
} from "@/lib/participation-payment-cache";
import { getCachedProductImageUrl } from "@/lib/product-card-image";
import { isTransferPaymentRequestedStatus } from "@/lib/transfer-payment";

const kstOffsetHours = 9;
const paymentDeadlineMinutes = 30;
const settlementAccountPanelExitMs = 180;
const profileStateCacheKey = "buncheol-profile-state-cache";
const profileStateCacheMaxAgeMs = 10 * 60 * 1000;

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

type ProfileStateCache = {
  apiBidEntries?: ProfileBidEntry[];
  apiHostedProducts?: ProductDetailItem[];
  authFingerprint?: string | null;
  bookmarkedProductCount?: number;
  cachedAt: number;
  userProfile?: UserProfile | null;
};

function getAuthCacheFingerprint() {
  const accessToken = readAuthState().accessToken;

  return accessToken ? accessToken.slice(-16) : null;
}

function isProfileStateCache(value: unknown): value is ProfileStateCache {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<ProfileStateCache>;

  return (
    typeof record.cachedAt === "number" &&
    (record.apiBidEntries === undefined ||
      Array.isArray(record.apiBidEntries)) &&
    (record.apiHostedProducts === undefined ||
      Array.isArray(record.apiHostedProducts)) &&
    (record.authFingerprint === undefined ||
      record.authFingerprint === null ||
      typeof record.authFingerprint === "string") &&
    (record.bookmarkedProductCount === undefined ||
      typeof record.bookmarkedProductCount === "number") &&
    (record.userProfile === undefined ||
      record.userProfile === null ||
      typeof record.userProfile === "object")
  );
}

function readProfileStateCache({
  ignoreMaxAge = false,
}: {
  ignoreMaxAge?: boolean;
} = {}) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(profileStateCacheKey);

    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (!isProfileStateCache(parsedValue)) {
      window.sessionStorage.removeItem(profileStateCacheKey);
      return null;
    }

    if (parsedValue.authFingerprint !== getAuthCacheFingerprint()) {
      window.sessionStorage.removeItem(profileStateCacheKey);
      return null;
    }

    if (
      !ignoreMaxAge &&
      Date.now() - parsedValue.cachedAt > profileStateCacheMaxAgeMs
    ) {
      window.sessionStorage.removeItem(profileStateCacheKey);
      return null;
    }

    return parsedValue;
  } catch {
    window.sessionStorage.removeItem(profileStateCacheKey);
    return null;
  }
}

function writeProfileStateCache(
  patch: Partial<Omit<ProfileStateCache, "cachedAt">>,
) {
  if (typeof window === "undefined") {
    return;
  }

  const currentCache = readProfileStateCache({ ignoreMaxAge: true }) ?? {};
  const nextCache: ProfileStateCache = {
    ...currentCache,
    ...patch,
    authFingerprint: getAuthCacheFingerprint(),
    cachedAt: Date.now(),
  };

  window.sessionStorage.setItem(
    profileStateCacheKey,
    JSON.stringify(nextCache),
  );
}

function clearProfileStateCache() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(profileStateCacheKey);
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
    !isProfileBidCancelled(bid) &&
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

function isCancelledBuncheolStatus(status: string | undefined) {
  return status === "CANCELLED" || status === "CANCELED";
}

function isProfileBidCancelled(bid: ProfileBidEntry) {
  return (
    isCancelledParticipationStatus(bid.participationStatus) ||
    isCancelledBuncheolStatus(bid.buncheolStatus)
  );
}

function isProfileBidPaymentExpired(bid: ProfileBidEntry, now: Date) {
  const isPaymentCandidate =
    isPaymentWaitingParticipationStatus(bid.participationStatus) ||
    (isProfileBidClosed(bid, now) && bid.rank === 1);

  if (
    isProfileBidCancelled(bid) ||
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

function shouldKeepProfileDeliveryReachable(bid: ProfileBidEntry) {
  return Boolean(bid.deliveryId && isProfileBidPaymentConfirmed(bid));
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

export function ProfileContent({
  skipEnterAnimation = false,
}: ProfileContentProps) {
  const router = useRouter();
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
  const [initialProfileStateCache] = useState(() => readProfileStateCache());
  const addressSyncRequestIdRef = useRef(0);
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
  const [isDefaultAddressLoading, setIsDefaultAddressLoading] = useState(false);
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(
    () => initialProfileStateCache?.userProfile ?? null,
  );
  const [isUserProfileLoading, setIsUserProfileLoading] = useState(false);
  const [userProfileMessage, setUserProfileMessage] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [apiBidEntries, setApiBidEntries] = useState<ProfileBidEntry[] | null>(
    () => initialProfileStateCache?.apiBidEntries ?? null,
  );
  const [apiHostedProducts, setApiHostedProducts] = useState<
    ProductDetailItem[] | null
  >(() => initialProfileStateCache?.apiHostedProducts ?? null);
  const [bookmarkedProductCount, setBookmarkedProductCount] = useState<
    number | null
  >(() => initialProfileStateCache?.bookmarkedProductCount ?? null);

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

        if (isProfileBidCancelled(bid)) {
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

      if (hasProfileSettlementAccount || userProfile) {
        return profileSettlementAccount;
      }

      return isUserProfileLoading
        ? getEmptySettlementAccountState()
        : storedSettlementAccount;
    },
    [
      authState.isLoggedIn,
      isUserProfileLoading,
      storedSettlementAccount,
      userProfile,
    ],
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

  const defaultDeliveryAddresses = getDefaultDeliveryAddressesByType(
    deliveryAddresses,
    defaultAddressIds,
  );
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

      if (settlementAccountPanelCloseTimerRef.current !== null) {
        window.clearTimeout(settlementAccountPanelCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!authState.isLoggedIn) {
      clearProfileStateCache();
      return;
    }

    const cachePatch: Partial<Omit<ProfileStateCache, "cachedAt">> = {};

    if (apiBidEntries !== null) {
      cachePatch.apiBidEntries = apiBidEntries;
    }

    if (apiHostedProducts !== null) {
      cachePatch.apiHostedProducts = apiHostedProducts;
    }

    if (bookmarkedProductCount !== null) {
      cachePatch.bookmarkedProductCount = bookmarkedProductCount;
    }

    if (userProfile !== null) {
      cachePatch.userProfile = userProfile;
    }

    if (Object.keys(cachePatch).length > 0) {
      writeProfileStateCache(cachePatch);
    }
  }, [
    apiBidEntries,
    apiHostedProducts,
    authState.isLoggedIn,
    bookmarkedProductCount,
    userProfile,
  ]);

  useEffect(() => {
    if (!authState.isLoggedIn || !authState.accessToken) {
      clearProfileStateCache();
      setApiBidEntries([]);
      setApiHostedProducts([]);
      setBookmarkedProductCount(0);
      return;
    }

    let isActive = true;


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
        setApiBidEntries((current) => current ?? []);
      }

      if (buncheols.status === "fulfilled") {
        setApiHostedProducts(buncheols.value.map(getHostedProductFromBuncheol));
      } else {
        setApiHostedProducts((current) => current ?? []);
      }

      if (bookmarks.status === "fulfilled") {
        setBookmarkedProductCount(bookmarks.value.length);
      } else {
        setBookmarkedProductCount((current) => current ?? 0);
      }
    }

    loadApiProfileLists().catch(() => {
      if (isActive) {
        setApiBidEntries((current) => current ?? []);
        setApiHostedProducts((current) => current ?? []);
        setBookmarkedProductCount((current) => current ?? 0);
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

        if (!isUserProfileComplete(profile)) {
          clearProfileStateCache();
          setUserProfile(null);
          window.sessionStorage.setItem(
            authProfileSetupReturnHrefStorageKey,
            "/profile",
          );
          router.replace("/signup/profile");
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
        } else {
          clearSettlementAccountState();
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
  }, [authState.accessToken, authState.isLoggedIn, router]);

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
        accessToken ? syncDeliveryAddresses(accessToken) : null,
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

  function rememberScrollPosition() {
    if (!scrollContainerRef.current) {
      return;
    }

    window.sessionStorage.setItem(
      "profile-scroll-top",
      String(scrollContainerRef.current.scrollTop),
    );
  }

  function rememberProfileReturnState() {
    rememberScrollPosition();
    window.sessionStorage.setItem(PROFILE_SKIP_ENTER_KEY, "true");
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
        account: nextSettlementAccount.accountNumber,
        bank: nextSettlementAccount.bankName,
        holder: nextSettlementAccount.accountHolder,
      });
      setUserProfile((current) => ({
        email: current?.email ?? "",
        nickname: current?.nickname ?? "",
        phoneNumber: current?.phoneNumber ?? "",
        provider: current?.provider ?? "",
        bankAccount: {
          account: nextSettlementAccount.accountNumber,
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

    rememberProfileReturnState();
  }

  function clearUserSessionState() {
    invalidateAddressSyncRequests();
    clearAuthCookies();
    clearAuthState();
    clearDeliveryAddressState();
    clearHostedProducts();
    clearSettlementAccountState();
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
        <div className="flex min-h-full flex-col">
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
              href={createLoginHref({
                cancelTo: "/profile",
                returnTo: "/profile",
              })}
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
                계좌
              </h2>
              <p className="mt-1 text-[13px] font-medium text-black/45">
                환불받을 때 사용할 계좌를 확인해요.
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
                    inputMode="tel"
                    maxLength={50}
                    onChange={(event) =>
                      updateSettlementAccountForm(
                        "accountNumber",
                        event.currentTarget.value,
                      )
                    }
                    placeholder="숫자 또는 하이픈 입력"
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
                  환불받을 계좌를 등록해 주세요.
                </span>
                <span className="mt-1 block text-[13px] font-medium text-black/40">
                  등록해 두면 환불이 필요할 때 바로 받을 수 있어요.
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
                  : createLoginHref({
                      cancelTo: "/profile",
                      returnTo: "/profile/addresses",
                    })
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
                          address
                            ? getDeliveryAddressDisplayBranchName(address)
                            : "등록된 배송지가 없어요"
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
        <div className="relative -mx-4 -mb-6 mt-auto bg-[#f7f7f7] pt-6">
          <BusinessFooter variant="compact" />
        </div>
        </div>
      </main>

    </div>
  );
}
