import { notFound } from "next/navigation";
import { BoardDetailExperience } from "@/components/BoardDetailExperience";
import { boardPosts, getBoardPost } from "@/lib/board-posts";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

type BoardDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    from?: string | string[];
  }>;
};

export function generateStaticParams() {
  return boardPosts.map((post) => ({
    id: post.id,
  }));
}

export default async function BoardDetailPage({
  params,
  searchParams,
}: BoardDetailPageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const post = getBoardPost(id);
  const returnSource = (Array.isArray(from) ? from[0] : from) === "home"
    ? "home"
    : "board";

  if (!post) {
    notFound();
  }

  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <BoardDetailExperience post={post} returnSource={returnSource} />
    </main>
  );
}
