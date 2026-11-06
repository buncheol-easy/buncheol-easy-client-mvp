import type { Metadata } from "next";
import { TestAccountStart } from "@/components/test-account/TestAccountStart";
import { getOptionalSafeInternalHref } from "@/lib/auth-navigation";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata: Metadata = {
  title: "체험 시작",
  robots: { index: false, follow: false },
};

type TryStartPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function TryStartPage({ searchParams }: TryStartPageProps) {
  const { next } = await searchParams;

  return (
    <main className="system-chrome-white h-[100dvh] overflow-hidden bg-[#f6f6f3] text-[#111111]">
      <div className="app-page-scroll h-full overflow-y-auto overscroll-contain">
        <TestAccountStart next={getOptionalSafeInternalHref(next)} />
      </div>
    </main>
  );
}
