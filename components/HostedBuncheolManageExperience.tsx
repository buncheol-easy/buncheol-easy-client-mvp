"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BID_HISTORY_SKIP_ENTER_KEY,
  BidHistoryContent,
  MANAGE_BID_HISTORY_ENTRY_INDEX_KEY,
} from "@/components/BidHistoryContent";
import { BottomNavigator } from "@/components/BottomNavigator";
import { HostedBuncheolManage } from "@/components/HostedBuncheolManage";
import { SwipeUnderlay } from "@/components/SwipeUnderlay";
import { getHistoryIndex } from "@/lib/history-index";

const MANAGE_PANEL_TRANSITION_MS = 240;
const MANAGE_BID_HISTORY_ENTRY_STATE_KEY = "__buncheolManageFromBidHistory";

function hasBidHistoryEntryState() {
  const historyState = window.history.state as Record<string, unknown> | null;

  return historyState?.[MANAGE_BID_HISTORY_ENTRY_STATE_KEY] === true;
}

type HostedBuncheolManageExperienceProps = {
  id: string;
};

export function HostedBuncheolManageExperience({
  id,
}: HostedBuncheolManageExperienceProps) {
  const router = useRouter();
  const exitTimerRef = useRef<number | null>(null);
  const [isEntered, setIsEntered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isUnderlayHidden, setIsUnderlayHidden] = useState(false);

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

  // 「내 분철」의 관리하기 링크가 적어 둔 다음 칸 번호와 같을 때만 이 칸에 "내 분철에서 왔다" 표시를 남긴다.
  useEffect(() => {
    const expectedEntryIndex = window.sessionStorage.getItem(
      MANAGE_BID_HISTORY_ENTRY_INDEX_KEY,
    );
    window.sessionStorage.removeItem(MANAGE_BID_HISTORY_ENTRY_INDEX_KEY);

    if (expectedEntryIndex === String(getHistoryIndex())) {
      window.history.replaceState(
        {
          ...((window.history.state as Record<string, unknown> | null) ?? {}),
          [MANAGE_BID_HISTORY_ENTRY_STATE_KEY]: true,
        },
        "",
      );
    }
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

    // 밑에는 늘 「내 분철」이 깔려 있다. 그 밖의 화면(상세 등)으로 돌아갈 때는 퇴장 중에 비치지 않게 가린다.
    if (getHistoryIndex() > 0 && !hasBidHistoryEntryState()) {
      setIsUnderlayHidden(true);
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
        <SwipeUnderlay
          className={isUnderlayHidden ? "invisible" : ""}
          isEntered={isEntered}
          isExiting={isExiting}
        >
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
