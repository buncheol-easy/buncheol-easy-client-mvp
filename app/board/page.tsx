import { BoardExperience } from "@/components/BoardExperience";
import { buildPageMetadata } from "@/lib/seo";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata = buildPageMetadata({
  title: "공지사항",
  description: "분철이지의 공지사항과 새 소식을 확인하세요.",
  path: "/board",
});

export default function BoardPage() {
  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <BoardExperience />
    </main>
  );
}
