import { BottomNavigator } from "@/components/BottomNavigator";
import { ProfileContent } from "@/components/ProfileContent";

export default function ProfilePage() {
  return (
    <main className="h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <ProfileContent />
        <BottomNavigator activeLabel="Profile" />
      </div>
    </main>
  );
}
