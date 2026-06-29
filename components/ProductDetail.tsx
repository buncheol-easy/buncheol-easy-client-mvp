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
  type BankAccountInfo,
  type BuncheolManagementOption,
} from "@/lib/auth-api";
import { getFreshAccessToken } from "@/lib/auth-session";
import { readAuthState, subscribeAuthState } from "@/lib/auth-store";
import {
  getDeliveryAddressStateFromSyncedAddresses,
  getInitialDeliveryAddressState,
  readDeliveryAddressState,
  subscribeDeliveryAddressState,
  writeDeliveryAddressState,
} from "@/lib/delivery-address-store";
import {
  getAvailableConvenienceStoreTypes,
  getConvenienceStoreLabel,
  getDefaultDeliveryAddressesByType,
  getPrioritizedDeliveryAddresses,
  type DeliveryAddress,
} from "@/lib/mock-delivery-addresses";
import { BackIcon, CloseIcon, HeartIcon } from "@/components/icons";
import { BottomNavigator } from "@/components/BottomNavigator";
import { BID_HISTORY_SKIP_ENTER_KEY, BidHistoryContent } from "@/components/BidHistoryContent";
import { writeCachedParticipationPayment } from "@/lib/participation-payment-cache";
import {
  FAVORITES_SKIP_ENTER_KEY,
  FavoritesContent,
} from "@/components/FavoritesContent";
import { HOME_SKIP_ENTER_KEY, HomeContent } from "@/components/HomeContent";
import {
  PROFILE_SKIP_ENTER_KEY,
  ProfileContent,
} from "@/components/ProfileContent";
import {
  SEARCH_SKIP_ENTER_KEY,
  SearchExperience,
} from "@/components/SearchExperience";
import { SwipeUnderlay } from "@/components/SwipeUnderlay";

type ProductDetailProps = {
  product: ProductDetailItem;
  backHref?: string;
  initialReturnSource?: "home" | "profile" | "bids" | "favorites" | "upload";
  initialReturnQuery?: string;
};

const PRODUCT_PROFILE_ENTRY_INDEX_KEY = "product-profile-entry-index";
const PRODUCT_PROFILE_ENTRY_STATE_KEY = "__buncheolProductFromProfile";
const PRODUCT_BID_HISTORY_ENTRY_INDEX_KEY = "product-bid-history-entry-index";
const PRODUCT_BID_HISTORY_ENTRY_STATE_KEY = "__buncheolProductFromBidHistory";
const PRODUCT_FAVORITES_ENTRY_INDEX_KEY = "product-favorites-entry-index";
const PRODUCT_FAVORITES_ENTRY_STATE_KEY = "__buncheolProductFromFavorites";
const kstOffsetHours = 9;
const paymentDueWindowMs = 30 * 60 * 1000;

type CheckoutSheetStep = "options" | "confirm" | "payment";

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

type ProductHistoryState = {
  idx?: unknown;
  [PRODUCT_PROFILE_ENTRY_STATE_KEY]?: unknown;
  [PRODUCT_BID_HISTORY_ENTRY_STATE_KEY]?: unknown;
  [PRODUCT_FAVORITES_ENTRY_STATE_KEY]?: unknown;
};

function ProductEditIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M4.5 19.5h4L19 9a2.1 2.1 0 0 0-3-3L5.5 16.5l-1 3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m14.5 7.5 2 2" strokeLinecap="round" />
    </svg>
  );
}

function ProductDeleteIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M6 7h12" strokeLinecap="round" />
      <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" />
      <path
        d="M8 10v7.2A2.8 2.8 0 0 0 10.8 20h2.4A2.8 2.8 0 0 0 16 17.2V10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

