import type { Metadata } from "next";
import { SignupProfileContent } from "@/components/SignupProfileContent";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata: Metadata = {
  title: "가입 정보 입력",
  robots: { index: false, follow: false },
};

export default function SignupProfilePage() {
  return <SignupProfileContent />;
}
