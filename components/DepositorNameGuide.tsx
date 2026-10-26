type DepositorNameGuideProps = {
  holder: string;
  isC2C: boolean;
};

// 검정 입금 마감 카드 안에 둔다. 입금자명은 LEGACY 자동 입금확인(페이액션)의 매칭 키이고 C2C 에서는 개최자가
// 통장에서 찾는 단서라, 송금 화면에서 닉네임이나 멤버 이름으로 바꾸면 확인이 안 된다.
export function DepositorNameGuide({ holder, isC2C }: DepositorNameGuideProps) {
  return (
    <>
      <div className="mt-3.5 rounded-[0.75rem] bg-[#CFE86B] px-3.5 pb-3 pt-3 text-black">
        <p className="text-[12.5px] font-semibold leading-[1.45] text-black/70">
          입금자명을 꼭 이 이름으로 보내 주세요
        </p>
        <p className="mt-0.5 break-all text-[24px] font-bold leading-[1.25] tracking-[-0.04em]">
          {holder}
        </p>
      </div>
      <div className="mt-2.5 flex items-start gap-2">
        <span
          aria-hidden="true"
          className="mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[#ff6b6b] text-[12px] font-extrabold text-black"
        >
          !
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-[1.4] text-[#ff8e8e]">
            입금자명이 다를 경우?
          </p>
          <p className="mt-0.5 break-keep text-[12.5px] font-medium leading-[1.55] text-white/70">
            {isC2C
              ? "입금자명이 위 이름과 다를 경우 개최자가 입금을 찾지 못할 수 있어요."
              : "입금자명이 위 이름과 다를 경우 입금이 확인되지 않아 참여가 취소될 수 있어요."}
          </p>
        </div>
      </div>
    </>
  );
}
