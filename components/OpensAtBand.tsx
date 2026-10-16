import { ClockIcon } from "@/components/icons";
import { formatOpensAt } from "@/lib/buncheol-open-time";

type OpensAtBandSize = "wide" | "grid" | "detail";

type OpensAtBandProps = {
  nowMs: number;
  opensAtMs: number;
  size: OpensAtBandSize;
};

// 상세 띠는 높이를 고정한다. 사진 위 다른 요소(유리 상자, 장수 칩)를 띠 위로 올리는 기준이다.
const sizeClassNames: Record<
  OpensAtBandSize,
  { band: string; icon: string; sub: string }
> = {
  wide: {
    band: "gap-2 px-3.5 py-2.5 text-[15px] leading-5",
    icon: "h-[18px] w-[18px] shrink-0",
    sub: "ml-auto whitespace-nowrap text-[12px]",
  },
  grid: {
    band: "flex-wrap gap-x-[5px] px-2.5 py-2 text-[13px] leading-[18px]",
    icon: "h-3.5 w-3.5 shrink-0",
    sub: "w-full truncate text-[10.5px] leading-4",
  },
  detail: {
    band: "h-[50px] gap-2 px-[18px] text-[17px] leading-6",
    icon: "h-5 w-5 shrink-0",
    sub: "ml-auto whitespace-nowrap text-[12px]",
  },
};

/** 상세 사진에서 띠와 겹치지 않게 띠 위로 올릴 요소의 bottom (띠 50px + 16px). */
export const aboveDetailOpensAtBandClassName = "bottom-[66px]";

/**
 * 예약 오픈 전 운영진 분철의 사진 아래 검정 띠. 오픈 전에는 상태 칩과 「D-n」 자리를 대신한다.
 * 넓은 카드·2열 카드·상세 사진이 크기만 달리해 함께 쓴다.
 */
export function OpensAtBand({ nowMs, opensAtMs, size }: OpensAtBandProps) {
  const classNames = sizeClassNames[size];
  const opensAtLabel = formatOpensAt(opensAtMs, nowMs);

  return (
    <div
      className={`absolute inset-x-0 bottom-0 flex items-center bg-black font-bold tracking-[-0.04em] text-[#D7FF5F] ${classNames.band}`}
    >
      <ClockIcon className={classNames.icon} />
      <span className="min-w-0">
        {size === "grid" ? opensAtLabel : `${opensAtLabel} 오픈`}
      </span>
      <span
        className={`font-semibold tracking-[-0.02em] text-white/70 ${classNames.sub}`}
      >
        {size === "grid" ? "오픈 전, 아직 참여할 수 없어요" : "지금은 참여 전"}
      </span>
    </div>
  );
}
