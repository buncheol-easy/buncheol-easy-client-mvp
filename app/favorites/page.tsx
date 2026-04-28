import { BottomNavigator } from "@/components/BottomNavigator";
import { FavoritesContent } from "@/components/FavoritesContent";

export default function FavoritesPage() {
  return (
    <main className="h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <FavoritesContent />
        <BottomNavigator activeLabel="Favorites" />
      </div>
    </main>
  );
}
