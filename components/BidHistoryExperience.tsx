"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BidHistoryContent } from "@/components/BidHistoryContent";
import { BottomNavigator } from "@/components/BottomNavigator";
import { ProfileContent } from "@/components/ProfileContent";

type BidHistoryExperienceProps = {
  initialReturnSource?: "profile";
};

const BID_HISTORY_PROFILE_ENTRY_INDEX_KEY =
  "bid-history-profile-entry-index";
const BID_HISTORY_PROFILE_ENTRY_STATE_KEY = "__buncheolBidHistoryFromProfile";

type BidHistoryHistoryState = {
  idx?: unknown;
  [BID_HISTORY_PROFILE_ENTRY_STATE_KEY]?: unknown;
};

function getHistoryState() {
  return window.history.state as BidHistoryHistoryState | null;
}

function getHistoryIndex() {
  const historyState = getHistoryState();

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

function hasProfileEntryState() {
  return getHistoryState()?.[BID_HISTORY_PROFILE_ENTRY_STATE_KEY] === true;
}

export function BidHistoryExperience({
  initialReturnSource,
}: BidHistoryExperienceProps) {
  const router = useRouter();
  const [isEntered, setIsEntered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const historyIndex = getHistoryIndex();
    const expectedEntryIndex = window.sessionStorage.getItem(
      BID_HISTORY_PROFILE_ENTRY_INDEX_KEY,
    );
    window.sessionStorage.removeItem(BID_HISTORY_PROFILE_ENTRY_INDEX_KEY);

    if (
      initialReturnSource === "profile" &&
      historyIndex !== null &&
      expectedEntryIndex === String(historyIndex)
    ) {
      window.history.replaceState(
        {
          ...(getHistoryState() ?? {}),
          [BID_HISTORY_PROFILE_ENTRY_STATE_KEY]: true,
        },
        "",
      );
    }

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        setIsEntered(true);
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);

      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  function finishExit() {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    if (hasProfileEntryState()) {
      router.back();
      return;
    }

    router.replace("/profile");
  }

  function handleBack() {
    if (isExiting) {
      return;
    }

    window.sessionStorage.setItem("skip-profile-enter-animation", "true");
    setIsExiting(true);
    exitTimerRef.current = window.setTimeout(finishExit, 360);
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]">
      <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-white">
        <div
          className={`home-page-underlay pointer-events-none absolute inset-0 flex flex-col ${
            isExiting ? "home-page-underlay-exit" : "home-page-underlay-enter"
          }`}
        >
          <ProfileContent skipEnterAnimation />
          <BottomNavigator activeLabel="Profile" />
        </div>

        <div
          className={`bid-history-panel absolute inset-0 flex flex-col bg-white shadow-[-18px_0_36px_rgba(0,0,0,0.16)] ${
            isEntered && !isExiting ? "bid-history-panel-enter" : ""
          } ${
            isExiting ? "bid-history-panel-exit" : ""
          }`}
          onTransitionEnd={(event) => {
            if (
              isExiting &&
              event.currentTarget === event.target &&
              event.propertyName === "transform"
            ) {
              finishExit();
            }
          }}
        >
          <BidHistoryContent onBack={handleBack} skipEnterAnimation />
          <BottomNavigator activeLabel="Profile" />
        </div>
      </div>
    </main>
  );
}
