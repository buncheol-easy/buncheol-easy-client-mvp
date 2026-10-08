import { EventGuideContent } from "@/components/EventGuideContent";
import { buildPageMetadata } from "@/lib/seo";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

// 이벤트가 끝나면 내릴 임시 페이지라 색인하지 않는다(종료 후 오래된 "이벤트 중" 스니펫·404 방지).
export const metadata = {
  ...buildPageMetadata({
    title: "첫 분철 배송비 지원 이벤트",
    description:
      "분철이지에서 처음 여는 분철을 배송비 0원으로 열면 참여자에게 보낸 택배 1건당 3,000원, 분철 1건에 2만 원까지 드려요. 참여 세 단계와 꼭 기억할 점을 정리했습니다.",
    path: "/event",
  }),
  robots: { index: false, follow: false },
};

export default function EventPage() {
  return <EventGuideContent />;
}
