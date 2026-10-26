import type { Metadata } from "next";
import { BidHistoryExperience } from "@/components/BidHistoryExperience";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata: Metadata = {
  title: "참여 내역",
  robots: { index: false, follow: false },
};

export default function BidHistoryPage() {
  return <BidHistoryExperience />;
}
