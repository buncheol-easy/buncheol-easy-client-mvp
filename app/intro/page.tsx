import type { Metadata } from "next";
import { IntroContent } from "@/components/IntroContent";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const metadata: Metadata = {
  title: "분철이지 | 서비스 소개",
  description:
    "최애 굿즈 분철을 찾고, 참여하고, 입금 확인까지 이어가는 모바일 서비스 소개 페이지입니다.",
};

export const viewport = whiteChromeViewport;

export default function IntroPage() {
  return <IntroContent />;
}
