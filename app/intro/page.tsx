import { IntroContent } from "@/components/IntroContent";
import { buildPageMetadata } from "@/lib/seo";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const metadata = buildPageMetadata({
  title: "서비스 소개 — 포카 분철 신청부터 편의점 수령까지",
  description:
    "멤버별로 나눠 사는 포토카드 분철, 원하는 멤버 자리를 신청하고 입금 확인·배송·편의점 수령까지 이어지는 분철이지의 진행 흐름을 한눈에 소개합니다.",
  path: "/intro",
});

export const viewport = whiteChromeViewport;

export default function IntroPage() {
  return <IntroContent />;
}
