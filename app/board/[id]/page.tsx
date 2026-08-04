import type { Metadata } from "next";
import { BoardDetailExperience } from "@/components/BoardDetailExperience";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

// 공지 단건 조회 API 가 인증을 요구해 서버에서 제목·본문을 가져올 수 없다.
// 목록 페이지와 동일한 title 의 빈 셸이 공지 수만큼 색인되는 것을 막기 위해
// 제목을 넣을 수 있게 되기 전까지는 noindex 로 둔다 (docs/40 §3 미결).
export const metadata: Metadata = {
  title: "공지사항",
  robots: { index: false, follow: true },
};

type BoardDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    from?: string | string[];
  }>;
};

export default async function BoardDetailPage({
  params,
  searchParams,
}: BoardDetailPageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const returnSource = (Array.isArray(from) ? from[0] : from) === "home"
    ? "home"
    : "board";

  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <BoardDetailExperience messageId={id} returnSource={returnSource} />
    </main>
  );
}
