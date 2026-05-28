import type { Metadata } from "next";
import { IntroContent } from "@/components/IntroContent";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const metadata: Metadata = {
  title: "분철이지 | 모바일 소개",
  description: "최애 포카 분철을 쉽고 빠르게 모으는 모바일 서비스",
};

export const viewport = whiteChromeViewport;

export default function IntroPage() {
  return <IntroContent />;
}
