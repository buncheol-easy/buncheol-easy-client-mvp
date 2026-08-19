"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CloseIcon } from "@/components/icons";
import { trackEvent } from "@/lib/analytics";
import { submitFeedback } from "@/lib/auth-api";
import { getFreshAccessToken } from "@/lib/auth-session";
import { readAuthState } from "@/lib/auth-store";

const SHEET_CLOSE_MS = 280;
const MAX_CONTENT_LENGTH = 500;

type FeedbackSheetProps = {
  onClose: () => void;
};

// "의견 보내기" 바텀시트. 배송비 돌려받기 시트와 동일한 bid-sheet-backdrop/panel +
// enter/close 트랜지션 컨벤션을 따른다. 답장 없는 단방향 수집이라 연락처는 받지 않는다.
export function FeedbackSheet({ onClose }: FeedbackSheetProps) {
  const pathname = usePathname();
  const [isEntered, setIsEntered] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [content, setContent] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const trimmedContent = content.trim();
  const canSubmit = trimmedContent.length > 0 && !isSubmitting;

  useEffect(() => {
    const enterFrame = window.requestAnimationFrame(() => {
      setIsEntered(true);
    });

    return () => {
      window.cancelAnimationFrame(enterFrame);

      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function closeSheet() {
    if (isClosing) {
      return;
    }

    setIsClosing(true);
    // onTransitionEnd 가 유실되는 환경(백그라운드 탭 등) 대비 타이머 fallback.
    closeTimerRef.current = window.setTimeout(onClose, SHEET_CLOSE_MS);
  }

  async function submit() {
    if (!canSubmit) {
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);

    try {
      // 비로그인도 남길 수 있어야 하므로 토큰이 없어도 그대로 진행한다.
      const accessToken = readAuthState().isLoggedIn
        ? await getFreshAccessToken()
        : null;

      await submitFeedback(accessToken, trimmedContent, pathname ?? undefined);
      trackEvent("feedback_submitted", {
        content_length: trimmedContent.length,
        is_logged_in: accessToken !== null,
        screen_path: pathname ?? null,
      });
      setIsSubmitted(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "의견을 보내지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className={`bid-sheet-backdrop fixed inset-0 z-40 flex items-end ${
        isEntered && !isClosing ? "bid-sheet-backdrop-active" : ""
      }`}
    >
      <button
        aria-label="의견 보내기 닫기"
        className="absolute inset-0 cursor-default"
        onClick={closeSheet}
        type="button"
      />
      <section
        className={`bid-sheet-panel relative mx-auto flex max-h-[calc(100%-2.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[1.4rem] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
          isEntered && !isClosing ? "bid-sheet-panel-active" : ""
        }`}
        onTransitionEnd={(event) => {
          if (
            isClosing &&
            event.currentTarget === event.target &&
            event.propertyName === "transform"
          ) {
            onClose();
          }
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[21px] font-semibold tracking-[-0.06em]">
              의견 보내기
            </h2>
            <p className="mt-1 text-[13px] font-medium text-black/45">
              {isSubmitted
                ? "소중한 의견 고맙습니다."
                : "불편했던 점이나 아쉬운 점을 남겨주세요."}
            </p>
          </div>
          <button
            aria-label="닫기"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
            onClick={closeSheet}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        {isSubmitted ? (
          <div className="flex flex-col items-center gap-3.5 px-2 pb-3 pt-8 text-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#DDE7B8]">
              <svg
                aria-hidden="true"
                fill="none"
                height="30"
                stroke="#111"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.6"
                viewBox="0 0 24 24"
                width="30"
              >
                <path d="M4.5 12.5l5 5 10-11" />
              </svg>
            </span>
            <h3 className="text-[19px] font-semibold tracking-[-0.05em]">
              잘 받았어요
            </h3>
            <p className="text-[13.5px] font-medium leading-6 text-black/45">
              남겨주셔서 고맙습니다.
              <br />
              꼼꼼히 읽고 서비스에 반영할게요.
            </p>
            <button
              className="mt-2 h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-[#D7FF5F] shadow-[0_12px_24px_rgba(0,0,0,0.18)]"
              onClick={closeSheet}
              type="button"
            >
              닫기
            </button>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 sheet-scroll">
              <div className="mt-5 rounded-[0.9rem] border border-[#DDE7B8] bg-[#F7FAEE] px-4 py-3">
                <p className="text-[12px] font-semibold text-black/40">
                  먼저 알려드려요
                </p>
                <p className="mt-1.5 text-[13px] font-medium leading-5 text-black/60">
                  답장은 따로 드리지 않지만, 남겨주신 의견은 전부 읽고 반영하고
                  있어요. 급한 문의는 고객센터로 연락 주세요.
                </p>
              </div>

              <div className="mt-4">
                <label
                  className="block text-[13px] font-semibold text-black/55"
                  htmlFor="feedback-content"
                >
                  어떤 점이 불편하셨나요?
                </label>
                <textarea
                  className="mt-2 block h-32 w-full resize-none rounded-[0.85rem] border border-black/12 px-4 py-3 text-[14px] font-medium leading-6 tracking-[-0.02em] outline-none transition-colors placeholder:text-black/30 focus:border-black/40"
                  id="feedback-content"
                  maxLength={MAX_CONTENT_LENGTH}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="예: 입금 계좌가 어디 있는지 못 찾겠어요"
                  value={content}
                />
                <p className="mt-1.5 text-right text-[12px] font-semibold tabular-nums text-black/35">
                  {content.length} / {MAX_CONTENT_LENGTH}
                </p>
              </div>

              {submitError ? (
                <p className="mt-2 rounded-[0.85rem] bg-[#fff2f2] px-4 py-3 text-[13px] font-semibold leading-5 text-[#c03131]">
                  {submitError}
                </p>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-black/10 bg-white pt-4">
              <button
                className="h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-[#D7FF5F] shadow-[0_12px_24px_rgba(0,0,0,0.18)] disabled:bg-black/20 disabled:text-white/70 disabled:shadow-none"
                disabled={!canSubmit}
                onClick={submit}
                type="button"
              >
                {isSubmitting ? "보내는 중…" : "보내기"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
