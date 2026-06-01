"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BoardContent } from "@/components/BoardContent";
import { BottomNavigator } from "@/components/BottomNavigator";
import { HOME_SKIP_ENTER_KEY, HomeContent } from "@/components/HomeContent";
import { SwipeUnderlay } from "@/components/SwipeUnderlay";

const BOARD_PANEL_TRANSITION_MS = 240;

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

export function BoardExperience() {
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

    window.sessionStorage.setItem(HOME_SKIP_ENTER_KEY, "true");

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace("/");
  }

  function handleBack() {
    if (isExiting) {
      return;
    }

    setIsExiting(true);
    setIsEntered(false);

    exitTimerRef.current = window.setTimeout(
      finishBackNavigation,
      BOARD_PANEL_TRANSITION_MS,
    );
  }

  return (
    <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-white">
      <SwipeUnderlay isEntered={isEntered} isExiting={isExiting}>
        <HomeContent skipEnterAnimation />
        <BottomNavigator />
      </SwipeUnderlay>

      <div
        className={`product-page-panel absolute inset-0 z-10 flex flex-col overflow-hidden bg-white ${
          isEntered && !isExiting ? "product-page-active" : ""
        } ${isExiting ? "product-page-exit" : ""}`}
      >
        <BoardContent onBack={handleBack} />
      </div>
    </div>
  );
}
