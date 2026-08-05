import { UploadNoticeContent } from "@/components/UploadNoticeContent";
import { buildPageMetadata } from "@/lib/seo";
import { blackChromeViewport } from "@/lib/system-chrome";

export const viewport = blackChromeViewport;

export const metadata = buildPageMetadata({
  title: "분철 개최 안내",
  description:
    "분철이지의 분철 개최 정책과 개최 신청 절차를 안내합니다.",
  path: "/upload/notice",
});

export default function UploadNoticePage() {
  return <UploadNoticeContent />;
}
