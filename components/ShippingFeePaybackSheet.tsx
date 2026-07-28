"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { getFreshAccessToken } from "@/lib/auth-session";
import {
  requestShippingFeePayback,
  type ShippingFeePaybackInfo,
} from "@/lib/auth-api";
import {
  buildReviewTweetIntentUrl,
  formatPaybackDeadlineNotice,
  isValidTweetUrl,
} from "@/lib/shipping-fee-payback";

const SHEET_CLOSE_MS = 280;

function formatPrice(price: number) {
  return `${price.toLocaleString("ko-KR")}원`;
}

export type ShippingFeePaybackSheetTarget = {
  participationId: string;
  // 분철별 인용 트윗(EVENT_TWEET_URL_BY_BUNCHEOL) 조회 키.
  buncheolId: string;
  title: string;
  optionLabel: string;
  shippingFee: number | null;
  payback: ShippingFeePaybackInfo | null;
};

type ShippingFeePaybackSheetProps = {
  target: ShippingFeePaybackSheetTarget;
  onClose: () => void;
  // 제출 성공 시 부모가 참여 목록을 낙관적으로 REQUESTED 로 갱신하고 완료 토스트를 띄운다.
  onRequested: (participationId: string, tweetUrl: string) => void;
};

// 오픈 이벤트 "배송비 돌려받기" 신청 바텀시트. 기존 결제 정보 시트와 동일한
// bid-sheet-backdrop/panel + enter/close 트랜지션 컨벤션을 컴포넌트 내부에 캡슐화한다
// (부모는 열 대상 participationId 하나만 관리).
export function ShippingFeePaybackSheet({
  target,
  onClose,
  onRequested,
}: ShippingFeePaybackSheetProps) {
  const [isEntered, setIsEntered] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  // 검수 전(REQUESTED) 링크 수정 모드면 제출해 둔 링크를 미리 채워 바로 고칠 수 있게 한다.
  const [tweetUrl, setTweetUrl] = useState(() =>
    target.payback?.status === "REQUESTED"
      ? target.payback?.tweetUrl ?? ""
      : "",
  );
  const [inputError, setInputError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRejected = target.payback?.status === "REJECTED";
  const isEditingSubmittedUrl = target.payback?.status === "REQUESTED";
  const refundAccount = target.payback?.refundAccount ?? null;
  // 신청 마감 안내. 제출한 링크 수정 모드(REQUESTED)는 이미 신청된 상태라 그리지 않는다.
  const submitDeadlineNotice =
    !isEditingSubmittedUrl && target.payback?.submitDeadline
      ? formatPaybackDeadlineNotice(target.payback.submitDeadline)
      : null;
  const paybackAmountLabel =
    target.shippingFee !== null ? formatPrice(target.shippingFee) : "배송비 전액";

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

  function openTweetComposer() {
    window.open(
      buildReviewTweetIntentUrl(target.title, target.buncheolId),
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function submitPaybackRequest() {
    const trimmedUrl = tweetUrl.trim();

    if (!isValidTweetUrl(trimmedUrl)) {
      setInputError(
        "트윗 링크 형식이 올바르지 않아요. 예: https://x.com/아이디/status/숫자",
      );
      return;
    }

    setInputError("");
    setSubmitError("");
    setIsSubmitting(true);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        setSubmitError("로그인이 만료됐어요. 다시 로그인해 주세요.");
        return;
      }

      await requestShippingFeePayback(
        accessToken,
        target.participationId,
        trimmedUrl,
      );
      onRequested(target.participationId, trimmedUrl);
      closeSheet();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "돌려받기 신청에 실패했어요. 잠시 후 다시 시도해 주세요.",
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
        aria-label="배송비 돌려받기 닫기"
        className="absolute inset-0 cursor-default"
        onClick={closeSheet}
        type="button"
      />
      <section
        className={`bid-sheet-panel relative mx-auto flex max-h-[calc(100dvh-2.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[1.4rem] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
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
              배송비 돌려받기
            </h2>
            <p className="mt-1 text-[13px] font-medium text-black/45">
              {isEditingSubmittedUrl
                ? "제출한 후기 링크를 확인하고 수정할 수 있어요."
                : "X에 후기를 올리고 링크를 제출하면 배송비를 돌려드려요."}
            </p>
            {submitDeadlineNotice ? (
              <p className="mt-0.5 text-[12px] font-medium text-black/35">
                {submitDeadlineNotice}
              </p>
            ) : null}
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="mt-5 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] font-semibold text-black/40">
                참여한 멤버
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold tracking-[-0.04em] text-black/65">
                {target.optionLabel}
              </span>
            </div>
          </div>

          {isRejected && target.payback?.rejectReason ? (
            <div className="mt-3 rounded-[0.9rem] border border-[#F3C1C1] bg-[#fff2f2] px-4 py-3">
              <p className="text-[12px] font-semibold text-[#c03131]">
                후기를 다시 확인해 주세요
              </p>
              <p className="mt-1 text-[13px] font-medium leading-5 text-black/60">
                {target.payback.rejectReason}
              </p>
              <p className="mt-1 text-[12px] font-medium text-black/40">
                후기를 수정하거나 새로 작성한 뒤 링크를 다시 제출하면 돼요.
              </p>
            </div>
          ) : null}

          <div className="mt-3 rounded-[0.9rem] border border-[#DDE7B8] bg-[#F7FAEE] px-4 py-3">
            <p className="text-[12px] font-semibold text-black/40">후기 조건</p>
            <ul className="mt-2 space-y-1.5 text-[13px] font-medium leading-5 text-black/60">
              <li>1. 아래 버튼으로 열리는 작성창에서 그대로 게시해 주세요.</li>
              <li>2. 이벤트 트윗 인용과 해시태그는 지우지 말아 주세요.</li>
              <li>3. 계정이 공개 상태여야 후기를 확인할 수 있어요.</li>
            </ul>
          </div>

          <button
            className="mt-3 h-12 w-full rounded-full bg-black text-[15px] font-semibold tracking-[-0.04em] text-[#D7FF5F] shadow-[0_10px_20px_rgba(0,0,0,0.16)]"
            onClick={openTweetComposer}
            type="button"
          >
            X에서 후기 쓰기
          </button>

          <div className="mt-4">
            <p className="text-[13px] font-semibold text-black/55">
              작성한 후기 트윗 링크
            </p>
            <input
              className={`mt-2 h-12 w-full rounded-[0.85rem] border px-4 text-[14px] font-medium tracking-[-0.02em] outline-none transition-colors ${
                inputError
                  ? "error-shake border-[#e08c8c] bg-[#fff2f2]"
                  : "border-black/12 bg-white focus:border-black/45"
              }`}
              inputMode="url"
              onChange={(event) => {
                setTweetUrl(event.target.value);

                if (inputError) {
                  setInputError("");
                }
              }}
              placeholder="https://x.com/아이디/status/..."
              type="url"
              value={tweetUrl}
            />
            {inputError ? (
              <p className="mt-2 text-[12px] font-semibold text-[#c03131]">
                {inputError}
              </p>
            ) : null}
          </div>

          <div className="mt-4 rounded-[0.9rem] border border-black/10 px-4 py-3">
            <p className="text-[12px] font-semibold text-black/40">
              돌려받을 계좌
            </p>
            {refundAccount ? (
              <>
                <p className="mt-1 truncate text-[15px] font-semibold tracking-[-0.04em]">
                  {`${refundAccount.bank} ${refundAccount.account}`.trim()}
                </p>
                <p className="mt-1 text-[12px] font-medium text-black/40">
                  예금주 {refundAccount.holder}
                </p>
              </>
            ) : (
              <p className="mt-1 text-[13px] font-medium leading-5 text-black/55">
                참여할 때 등록한 환불 계좌로 돌려드려요.
              </p>
            )}
            <p className="mt-2 text-[12px] font-medium leading-5 text-black/45">
              후기 확인이 끝나면 배송비 {paybackAmountLabel}을 위 계좌로 보내드려요.
              <br />
              계좌 정보 수정은 마이페이지에서 할 수 있어요.
            </p>
          </div>

          {submitError ? (
            <p className="mt-3 rounded-[0.85rem] bg-[#fff2f2] px-4 py-3 text-[13px] font-semibold leading-5 text-[#c03131]">
              {submitError}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-black/10 bg-white pt-4">
          <button
            className="h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-[#D7FF5F] shadow-[0_12px_24px_rgba(0,0,0,0.18)] disabled:bg-black/20 disabled:text-white/70"
            disabled={isSubmitting || tweetUrl.trim().length === 0}
            onClick={() => void submitPaybackRequest()}
            type="button"
          >
            {isSubmitting
              ? "제출 중..."
              : isEditingSubmittedUrl
              ? "후기 링크 수정하기"
              : isRejected
              ? "후기 다시 제출하기"
              : "돌려받기 신청"}
          </button>
        </div>
      </section>
    </div>
  );
}
