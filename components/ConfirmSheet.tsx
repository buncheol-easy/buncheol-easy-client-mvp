"use client";

import { useEffect, useState } from "react";

export type ConfirmSheetRequest = {
  confirmLabel: string;
  description?: string;
  onConfirm: () => void;
  title: string;
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
  cancelLabel = "아니요",
  onCancel,
  request,
}: ConfirmSheetProps) {
  const [isEntered, setIsEntered] = useState(false);
  const isOpen = request !== null;

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
  }, [isOpen]);

  if (!request) {
    return null;
  }

  return (
    // 결제 정보 시트(z-40)·배송지 시트(z-50) 위에서도 열릴 수 있어 z-[60].
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
        className={`bid-sheet-panel relative mx-auto w-full max-w-[430px] rounded-t-[1.4rem] bg-white px-5 pb-6 pt-4 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
          isEntered ? "bid-sheet-panel-active" : ""
        }`}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
        <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
          {request.title}
        </h2>
        {request.description ? (
          <p className="mt-2 whitespace-pre-line text-[13px] font-medium leading-5 text-black/50">
            {request.description}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            className="h-12 rounded-full bg-[#f3f3f3] text-[15px] font-semibold tracking-[-0.04em] text-black/60"
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className="h-12 rounded-full bg-black text-[15px] font-semibold tracking-[-0.04em] text-[#D7FF5F]"
            onClick={request.onConfirm}
            type="button"
          >
            {request.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
