import { HelpText } from "@/components/HelpText";
import { KakaoIcon } from "@/components/icons";
import { KAKAO_CHANNEL_URL } from "@/lib/site";

type StaffContactLinkProps = {
  className?: string;
  description?: string;
};

// 입금 단계가 시작된 회원 개최 분철은 운영진과 함께 접는다. 개최자 관리 화면, 참여자 카드,
// 「개최한 분철」 카드가 같은 카카오톡 채널로 보낸다(누른 기록은 남기지 않는다).
export function StaffContactLink({
  className = "",
  description,
}: StaffContactLinkProps) {
  return (
    <div className={className}>
      {description ? <HelpText size="caption">{description}</HelpText> : null}
      <a
        className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 text-[13px] font-semibold tracking-[-0.04em] text-black/70${
          description ? " mt-2" : ""
        }`}
        href={KAKAO_CHANNEL_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        <KakaoIcon className="h-4 w-4" />
        운영진에게 알리기
      </a>
    </div>
  );
}
