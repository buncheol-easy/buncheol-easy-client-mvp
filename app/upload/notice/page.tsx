import { UploadNoticeContent } from "@/components/UploadNoticeContent";
import { buildPageMetadata } from "@/lib/seo";
import { blackChromeViewport } from "@/lib/system-chrome";

export const viewport = blackChromeViewport;

export const metadata = {
  ...buildPageMetadata({
    title: "분철 개최 안내",
    description:
      "분철이지의 분철 개최 정책과 개최 신청 절차를 안내합니다.",
    path: "/upload/notice",
  }),
  // 카피가 아직 "운영진 개최 전용" 시절 안내라 C2C 오픈과 어긋난다 — 문구 교체(docs/51 §3-3)
  // 전까지 색인 제외 (선례: /upload 의 robots).
  robots: { index: false, follow: false },
};

export default function UploadNoticePage() {
  return <UploadNoticeContent />;
}
