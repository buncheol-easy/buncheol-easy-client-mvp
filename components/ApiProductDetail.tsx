"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ProductDetail } from "@/components/ProductDetail";
import {
  requestBuncheolDetail,
  toProductDetailItem,
} from "@/lib/auth-api";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import type { ProductDetailItem } from "@/lib/mock-products";

type ApiProductDetailProps = {
  id: string;
  returnQuery?: string;
  returnSource?: "home" | "profile" | "bids" | "favorites" | "upload";
};

export function ApiProductDetail({
  id,
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

  useEffect(() => {
    if (!id) {
      const frame = window.requestAnimationFrame(() => {
        setProduct(null);
        setMessage("분철 정보를 확인할 수 없어요.");
      });

      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    const accessToken = authState.isLoggedIn
      ? authState.accessToken ?? undefined
      : undefined;
    let isActive = true;

    const loadingFrame = window.requestAnimationFrame(() => {
      if (isActive) {
        setMessage("분철 정보를 불러오고 있습니다.");
      }
    });

    requestBuncheolDetail(accessToken, id)
      .then((detail) => {
        if (!isActive) {
          return;
        }

        setProduct(toProductDetailItem(detail));
        setMessage("");
      })
      .catch((error: unknown) => {
        if (!isActive) {
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
  }, [authState.accessToken, authState.isLoggedIn, id]);

  if (!product) {
    return (
      <main className="system-chrome-white system-chrome-bottom-white flex h-[100dvh] items-center justify-center bg-white px-6 text-center">
        <p className="text-[15px] font-semibold text-black/45">{message}</p>
      </main>
    );
  }

  return (
    <ProductDetail
      backHref={returnSource ? undefined : "/"}
      initialReturnQuery={returnQuery}
      initialReturnSource={returnSource}
      product={product}
    />
  );
}
