"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  BOARD_SKIP_ENTER_KEY,
  BoardContent,
} from "@/components/BoardContent";
import { BoardDetailContent } from "@/components/BoardDetailContent";
import { BottomNavigator } from "@/components/BottomNavigator";
import { HOME_SKIP_ENTER_KEY, HomeContent } from "@/components/HomeContent";
import { SwipeUnderlay } from "@/components/SwipeUnderlay";
import { requestInboxMessageDetail } from "@/lib/auth-api";
import { getFreshAccessToken } from "@/lib/auth-session";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import {
  getBoardPost,
  getBoardPostFromInboxMessage,
  type BoardPost,
} from "@/lib/board-posts";

const BOARD_DETAIL_PANEL_TRANSITION_MS = 240;

type BoardDetailReturnSource = "board" | "home";

type BoardDetailExperienceProps = {
  messageId: string;
  returnSource: BoardDetailReturnSource;
};

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

export function BoardDetailExperience({
  messageId,
  returnSource,
}: BoardDetailExperienceProps) {
  const router = useRouter();
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const exitTimerRef = useRef<number | null>(null);
  const [isEntered, setIsEntered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [post, setPost] = useState<BoardPost | null>(null);

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

  useEffect(() => {
    let isActive = true;

    async function loadMessage() {
      setIsLoading(true);
      setMessage("");

      try {
        const accessToken = authState.isLoggedIn
          ? await getFreshAccessToken()
          : undefined;
        const detail = await requestInboxMessageDetail(
          accessToken ?? undefined,
          messageId,
        );

        if (!isActive) {
          return;
        }

        setPost(getBoardPostFromInboxMessage(detail));
        setMessage("");
      } catch (error: unknown) {
        if (!isActive) {
          return;
        }

        const fallbackPost = getBoardPost(messageId);

        setPost(fallbackPost);
        setMessage(
          fallbackPost
            ? ""
            : error instanceof Error
              ? error.message
              : "소식 내용을 불러오지 못했어요.",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadMessage();

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, authState.isLoggedIn, messageId]);

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
        <BoardDetailContent
          isLoading={isLoading}
          message={message}
          onBack={handleBack}
          post={post}
        />
      </div>
    </div>
  );
}
