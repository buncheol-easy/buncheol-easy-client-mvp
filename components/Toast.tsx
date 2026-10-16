"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_DURATION_MS = 3200;
// 복사 확인·입력칸 옆 안내처럼 사용자가 이미 그 자리를 보고 있을 때 쓴다.
export const BRIEF_TOAST_DURATION_MS = 1800;

type ToastProps = {
  // 띠 모양은 여기서 정한다. 호출부는 어디에 띄울지(위치·z-index)만 넘긴다.
  className?: string;
  message: string | null | undefined;
};

export function Toast({ className = "", message }: ToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div className={`pointer-events-none flex justify-center ${className}`}>
      <p
        aria-live="polite"
        className="soft-panel-enter max-w-full break-keep rounded-full bg-black/92 px-4 py-3 text-center text-[12px] font-semibold tracking-[-0.04em] text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
        role="status"
      >
        {message}
      </p>
    </div>
  );
}

export function useToast<T = string>(durationMs = TOAST_DURATION_MS) {
  const [toast, setToast] = useState<T | null>(null);
  const timerRef = useRef<number | null>(null);

  const hideToast = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setToast(null);
  }, []);

  const showToast = useCallback(
    (next: T) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      setToast(next);
      timerRef.current = window.setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return [toast, showToast, hideToast] as const;
}
