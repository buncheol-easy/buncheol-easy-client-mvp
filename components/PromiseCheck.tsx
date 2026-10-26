type PromiseCheckProps = {
  checked: boolean;
  className?: string;
  disabled?: boolean;
  message: string;
  onCheckedChange: (checked: boolean) => void;
};

// 회원 개최의 약속 체크(개최 폼 마지막, 신청 확인 단계). 체크해야 제출 버튼이 켜진다.
// 증거가 아니라 약속을 한 번 읽게 하는 장치라 체크 여부는 서버에 보내지 않는다.
export function PromiseCheck({
  checked,
  className = "",
  disabled = false,
  message,
  onCheckedChange,
}: PromiseCheckProps) {
  return (
    <div
      className={`rounded-[0.95rem] bg-[#F7FAEE] px-4 py-3.5 ring-1 ring-[#E4F6A5]/70 ${className}`}
    >
      <p className="break-keep text-[13px] font-semibold leading-[1.55] tracking-[-0.03em] text-black/75">
        {message}
      </p>
      <label className="mt-2.5 flex w-fit items-center gap-2.5">
        <input
          checked={checked}
          className="h-[18px] w-[18px] accent-black"
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.currentTarget.checked)}
          type="checkbox"
        />
        <span className="text-[14px] font-semibold tracking-[-0.03em] text-black">
          알겠어요
        </span>
      </label>
    </div>
  );
}
