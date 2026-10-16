import { ClockIcon } from "@/components/icons";
import { formatOpenCountdown, formatOpensAt } from "@/lib/buncheol-open-time";

type OpensAtBandSize = "wide" | "grid" | "detail";

type OpensAtBandProps = {
  nowMs: number;
  opensAtMs: number;
  size: OpensAtBandSize;
};

/** 상세 사진에서 띠와 겹치지 않게 띠 위로 올릴 요소의 bottom (띠 74px + 16px). */
export const aboveDetailOpensAtBandClassName = "bottom-[90px]";

/**
 * 예약 오픈 전 운영진 분철의 사진 아래 검정 띠. 오픈 전에는 상태 칩과 「D-n」 자리를 대신한다.
 * 넓은 카드·2열 카드·상세 사진이 크기만 달리해 함께 쓰고, 상세 띠에만 남은 시간을 더한다.
 */
export function OpensAtBand({ nowMs, opensAtMs, size }: OpensAtBandProps) {
  const opensAtText = formatOpensAt(opensAtMs, nowMs);
  const waitingLabel = "오픈 대기 중";

  if (size === "grid") {
    return (
      <div className="absolute inset-x-0 bottom-0 bg-black px-2.5 py-2 tracking-[-0.04em]">
        <p className="flex items-start gap-[5px] text-[13px] font-bold leading-[18px] text-[#D7FF5F]">
          <ClockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {/* 좁은 카드에서는 「참여 오픈」을 한 덩어리로 다음 줄에 넘긴다. */}
          <span className="min-w-0">
            {opensAtText} <span className="whitespace-nowrap">참여 오픈</span>
          </span>
        </p>
        <p className="text-[10.5px] font-semibold leading-4 tracking-[-0.02em] text-white/70">
          {waitingLabel}
        </p>
      </div>
    );
  }

  const isDetail = size === "detail";

  // 상세 띠는 높이를 고정한다(74px). 사진 위 다른 요소(유리 상자, 장수 칩)를 띠 위로 올리는 기준이다.
  return (
    <div
      className={`absolute inset-x-0 bottom-0 bg-black tracking-[-0.04em] ${
        isDetail ? "h-[74px] px-[18px] py-2.5" : "px-3.5 py-2.5"
      }`}
    >
      <div className="flex items-center gap-2 text-[15px] font-bold leading-5 text-[#D7FF5F]">
        <ClockIcon
          className={isDetail ? "h-5 w-5 shrink-0" : "h-[18px] w-[18px] shrink-0"}
        />
        <span className="min-w-0 whitespace-nowrap">{opensAtText} 참여 오픈</span>
        <span className="ml-auto whitespace-nowrap text-[12px] font-semibold tracking-[-0.02em] text-white/70">
          {waitingLabel}
        </span>
      </div>
      {isDetail ? (
        <p className="mt-1 pl-7 text-[26px] font-bold leading-7 tracking-[-0.02em] text-white [font-variant-numeric:tabular-nums]">
          {formatOpenCountdown(opensAtMs, nowMs)}
        </p>
      ) : null}
    </div>
  );
}
