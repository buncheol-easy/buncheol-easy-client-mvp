import { notFound } from "next/navigation";
import { BoardDetailContent } from "@/components/BoardDetailContent";
import { BottomNavigator } from "@/components/BottomNavigator";
import { boardPosts, getBoardPost } from "@/lib/board-posts";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

type BoardDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export function generateStaticParams() {
  return boardPosts.map((post) => ({
    id: post.id,
  }));
}

export default async function BoardDetailPage({
  params,
}: BoardDetailPageProps) {
  const { id } = await params;
  const post = getBoardPost(id);

  if (!post) {
    notFound();
  }

  return (
    <main className="system-chrome-white system-chrome-bottom-black h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <BoardDetailContent post={post} />
        <BottomNavigator activeLabel={null} />
      </div>
    </main>
  );
}
