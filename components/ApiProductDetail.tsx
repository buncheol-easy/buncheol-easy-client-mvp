"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ProductDetail,
  ProductReturnUnderlay,
  productDetailShellClassName,
  productPagePanelClassName,
} from "@/components/ProductDetail";
import { trackEvent } from "@/lib/analytics";
import type { ProductCardItem } from "@/components/ProductCard";
import {
  requestBuncheolBookmarkStatus,
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
import {
  toProductCardPatch,
  updateCachedHomeListing,
} from "@/lib/home-listings-cache";
import { readUploadedProduct } from "@/lib/hosted-products-store";
import { readPublicBuncheolCard } from "@/lib/public-buncheol-card-store";
import type { ProductDetailItem, ProductOption } from "@/lib/mock-products";
import { useProfileCompletionGuard } from "@/lib/use-profile-completion-guard";

type ApiProductDetailProps = {
  id: string;
  isHostedView?: boolean;
  returnQuery?: string;
  returnSource?: "home" | "bids" | "favorites" | "upload";
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
  useProfileCompletionGuard();

  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const [product, setProduct] = useState<ProductDetailItem | null>(null);
  const [message, setMessage] = useState("분철 정보를 불러오고 있습니다.");
  const [isShellEntered, setIsShellEntered] = useState(false);
  // 로딩 패널의 슬라이드 인이 끝난 뒤에만 ProductDetail로 교체해,
  // 전환 도중 패널이 최종 위치로 스냅하는 점프를 막는다.
  const [isShellSettled, setIsShellSettled] = useState(false);
  const [isDetailExiting, setIsDetailExiting] = useState(false);

  useEffect(() => {
    const enterAnimationFrame = window.requestAnimationFrame(() => {
      setIsShellEntered(true);
    });
    // transitionend가 유실되는 환경(reduced motion 등) 대비 안전장치.
    const settleFallbackTimer = window.setTimeout(() => {
      setIsShellSettled(true);
    }, 450);

    return () => {
      window.cancelAnimationFrame(enterAnimationFrame);
      window.clearTimeout(settleFallbackTimer);
    };
  }, []);
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

    // 상세 응답에는 찜 여부가 없어 찜 목록 조회를 병렬로 띄워 보강한다.
    const bookmarkStatusPromise: Promise<boolean | undefined> = accessToken
      ? requestBuncheolBookmarkStatus(accessToken, id).catch(() => undefined)
      : Promise.resolve(undefined);

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

        if (detailProduct.liked === undefined) {
          const bookmarked = await bookmarkStatusPromise;

          detailProduct = {
            ...detailProduct,
            liked: bookmarked ?? publicCard?.liked,
          };
        }

        if (!isActive) {
          return;
        }

        // 방금 받은 최신 상세를 홈 목록 캐시의 해당 카드에 되써준다(write-back).
        // 뒤로가기 복귀 시 방금 상세에서 본 사실(마감 등)과 홈 카드가 어긋나 보이지 않게 한다.
        updateCachedHomeListing(
          id,
          toProductCardPatch({ ...detailProduct, isHostedByMe }),
        );

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

  // 셸(main)과 언더레이는 로딩 → 상세 전환 동안 계속 마운트를 유지한다.
  // 로딩 패널과 ProductDetail 패널만 교체되므로 언더레이 화면(홈 등)의
  // 데이터 fetch가 중복 실행되지 않고, 전환 애니메이션도 끊기지 않는다.
  return (
    <main className={productDetailShellClassName}>
      <ProductReturnUnderlay
        isEntered={isShellEntered}
        isExiting={isDetailExiting}
        returnQuery={returnQuery}
        returnSource={returnSource}
      />
      {product && isShellSettled ? (
        <ProductDetail
          backHref={
            returnSource || returnQuery !== undefined ? undefined : "/"
          }
          initialReturnQuery={returnQuery}
          initialReturnSource={returnSource}
          onExitingChange={setIsDetailExiting}
          product={product}
          renderShell={false}
          startEntered
        />
      ) : (
        <div
          className={`${productPagePanelClassName} items-center justify-center px-6 ${
            isShellEntered ? "product-page-active" : ""
          }`}
          onTransitionEnd={(event) => {
            if (
              event.currentTarget === event.target &&
              event.propertyName === "transform"
            ) {
              setIsShellSettled(true);
            }
          }}
        >
          <p className="text-center text-[15px] font-semibold text-black/45">
            {message}
          </p>
        </div>
      )}
    </main>
  );
}
