import type { Metadata } from "next";
import { BoardExperience } from "@/components/BoardExperience";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata: Metadata = {
  title: "공지사항",
  description: "분철이지의 공지사항과 새 소식을 확인하세요.",
  alternates: { canonical: "/board" },
};

export default function BoardPage() {
  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <BoardExperience />
    </main>
  );
}