function getHistoryIndex() {
  const historyState = getHistoryState();

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

function hasProfileEntryState() {
  return getHistoryState()?.[PRODUCT_PROFILE_ENTRY_STATE_KEY] === true;
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

function isPaymentWindowClosed(deadline: string, now = Date.now()) {
  const deadlineDate = parseKoreaDateTime(deadline);

  return (
    !Number.isNaN(deadlineDate.getTime()) &&
    deadlineDate.getTime() - now <= paymentDueWindowMs
  );
}

function getTargetTags(product: ProductDetailItem) {
  const tags = product.targetMembers ?? [product.member];

  return tags
    .filter((tag, index, tags) => tag && tags.indexOf(tag) === index)
    .map((tag) => `#${tag}`);
}

function getProductImageUrls(product: ProductDetailItem) {
  return [product.imageUrl, ...(product.imageUrls ?? [])].filter(
    (imageUrl, index, imageUrls): imageUrl is string => {
      return Boolean(imageUrl) && imageUrls.indexOf(imageUrl) === index;
    },
  );
}

function formatCheckoutDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
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

  return Boolean(
    option.purchasePaymentConfirmedAt ||
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
  const isConfirmed = isConfirmedOptionPurchase(option);

  if (myBid) {
    return isConfirmed ? "내 구매 완료" : "내 결제 대기 중";
  }

  if (hasOptionPurchaseState(option)) {
    return isConfirmed ? "구매 완료" : "결제 대기 중";
  }

  if (isUnavailablePurchaseOption(option)) {
    return "구매 진행 중";
  }

  if (option.available === true) {
    return null;
  }

  if (shouldUseParticipantCount && option.participantCount > 0) {
    return "결제 대기 중";
  }

  return null;
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
  initialReturnSource,
  initialReturnQuery,
}: ProductDetailProps) {
  const router = useRouter();
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
  const sheetEnterAnimationFrameRef = useRef<number | null>(null);
  const sheetCloseFallbackTimerRef = useRef<number | null>(null);
  const checkoutAddressSheetEnterAnimationFrameRef = useRef<number | null>(null);
  const checkoutAddressSheetCloseFallbackTimerRef = useRef<number | null>(null);
  const checkoutCopyToastTimerRef = useRef<number | null>(null);
  const productImagePointerStartXRef = useRef<number | null>(null);
  const [returnQuery] = useState<string | undefined>(initialReturnQuery);
  const [isEntered, setIsEntered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSheetEntered, setIsSheetEntered] = useState(false);
  const [isSheetClosing, setIsSheetClosing] = useState(false);
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
  const [deadlineTick, setDeadlineTick] = useState(() => Date.now());

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
  const estimatedShippingFee = priceToNumber(shippingMethods[0]?.price ?? "");
  const estimatedShippingAmount = activeBidCount > 0 ? estimatedShippingFee : 0;
  const estimatedCheckoutTotal = totalBidAmount + estimatedShippingAmount;
  const availableShippingStoreTypes = getAvailableConvenienceStoreTypes(
    product.shippingMethods,
    product.courier,
  );
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
  const bidDeliveryAddress =
    getBidDeliveryAddressFromState(deliveryAddressState);
  const checkoutEligibleDeliveryAddresses = getPrioritizedDeliveryAddresses(
    deliveryAddressState.addresses,
    deliveryAddressState.defaultAddressIds,
  ).filter((address) =>
    availableShippingStoreTypes.length > 0
      ? availableShippingStoreTypes.includes(address.storeType)
      : true,
  );
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
  const isPaymentWindowPassed = isPaymentWindowClosed(
    product.deadline,
    deadlineTick,
  );
  const productStatus = product.status?.toUpperCase();
  const isCancelledProduct =
    productStatus === "CANCELLED" || productStatus === "CANCELED";
  const isPurchasableStatus =
    !productStatus || productStatus === "RECRUITING";
  const hasSelectableOption = auctionOptions.some(
    (option) =>
      !getOptionPurchaseOverlayLabel(
        option,
        myBids[option.id],
        product.isApiProduct === true,
      ),
  );
  const buncheolId = product.buncheolId ?? product.id;
  const isHostedProduct =
    product.isHostedByMe === true || isHostedByMeFromApi === true;
  const canEditProduct =
    product.id.startsWith("uploaded-") || isHostedProduct;
  const canDeleteProduct = product.isApiProduct && isHostedProduct;
  const canBidProduct =
    !isPublicPreview &&
    !isBidUnavailable &&
    !isHostedProduct &&
    !isDeadlinePassed &&
    !isPaymentWindowPassed &&
    isPurchasableStatus &&
    hasSelectableOption;
  const isMainBidButtonDisabled =
    !isPublicPreview && (isBidUnavailable || !canBidProduct);

  function getBidUnavailableMessage() {
    if (isHostedProduct) {
      return "내가 연 분철은 구매할 수 없어요";
    }

    if (isCancelledProduct) {
      return "취소된 분철이에요";
    }

    if (isDeadlinePassed) {
      return "구매 기한이 지났어요";
    }

    if (isPaymentWindowPassed) {
      return "입금 시간 확보를 위해 구매가 마감됐어요";
    }

    if (!hasSelectableOption) {
      return "구매 가능한 옵션이 없어요";
    }

    if (productStatus === "CONFIRMED") {
      return "진행 확정된 분철이에요";
    }

    return "지금은 구매할 수 없는 분철이에요";
  }

  function getProductDetailReturnHref() {
    const fallbackHref = `/products/${encodeURIComponent(buncheolId)}`;

    if (typeof window === "undefined") {
      return fallbackHref;
    }

    const currentHref = `${window.location.pathname}${window.location.search}`;

    return currentHref.startsWith("/products/") ? currentHref : fallbackHref;
  }

  function getAddressManagementHref(openAdd = false) {
    const params = new URLSearchParams({
      returnTo: getProductDetailReturnHref(),
    });

    if (openAdd) {
      params.set("openAdd", "1");
    }

    return `/profile/addresses?${params.toString()}`;
  }

  useEffect(() => {
    if (isPaymentWindowClosed(product.deadline)) {
      setDeadlineTick(Date.now());
      return;
    }

    const intervalId = window.setInterval(() => {
      setDeadlineTick(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [product.deadline]);

  useEffect(() => {
    setIsLiked(product.liked === true);
  }, [product.id, product.liked]);

  useEffect(() => {
    setAuctionOptions(product.options);
    setMyBids(getMyBidsFromOptions(product.options));
    setBidAmounts({});
    setIsHostedByMeFromApi(product.isHostedByMe === true);
    setCheckoutStep("options");
    setCheckoutDeliveryAddress(null);
    setCheckoutRefundAccount(null);
    setCheckoutPaymentSummary(null);
    setCheckoutError("");
    setCheckoutCopyToast("");
  }, [product.id, product.isHostedByMe, product.options]);

  useEffect(() => {
    if (
      !product.isApiProduct ||
      isPublicPreview ||
      !authState.isLoggedIn ||
      !authState.accessToken
    ) {
      setIsHostedByMeFromApi(product.isHostedByMe === true);
      return;
    }

    let isCancelled = false;
    const accessToken = authState.accessToken;

    setIsHostedByMeFromApi(product.isHostedByMe === true);

    requestBuncheolDetail(accessToken, buncheolId)
      .then(async (detail) => {
        if (isCancelled) {
          return;
        }

        const isHosted = detail.isHostedByMe === true;
        const refreshedProduct = toProductDetailItem(detail);
        setIsHostedByMeFromApi(isHosted);
        setAuctionOptions(refreshedProduct.options);
        setMyBids(getMyBidsFromOptions(refreshedProduct.options));
        setBidAmounts({});

        if (!isHosted && product.isHostedByMe !== true) {
          return;
        }

        try {
          const managementDetail = await requestBuncheolManagement(
            accessToken,
            buncheolId,
          );

          if (!isCancelled) {
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
      })
      .catch(() => {
        // The submit path still handles permission failures with a user-facing message.
      });

    return () => {
      isCancelled = true;
    };
  }, [
    authState.accessToken,
    authState.isLoggedIn,
    buncheolId,
    isPublicPreview,
    product.isHostedByMe,
    product.isApiProduct,
  ]);

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
      if (current[optionId] === "selected") {
        const nextAmounts = { ...current };
        delete nextAmounts[optionId];

        return nextAmounts;
      }

      return {
        ...current,
        [optionId]: "selected",
      };
    });
  }

  function applySubmittedBidState(
    participationResults: Map<
      string,
      { bidAmount: number; participationId: string }
    >,
    onlyParticipationResults = false,
  ) {
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

    setCheckoutError("");
    setIsBidSubmitPending(true);

    if (product.isApiProduct) {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        const returnHref = `/products/${encodeURIComponent(buncheolId)}`;
        router.push(`/login?returnTo=${encodeURIComponent(returnHref)}`);
        return;
      }

      let nextBidDeliveryAddress = checkoutDeliveryAddress ?? bidDeliveryAddress;

      if (!nextBidDeliveryAddress) {
        try {
          const addresses = await requestShippingAddresses(accessToken);
          const nextAddressState =
            getDeliveryAddressStateFromSyncedAddresses(addresses);

          writeDeliveryAddressState(nextAddressState);
          nextBidDeliveryAddress =
            getBidDeliveryAddressFromState(nextAddressState);
        } catch {
          nextBidDeliveryAddress = null;
        }
      }

      const shippingAddressId = Number(nextBidDeliveryAddress?.id);

      if (!Number.isFinite(shippingAddressId)) {
        window.alert("구매하려면 배송지를 먼저 등록해 주세요.");
        setIsBidSubmitPending(false);
        router.push(getAddressManagementHref(true));
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
        window.alert("구매하려면 환불 계좌를 먼저 등록해 주세요.");
        setIsBidSubmitPending(false);
        router.push("/profile/account");
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
        router.push(`/login?returnTo=${encodeURIComponent(returnHref)}`);
        return;
      }

      setIsBidSubmitPending(true);

      let nextBidDeliveryAddress = checkoutDeliveryAddress ?? bidDeliveryAddress;

      if (!nextBidDeliveryAddress) {
        try {
          const addresses = await requestShippingAddresses(accessToken);
          const nextAddressState =
            getDeliveryAddressStateFromSyncedAddresses(addresses);

          writeDeliveryAddressState(nextAddressState);
          nextBidDeliveryAddress =
            getBidDeliveryAddressFromState(nextAddressState);
        } catch {
          nextBidDeliveryAddress = null;
        }
      }

      const shippingAddressId = Number(nextBidDeliveryAddress?.id);

      if (!Number.isFinite(shippingAddressId)) {
        window.alert("구매하려면 배송지를 먼저 등록해 주세요.");
        setIsBidSubmitPending(false);
        router.push(getAddressManagementHref(true));
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
        window.alert("구매하려면 환불 계좌를 먼저 등록해 주세요.");
        setIsBidSubmitPending(false);
        router.push("/profile/account");
        return;
      }

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
        const result = await participateBuncheol(accessToken, buncheolId, {
          buncheolMemberIds: checkoutRequestItems.map(
            (item) => item.buncheolMemberId,
          ),
          refundAccount,
          shippingAddressId,
        });
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
        let paymentDetail:
          | Awaited<ReturnType<typeof requestParticipationPaymentDetail>>
          | null = null;

        if (
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
        const totalPaymentAmount =
          result.paymentAmount ??
          paymentDetail?.paymentAmount ??
          totalBidAmount + estimatedShippingFee;
        const sharedShippingFee = Math.max(
          totalPaymentAmount - totalBidAmount,
          0,
        );
        const sharedPaymentDueAt =
          result.paymentDueAt ?? paymentDetail?.paymentDueAt;
        const sharedParticipationStatus =
          result.participationStatus ||
          paymentDetail?.paymentStatus ||
          "AWAITING_PAYMENT";

        checkoutRequestItems.forEach(({ bidAmount, option }, index) => {
          const participationId = resultParticipationIds[index] ?? "";
          const nextShippingFee = index === 0 ? sharedShippingFee : 0;
          const nextPaymentAmount = bidAmount + nextShippingFee;

          if (participationId) {
            writeCachedParticipationPayment({
              bidAmount,
              hostBankAccount,
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
            "선택한 옵션의 입금 계좌가 달라요. 구매 내역에서 각각 확인해 주세요.",
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
        const didPaymentWindowPass = isPaymentWindowClosed(product.deadline);
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
        } else if (didPaymentWindowPass) {
          setCheckoutError("입금 시간 확보를 위해 구매가 마감됐어요.");
        } else if (isForbidden) {
          setCheckoutError(
            "구매 권한이 없어요. 테스트 리모콘에서 구매 계정으로 다시 전환한 뒤 시도해 주세요.",
          );
        } else {
          setCheckoutError(errorMessage);
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
      setCheckoutStep("payment");
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

    if (initialReturnSource === "profile") {
      if (hasProfileEntryState()) {
        router.back();
        return;
      }

      router.replace("/profile");
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

    router.back();
  }, [backHref, initialReturnSource, router]);

  useEffect(() => {
    const enterAnimationFrame = window.requestAnimationFrame(() => {
      setIsEntered(true);
    });

    return () => {
      window.cancelAnimationFrame(enterAnimationFrame);
    };
  }, []);

  useEffect(() => {
    const historyIndex = getHistoryIndex();
    const expectedEntryIndex = window.sessionStorage.getItem(
      PRODUCT_PROFILE_ENTRY_INDEX_KEY,
    );
    const expectedBidHistoryEntryIndex = window.sessionStorage.getItem(
      PRODUCT_BID_HISTORY_ENTRY_INDEX_KEY,
    );
    const expectedFavoritesEntryIndex = window.sessionStorage.getItem(
      PRODUCT_FAVORITES_ENTRY_INDEX_KEY,
    );
    window.sessionStorage.removeItem(PRODUCT_PROFILE_ENTRY_INDEX_KEY);
    window.sessionStorage.removeItem(PRODUCT_BID_HISTORY_ENTRY_INDEX_KEY);
    window.sessionStorage.removeItem(PRODUCT_FAVORITES_ENTRY_INDEX_KEY);

    if (
      initialReturnSource === "profile" &&
      historyIndex !== null &&
      expectedEntryIndex === String(historyIndex)
    ) {
      window.history.replaceState(
        {
          ...(getHistoryState() ?? {}),
          [PRODUCT_PROFILE_ENTRY_STATE_KEY]: true,
        },
        "",
      );
    }

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

    if (initialReturnSource === "profile") {
      window.sessionStorage.setItem(PROFILE_SKIP_ENTER_KEY, "true");
    } else {
      window.sessionStorage.removeItem(PROFILE_SKIP_ENTER_KEY);
    }

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
      router.push(`/login?returnTo=${encodeURIComponent(returnHref)}`);
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

      router.push(`/login?returnTo=${encodeURIComponent(returnHref)}`);
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

  function openCheckoutAddressSheet() {
    if (checkoutEligibleDeliveryAddresses.length === 0) {
      router.push(getAddressManagementHref(true));
      return;
    }

    if (checkoutAddressSheetCloseFallbackTimerRef.current !== null) {
      window.clearTimeout(checkoutAddressSheetCloseFallbackTimerRef.current);
      checkoutAddressSheetCloseFallbackTimerRef.current = null;
    }

    setCheckoutDeliveryAddress(
      (current) =>
        current ?? bidDeliveryAddress ?? checkoutEligibleDeliveryAddresses[0] ?? null,
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

  function openBidHistory() {
    window.sessionStorage.setItem(BID_HISTORY_SKIP_ENTER_KEY, "true");
    router.push("/profile/bids");
  }

  return (
    <main className="product-detail-shell system-chrome-white system-chrome-bottom-white relative h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]">
      {initialReturnSource === "home" ? (
        <SwipeUnderlay
          className="product-detail-underlay"
          isEntered={isEntered}
          isExiting={isExiting}
        >
          <HomeContent skipEnterAnimation />
          <BottomNavigator />
        </SwipeUnderlay>
      ) : null}

      {initialReturnSource === "profile" ? (
        <SwipeUnderlay
          className="product-detail-underlay"
          isEntered={isEntered}
          isExiting={isExiting}
        >
          <ProfileContent skipEnterAnimation />
          <BottomNavigator activeLabel="Profile" />
        </SwipeUnderlay>
      ) : null}

      {initialReturnSource === "bids" ? (
        <SwipeUnderlay
          className="product-detail-underlay"
          isEntered={isEntered}
          isExiting={isExiting}
        >
          <BidHistoryContent skipEnterAnimation />
          <BottomNavigator activeLabel="Bids" />
        </SwipeUnderlay>
      ) : null}

      {initialReturnSource === "favorites" ? (
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
        <header className="product-detail-header shrink-0 px-4 pb-2 pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="product-detail-action mr-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-white"
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
                <ProductEditIcon />
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
                <ProductDeleteIcon />
              </button>
            ) : null}
            {!canEditProduct ? (
            <button
              type="button"
              className="product-detail-action inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black"
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
                    className="h-full touch-none select-none overflow-hidden"
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
              <div className="absolute left-5 top-5 rounded-full bg-black px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-white">
                {product.badge}
              </div>
            </div>
          </section>

          <section className="px-5 pt-6">
            <p className="text-[13px] font-semibold leading-5 text-black/40">
              {targetTags.join(" ")}
            </p>

            <h1 className="mt-4 line-clamp-2 text-[27px] font-semibold leading-[1.18] tracking-[-0.06em]">
              {product.title}
            </h1>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="col-span-2 rounded-[0.9rem] border border-black/10 px-4 py-3">
                <p className="text-[12px] font-medium text-black/45">구매처</p>
                <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                  {product.purchaseSource ?? "공식 판매처"}
                </p>
              </div>
              <div className="col-span-2 rounded-[0.9rem] border border-black/10 px-4 py-3">
                <p className="text-[12px] font-medium text-black/45">구매 기한</p>
                <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                  {product.deadline}
                </p>
              </div>
              <div className="col-span-2 rounded-[0.9rem] border border-black/10 px-4 py-3">
                <p className="text-[12px] font-medium text-black/45">
                  분철 유지 기준
                </p>
                <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                  {typeof product.minHeadcount === "number" &&
                  product.minHeadcount > 0
                    ? `${product.minHeadcount.toLocaleString("ko-KR")}명 이상`
                    : "개최자 확인"}
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
            </div>
            ) : null}

            <div className="mt-8 border-t border-black/10 pt-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                상품 설명
              </h2>
              <p className="mt-3 text-[15px] leading-7 tracking-[-0.04em] text-black/65">
                {product.description}
              </p>
            </div>

            <div className="mt-8 border-t border-black/10 pt-6">
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-[18px] font-semibold">
                  옵션 선택
                </h2>
                <p className="text-[12px] font-semibold text-black/35">
                  {auctionOptions.length.toLocaleString("ko-KR")}개 옵션
                </p>
              </div>
              <div className="mt-4 grid gap-2.5">
                {auctionOptions.map((option) => {
                  const overlayLabel = getOptionPurchaseOverlayLabel(
                    option,
                    myBids[option.id],
                    product.isApiProduct === true,
                  );

                  return (
                    <div
                      key={option.id}
                      className={`relative flex min-h-[76px] items-center justify-between gap-3 overflow-hidden rounded-[0.9rem] border px-4 py-3 shadow-[0_8px_22px_rgba(0,0,0,0.035)] ${
                        overlayLabel
                          ? "border-black/10 bg-[#f7f7f7]"
                          : "border-black/10 bg-white"
                      }`}
                    >
                      <div
                        className={`flex min-w-0 items-center gap-3 ${
                          overlayLabel ? "opacity-65" : ""
                        }`}
                      >
                        <OptionAvatar option={option} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-[16px] font-semibold">
                            {option.label}
                          </p>
                          <p className="mt-0.5 text-[12px] font-semibold text-black/35">
                            {overlayLabel ? "선택할 수 없는 옵션" : "구매 가능 옵션"}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`shrink-0 text-right ${
                          overlayLabel ? "opacity-65" : ""
                        }`}
                      >
                        <p className="text-[11px] font-semibold text-black/35">
                          {getOptionPriceLabel()}
                        </p>
                        <p className="mt-0.5 text-[16px] font-semibold">
                          {getBidBaseline(option)}
                        </p>
                      </div>
                      {overlayLabel ? (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-[0.5px]">
                          <span className="rounded-full bg-black px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
                            {overlayLabel}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <div className="product-detail-bid-bar absolute bottom-0 left-0 right-0 z-20 bg-white px-5 pb-5 pt-3 shadow-[0_-12px_34px_rgba(0,0,0,0.08)]">
          <button
            type="button"
            className="h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-white disabled:bg-black/20"
            disabled={isMainBidButtonDisabled}
            onClick={
              isMainBidButtonDisabled ? undefined : handleBidButtonClick
            }
          >
            {isPublicPreview
              ? "로그인 후 구매하기"
              : isBidUnavailable
                ? "구매하기"
                : canBidProduct
                  ? "구매하기"
                  : getBidUnavailableMessage()}
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
                    {checkoutStep === "payment"
                      ? "입금 안내"
                      : checkoutStep === "confirm"
                        ? "주문 확인"
                        : "구매 옵션"}
                  </h2>
                  <p className="mt-1 text-[13px] font-medium text-black/45">
                    {checkoutStep === "payment"
                      ? "마감 시각까지 아래 계좌로 입금해 주세요."
                      : checkoutStep === "confirm"
                        ? "결제 후 입금 계좌와 마감 시각이 안내돼요."
                        : "구매할 옵션을 선택해 주세요."}
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

              {checkoutStep === "options" ? (
                <>
                  <div className="mt-5 max-h-[38dvh] space-y-3 overflow-y-auto pr-1 [touch-action:pan-y]">
                    {sortedAuctionOptions.map((option) => {
                      const myBid = myBids[option.id];
                      const isSelected = bidAmounts[option.id] === "selected";
                      const overlayLabel = getOptionPurchaseOverlayLabel(
                        option,
                        myBid,
                        product.isApiProduct === true,
                      );

                      return (
                        <div
                          key={option.id}
                          className={`relative overflow-hidden rounded-[0.9rem] border px-4 py-3 ${
                            overlayLabel
                              ? "border-black/10 bg-[#f7f7f7]"
                              : isSelected
                              ? "border-black bg-[#f2f2f0]"
                              : "border-black/10 bg-white"
                          }`}
                        >
                          <div
                            className={`flex items-start justify-between gap-3 ${
                              overlayLabel ? "opacity-65" : ""
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <OptionAvatar option={option} size="lg" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                                    {option.label}
                                  </p>
                                  {myBid ? (
                                    <span className="shrink-0 rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold text-white">
                                      구매 진행 중
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-[13px] font-medium tracking-[-0.04em] text-black/45">
                                  {myBid
                                    ? `구매 금액 ${formatPrice(myBid)}`
                                    : "구매 가능"}
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[12px] font-medium text-black/45">
                                {getOptionPriceLabel()}
                              </p>
                              <p className="mt-1 text-[15px] font-semibold tracking-[-0.04em]">
                                {getBidBaseline(option)}
                              </p>
                            </div>
                          </div>

                          <button
                            className={`mt-3 h-12 w-full rounded-[0.8rem] text-[14px] font-semibold transition-colors ${
                              overlayLabel
                                ? "bg-black/10 text-black/35"
                                : isSelected
                                  ? "bg-black text-white"
                                  : "bg-[#f7f7f7] text-black/55"
                            }`}
                            disabled={Boolean(overlayLabel)}
                            onClick={() => togglePurchaseOption(option.id)}
                            type="button"
                          >
                            {overlayLabel
                              ? "선택 불가"
                              : isSelected
                                ? "선택 해제"
                                : "선택"}
                          </button>
                          {overlayLabel ? (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-[0.5px]">
                              <span className="rounded-full bg-black px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
                                {overlayLabel}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-black/10 pt-4">
                    <span className="text-[14px] font-medium text-black/45">
                      구매 옵션 {activeBidCount}개
                    </span>
                    <span className="text-[22px] font-semibold tracking-[-0.05em]">
                      {formatPrice(totalBidAmount)}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="mt-4 h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-white disabled:bg-black/20"
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
                      <p className="text-[12px] font-semibold text-black/40">선택 옵션</p>
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
                          <p className="mt-1 truncate text-[15px] font-semibold tracking-[-0.04em]">
                            {checkoutDeliveryAddress
                              ? `${getConvenienceStoreLabel(checkoutDeliveryAddress.storeType)} ${checkoutDeliveryAddress.branchName}`
                              : "등록된 배송지 없음"}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-5 text-black/40">
                            {checkoutDeliveryAddress?.address ?? "배송지를 등록해 주세요."}
                          </p>
                        </div>
                        <button
                          className="h-9 shrink-0 rounded-full bg-[#f3f3f3] px-3 text-[12px] font-semibold text-black/55"
                          onClick={openCheckoutAddressSheet}
                          type="button"
                        >
                          {checkoutDeliveryAddress
                            ? "변경"
                            : checkoutEligibleDeliveryAddresses.length > 0
                              ? "선택"
                              : "추가"}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-[0.95rem] bg-black px-4 py-4 text-white">
                      <div className="flex items-center justify-between text-[13px] font-semibold text-white/60">
                        <span>상품 금액</span>
                        <span>{formatPrice(totalBidAmount)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[13px] font-semibold text-white/60">
                        <span>예상 배송비</span>
                        <span>{formatPrice(estimatedShippingAmount)}</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-4">
                        <span className="text-[14px] font-semibold text-white/70">총 예상 금액</span>
                        <span className="text-[22px] font-semibold tracking-[-0.05em]">
                          {formatPrice(estimatedCheckoutTotal)}
                        </span>
                      </div>
                    </div>

                    <p className="px-1 text-[12px] font-medium leading-5 text-black/45">
                      결제하기를 누르면 입금 마감 시각이 정해져요. 마감 시각까지 입금하면 관리자가 확인 후 주문을 확정해요.
                    </p>
                    {checkoutError ? (
                      <p className="rounded-[0.85rem] bg-[#fff2f2] px-4 py-3 text-[12px] font-semibold leading-5 text-[#c03131]">
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
                      className="h-14 rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-white disabled:bg-black/20"
                      disabled={
                        isBidSubmitPending ||
                        activeBidCount === 0 ||
                        !canBidProduct ||
                        !checkoutDeliveryAddress
                      }
                      onClick={() => void handleSubmitBids()}
                      type="button"
                    >
                      {isBidSubmitPending ? "결제 처리 중" : "결제하기"}
                    </button>
                  </div>
                </>
              ) : null}

              {checkoutStep === "payment" ? (
                checkoutPaymentSummary ? (
                  <>
                    <div className="mt-5 max-h-[48dvh] space-y-3 overflow-y-auto pr-1 [touch-action:pan-y]">
                      <div className="rounded-[0.95rem] bg-[#f7f7f7] px-4 py-4">
                        <p className="text-[12px] font-semibold text-black/40">선택 옵션</p>
                        <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                          {checkoutPaymentSummary.items[0]?.option.label ?? "-"}
                          {checkoutPaymentSummary.items.length > 1
                            ? ` 외 ${checkoutPaymentSummary.items.length - 1}개`
                            : ""}
                        </p>
                        <p className="mt-2 text-[12px] font-medium leading-5 text-black/45">
                          선택한 옵션 {checkoutPaymentSummary.items.length}개를
                          합산해 한 번에 입금해 주세요.
                        </p>
                        <div className="mt-3 space-y-2">
                          {checkoutPaymentSummary.items.map((item) => (
                            <div
                              className="flex items-center justify-between gap-3 rounded-[0.75rem] bg-white px-3 py-2"
                              key={item.participationId}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-semibold tracking-[-0.04em]">
                                  {item.option.label}
                                </p>
                                <p className="mt-0.5 text-[11px] font-medium text-black/40">
                                  {item.shippingFee > 0
                                    ? `배송비 ${formatPrice(item.shippingFee)} 포함`
                                    : "묶음 배송비 0원"}
                                </p>
                              </div>
                              <span className="shrink-0 text-[13px] font-semibold tracking-[-0.04em]">
                                {formatPrice(item.paymentAmount)}
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
                                : "구매 내역에서 다시 확인해 주세요."}
                            </p>
                          </div>
                          <button
                            className="h-9 shrink-0 rounded-full bg-black px-3 text-[12px] font-semibold text-white disabled:bg-black/10 disabled:text-black/30"
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
                        {checkoutCopyToast ? (
                          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
                            <p className="soft-panel-enter rounded-full bg-black/92 px-4 py-3 text-center text-[12px] font-semibold tracking-[-0.04em] text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
                              {checkoutCopyToast}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-[0.95rem] bg-black px-4 py-4 text-white">
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
                          <span className="text-[23px] font-semibold tracking-[-0.05em]">
                            {formatPrice(checkoutPaymentSummary.totalAmount)}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-[0.95rem] bg-[#f7f7f7] px-4 py-4">
                        <p className="text-[12px] font-semibold text-black/40">입금 마감</p>
                        <p className="mt-1 text-[17px] font-semibold tracking-[-0.04em]">
                          {formatCheckoutDateTime(checkoutPaymentSummary.paymentDueAt)}
                        </p>
                        <p className="mt-2 text-[12px] font-medium leading-5 text-black/45">
                          마감 시각까지 입금하면 관리자가 확인 후 주문을 확정해요.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-[0.52fr_0.48fr] gap-2">
                      <button
                        className="h-14 rounded-full bg-black text-[16px] font-semibold tracking-[-0.04em] text-white"
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
                        구매 내역 보기
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-5 rounded-[0.95rem] bg-[#f7f7f7] px-4 py-5 text-[14px] font-semibold text-black/45">
                    입금 정보를 불러오고 있어요.
                  </div>
                )
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
              className={`bid-sheet-panel relative mx-auto flex h-[72dvh] w-full max-w-[430px] flex-col rounded-t-[1.4rem] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
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
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
                  onClick={closeCheckoutAddressSheet}
                  type="button"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {checkoutEligibleDeliveryAddresses.map((address) => {
                  const isDefault =
                    address.id ===
                    deliveryAddressState.defaultAddressIds[address.storeType];
                  const isSelected =
                    address.id ===
                    (checkoutDeliveryAddress?.id ?? bidDeliveryAddress?.id);

                  return (
                    <button
                      className={`w-full rounded-[0.95rem] border-[1.5px] px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? "border-[#d8d8d8] bg-[#ececec]"
                          : "border-[#ededed] bg-white"
                      }`}
                      key={address.id}
                      onClick={() => setCheckoutDeliveryAddress(address)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1 pr-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                isSelected || isDefault
                                  ? "bg-black text-white"
                                  : "bg-[#f3f3f3] text-black/45"
                              }`}
                            >
                              {getConvenienceStoreLabel(address.storeType)}
                            </span>
                            {address.alias ? (
                              <span className="rounded-full bg-black/10 px-2.5 py-1 text-[11px] font-semibold text-black/60">
                                {address.alias}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 truncate text-[14px] font-semibold tracking-[-0.04em]">
                            {address.branchName}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-5 text-black/40">
                            {address.address}
                          </p>
                        </div>
                        <span
                          className={`inline-flex h-8 w-[4.25rem] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                            isSelected
                              ? "bg-black text-white"
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
                  className="flex h-[4.25rem] w-full items-center justify-center rounded-[0.95rem] border border-dashed border-black/15 bg-[#f7f7f7] text-[14px] font-semibold text-black/45"
                  onClick={() => router.push(getAddressManagementHref(true))}
                  type="button"
                >
                  + 새 배송지 추가
                </button>
              </div>

              <button
                className="mt-3 h-12 w-full rounded-full bg-black text-[15px] font-semibold text-white"
                onClick={closeCheckoutAddressSheet}
                type="button"
              >
                이 배송지로 받기
              </button>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
