import type { Metadata } from "next";
import { BoardDetailExperience } from "@/components/BoardDetailExperience";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

// 공지 단건 조회 API 가 인증을 요구해 서버에서 제목을 가져올 수 없다.
// 우선 일반 제목 + canonical 만 부여한다 (docs/40 §3 미결).
export async function generateMetadata({
  params,
}: BoardDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  return {
    title: "공지사항",
    alternates: { canonical: `/board/${id}` },
  };
}

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
