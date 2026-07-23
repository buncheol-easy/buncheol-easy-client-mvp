"use client";

import { useEffect, useState } from "react";
import { ProductDetail } from "@/components/ProductDetail";
import { readUploadedProduct } from "@/lib/hosted-products-store";
import type { ProductDetailItem } from "@/lib/mock-products";

type UploadedProductDetailProps = {
  id: string;
  returnSource?: "home" | "bids" | "favorites" | "upload";
};

export function UploadedProductDetail({
  id,
  returnSource,
}: UploadedProductDetailProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [product, setProduct] = useState<ProductDetailItem | null>(null);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setProduct(readUploadedProduct(id));
      setIsLoaded(true);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [id]);

  if (!isLoaded) {
    return (
      <main className="system-chrome-white system-chrome-bottom-white flex h-[100dvh] items-center justify-center bg-white px-6 text-center text-[15px] font-semibold text-black/45">
        상품 정보를 불러오고 있습니다.
      </main>
    );
  }

  if (!product) {
    return (
      <main className="system-chrome-white system-chrome-bottom-white flex h-[100dvh] items-center justify-center bg-white px-6 text-center text-[15px] font-semibold text-black/45">
        생성된 상품 정보를 찾을 수 없습니다.
      </main>
    );
  }

  return (
    <ProductDetail
      backHref={returnSource ? undefined : "/"}
      initialReturnSource={returnSource}
      product={product}
    />
  );
}
