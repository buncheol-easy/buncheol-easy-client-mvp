import type { Metadata } from "next";
import { TestAccountTryEntry } from "@/components/test-account/TestAccountTryEntry";
import { getOptionalSafeInternalHref } from "@/lib/auth-navigation";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata: Metadata = {
  title: "체험 시작",
  robots: { index: false, follow: false },
};

type TryPageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
};

// 보고서와 QR 의 바로가기. 그 역할의 체험 계정으로 로그인한 뒤 next 나 역할의 첫 화면으로 보낸다.
export default async function TryPage({ params, searchParams }: TryPageProps) {
  const { role } = await params;
  const { next } = await searchParams;

  return (
    <main className="system-chrome-white h-[100dvh] overflow-hidden bg-[#f6f6f3] text-[#111111]">
      <TestAccountTryEntry
        next={getOptionalSafeInternalHref(next)}
        role={role === "host" || role === "participant" ? role : null}
      />
    </main>
  );
}
