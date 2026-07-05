import { BoardDetailExperience } from "@/components/BoardDetailExperience";
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
