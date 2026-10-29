import type { ReactNode } from "react";

export type StatusTagTone = "black" | "lime" | "grey" | "warning" | "extra" | "open";

// 점선 칩은 테두리 1px 만큼 안쪽 여백을 줄여 다른 칩과 높이를 맞춘다.
const STATUS_TAG_TONE_CLASS_NAMES: Record<StatusTagTone, string> = {
  black: "bg-black px-2.5 py-1 text-white",
  lime: "bg-brand-strong px-2.5 py-1 text-black",
  grey: "bg-surface-3 px-2.5 py-1 text-black/60",
  warning: "bg-warning-soft px-2.5 py-1 text-warning-ink",
  extra: "bg-brand-pale px-2.5 py-1 text-brand-ink ring-1 ring-inset ring-brand-soft",
  open: "border border-dashed border-brand-ink/60 bg-white px-[9px] py-[3px] text-brand-ink",
};

// 개최 관리 화면의 자리·참여자 상태 칩. 같은 상태는 자리 줄과 참여자 카드에서 같은 색이다.
export function StatusTag({
  children,
  tone,
}: {
  children: ReactNode;
  tone: StatusTagTone;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full text-[11px] font-semibold ${STATUS_TAG_TONE_CLASS_NAMES[tone]}`}
    >
      {children}
    </span>
  );
}
