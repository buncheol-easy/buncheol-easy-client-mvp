// open: 지금 참여할 수 있는 자리 / taken: 팔렸거나 누가 입금 중이라 지금은 못 고르는 자리
// ended: 분철 자체가 끝나 자리 상태를 따질 필요가 없는 경우 / mine: 내가 참여한 자리(상세만 안다)
export type MemberChipState = "open" | "taken" | "ended" | "mine";

export type MemberChip = {
  // 같은 이름의 슬롯을 구분하고, 누른 칩의 멤버 행을 찾을 때 쓴다.
  id?: string;
  name: string;
  state: MemberChipState;
};

type MemberChipsProps = {
  members: MemberChip[];
  size?: "card" | "detail";
  // 주면 칩마다 버튼이 된다. 카드처럼 칩을 감싼 링크가 있는 곳에서는 주지 않는다.
  onSelect?: (member: MemberChip) => void;
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
  onSelect,
}: MemberChipsProps) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {members.map((member) => {
        const className = `rounded-full font-semibold leading-4 tracking-[-0.04em] ${chipSizeClassNames[size]} ${chipStateClassNames[member.state]}`;
        const content = (
          <>
            {member.name}
            {chipStateScreenReaderText[member.state] ? (
              <span className="sr-only">
                {chipStateScreenReaderText[member.state]}
              </span>
            ) : null}
          </>
        );

        return onSelect ? (
          <button
            className={`${className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2`}
            key={member.id ?? member.name}
            onClick={() => onSelect(member)}
            type="button"
          >
            {content}
          </button>
        ) : (
          <span className={className} key={member.id ?? member.name}>
            {content}
          </span>
        );
      })}
    </span>
  );
}
