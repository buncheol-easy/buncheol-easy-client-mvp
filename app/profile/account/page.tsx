import type { Metadata } from "next";
import { ProfileAccountExperience } from "@/components/ProfileAccountExperience";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata: Metadata = {
  title: "계정 관리",
  robots: { index: false, follow: false },
};

export default function ProfileAccountPage() {
  return (
    <main className="system-chrome-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <ProfileAccountExperience />
    </main>
  );
}
