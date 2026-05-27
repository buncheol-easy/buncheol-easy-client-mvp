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
import { BackIcon, CloseIcon, HeartIcon } from "@/components/icons";
import { BottomNavigator } from "@/components/BottomNavigator";
import {
  BID_HISTORY_SKIP_ENTER_KEY,
  BidHistoryContent,
} from "@/components/BidHistoryContent";
import {
  FAVORITES_SKIP_ENTER_KEY,
  FavoritesContent,
} from "@/components/FavoritesContent";
import { HOME_SKIP_ENTER_KEY, HomeContent } from "@/components/HomeContent";
import { ProfileContent } from "@/components/ProfileContent";
import {
  SEARCH_SKIP_ENTER_KEY,
  SearchExperience,
} from "@/components/SearchExperience";
import { SwipeUnderlay } from "@/components/SwipeUnderlay";
import {
  cancelBuncheolParticipation,
  participateBuncheol,
  requestShippingAddresses,
} from "@/lib/auth-api";
import { readAuthState, subscribeAuthState } from "@/lib/auth-store";
import {
  getDeliveryAddressStateFromSyncedAddresses,
  getInitialDeliveryAddressState,
  readDeliveryAddressState,
  subscribeDeliveryAddressState,
  writeDeliveryAddressState,
  type StoredDeliveryAddressState,
} from "@/lib/delivery-address-store";
import {
  getAvailableConvenienceStoreTypes,
  getDefaultDeliveryAddressesByType,
  getPrioritizedDeliveryAddresses,
} from "@/lib/mock-delivery-addresses";

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

function getTopBids(option: ProductOption) {
  return option.topBids ?? [option.currentBid, "-", "-"];
}

function getStartingBid(option: ProductOption) {
  return option.startingBid ?? option.price ?? option.currentBid;
}

function hasOptionBids(option: ProductOption) {
  return (
    option.participantCount > 0 &&
    getTopBids(option).some((bid) => priceToNumber(bid) > 0)
  );
}

function getOptionPriceLabel(option: ProductOption) {
  return hasOptionBids(option) ? "현재 최고가" : "입찰 시작가";
}

