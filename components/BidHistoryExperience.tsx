"use client";

import { BidHistoryContent } from "@/components/BidHistoryContent";
import { BottomNavigator } from "@/components/BottomNavigator";

export function BidHistoryExperience() {
  return (
    <main className="system-chrome-white system-chrome-bottom-black h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]">
      <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-white">
        <div className="flex h-full flex-col">
          <BidHistoryContent />
          <BottomNavigator activeLabel="Bids" />
        </div>
      </div>
    </main>
  );
}
