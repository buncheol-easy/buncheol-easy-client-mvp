import type { Metadata } from "next";
import { BottomNavigator } from "@/components/BottomNavigator";
import { HomeContent } from "@/components/HomeContent";
import { blackChromeViewport } from "@/lib/system-chrome";

export const viewport = blackChromeViewport;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <main className="system-chrome-black h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <h1 className="sr-only">분철이지 — 최애 포카 분철 플랫폼</h1>
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <HomeContent />
        </div>
        <BottomNavigator />
      </div>
    </main>
  );
}
