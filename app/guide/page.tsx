import { HostGuideContent } from "@/components/HostGuideContent";
import { buildPageMetadata } from "@/lib/seo";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata = buildPageMetadata({
  title: "처음 분철 여는 법 — 개최 가이드",
  description:
    "분철이지에서 처음 분철을 여는 총대를 위한 안내입니다. 열기 전에 준비할 것, 등록부터 성사 확정·입금 확인·진행 확정·운송장 등록까지의 순서와 꼭 알아둘 점을 정리했습니다.",
  path: "/guide",
});

export default function GuidePage() {
  return <HostGuideContent />;
}
