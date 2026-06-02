import { ProfileAccountExperience } from "@/components/ProfileAccountExperience";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export default function ProfileAccountPage() {
  return (
    <main className="system-chrome-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <ProfileAccountExperience />
    </main>
  );
}
