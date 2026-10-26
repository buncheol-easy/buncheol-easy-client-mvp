"use client";

import Image from "next/image";
import { type ComponentProps, useState } from "react";
import { isOptimizableImageSrc } from "@/lib/optimizable-image";

type ProductPhotoProps = Omit<
  ComponentProps<typeof Image>,
  "fill" | "height" | "onError" | "sizes" | "src" | "unoptimized" | "width"
> & {
  /** 원본 주소까지 실패했을 때만 불린다. */
  onError?: () => void;
  sizes: string;
  src: string;
};

/**
 * 부모 칸을 채우는(fill) 사진. 부모에 position(relative 등)이 있어야 한다.
 * 허용 목록 밖 주소는 원본을 그리고, 변환 주소가 실패하면 원본 주소로 한 번 더 그린다 —
 * 사진이 아예 안 보이는 일을 만들지 않는다.
 */
export function ProductPhoto({
  alt,
  onError,
  sizes,
  src,
  ...imageProps
}: ProductPhotoProps) {
  const [failedOptimizedSrc, setFailedOptimizedSrc] = useState<string | null>(
    null,
  );
  const shouldOptimize =
    failedOptimizedSrc !== src && isOptimizableImageSrc(src);

  return (
    <Image
      {...imageProps}
      alt={alt}
      fill
      onError={() => {
        if (shouldOptimize) {
          setFailedOptimizedSrc(src);
          return;
        }

        onError?.();
      }}
      sizes={sizes}
      src={src}
      unoptimized={!shouldOptimize}
    />
  );
}
