import type { Metadata } from "next";
import { IntroContent } from "@/components/IntroContent";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const metadata: Metadata = {
  title: "서비스 소개 — 포카 분철 참여부터 입금 확인까지",
  description:
    "그룹·멤버별로 나눠 사는 포토카드 분철, 어떻게 찾고 참여하고 안전하게 받는지 분철이지의 서비스 흐름을 한눈에 소개합니다.",
  alternates: { canonical: "/intro" },
};

export const viewport = whiteChromeViewport;

export default function IntroPage() {
  return <IntroContent />;
}
