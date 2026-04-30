"use client";

import { useEffect, useState } from "react";
import { ProductDetail } from "@/components/ProductDetail";
import type { ProductDetailItem } from "@/lib/mock-products";

type UploadedProductDetailProps = {
  id: string;
};

export function UploadedProductDetail({ id }: UploadedProductDetailProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [product, setProduct] = useState<ProductDetailItem | null>(null);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const storedProduct = window.sessionStorage.getItem(
        `uploaded-product:${id}`,
      );

      if (!storedProduct) {
        setIsLoaded(true);
        return;
      }

      try {
        setProduct(JSON.parse(storedProduct) as ProductDetailItem);
      } catch {
        setProduct(null);
      }

      setIsLoaded(true);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [id]);

  if (!isLoaded) {
    return (
      <main className="flex h-[100dvh] items-center justify-center bg-white px-6 text-center text-[15px] font-semibold text-black/45">
        상품 정보를 불러오고 있습니다.
      </main>
    );
  }

  if (!product) {
    return (
      <main className="flex h-[100dvh] items-center justify-center bg-white px-6 text-center text-[15px] font-semibold text-black/45">
        생성된 상품 정보를 찾을 수 없습니다.
      </main>
    );
  }

  return <ProductDetail backHref="/" product={product} />;
}
