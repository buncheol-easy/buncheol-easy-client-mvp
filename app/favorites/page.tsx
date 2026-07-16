import { BottomNavigator } from "@/components/BottomNavigator";
import { FavoritesContent } from "@/components/FavoritesContent";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export default function FavoritesPage() {
  return (
    <main className="system-chrome-white system-chrome-bottom-black h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <FavoritesContent />
        <BottomNavigator activeLabel="Favorites" />
      </div>
    </main>
  );
}
