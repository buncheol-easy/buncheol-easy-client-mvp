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
import { getHistoryIndex } from "@/lib/history-index";
import { useIsInAppNavigation } from "@/lib/use-in-app-navigation";

const LOGIN_PANEL_TRANSITION_MS = 240;

type LoginExperienceProps = {
  bookmarkId?: string;
  cancelHref?: string;
  returnHref: string;
};

export function LoginExperience({
  bookmarkId,
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
  // 언더레이(마이페이지)는 마이페이지에서 들어왔을 때만 깐다. 딥링크·새로고침이나 다른 화면(상세 등)에서
  // 왔을 때 깔면 방문하지 않은 화면이 로그인 패널 밑으로 비친다.
  const isInAppNavigation = useIsInAppNavigation();
  const shouldShowProfileUnderlay =
    isInAppNavigation && cancelHref === "/profile";

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
        {shouldShowProfileUnderlay ? (
          <>
            <ProfileContent skipEnterAnimation />
            <BottomNavigator activeLabel="Profile" />
          </>
        ) : null}
      </SwipeUnderlay>

      <div
        className={`product-page-panel absolute inset-0 z-10 flex flex-col overflow-hidden bg-white ${
          isEntered && !isExiting ? "product-page-active" : ""
        } ${isExiting ? "product-page-exit" : ""}`}
      >
        <LoginContent
          bookmarkId={bookmarkId}
          onBack={handleBack}
          returnHref={returnHref}
        />
      </div>
    </div>
  );
}