function getBidBaseline(option: ProductOption) {
  return hasOptionBids(option) ? option.currentBid : getStartingBid(option);
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

function getBidDeliveryAddress(
  state: StoredDeliveryAddressState,
  product: ProductDetailItem,
) {
  const defaultDeliveryAddresses = getDefaultDeliveryAddressesByType(
    state.addresses,
    state.defaultAddressIds,
  );
  const prioritizedDeliveryAddresses = getPrioritizedDeliveryAddresses(
    state.addresses,
    state.defaultAddressIds,
  );
  const availableShippingStoreTypes = getAvailableConvenienceStoreTypes(
    product.shippingMethods,
    product.courier,
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
  const productImagePointerStartXRef = useRef<number | null>(null);
  const [returnQuery] = useState<string | undefined>(initialReturnQuery);
  const [isEntered, setIsEntered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSheetEntered, setIsSheetEntered] = useState(false);
  const [isSheetClosing, setIsSheetClosing] = useState(false);
  const [auctionOptions, setAuctionOptions] = useState<ProductOption[]>(
    product.options,
  );
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [myBids, setMyBids] = useState<Record<string, number>>(() =>
    product.options.reduce<Record<string, number>>((bids, option) => {
      if (typeof option.myBidAmount === "number" && option.myBidAmount > 0) {
        bids[option.id] = option.myBidAmount;
      }

      return bids;
    }, {}),
  );
  const [isBidSubmitPending, setIsBidSubmitPending] = useState(false);
  const [withdrawingOptionId, setWithdrawingOptionId] = useState<string | null>(
    null,
  );
  const [currentProductImageIndex, setCurrentProductImageIndex] = useState(0);
  const [productImageDragOffset, setProductImageDragOffset] = useState(0);
  const [isProductImageDragging, setIsProductImageDragging] = useState(false);

  const activeBidCount = useMemo(() => {
    return auctionOptions.filter((option) => {
      const bidAmount = Number(bidAmounts[option.id] ?? 0);

      return bidAmount > priceToNumber(getBidBaseline(option));
    }).length;
  }, [auctionOptions, bidAmounts]);

  const totalBidAmount = useMemo(() => {
    return auctionOptions.reduce((sum, option) => {
      const bidAmount = Number(bidAmounts[option.id] ?? 0);

      if (bidAmount <= priceToNumber(getBidBaseline(option))) {
        return sum;
      }

      return sum + bidAmount;
    }, 0);
  }, [auctionOptions, bidAmounts]);

  const myBidItems = auctionOptions
    .map((option) => {
      const amount = myBids[option.id] ?? 0;

      if (amount <= 0) {
        return null;
      }

      const rank =
        getTopBids(option)
          .map((bid) => priceToNumber(bid))
          .filter((bid) => bid > amount).length + 1;

      return {
        amount,
        option,
        rank,
      };
    })
    .filter(
      (item): item is { amount: number; option: ProductOption; rank: number } =>
        item !== null,
    );

  const sortedAuctionOptions = [...auctionOptions].sort((left, right) => {
    const leftHasBid = Boolean(myBids[left.id]);
    const rightHasBid = Boolean(myBids[right.id]);

    if (leftHasBid === rightHasBid) {
      return 0;
    }

    return leftHasBid ? -1 : 1;
  });

  const shippingMethods = product.shippingMethods ?? [
    { name: product.courier, price: "판매자 안내" },
  ];
  const bidDeliveryAddress = getBidDeliveryAddress(
    deliveryAddressState,
    product,
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
  const canEditProduct =
    product.id.startsWith("uploaded-") || product.isHostedByMe;
  const buncheolId = product.buncheolId ?? product.id;

  function buildTopBids(
    option: ProductOption,
    bidAmount: number,
    previousBidAmount = 0,
  ) {
    const topBidAmounts = [
      bidAmount,
      ...getTopBids(option).map((bid) => priceToNumber(bid)),
    ]
      .filter((bid) => bid > 0)
      .sort((a, b) => b - a);
    const previousBidIndex = topBidAmounts.indexOf(previousBidAmount);

    if (previousBidIndex >= 0) {
      topBidAmounts.splice(previousBidIndex, 1);
    }

    const topBids = topBidAmounts.slice(0, 3).map(formatPrice);

    return [
      topBids[0] ?? "-",
      topBids[1] ?? "-",
      topBids[2] ?? "-",
    ] as [string, string, string];
  }

  function removeBidFromTopBids(option: ProductOption, bidAmount: number) {
    const nextTopBidAmounts = getTopBids(option)
      .map((bid) => priceToNumber(bid))
      .filter((bid) => bid > 0);
    const withdrawnBidIndex = nextTopBidAmounts.indexOf(bidAmount);

    if (withdrawnBidIndex >= 0) {
      nextTopBidAmounts.splice(withdrawnBidIndex, 1);
    }

    const nextTopBids = nextTopBidAmounts
      .slice(0, 3)
      .map(formatPrice);

    return {
      currentBid: nextTopBids[0] ?? "-",
      topBids: [
        nextTopBids[0] ?? "-",
        nextTopBids[1] ?? "-",
        nextTopBids[2] ?? "-",
      ] as [string, string, string],
    };
  }

  function updateBidAmount(optionId: string, nextAmount: string) {
    setBidAmounts((current) => ({
      ...current,
      [optionId]: nextAmount.replace(/[^0-9]/g, ""),
    }));
  }

  async function withdrawBid(optionId: string) {
    const withdrawnBid = myBids[optionId];

    if (!withdrawnBid || withdrawingOptionId) {
      return;
    }

    const option = auctionOptions.find((option) => option.id === optionId);
    const participationId = option?.myParticipationId;

    if (product.isApiProduct) {
      const accessToken = authState.accessToken;

      if (!authState.isLoggedIn || !accessToken) {
        const returnHref = `/products/${encodeURIComponent(buncheolId)}`;
        router.push(`/login?returnTo=${encodeURIComponent(returnHref)}`);
        return;
      }

      if (!participationId) {
        window.alert("입찰 철회 정보를 확인하지 못했어요.");
        return;
      }

      setWithdrawingOptionId(optionId);

      try {
        await cancelBuncheolParticipation(accessToken, participationId);
      } catch (error: unknown) {
        window.alert(
          error instanceof Error ? error.message : "입찰을 철회하지 못했어요.",
        );
        setWithdrawingOptionId(null);
        return;
      }
    }

    setAuctionOptions((currentOptions) =>
      currentOptions.map((option) => {
        if (option.id !== optionId) {
          return option;
        }

        const { currentBid, topBids } = removeBidFromTopBids(
          option,
          withdrawnBid,
        );

        return {
          ...option,
          currentBid,
          myBidAmount: undefined,
          myParticipationId: undefined,
          participantCount: Math.max(0, option.participantCount - 1),
          topBids,
        };
      }),
    );
    setMyBids((current) => {
      const nextBids = { ...current };
      delete nextBids[optionId];

      return nextBids;
    });
    setBidAmounts((current) => {
      const nextAmounts = { ...current };
      delete nextAmounts[optionId];

      return nextAmounts;
    });
    setWithdrawingOptionId(null);
  }

  function applySubmittedBidState(
    participationResults: Map<
      string,
      { bidAmount: number; participationId: string }
    >,
    onlyParticipationResults = false,
  ) {
    function shouldApplyOption(optionId: string) {
      return !onlyParticipationResults || participationResults.has(optionId);
    }

    setAuctionOptions((currentOptions) =>
      currentOptions.map((option) => {
        if (!shouldApplyOption(option.id)) {
          return option;
        }

        const apiResult = participationResults.get(option.id);
        const bidAmount =
          apiResult?.bidAmount ?? Number(bidAmounts[option.id] ?? 0);

        if (bidAmount <= priceToNumber(getBidBaseline(option))) {
          return option;
        }

        const previousBidAmount = myBids[option.id] ?? 0;

        return {
          ...option,
          currentBid: formatPrice(bidAmount),
          participantCount:
            previousBidAmount > 0
              ? option.participantCount
              : option.participantCount + 1,
          myBidAmount: bidAmount,
          myParticipationId:
            apiResult?.participationId ?? option.myParticipationId,
          topBids: buildTopBids(option, bidAmount, previousBidAmount),
        };
      }),
    );
    setMyBids((current) => {
      const nextBids = { ...current };

      auctionOptions.forEach((option) => {
        if (!shouldApplyOption(option.id)) {
          return;
        }

        const apiResult = participationResults.get(option.id);
        const bidAmount =
          apiResult?.bidAmount ?? Number(bidAmounts[option.id] ?? 0);

        if (bidAmount > priceToNumber(getBidBaseline(option))) {
          nextBids[option.id] = bidAmount;
        }
      });

      return nextBids;
    });
    setBidAmounts((current) => {
      if (!onlyParticipationResults) {
        return {};
      }

      const nextAmounts = { ...current };

      participationResults.forEach((_, optionId) => {
        delete nextAmounts[optionId];
      });

      return nextAmounts;
    });
  }

  async function handleSubmitBids() {
    if (isBidSubmitPending) {
      return;
    }

    const submittedBids = auctionOptions
      .map((option) => ({
        bidAmount: Number(bidAmounts[option.id] ?? 0),
        option,
      }))
      .filter(
        ({ bidAmount, option }) =>
          bidAmount > priceToNumber(getBidBaseline(option)),
      );

    if (submittedBids.length === 0) {
      return;
    }

    const participationResults = new Map<
      string,
      { bidAmount: number; participationId: string }
    >();

    if (product.isApiProduct) {
      setIsBidSubmitPending(true);

      const accessToken = authState.accessToken;

      if (!authState.isLoggedIn || !accessToken) {
        const returnHref = `/products/${encodeURIComponent(buncheolId)}`;
        setIsBidSubmitPending(false);
        router.push(`/login?returnTo=${encodeURIComponent(returnHref)}`);
        return;
      }

      let nextBidDeliveryAddress = bidDeliveryAddress;

      if (!nextBidDeliveryAddress) {
        try {
          const addresses = await requestShippingAddresses(accessToken);
          const nextAddressState =
            getDeliveryAddressStateFromSyncedAddresses(addresses);

          writeDeliveryAddressState(nextAddressState);
          nextBidDeliveryAddress = getBidDeliveryAddress(
            nextAddressState,
            product,
          );
        } catch {
          nextBidDeliveryAddress = null;
        }
      }

      const shippingAddressId = Number(nextBidDeliveryAddress?.id);

      if (!Number.isFinite(shippingAddressId)) {
        window.alert("입찰하려면 배송지를 먼저 등록해 주세요.");
        setIsBidSubmitPending(false);
        router.push("/profile/addresses?openAdd=1");
        return;
      }

      try {
        for (const { bidAmount, option } of submittedBids) {
          const buncheolMemberId = Number(option.buncheolMemberId ?? option.id);

          if (!Number.isFinite(buncheolMemberId)) {
            throw new Error("입찰할 멤버 정보를 확인하지 못했어요.");
          }

          const result = await participateBuncheol(accessToken, buncheolId, {
            bidAmount,
            buncheolMemberId,
            shippingAddressId,
          });

          participationResults.set(option.id, {
            bidAmount: result.bidAmount,
            participationId: result.participationId,
          });
        }
      } catch (error: unknown) {
        if (participationResults.size > 0) {
          applySubmittedBidState(participationResults, true);
        }

        window.alert(
          error instanceof Error ? error.message : "입찰을 등록하지 못했어요.",
        );
        setIsBidSubmitPending(false);
        return;
      }
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
    };
  }, []);

  function handleBack() {
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
      window.sessionStorage.setItem("skip-profile-enter-animation", "true");
    } else {
      window.sessionStorage.removeItem("skip-profile-enter-animation");
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
    if (sheetCloseFallbackTimerRef.current !== null) {
      window.clearTimeout(sheetCloseFallbackTimerRef.current);
      sheetCloseFallbackTimerRef.current = null;
    }

    setIsSheetOpen(true);
    setIsSheetClosing(false);

    sheetEnterAnimationFrameRef.current = window.requestAnimationFrame(() => {
      sheetEnterAnimationFrameRef.current = null;
      setIsSheetEntered(true);
    });
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
            <button
              type="button"
              className="product-detail-action inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black"
              aria-label="찜하기"
            >
              <HeartIcon filled={product.liked} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto pb-32">
          <section className="px-4">
            <div
              className={`product-detail-media relative aspect-[4/3] overflow-hidden rounded-[1.35rem] bg-gradient-to-br ${product.tone}`}
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
                      {productImages.map((imageUrl) => (
                        <div
                          className="h-full w-full shrink-0 overflow-hidden"
                          key={imageUrl}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt=""
                            className="h-full w-full object-cover"
                            draggable={false}
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
              <div className="rounded-[0.9rem] border border-black/10 px-4 py-3">
                <p className="text-[12px] font-medium text-black/45">입찰 기한</p>
                <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                  {product.deadline}
                </p>
              </div>
              <div className="rounded-[0.9rem] border border-black/10 px-4 py-3">
                <p className="text-[12px] font-medium text-black/45">발송 기한</p>
                <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                  {product.shippingDeadline ?? "마감 후 7일 이내"}
                </p>
              </div>
            </div>

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

            <div className="mt-8 border-t border-black/10 pt-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                상품 설명
              </h2>
              <p className="mt-3 text-[15px] leading-7 tracking-[-0.04em] text-black/65">
                {product.description}
              </p>
            </div>

            <div className="mt-8 border-t border-black/10 pt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                  내 입찰 현황
                </h2>
                <span className="text-[13px] font-medium text-black/45">
                  {myBidItems.length}개 참여
                </span>
              </div>

              {myBidItems.length > 0 ? (
                <div className="mt-4 grid gap-3">
                  {myBidItems.map(({ amount, option, rank }) => (
                    <div
                      key={option.id}
                      className="rounded-[0.9rem] border border-black/10 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${
                              option.avatarTone ??
                              "from-zinc-100 via-white to-zinc-400"
                            } text-[12px] font-semibold tracking-[-0.04em] text-black ring-1 ring-black/10`}
                          >
                            {option.avatarInitials ?? option.label.slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                              {option.label}
                            </p>
                            <p className="mt-1 text-[13px] font-medium text-black/45">
                              현재 {rank}등
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[15px] font-semibold tracking-[-0.04em]">
                            {formatPrice(amount)}
                          </p>
                          <button
                            type="button"
                            className="mt-2 text-[13px] font-semibold text-black/45 disabled:text-black/25"
                            disabled={withdrawingOptionId === option.id}
                            onClick={() => void withdrawBid(option.id)}
                          >
                            철회
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-5">
                  <p className="text-[14px] font-medium tracking-[-0.04em] text-black/45">
                    아직 등록한 입찰이 없습니다.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 border-t border-black/10 pt-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                옵션별 가격 TOP 3
              </h2>
              <div className="mt-4 grid gap-3">
                {auctionOptions.map((option) => (
                  <div
                    key={option.id}
                    className="rounded-[0.9rem] border border-black/10 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${
                            option.avatarTone ??
                            "from-zinc-100 via-white to-zinc-400"
                          } text-[12px] font-semibold tracking-[-0.04em] text-black ring-1 ring-black/10`}
                        >
                          {option.avatarInitials ?? option.label.slice(0, 2)}
                        </div>
                        <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                          {option.label}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12px] font-medium text-black/45">
                        참여 {option.participantCount}명
                      </span>
                    </div>
                    <div className="relative mt-3">
                      <div
                        className={`grid grid-cols-3 gap-2 ${
                          hasOptionBids(option) ? "" : "opacity-55"
                        }`}
                      >
                        {getTopBids(option).map((bid, index) => (
                          <div
                            key={`${option.id}-${index}`}
                            className="rounded-[0.7rem] bg-[#f7f7f7] px-3 py-2"
                          >
                            <p className="text-[11px] font-semibold text-black/35">
                              TOP {index + 1}
                            </p>
                            <p className="mt-1 text-[13px] font-semibold tracking-[-0.04em]">
                              {bid}
                            </p>
                          </div>
                        ))}
                      </div>

                      {!hasOptionBids(option) ? (
                        <div className="absolute inset-0 flex items-center justify-center rounded-[0.75rem] bg-white/25">
                          <div className="rounded-full bg-black px-3 py-1.5 text-[12px] font-semibold tracking-[-0.04em] text-white shadow-[0_8px_20px_rgba(0,0,0,0.16)]">
                            입찰 시작가 {getStartingBid(option)}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="product-detail-bid-bar absolute bottom-0 left-0 right-0 bg-white px-5 pb-5 pt-3 shadow-[0_-12px_34px_rgba(0,0,0,0.08)]">
          <button
            type="button"
            className="h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-white"
            onClick={openSheet}
          >
            입찰하기
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
                    입찰 옵션
                  </h2>
                  <p className="mt-1 text-[13px] font-medium text-black/45">
                    옵션별 현재 최고가를 확인하고 입찰가를 등록해 주세요.
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

              <div className="mt-5 max-h-[34dvh] space-y-3 overflow-y-auto pr-1 [touch-action:pan-y]">
                {sortedAuctionOptions.map((option) => {
                  const myBid = myBids[option.id];

                  return (
                    <div
                      key={option.id}
                      className={`rounded-[0.9rem] border px-4 py-3 ${
                        myBid
                          ? "border-black bg-[#f2f2f0]"
                          : "border-black/10 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${
                              option.avatarTone ??
                              "from-zinc-100 via-white to-zinc-400"
                            } text-[13px] font-semibold tracking-[-0.04em] text-black ring-1 ring-black/10`}
                          >
                            {option.avatarInitials ?? option.label.slice(0, 2)}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                                {option.label}
                              </p>
                              {myBid ? (
                                <span className="shrink-0 rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold text-white">
                                  입찰중
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[13px] font-medium tracking-[-0.04em] text-black/45">
                              {myBid
                                ? `내 입찰가 ${formatPrice(myBid)}`
                                : `참여 ${option.participantCount}명`}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[12px] font-medium text-black/45">
                            {getOptionPriceLabel(option)}
                          </p>
                          <p className="mt-1 text-[15px] font-semibold tracking-[-0.04em]">
                            {getBidBaseline(option)}
                          </p>
                        </div>
                      </div>

                      <label
                        className={`mt-3 flex h-12 items-center rounded-[0.8rem] border px-3 focus-within:border-black ${
                          myBid
                            ? "border-black/15 bg-white"
                            : "border-black/10 bg-[#f7f7f7]"
                        }`}
                      >
                        <input
                          className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-black/30"
                          inputMode="numeric"
                          min={
                            priceToNumber(
                              getBidBaseline(option),
                            ) + 100
                          }
                          onChange={(event) =>
                            updateBidAmount(option.id, event.currentTarget.value)
                          }
                          placeholder={`${formatPrice(
                            priceToNumber(
                              getBidBaseline(option),
                            ) + 100,
                          )} 이상`}
                          type="number"
                          value={bidAmounts[option.id] ?? ""}
                        />
                        <span className="text-[14px] font-semibold text-black/45">
                          원
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-black/10 pt-4">
                <span className="text-[14px] font-medium text-black/45">
                  입찰 옵션 {activeBidCount}개
                </span>
                <span className="text-[22px] font-semibold tracking-[-0.05em]">
                  {formatPrice(totalBidAmount)}
                </span>
              </div>

              <button
                type="button"
                className="mt-4 h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-white disabled:bg-black/20"
                disabled={activeBidCount === 0 || isBidSubmitPending}
                onClick={() => void handleSubmitBids()}
              >
                입찰가 등록하기
              </button>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
