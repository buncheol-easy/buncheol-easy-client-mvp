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
import { CheckIcon, CloseIcon, ProfileIcon } from "@/components/icons";
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
import {
  cancelBuncheolParticipation,
  deleteBuncheol,
  deleteShippingAddress,
  deleteUserProfile,
  requestNicknameDuplicate,
  requestLogout,
  requestMyHostedBuncheols,
  requestMyParticipations,
  requestShippingAddresses,
  requestUserProfile,
  updateBankAccount,
  updateShippingAddress,
  updateUserProfile,
  type MyHostedBuncheol,
  type MyParticipation,
  type UserProfile,
} from "@/lib/auth-api";
import {
  clearHostedProducts,
  getInitialHostedProducts,
  readHostedProducts,
  subscribeHostedProducts,
} from "@/lib/hosted-products-store";
import {
  clearSettlementAccountState,
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
  getDefaultDeliveryAddressesByType,
  getPrioritizedDeliveryAddresses,
  type DeliveryAddress,
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

function sanitizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function getEmptyUserProfileFormState() {
  return {
    nickname: "",
    phoneNumber: "",
  };
}

function getUserProfileFormState(profile: UserProfile | null) {
  return {
    nickname: profile?.nickname ?? "",
    phoneNumber: profile?.phoneNumber ?? "",
  };
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

function formatRemainingTime(deadline: string, now: Date) {
  return formatRemainingTimeFromDate(parseDeadline(deadline), now);
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

const mockBidAmounts = [5400, 6000, 4800, 5800];
const mockClosedDeadlines = [
  "2026.04.26 23",
  "2026.05.05 21",
  "2026.04.25 21",
  "2026.04.26 20",
];
const shippingFee = 3200;

const mockBidEntries = productDetails.slice(0, 4).map((product, index) => {
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
    productId: product.id,
    rank,
    submittedAt: ["오늘 20:12", "오늘 18:40", "어제 23:08", "어제 19:22"][
      index
    ],
    title: product.title,
    tone: product.tone,
  };
});

type ProfileBidEntry = (typeof mockBidEntries)[number] & {
  buncheolStatus?: string;
  participationStatus?: string;
};

function isRecruitingStatus(status: string | undefined) {
  return !status || status === "RECRUITING";
}

function isDeletedProductStatus(status: string | undefined) {
  return status === "CANCELLED" || status === "DELETED";
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

type ProfileContentProps = {
  skipEnterAnimation?: boolean;
};

type AddressSheetMode = "manage" | "select";
type UserProfileFormState = ReturnType<typeof getEmptyUserProfileFormState>;

export function ProfileContent({
  skipEnterAnimation = false,
}: ProfileContentProps) {
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const [shouldSkipEnterAnimation] = useState(() => {
    if (skipEnterAnimation || typeof window === "undefined") {
      return skipEnterAnimation;
    }

    const shouldSkip =
      window.sessionStorage.getItem("skip-profile-enter-animation") === "true";
    window.sessionStorage.removeItem("skip-profile-enter-animation");

    return shouldSkip;
  });
  const [withdrawnBidIds, setWithdrawnBidIds] = useState<string[]>([]);
  const [withdrawingBidId, setWithdrawingBidId] = useState<string | null>(null);
  const [selectedPaymentBidId, setSelectedPaymentBidId] = useState<
    string | null
  >(null);
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);
  const [isPaymentSheetEntered, setIsPaymentSheetEntered] = useState(false);
  const [isPaymentSheetClosing, setIsPaymentSheetClosing] = useState(false);
  const addressSyncRequestIdRef = useRef(0);
  const paymentSheetCloseTimerRef = useRef<number | null>(null);
  const [selectedPaymentAddressId, setSelectedPaymentAddressId] = useState<
    string | null
  >(null);
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
  const hostedProducts = useSyncExternalStore(
    subscribeHostedProducts,
    readHostedProducts,
    getInitialHostedProducts,
  );
  const { addresses: deliveryAddresses, defaultAddressIds } = storedAddressState;
  const [addressSheetMode, setAddressSheetMode] =
    useState<AddressSheetMode>("manage");
  const [isAddressSheetOpen, setIsAddressSheetOpen] = useState(false);
  const [isAddressSheetEntered, setIsAddressSheetEntered] = useState(false);
  const [isAddressSheetClosing, setIsAddressSheetClosing] = useState(false);
  const addressSheetCloseTimerRef = useRef<number | null>(null);
  const [manageAddressSnapshot, setManageAddressSnapshot] = useState<
    DeliveryAddress[]
  >([]);
  const [isEditingSettlementAccount, setIsEditingSettlementAccount] =
    useState(false);
  const [settlementAccountForm, setSettlementAccountForm] =
    useState<SettlementAccountState>(() => getEmptySettlementAccountState());
  const [isSettlementAccountFormDirty, setIsSettlementAccountFormDirty] =
    useState(false);
  const [settlementAccountMessage, setSettlementAccountMessage] = useState("");
  const [isSavingSettlementAccount, setIsSavingSettlementAccount] =
    useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isUserProfileLoading, setIsUserProfileLoading] = useState(false);
  const [userProfileMessage, setUserProfileMessage] = useState("");
  const [isEditingUserProfile, setIsEditingUserProfile] = useState(false);
  const [userProfileForm, setUserProfileForm] =
    useState<UserProfileFormState>(() => getEmptyUserProfileFormState());
  const [isSavingUserProfile, setIsSavingUserProfile] = useState(false);
  const [isDeletingUserProfile, setIsDeletingUserProfile] = useState(false);
  const [deleteUserProfileMessage, setDeleteUserProfileMessage] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [apiBidEntries, setApiBidEntries] = useState<ProfileBidEntry[] | null>(
    null,
  );
  const [apiHostedProducts, setApiHostedProducts] = useState<
    ProductDetailItem[] | null
  >(null);
  const [hostedProductMessage, setHostedProductMessage] = useState("");
  const [deletingHostedProductId, setDeletingHostedProductId] = useState<
    string | null
  >(null);

  const allBids = useMemo(
    () => {
      const sourceEntries: ProfileBidEntry[] = apiBidEntries ?? mockBidEntries;

      return authState.isLoggedIn
        ? sourceEntries.filter((bid) => !withdrawnBidIds.includes(bid.id))
        : [];
    },
    [apiBidEntries, authState.isLoggedIn, withdrawnBidIds],
  );
  const activeBids = useMemo(
    () =>
      allBids.filter((bid) => {
        const isClosed = isProfileBidClosed(bid, now);

        return !isClosed || bid.rank === 1;
      }),
    [allBids, now],
  );
  const activeHostedProducts = useMemo(
    () =>
      authState.isLoggedIn
        ? (apiHostedProducts ?? hostedProducts).filter((product) =>
            !isDeletedProductStatus(product.status) &&
            isProfileHostedProductActive(product, now),
          )
        : [],
    [apiHostedProducts, authState.isLoggedIn, hostedProducts, now],
  );
  const settlementAccount = useMemo(
    () =>
      authState.isLoggedIn
        ? getSettlementAccountState(userProfile)
        : getEmptySettlementAccountState(),
    [authState.isLoggedIn, userProfile],
  );
  const hasSettlementAccount =
    settlementAccount.bankName.trim().length > 0 &&
    settlementAccount.accountNumber.trim().length > 0 &&
    settlementAccount.accountHolder.trim().length > 0;
  const canSaveUserProfile =
    /^[가-힣A-Za-z0-9]{1,20}$/.test(userProfileForm.nickname.trim()) &&
    /^01\d{8,9}$/.test(userProfileForm.phoneNumber.trim());
  const canSaveSettlementAccount =
    settlementAccountForm.bankName.trim().length > 0 &&
    settlementAccountForm.bankName.trim().length <= 50 &&
    settlementAccountForm.accountNumber.trim().length > 0 &&
    settlementAccountForm.accountNumber.replace(/\D/g, "").length <= 50 &&
    settlementAccountForm.accountHolder.trim().length > 0 &&
    settlementAccountForm.accountHolder.trim().length <= 50 &&
    settlementAccountForm.accountNumber.replace(/\D/g, "").length > 0;

  const highestRankCount = activeBids.filter((bid) => bid.rank === 1).length;
  const selectedPaymentBid =
    activeBids.find((bid) => bid.id === selectedPaymentBidId) ?? null;
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

      if (addressSheetCloseTimerRef.current !== null) {
        window.clearTimeout(addressSheetCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const accessToken = authState.accessToken;

    if (!authState.isLoggedIn || !accessToken) {
      setApiBidEntries([]);
      setApiHostedProducts([]);
      setHostedProductMessage("");
      return;
    }

    let isActive = true;

    requestMyParticipations(accessToken)
      .then((participations) => {
        if (isActive) {
          setApiBidEntries(
            participations.map(getProfileBidEntryFromParticipation),
          );
        }
      })
      .catch(() => {
        if (isActive) {
          setApiBidEntries([]);
        }
      });

    requestMyHostedBuncheols(accessToken)
      .then((buncheols) => {
        if (isActive) {
          setApiHostedProducts(buncheols.map(getHostedProductFromBuncheol));
          setHostedProductMessage("");
        }
      })
      .catch(() => {
        if (isActive) {
          setApiHostedProducts([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, authState.isLoggedIn]);

  useEffect(() => {
    const accessToken = authState.accessToken;

    if (!authState.isLoggedIn || !accessToken) {
      setUserProfile(null);
      setUserProfileForm(getEmptyUserProfileFormState());
      setSettlementAccountForm(getEmptySettlementAccountState());
      setIsSettlementAccountFormDirty(false);
      setIsEditingUserProfile(false);
      setIsEditingSettlementAccount(false);
      setUserProfileMessage("");
      setSettlementAccountMessage("");
      return;
    }

    let isActive = true;

    setIsUserProfileLoading(true);
    setUserProfileMessage("");

    requestUserProfile(accessToken)
      .then((profile) => {
        if (!isActive) {
          return;
        }

        setUserProfile(profile);
        setUserProfileForm(getUserProfileFormState(profile));
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
    const accessToken = authState.accessToken;

    if (!authState.isLoggedIn || !accessToken) {
      invalidateAddressSyncRequests();
      clearDeliveryAddressState();
      return;
    }

    syncDeliveryAddresses(accessToken, { clearBeforeSync: true })
      .then(() => {
        // The sync helper commits only if this is still the newest request.
      })
      .catch(() => {});

    return () => {
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

    const returnBid = returnState.bidId
      ? activeBids.find((bid) => bid.id === returnState.bidId)
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
    const returnEligibleAddresses = getPrioritizedDeliveryAddresses(
      deliveryAddresses,
      defaultAddressIds,
    ).filter((address) => returnAvailableStoreTypes.includes(address.storeType));
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
  }, [activeBids, defaultAddressIds, deliveryAddresses]);

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

  async function withdrawBid(bidId: string) {
    const accessToken = authState.accessToken;

    if (!authState.isLoggedIn || !accessToken || withdrawingBidId) {
      return;
    }

    setWithdrawingBidId(bidId);

    try {
      await cancelBuncheolParticipation(accessToken, bidId);
      setWithdrawnBidIds((current) =>
        current.includes(bidId) ? current : [...current, bidId],
      );
      setApiBidEntries((current) =>
        current ? current.filter((bid) => bid.id !== bidId) : current,
      );
      setUserProfileMessage("");
    } catch (error: unknown) {
      setUserProfileMessage(
        error instanceof Error ? error.message : "입찰을 철회하지 못했어요.",
      );
    } finally {
      setWithdrawingBidId(null);
    }
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
      addressId: selectedPaymentAddressId,
    };

    window.sessionStorage.removeItem(lastAddedDeliveryAddressIdKey);
    window.sessionStorage.setItem(
      addressReturnStateKey,
      JSON.stringify(returnState),
    );
  }

  function startUserProfileEdit() {
    setUserProfileForm(getUserProfileFormState(userProfile));
    setUserProfileMessage("");
    setIsEditingUserProfile(true);
  }

  function cancelUserProfileEdit() {
    setUserProfileForm(getUserProfileFormState(userProfile));
    setUserProfileMessage("");
    setIsEditingUserProfile(false);
  }

  function updateUserProfileForm(
    field: keyof UserProfileFormState,
    value: string,
  ) {
    setUserProfileForm((current) => ({
      ...current,
      [field]: field === "phoneNumber" ? sanitizePhoneNumber(value) : value,
    }));
  }

  async function saveUserProfile() {
    const accessToken = authState.accessToken;

    if (!accessToken || !canSaveUserProfile || isSavingUserProfile) {
      return;
    }

    const nextProfile = {
      nickname: userProfileForm.nickname.trim(),
      phoneNumber: userProfileForm.phoneNumber.trim(),
    };

    setIsSavingUserProfile(true);
    setUserProfileMessage("");

    try {
      if (nextProfile.nickname !== userProfile?.nickname?.trim()) {
        const { isDuplicate } = await requestNicknameDuplicate(
          accessToken,
          nextProfile.nickname,
        );

        if (isDuplicate) {
          setUserProfileMessage("이미 사용 중인 닉네임이에요.");
          return;
        }
      }

      await updateUserProfile(accessToken, nextProfile);
      setUserProfile((current) => ({
        bankAccount: current?.bankAccount ?? null,
        email: current?.email ?? "",
        provider: current?.provider ?? "",
        ...nextProfile,
      }));
      setUserProfileForm(nextProfile);
      setUserProfileMessage("회원 정보가 저장됐어요.");
      setIsEditingUserProfile(false);
    } catch (error) {
      setUserProfileMessage(
        error instanceof Error ? error.message : "회원 정보를 저장하지 못했어요.",
      );
    } finally {
      setIsSavingUserProfile(false);
    }
  }

  function startSettlementAccountEdit() {
    setSettlementAccountForm(settlementAccount);
    setIsSettlementAccountFormDirty(false);
    setSettlementAccountMessage("");
    setIsEditingSettlementAccount(true);
  }

  function cancelSettlementAccountEdit() {
    setSettlementAccountForm(settlementAccount);
    setIsSettlementAccountFormDirty(false);
    setSettlementAccountMessage("");
    setIsEditingSettlementAccount(false);
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
    const accessToken = authState.accessToken;

    if (!accessToken || !canSaveSettlementAccount || isSavingSettlementAccount) {
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
      await updateBankAccount(accessToken, {
        account: nextSettlementAccount.accountNumber.replace(/\D/g, ""),
        bank: nextSettlementAccount.bankName,
        holder: nextSettlementAccount.accountHolder,
      });
      setUserProfile((current) => ({
        email: current?.email ?? "",
        nickname: current?.nickname ?? userProfileForm.nickname.trim(),
        phoneNumber: current?.phoneNumber ?? userProfileForm.phoneNumber.trim(),
        provider: current?.provider ?? "",
        bankAccount: {
          account: nextSettlementAccount.accountNumber.replace(/\D/g, ""),
          bank: nextSettlementAccount.bankName,
          holder: nextSettlementAccount.accountHolder,
        },
      }));

      writeSettlementAccountState(nextSettlementAccount);
      setSettlementAccountForm(nextSettlementAccount);
      setIsSettlementAccountFormDirty(false);
      setSettlementAccountMessage("계좌 정보가 저장됐어요.");
      setIsEditingSettlementAccount(false);
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

    const selectedBid = activeBids.find((bid) => bid.id === bidId) ?? null;
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

  function commitDeliveryAddressState(nextState: StoredDeliveryAddressState) {
    writeDeliveryAddressState(nextState);
  }

  function openAddressSheet(mode: AddressSheetMode = "manage") {
    if (addressSheetCloseTimerRef.current !== null) {
      window.clearTimeout(addressSheetCloseTimerRef.current);
      addressSheetCloseTimerRef.current = null;
    }

    if (mode === "manage") {
      setManageAddressSnapshot(
        getPrioritizedDeliveryAddresses(deliveryAddresses, defaultAddressIds),
      );
    }

    setAddressSheetMode(mode);
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

  function clearUserSessionState() {
    invalidateAddressSyncRequests();
    clearAuthCookies();
    clearAuthState();
    clearDeliveryAddressState();
    clearHostedProducts();
    clearSettlementAccountState();
    setSelectedPaymentBidId(null);
    setSelectedPaymentAddressId(null);
    setWithdrawnBidIds([]);
    setManageAddressSnapshot([]);
    setIsEditingSettlementAccount(false);
    setIsEditingUserProfile(false);
    setUserProfile(null);
    setUserProfileForm(getEmptyUserProfileFormState());
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

  async function handleDeleteUserProfile() {
    const accessToken = authState.accessToken;

    if (!accessToken || isDeletingUserProfile) {
      return;
    }

    const shouldDelete = window.confirm("회원 탈퇴를 진행할까요?");

    if (!shouldDelete) {
      return;
    }

    setIsDeletingUserProfile(true);
    setDeleteUserProfileMessage("");

    try {
      await deleteUserProfile(accessToken);
      clearUserSessionState();
    } catch (error) {
      setDeleteUserProfileMessage(
        error instanceof Error ? error.message : "회원 탈퇴를 처리하지 못했어요.",
      );
    } finally {
      setIsDeletingUserProfile(false);
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

    const accessToken = authState.accessToken;

    if (authState.isLoggedIn && accessToken) {
      try {
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

    const accessToken = authState.accessToken;

    if (authState.isLoggedIn && accessToken) {
      try {
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
        setUserProfileMessage(
          error instanceof Error
            ? error.message
            : "배송지를 삭제하지 못했어요.",
        );
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
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-6"
        ref={scrollContainerRef}
      >
        <section className="rounded-[1.15rem] bg-black p-4 text-white">
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
              <p className="text-[11px] font-medium text-white/45">참여중</p>
              <p className="mt-1 text-[19px] font-semibold">
                {activeBids.length}
              </p>
            </div>
            <div className="rounded-[0.8rem] bg-white/10 px-3 py-3">
              <p className="text-[11px] font-medium text-white/45">1등</p>
              <p className="mt-1 text-[19px] font-semibold">
                {highestRankCount}
              </p>
            </div>
            <div className="rounded-[0.8rem] bg-white/10 px-3 py-3">
              <p className="text-[11px] font-medium text-white/45">찜</p>
              <p className="mt-1 text-[19px] font-semibold">
                {authState.isLoggedIn ? 10 : 0}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 border-t border-black/10 pt-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                정산 계좌
              </h2>
              <p className="mt-1 text-[13px] font-medium text-black/45">
                개최한 분철 정산금을 받을 계좌를 입력해 주세요.
              </p>
            </div>
            {hasSettlementAccount && !isEditingSettlementAccount ? (
              <button
                className="shrink-0 rounded-full bg-[#f7f7f7] px-3 py-2 text-[13px] font-semibold text-black/55"
                onClick={startSettlementAccountEdit}
                type="button"
              >
                수정
              </button>
            ) : null}
          </div>

          {!authState.isLoggedIn ? (
            <div className="mt-4 rounded-[0.95rem] bg-[#f7f7f7] px-4 py-6">
              <p className="text-[14px] font-medium text-black/45">
                로그인 후 이용할 수 있어요.
              </p>
            </div>
          ) : isEditingSettlementAccount ||
          !hasSettlementAccount ||
          isSettlementAccountFormDirty ? (
            <div className="mt-4 rounded-[0.95rem] border border-black/10 px-4 py-4">
              <div className="grid gap-3">
                <label className="block">
                  <span className="text-[13px] font-semibold text-black/45">
                    은행
                  </span>
                  <input
                    className="mt-2 h-12 w-full rounded-[0.8rem] border border-black/10 bg-[#f7f7f7] px-4 text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
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
                <label className="block">
                  <span className="text-[13px] font-semibold text-black/45">
                    계좌번호
                  </span>
                  <input
                    className="mt-2 h-12 w-full rounded-[0.8rem] border border-black/10 bg-[#f7f7f7] px-4 text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
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
                <label className="block">
                  <span className="text-[13px] font-semibold text-black/45">
                    예금주
                  </span>
                  <input
                    className="mt-2 h-12 w-full rounded-[0.8rem] border border-black/10 bg-[#f7f7f7] px-4 text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
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

              <div className="mt-4 flex items-center gap-2">
                {hasSettlementAccount || isSettlementAccountFormDirty ? (
                  <button
                    className="h-11 flex-1 rounded-full bg-[#f7f7f7] text-[14px] font-semibold text-black/55"
                    onClick={cancelSettlementAccountEdit}
                    type="button"
                  >
                    취소
                  </button>
                ) : null}
                <button
                  className="h-11 flex-1 rounded-full bg-black text-[14px] font-semibold text-white disabled:bg-black/20"
                  disabled={!canSaveSettlementAccount || isSavingSettlementAccount}
                  onClick={saveSettlementAccount}
                  type="button"
                >
                  {isSavingSettlementAccount ? "저장 중" : "저장"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[0.95rem] bg-[#f7f7f7] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-black/45">
                    {settlementAccount.bankName}
                  </p>
                  <p className="mt-1 break-all text-[17px] font-semibold tracking-[-0.04em]">
                    {settlementAccount.accountNumber}
                  </p>
                  <p className="mt-1 text-[13px] font-medium text-black/45">
                    예금주 {settlementAccount.accountHolder}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black/45">
                  저장됨
                </span>
              </div>
            </div>
          )}

          {settlementAccountMessage ? (
            <p className="mt-2 text-[13px] font-semibold text-black/45">
              {settlementAccountMessage}
            </p>
          ) : null}
        </section>

        <section className="mt-5 border-t border-black/10 pt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
              기본 배송지
            </h2>
            <Link
              className="text-[13px] font-semibold text-black/45"
              href={
                authState.isLoggedIn
                  ? "/profile/addresses"
                  : "/login?returnTo=/profile/addresses"
              }
            >
              배송지 관리
            </Link>
          </div>
          <div className="mt-3 grid gap-3">
            {(["gs25", "cu"] as const).map((storeType) => {
              const address = defaultDeliveryAddresses[storeType];

              return (
                <div
                  className="rounded-[0.95rem] bg-[#f7f7f7] px-4 py-4"
                  key={storeType}
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-white">
                      기본
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black/45">
                      {convenienceStoreTypeLabels[storeType]}
                    </span>
                    <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                      {!authState.isLoggedIn
                        ? "로그인 후 이용할 수 있어요"
                        : address?.branchName ?? "등록된 배송지가 없어요"}
                    </p>
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
                입찰 현황
              </h2>
              <p className="mt-1 text-[13px] font-medium text-black/45">
                등수 확인과 철회를 여기서 관리해요.
              </p>
            </div>
            <span className="shrink-0 text-[13px] font-semibold text-black/45">
              {activeBids.length}개
            </span>
          </div>

          {activeBids.length > 0 ? (
            <div className="mt-4 space-y-3">
              {activeBids.map((bid) => {
                const isClosed = isProfileBidClosed(bid, now);
                const remainingTime = formatRemainingTime(bid.deadline, now);
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
                        href={`/products/${bid.productId}?from=profile`}
                        onClick={rememberProfileProductEntry}
                      />
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
                                {isClosed
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
                            {isClosed
                              ? bid.rank === 1
                                ? (
                                  <>
                                    <p>결제가 필요해요</p>
                                    <p className="mt-0.5 text-black/45">
                                      결제까지 {paymentRemainingTime}
                                    </p>
                                  </>
                                )
                                : <p>마감된 입찰이에요</p>
                              : `철회까지 ${remainingTime}`}
                          </div>
                          {!isClosed ? (
                            <button
                              className="shrink-0 rounded-full bg-[#f7f7f7] px-3 py-2 text-[13px] font-semibold text-black/55 disabled:text-black/25"
                              disabled={withdrawingBidId === bid.id}
                              onClick={() => void withdrawBid(bid.id)}
                              type="button"
                            >
                              철회
                            </button>
                          ) : bid.rank === 1 ? (
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
          ) : (
            <div className="mt-4 rounded-[0.95rem] bg-[#f7f7f7] px-4 py-6">
              <p className="text-[14px] font-medium text-black/45">
                {authState.isLoggedIn
                  ? "참여 중인 입찰이 없습니다."
                  : "로그인 후 이용할 수 있어요."}
              </p>
            </div>
          )}

        </section>

        <section className="mt-6 border-t border-black/10 pt-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                진행 중인 개최 분철
              </h2>
              <p className="mt-1 text-[13px] font-medium text-black/45">
                지금 열려 있는 분철만 빠르게 확인해요.
              </p>
            </div>
            <span className="shrink-0 text-[13px] font-semibold text-black/45">
              {activeHostedProducts.length}개
            </span>
          </div>

          {hostedProductMessage ? (
            <p className="mt-3 rounded-[0.8rem] bg-[#f7f7f7] px-3 py-2 text-[13px] font-semibold text-black/55">
              {hostedProductMessage}
            </p>
          ) : null}

          {activeHostedProducts.length > 0 ? (
            <div className="mt-4 space-y-3">
              {activeHostedProducts.map((product) => {
                const isClosed = !isProfileHostedProductActive(product, now);
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
                            {isClosed ? "마감" : "모집중"}
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
                              {isClosed ? "정산 대기" : "진행중"}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 truncate text-[12px] font-medium text-black/40">
                          마감 {product.deadline}
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
                진행 중인 개최 분철이 없습니다.
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
          <section className="mt-6 border-t border-black/10 pt-5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold tracking-[-0.04em] text-black/65">
                  회원정보 수정
                </h2>
                <p className="mt-1 truncate text-[13px] font-medium text-black/35">
                  {userProfile?.phoneNumber ?? "휴대폰 번호 미등록"}
                </p>
              </div>
              {!isEditingUserProfile ? (
                <button
                  className="h-9 shrink-0 rounded-full bg-[#f7f7f7] px-3 text-[12px] font-semibold text-black/45 disabled:text-black/20"
                  disabled={isUserProfileLoading}
                  onClick={startUserProfileEdit}
                  type="button"
                >
                  수정
                </button>
              ) : null}
            </div>

            {isEditingUserProfile ? (
              <div className="mt-4 rounded-[0.95rem] border border-black/10 px-4 py-4">
                <div className="grid gap-3">
                  <label className="block">
                    <span className="text-[13px] font-semibold text-black/45">
                      닉네임
                    </span>
                    <input
                      className="mt-2 h-12 w-full rounded-[0.8rem] border border-black/10 bg-[#f7f7f7] px-4 text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                      maxLength={20}
                      onChange={(event) =>
                        updateUserProfileForm(
                          "nickname",
                          event.currentTarget.value,
                        )
                      }
                      placeholder="에이지"
                      value={userProfileForm.nickname}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-semibold text-black/45">
                      휴대폰 번호
                    </span>
                    <input
                      className="mt-2 h-12 w-full rounded-[0.8rem] border border-black/10 bg-[#f7f7f7] px-4 text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                      inputMode="numeric"
                      onChange={(event) =>
                        updateUserProfileForm(
                          "phoneNumber",
                          event.currentTarget.value,
                        )
                      }
                      placeholder="01012345678"
                      value={userProfileForm.phoneNumber}
                    />
                  </label>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    className="h-11 flex-1 rounded-full bg-[#f7f7f7] text-[14px] font-semibold text-black/55"
                    onClick={cancelUserProfileEdit}
                    type="button"
                  >
                    취소
                  </button>
                  <button
                    className="h-11 flex-1 rounded-full bg-black text-[14px] font-semibold text-white disabled:bg-black/20"
                    disabled={!canSaveUserProfile || isSavingUserProfile}
                    onClick={saveUserProfile}
                    type="button"
                  >
                    {isSavingUserProfile ? "저장 중" : "저장"}
                  </button>
                </div>
              </div>
            ) : null}

            {userProfileMessage ? (
              <p className="mt-2 text-[13px] font-semibold text-black/45">
                {userProfileMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        {authState.isLoggedIn ? (
          <section className="mt-6 border-t border-black/10 pt-5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold tracking-[-0.04em] text-black/65">
                  회원 탈퇴
                </h2>
                <p className="mt-1 break-keep text-[13px] font-medium leading-5 text-black/35">
                  탈퇴하면 현재 계정으로 저장된 회원 정보가 삭제돼요.
                </p>
              </div>
              <button
                className="h-9 shrink-0 rounded-full bg-[#f7f7f7] px-3 text-[12px] font-semibold text-black/45 disabled:text-black/20"
                disabled={isDeletingUserProfile}
                onClick={handleDeleteUserProfile}
                type="button"
              >
                {isDeletingUserProfile ? "처리 중" : "탈퇴"}
              </button>
            </div>
            {deleteUserProfileMessage ? (
              <p className="mt-2 text-[13px] font-semibold text-black/45">
                {deleteUserProfileMessage}
              </p>
            ) : null}
          </section>
        ) : null}
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
                    onClick={() => selectPaymentAddress(address.id)}
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
              onClick={() => openAddressSheet("select")}
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
          className={`bid-sheet-backdrop fixed inset-0 z-30 flex items-end ${
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
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
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
                const isDefault =
                  address.id === defaultAddressIds[address.storeType];
                const isSelected =
                  address.id ===
                  (selectedPaymentAddressId ?? paymentDeliveryAddress?.id);

                return (
                  <div
                    className={`w-full rounded-[0.95rem] border-[1.5px] px-4 py-3 text-left transition-colors ${
                      addressSheetMode === "select"
                        ? isSelected
                          ? "border-[#d8d8d8] bg-[#ececec]"
                          : "border-[#ededed] bg-white"
                        : isDefault
                        ? "border-[#d8d8d8] bg-[#ececec]"
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
                                  ? "bg-black text-white"
                                  : isDefault
                                  ? "bg-black text-white"
                                  : "bg-white text-black/45"
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
                      {addressSheetMode === "select" ? (
                        <span
                        className={`inline-flex h-8 w-[4.25rem] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                          isSelected
                            ? "bg-black text-white"
                            : "bg-white text-black/45"
                        }`}
                        >
                          {isSelected ? "선택됨" : "선택"}
                        </span>
                      ) : isDefault ? (
                        <div className="flex w-[8.3rem] shrink-0 items-center justify-end gap-2">
                          <span className="inline-flex h-8 items-center rounded-full bg-black px-2.5 text-[12px] font-semibold text-white transition-colors duration-300 ease-out">
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
                  className="flex h-[4.25rem] w-full items-center justify-center rounded-[0.95rem] border border-dashed border-black/15 bg-[#f7f7f7] text-[14px] font-semibold text-black/45"
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
