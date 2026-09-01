"use client";

import { useEffect, useRef, useState } from "react";

export type ConfirmSheetDetail = {
  label: string;
  value: string;
};

export type ConfirmSheetRequest = {
  cancelLabel?: string;
  confirmLabel: string;
  description?: string;
  // 라벨-값 목록. 되돌릴 수 없는 액션 직전에 "무엇을 확정하는지" 를 다시 보여주는 자리다.
  details?: ConfirmSheetDetail[];
  onConfirm: () => void;
  title: string;
  // 강조 경고. 마지막 줄만 굵게 — 되돌릴 수 없다는 사실이 목록에 묻히면 안 된다.
  warnings?: string[];
};

type ConfirmSheetProps = {
  cancelLabel?: string;
  onCancel: () => void;
  request: ConfirmSheetRequest | null;
};

// window.confirm 대체 확인 시트. 카카오·네이버 인앱 브라우저 등 일부 웹뷰는 confirm 을
// 억제하고 즉시 false 를 반환해, 되돌리기 어려운 액션(알림톡 발송·상태 일괄 전이)이
// 아예 실행 불가능해진다 — 앱 시트로 확인을 받으면 환경과 무관하게 동작한다.
export function ConfirmSheet({
  cancelLabel: fallbackCancelLabel = "아니요",
  onCancel,
  request,
}: ConfirmSheetProps) {
  const [isEntered, setIsEntered] = useState(false);
  // window.confirm 과 달리 논블로킹이라 빠른 더블탭이 onConfirm 을 두 번 태울 수 있다 —
  // 요청 단위 1회 실행 가드 (알림톡 발송 등 되돌릴 수 없는 액션의 이중 실행 방지).
  const hasConfirmedRef = useRef(false);
  const isOpen = request !== null;

  useEffect(() => {
    hasConfirmedRef.current = false;
  }, [request]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setIsEntered(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      setIsEntered(false);
    };
  }, [isOpen, request]);

  // 네이티브 confirm 처럼 Escape 로 닫을 수 있게 한다 (데스크톱·외장 키보드).
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!request) {
    return null;
  }

  const warnings = request.warnings ?? [];

  return (
    // 결제 정보 시트(z-40) 등 기존 시트 위에서도 열릴 수 있어 z-[60].
    // (호출 컴포넌트 루트에 transform 이 걸리면 fixed 기준이 그 컨테이너가 되는 것은
    //  기존 시트들과 동일한 제약이다.)
    <div
      className={`bid-sheet-backdrop fixed inset-0 z-[60] flex items-end ${
        isEntered ? "bid-sheet-backdrop-active" : ""
      }`}
    >
      <button
        aria-label="닫기"
        className="absolute inset-0 cursor-default"
        onClick={onCancel}
        type="button"
      />
      <section
        aria-labelledby="confirm-sheet-title"
        aria-modal="true"
        // 상세·경고가 붙으면 400px 안팎이 된다 — 가로 모드·인앱 웹뷰 상하단 바·폰트 확대가 겹치면
        // 위로 넘쳐 제목과 금액이 잘린다. 버튼은 스크롤 밖에 고정해 항상 닿게 둔다.
        className={`bid-sheet-panel relative mx-auto flex max-h-[calc(100%-2.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[1.4rem] bg-white px-5 pb-6 pt-4 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
          isEntered ? "bid-sheet-panel-active" : ""
        }`}
        role="dialog"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
        <div className="min-h-0 flex-1 overflow-y-auto">
        <h2
          className="text-[19px] font-semibold tracking-[-0.05em]"
          id="confirm-sheet-title"
        >
          {request.title}
        </h2>
        {request.description ? (
          <p className="mt-2 whitespace-pre-line text-[13px] font-medium leading-5 text-black/50">
            {request.description}
          </p>
        ) : null}
        {request.details?.length ? (
          <dl className="mt-4 space-y-2 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3.5">
            {request.details.map((detail, index) => (
              <div
                className="flex items-baseline justify-between gap-3"
                key={`${detail.label}-${index}`}
              >
                <dt className="shrink-0 text-[12px] font-medium text-black/40">
                  {detail.label}
                </dt>
                <dd className="min-w-0 break-words text-right text-[13px] font-semibold tracking-[-0.03em]">
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {warnings.length > 0 ? (
          <div className="mt-3 space-y-1">
            {warnings.map((warning, index) => (
              <p
                className={`text-[12px] leading-5 ${
                  index === warnings.length - 1
                    ? "font-semibold text-black/70"
                    : "font-medium text-black/45"
                }`}
                key={`${warning}-${index}`}
              >
                {warning}
              </p>
            ))}
          </div>
        ) : null}
        </div>
        <div className="mt-5 shrink-0 grid grid-cols-2 gap-2">
          <button
            className="h-12 rounded-full bg-[#f3f3f3] text-[15px] font-semibold tracking-[-0.04em] text-black/60"
            onClick={onCancel}
            type="button"
          >
            {request.cancelLabel ?? fallbackCancelLabel}
          </button>
          <button
            className="h-12 rounded-full bg-black text-[15px] font-semibold tracking-[-0.04em] text-[#D7FF5F]"
            onClick={() => {
              if (hasConfirmedRef.current) {
                return;
              }

              hasConfirmedRef.current = true;
              request.onConfirm();
            }}
            type="button"
          >
            {request.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
