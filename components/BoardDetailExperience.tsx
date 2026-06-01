"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BOARD_SKIP_ENTER_KEY,
  BoardContent,
} from "@/components/BoardContent";
import { BoardDetailContent } from "@/components/BoardDetailContent";
import { BottomNavigator } from "@/components/BottomNavigator";
import { HOME_SKIP_ENTER_KEY, HomeContent } from "@/components/HomeContent";
import { SwipeUnderlay } from "@/components/SwipeUnderlay";
import type { BoardPost } from "@/lib/board-posts";

const BOARD_DETAIL_PANEL_TRANSITION_MS = 240;

type BoardDetailReturnSource = "board" | "home";

type BoardDetailExperienceProps = {
  post: BoardPost;
  returnSource: BoardDetailReturnSource;
};

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

export function BoardDetailExperience({
  post,
  returnSource,
}: BoardDetailExperienceProps) {
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

    if (returnSource === "home") {
      window.sessionStorage.setItem(HOME_SKIP_ENTER_KEY, "true");
    } else {
      window.sessionStorage.setItem(BOARD_SKIP_ENTER_KEY, "true");
    }

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace(returnSource === "home" ? "/" : "/board");
  }

  function handleBack() {
    if (isExiting) {
      return;
    }

    setIsExiting(true);
    setIsEntered(false);

    exitTimerRef.current = window.setTimeout(
      finishBackNavigation,
      BOARD_DETAIL_PANEL_TRANSITION_MS,
    );
  }

  return (
    <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-white">
      <SwipeUnderlay isEntered={isEntered} isExiting={isExiting}>
        {returnSource === "home" ? (
          <>
            <HomeContent skipEnterAnimation />
            <BottomNavigator />
          </>
        ) : (
          <BoardContent skipEnterAnimation />
        )}
      </SwipeUnderlay>

      <div
        className={`product-page-panel absolute inset-0 z-10 flex flex-col overflow-hidden bg-white ${
          isEntered && !isExiting ? "product-page-active" : ""
        } ${isExiting ? "product-page-exit" : ""}`}
      >
        <BoardDetailContent onBack={handleBack} post={post} />
      </div>
    </div>
  );
}
