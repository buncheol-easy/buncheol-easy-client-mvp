type FloatingHelpButtonProps = {
  isScrolledAway: boolean;
  label: string;
  onClick: () => void;
};

/*
 * 버튼은 스크롤 바닥 근처에서 숨지 않으므로, 맨 끝 콘텐츠는 이만큼 하단 여백을 둬야 가려지지 않는다.
 * 버튼 위치(bottom-5 + h-12 = 68px)에 간격 8px 을 더한 값이다 — 버튼 위치를 바꾸면 같이 바꾼다.
 */
export const floatingHelpButtonClearanceClassName = "pb-[4.75rem]";

export function FloatingHelpButton({
  isScrolledAway,
  label,
  onClick,
}: FloatingHelpButtonProps) {
  return (
    <button
      aria-label={label}
      className={`motion-icon-button floating-help-button absolute bottom-5 right-4 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-black text-[18px] font-semibold text-[#D7FF5F] shadow-[0_14px_30px_rgba(0,0,0,0.28)] ${
        isScrolledAway ? "floating-help-button--scrolled-away" : ""
      }`}
      onClick={onClick}
      type="button"
    >
      ?
    </button>
  );
}
