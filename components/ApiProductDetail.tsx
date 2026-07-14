"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ProductDetail,
  ProductReturnUnderlay,
} from "@/components/ProductDetail";
import { trackEvent } from "@/lib/analytics";
import type { ProductCardItem } from "@/components/ProductCard";
import {
  requestBuncheolDetail,
  requestBuncheolManagement,
  requestMyHostedBuncheols,
  toProductDetailItem,
  type BuncheolManagementOption,
} from "@/lib/auth-api";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import { readUploadedProduct } from "@/lib/hosted-products-store";
import { readPublicBuncheolCard } from "@/lib/public-buncheol-card-store";
import type { ProductDetailItem, ProductOption } from "@/lib/mock-products";

type ApiProductDetailProps = {
  id: string;
  isHostedView?: boolean;
  returnQuery?: string;
  returnSource?: "home" | "profile" | "bids" | "favorites" | "upload";
};

function isInactivePurchaseStatus(status: string | undefined) {
  return [
    "CANCELLED",
    "CANCELED",
    "EXPIRED",
    "FAILED",
    "REFUNDED",
    "REJECTED",
  ].includes(status?.toUpperCase() ?? "");
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
    (item) => !isInactivePurchaseStatus(item.status),
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
  options: [ProductOption, ...ProductOption[]],
  managementOptions: BuncheolManagementOption[],
): [ProductOption, ...ProductOption[]] {
  const optionsById = new Map(
    managementOptions.map((option) => [option.buncheolMemberId, option]),
  );
  const optionsByName = new Map(
    managementOptions.map((option) => [option.memberName, option]),
  );
  const mergedOptions = options.map((option) => {
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

  return mergedOptions as [ProductOption, ...ProductOption[]];
}

function toPublicPreviewProduct(
  item: ProductCardItem,
  requiresLogin: boolean,
): ProductDetailItem {
  const productId = item.productId ?? item.id;
  const optionLabel = item.member || item.targetMembers?.[0] || "옵션";
  const lockedLabel = requiresLogin ? "로그인 후 확인" : "확인 필요";

  return {
    ...item,
    id: productId,
    productId,
    buncheolId: productId,
    courier: lockedLabel,
    description: requiresLogin
      ? "로그인 후 구매와 상세 정보를 확인할 수 있어요."
      : "목록에 공개된 분철 정보를 표시하고 있어요.",
    isApiProduct: true,
    isBidUnavailable: false,
    isPublicPreview: requiresLogin,
    options: [
      {
        currentBid: item.price ?? "-",
        id: `${productId}-public-preview`,
        label: optionLabel,
        participantCount: Number(item.reviews) || 0,
        price: item.price ?? "-",
        startingBid: item.price ?? "-",
        topBids: ["-", "-", "-"],
      },
    ],
    purchaseSource: lockedLabel,
    shippingMethods: [{ name: lockedLabel, price: "-" }],
    status: requiresLogin ? "PUBLIC_PREVIEW" : "RECRUITING",
  };
}

export function ApiProductDetail({
  id,
  isHostedView = false,
  returnQuery,
  returnSource,
}: ApiProductDetailProps) {
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const [product, setProduct] = useState<ProductDetailItem | null>(null);
  const [message, setMessage] = useState("분철 정보를 불러오고 있습니다.");
  // 같은 분철을 볼 때 토큰 갱신 등으로 effect가 재실행돼도 조회 이벤트는 1회만 발사.
  const viewedBuncheolIdRef = useRef<string | null>(null);

  useEffect(() => {
    const requiresLogin = !authState.isLoggedIn;
    const accessToken = authState.isLoggedIn
      ? authState.accessToken ?? undefined
      : undefined;
    const publicCard = readPublicBuncheolCard(id);

    if (!id) {
      const frame = window.requestAnimationFrame(() => {
        setProduct(null);
        setMessage("분철 정보를 확인할 수 없어요.");
      });

      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    let isActive = true;

    const loadingFrame = window.requestAnimationFrame(() => {
      if (isActive) {
        setMessage("분철 정보를 불러오고 있습니다.");
      }
    });

    requestBuncheolDetail(accessToken, id)
      .then(async (detail) => {
        if (!isActive) {
          return;
        }

        let detailProduct = toProductDetailItem(detail);
        const cachedProduct = readUploadedProduct(id);
        const cachedImageUrls = cachedProduct?.imageUrls?.length
          ? cachedProduct.imageUrls
          : cachedProduct?.imageUrl
            ? [cachedProduct.imageUrl]
            : [];

        if (
          cachedImageUrls.length > 0 &&
          !detailProduct.imageUrl &&
          (detailProduct.imageUrls?.length ?? 0) === 0
        ) {
          detailProduct = {
            ...detailProduct,
            imageUrl: cachedImageUrls[0],
            imageUrls: cachedImageUrls,
          };
        }

        const detailHostedByMe = detailProduct.isHostedByMe === true;
        let isHostedByMe = detailHostedByMe;
        const shouldVerifyHostedOwnership =
          !isHostedByMe &&
          Boolean(accessToken) &&
          (isHostedView || detailProduct.isHostedByMe === undefined);

        if (shouldVerifyHostedOwnership && accessToken) {
          try {
            const hostedBuncheols = await requestMyHostedBuncheols(accessToken);
            isHostedByMe = hostedBuncheols.some(
              (buncheol) => String(buncheol.id) === String(id),
            );
          } catch {
            isHostedByMe = detailHostedByMe;
          }
        }

        if ((isHostedByMe || isHostedView) && accessToken) {
          try {
            const managementDetail = await requestBuncheolManagement(
              accessToken,
              id,
            );
            detailProduct = {
              ...detailProduct,
              options: mergeManagementOptionPurchaseStates(
                detailProduct.options,
                managementDetail.options,
              ),
            };
          } catch {
            // The public detail is still usable if host-only management data is unavailable.
          }
        }

        if (!isActive) {
          return;
        }

        setProduct({
          ...detailProduct,
          isHostedByMe,
        });
        setMessage("");

        if (viewedBuncheolIdRef.current !== id) {
          viewedBuncheolIdRef.current = id;
          trackEvent("buncheol_viewed", { buncheol_id: id });
        }
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        if (publicCard) {
          setProduct(toPublicPreviewProduct(publicCard, requiresLogin));
          setMessage("");
          return;
        }

        setProduct(null);
        setMessage(
          error instanceof Error
            ? error.message
            : "분철 정보를 불러오지 못했어요.",
        );
      });

    return () => {
      isActive = false;
      window.cancelAnimationFrame(loadingFrame);
    };
  }, [authState.accessToken, authState.isLoggedIn, id, isHostedView]);

  if (!product) {
    return (
      <ProductDetailLoadingShell
        message={message}
        returnQuery={returnQuery}
        returnSource={returnSource}
      />
    );
  }

  return (
    <ProductDetail
      backHref={returnSource ? undefined : "/"}
      initialReturnQuery={returnQuery}
      initialReturnSource={returnSource}
      product={product}
      startEntered
    />
  );
}

// 상세 데이터를 불러오는 동안에도 전환 레이아웃(언더레이 + 슬라이드 패널)을
// 유지해, 라우트 전환 순간 하단 내비게이션이 사라졌다 나타나는 깜빡임을 막는다.
// 패널 슬라이드 인은 이 셸이 담당하고, ProductDetail은 startEntered로 이어받는다.
function ProductDetailLoadingShell({
  message,
  returnQuery,
  returnSource,
}: {
  message: string;
  returnQuery?: string;
  returnSource?: "home" | "profile" | "bids" | "favorites" | "upload";
}) {
  const [isEntered, setIsEntered] = useState(false);

  useEffect(() => {
    const enterAnimationFrame = window.requestAnimationFrame(() => {
      setIsEntered(true);
    });

    return () => {
      window.cancelAnimationFrame(enterAnimationFrame);
    };
  }, []);

  return (
    <main className="product-detail-shell system-chrome-white system-chrome-bottom-white relative h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]">
      <ProductReturnUnderlay
        isEntered={isEntered}
        isExiting={false}
        returnQuery={returnQuery}
        returnSource={returnSource}
      />
      <div
        className={`product-page-panel relative mx-auto flex h-full w-full max-w-[430px] flex-col items-center justify-center overflow-hidden bg-white px-6 ${
          isEntered ? "product-page-active" : ""
        }`}
      >
        <p className="text-center text-[15px] font-semibold text-black/45">
          {message}
        </p>
      </div>
    </main>
  );
}
