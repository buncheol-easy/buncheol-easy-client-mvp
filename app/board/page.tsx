import { BoardExperience } from "@/components/BoardExperience";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export default function BoardPage() {
  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <BoardExperience />
    </main>
  );
}
