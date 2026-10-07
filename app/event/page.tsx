import { EventGuideContent } from "@/components/EventGuideContent";
import { buildPageMetadata } from "@/lib/seo";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata = buildPageMetadata({
  title: "첫 분철 배송비 지원 이벤트",
  description:
    "분철이지에서 처음 여는 분철을 배송비 0원으로 열면 참여자에게 보낸 택배비를 분철 1건에 2만 원까지 드려요. 이벤트 참여 방법과 열기·모으기·보내기 순서, 꼭 알아둘 점을 정리했습니다.",
  path: "/event",
});

export default function EventPage() {
  return <EventGuideContent />;
}
