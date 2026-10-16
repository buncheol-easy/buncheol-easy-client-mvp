import type { ReactNode } from "react";

// open: 지금 참여할 수 있는 자리 / taken: 팔렸거나 누가 입금 중이라 지금은 못 고르는 자리
// ended: 분철 자체가 끝나 자리 상태를 따질 필요가 없는 경우 / mine: 내가 참여한 자리(상세만 안다)
export type MemberChipState = "open" | "taken" | "ended" | "mine";

export type MemberChip = {
  name: string;
  state: MemberChipState;
};

type MemberChipsProps = {
  members: MemberChip[];
  size?: "card" | "detail";
  // 마지막 칩 바로 뒤에 같은 줄로 붙는 요소(예: 「멤버 보기」)
  trailing?: ReactNode;
};

const chipStateClassNames: Record<MemberChipState, string> = {
  open: "bg-[#EEF8C8] text-black/80 ring-1 ring-[#CFE86B]/70",
  taken: "bg-black/[0.05] text-black/35 line-through decoration-black/35",
  ended: "bg-black/[0.05] text-black/45",
  mine: "bg-black text-[#D7FF5F]",
};

const chipStateScreenReaderText: Partial<Record<MemberChipState, string>> = {
  taken: "(참여 불가)",
  mine: "(내 참여)",
};

const chipSizeClassNames = {
  card: "px-2.5 py-1 text-[12px]",
  detail: "px-3 py-1.5 text-[13px]",
};

export function MemberChips({
  members,
  size = "card",
  trailing,
}: MemberChipsProps) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {members.map(({ name, state }) => (
        <span
          className={`rounded-full font-semibold leading-4 tracking-[-0.04em] ${chipSizeClassNames[size]} ${chipStateClassNames[state]}`}
          key={name}
        >
          {name}
          {chipStateScreenReaderText[state] ? (
            <span className="sr-only">{chipStateScreenReaderText[state]}</span>
          ) : null}
        </span>
      ))}
      {trailing}
    </span>
  );
}
