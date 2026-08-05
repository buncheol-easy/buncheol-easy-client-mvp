"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { BottomNavigator } from "@/components/BottomNavigator";
import { LoginContent } from "@/components/LoginContent";
import {
  PROFILE_SKIP_ENTER_KEY,
  ProfileContent,
} from "@/components/ProfileContent";
import { SwipeUnderlay } from "@/components/SwipeUnderlay";
import { requestUserProfileStatus } from "@/lib/auth-api";
import { getFreshAccessToken } from "@/lib/auth-session";
import {
  authProfileSetupReturnHrefStorageKey,
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";

const LOGIN_PANEL_TRANSITION_MS = 240;

type LoginExperienceProps = {
  cancelHref?: string;
  returnHref: string;
};

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

export function LoginExperience({
  cancelHref,
  returnHref,
}: LoginExperienceProps) {
  const router = useRouter();
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
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

  useEffect(() => {
    if (!authState.isLoggedIn || !authState.accessToken) {
      return;
    }

    let isActive = true;

    getFreshAccessToken()
      .then((accessToken) => {
        if (!isActive || !accessToken) {
          return;
        }

        return requestUserProfileStatus(accessToken).then(
          ({ isProfileComplete }) => {
            if (!isActive) {
              return;
            }

            if (!isProfileComplete) {
              window.sessionStorage.setItem(
                authProfileSetupReturnHrefStorageKey,
                returnHref,
              );
              router.replace("/signup/profile");
              return;
            }

            router.replace(returnHref);
          },
        );
      })
      .catch(() => {
        if (isActive) {
          router.replace(returnHref);
        }
      });

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, authState.isLoggedIn, returnHref, router]);

  function finishBackNavigation() {
    if (cancelHref) {
      if (cancelHref === "/profile") {
        window.sessionStorage.setItem(PROFILE_SKIP_ENTER_KEY, "true");
      }

      router.replace(cancelHref);
      return;
    }

    const historyIndex = getHistoryIndex();

    if (returnHref === "/profile") {
      window.sessionStorage.setItem(PROFILE_SKIP_ENTER_KEY, "true");
    }

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace(returnHref);
  }

  function handleBack() {
    if (isExiting) {
      return;
    }

    setIsExiting(true);
    setIsEntered(false);

    exitTimerRef.current = window.setTimeout(
      finishBackNavigation,
      LOGIN_PANEL_TRANSITION_MS,
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
        <LoginContent onBack={handleBack} returnHref={returnHref} />
      </div>
    </div>
  );
}
