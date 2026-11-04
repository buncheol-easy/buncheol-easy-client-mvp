import type { Metadata } from "next";
import { ParticipationHistoryExperience } from "@/components/ParticipationHistoryExperience";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata: Metadata = {
  title: "참여 내역",
  robots: { index: false, follow: false },
};

export default function ParticipationHistoryPage() {
  return <ParticipationHistoryExperience />;
}
