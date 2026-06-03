"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BID_HISTORY_SKIP_ENTER_KEY,
  BidHistoryContent,
} from "@/components/BidHistoryContent";
import { BottomNavigator } from "@/components/BottomNavigator";
import { HostedBuncheolManage } from "@/components/HostedBuncheolManage";
import { SwipeUnderlay } from "@/components/SwipeUnderlay";

const MANAGE_PANEL_TRANSITION_MS = 240;

type HostedBuncheolManageExperienceProps = {
  id: string;
};

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

export function HostedBuncheolManageExperience({
  id,
}: HostedBuncheolManageExperienceProps) {
  const router = useRouter();
  const exitTimerRef = useRef<number | null>(null);
  const [isEntered, setIsEntered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const enterFrame = window.requestAnimationFrame(() => {
      setIsEntered(true);
    });

    return () => {
      window.cancelAnimationFrame(enterFrame);

      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  function finishBackNavigation() {
    const historyIndex = getHistoryIndex();

    window.sessionStorage.setItem(BID_HISTORY_SKIP_ENTER_KEY, "true");

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace("/profile/bids");
  }

  function handleBack() {
    if (isExiting) {
      return;
    }

    setIsExiting(true);
    setIsEntered(false);

    exitTimerRef.current = window.setTimeout(
      finishBackNavigation,
      MANAGE_PANEL_TRANSITION_MS,
    );
  }

  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-white">
        <SwipeUnderlay isEntered={isEntered} isExiting={isExiting}>
          <BidHistoryContent
            restoreStoredViewState={false}
            skipEnterAnimation
          />
          <BottomNavigator activeLabel="Bids" />
        </SwipeUnderlay>

        <div
          className={`product-page-panel absolute inset-0 z-10 flex flex-col overflow-hidden bg-white ${
            isEntered && !isExiting ? "product-page-active" : ""
          } ${isExiting ? "product-page-exit" : ""}`}
        >
          <HostedBuncheolManage id={id} onBack={handleBack} />
        </div>
      </div>
    </main>
  );
}
