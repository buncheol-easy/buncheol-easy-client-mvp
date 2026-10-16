"use client";

import { useEffect, useRef, useState } from "react";

const COPIED_STATE_MS = 2000;

type CopyButtonProps = {
  className?: string;
  copiedLabel?: string;
  disabled?: boolean;
  label: string;
  onCopyFailed?: () => void;
  value: string;
  variant?: "soft" | "dark";
};

export function CopyButton({
  className = "",
  copiedLabel = "복사했어요",
  disabled = false,
  label,
  onCopyFailed,
  value,
  variant = "soft",
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);
  const isMountedRef = useRef(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      onCopyFailed?.();
      return;
    }

    if (!isMountedRef.current) {
      return;
    }

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    // 같은 상태를 다시 켜면 고리 애니메이션이 다시 돌지 않는다 — 한 프레임 껐다 켠다.
    setIsCopied(false);
    window.requestAnimationFrame(() => {
      if (isMountedRef.current) {
        setIsCopied(true);
      }
    });
    resetTimerRef.current = window.setTimeout(() => {
      setIsCopied(false);
      resetTimerRef.current = null;
    }, COPIED_STATE_MS);
  }

  return (
    <>
      <button
        aria-label={label}
        className={`copy-button copy-button--${variant} ${className}`}
        data-copied={isCopied}
        disabled={disabled}
        onClick={() => void handleClick()}
        type="button"
      >
        <span aria-hidden="true" className="copy-button-icon">
          <svg className="copy-button-copy" viewBox="0 0 14 14">
            <rect height="7.6" rx="1.8" width="7.6" x="4.2" y="4.2" />
            <path d="M9.6 2.4H3.6a1.4 1.4 0 0 0-1.4 1.4v6" />
          </svg>
          <svg className="copy-button-check" viewBox="0 0 14 14">
            <path d="M2.6 7.4l2.9 2.9 5.9-6.1" />
          </svg>
        </span>
        <span aria-hidden="true" className="copy-button-label">
          <span data-active={!isCopied}>{label}</span>
          <span data-active={isCopied}>{copiedLabel}</span>
        </span>
      </button>
      <span aria-live="polite" className="sr-only">
        {isCopied ? copiedLabel : ""}
      </span>
    </>
  );
}
