"use client";

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react";

// 안쪽 .skeleton-surface 칸마다 묶음 왼쪽에서 떨어진 거리를 넣어, 반짝임이 모든 칸을 같은 박자로 지나가게 한다.
export function SkeletonGroup({
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;

    if (!root) {
      return;
    }

    const syncOffsets = () => {
      const rootRect = root.getBoundingClientRect();

      root.style.setProperty("--skeleton-span", `${rootRect.width}px`);
      root.querySelectorAll<HTMLElement>(".skeleton-surface").forEach((cell) => {
        cell.style.setProperty(
          "--skeleton-x",
          `${cell.getBoundingClientRect().left - rootRect.left}px`,
        );
      });
    };

    syncOffsets();

    const resizeObserver = new ResizeObserver(syncOffsets);

    resizeObserver.observe(root);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  );
}
