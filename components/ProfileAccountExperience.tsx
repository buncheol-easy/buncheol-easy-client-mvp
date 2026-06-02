"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNavigator } from "@/components/BottomNavigator";
import {
  PROFILE_SKIP_ENTER_KEY,
  ProfileContent,
} from "@/components/ProfileContent";
import {
  PROFILE_ACCOUNT_LOGIN_RETURN_KEY,
  ProfileAccountContent,
} from "@/components/ProfileAccountContent";
import { SwipeUnderlay } from "@/components/SwipeUnderlay";

const ACCOUNT_PANEL_TRANSITION_MS = 240;

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

export function ProfileAccountExperience() {
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
    const shouldReturnToProfile =
      window.sessionStorage.getItem(PROFILE_ACCOUNT_LOGIN_RETURN_KEY) ===
      "true";

    window.sessionStorage.removeItem(PROFILE_ACCOUNT_LOGIN_RETURN_KEY);
    window.sessionStorage.setItem(PROFILE_SKIP_ENTER_KEY, "true");

    if (shouldReturnToProfile) {
      router.replace("/profile");
      return;
    }

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace("/profile");
  }

  function handleBack() {
    if (isExiting) {
      return;
    }

    setIsExiting(true);
    setIsEntered(false);

    exitTimerRef.current = window.setTimeout(
      finishBackNavigation,
      ACCOUNT_PANEL_TRANSITION_MS,
    );
  }

  return (
    <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-white">
      <SwipeUnderlay isEntered={isEntered} isExiting={isExiting}>
        <ProfileContent skipEnterAnimation />
        <BottomNavigator activeLabel="Profile" />
      </SwipeUnderlay>

      <div
        className={`product-page-panel absolute inset-0 z-10 flex flex-col overflow-hidden bg-white ${
          isEntered && !isExiting ? "product-page-active" : ""
        } ${isExiting ? "product-page-exit" : ""}`}
      >
        <ProfileAccountContent onBack={handleBack} />
      </div>
    </div>
  );
}
