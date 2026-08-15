import { HostingIneligibleNotice } from "@/components/HostingIneligibleNotice";
import { buildPageMetadata } from "@/lib/seo";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata = {
  ...buildPageMetadata({
    title: "분철 개최 안내",
    description:
      "분철이지에서 분철을 개최하기 위한 자격 조건과 절차를 안내합니다.",
    path: "/upload/notice",
  }),
  // C2C 오픈 이후의 자격 안내로 교체했지만(docs/53 Q-07), 개최 진입은 /upload 가 담당하므로
  // 이 페이지는 사유별 안내의 공용 폴백으로만 둔다 — 색인 제외를 유지한다.
  robots: { index: false, follow: false },
};

export default function UploadNoticePage() {
  return <HostingIneligibleNotice reason={null} variant="requirements" />;
}
