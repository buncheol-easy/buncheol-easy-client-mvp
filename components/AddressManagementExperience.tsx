"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AddressManagementContent } from "@/components/AddressManagementContent";
import {
  PARTICIPATION_HISTORY_SKIP_ENTER_KEY,
  ParticipationHistoryContent,
} from "@/components/ParticipationHistoryContent";
import { BottomNavigator } from "@/components/BottomNavigator";
import {
  PROFILE_SKIP_ENTER_KEY,
  ProfileContent,
} from "@/components/ProfileContent";
import { SwipeUnderlay } from "@/components/SwipeUnderlay";
import { getHistoryIndex } from "@/lib/history-index";
import { useProfileCompletionGuard } from "@/lib/use-profile-completion-guard";

const ADDRESS_PANEL_TRANSITION_MS = 240;

type AddressManagementExperienceProps = {
  openFormOnEntry: boolean;
  returnHref: string | null;
};

export function AddressManagementExperience({
  openFormOnEntry,
  returnHref,
}: AddressManagementExperienceProps) {
  useProfileCompletionGuard();

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
    const isProductReturn =
      typeof returnHref === "string" && returnHref.startsWith("/products/");
    const skipEnterKey =
      returnHref === "/profile/participations"
        ? PARTICIPATION_HISTORY_SKIP_ENTER_KEY
        : PROFILE_SKIP_ENTER_KEY;

    if (isProductReturn) {
      router.replace(returnHref);
      return;
    }

    window.sessionStorage.setItem(skipEnterKey, "true");

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace(returnHref ?? "/profile");
  }

  function handleBack() {
    if (isExiting) {
      return;
    }

    setIsExiting(true);
    setIsEntered(false);

    exitTimerRef.current = window.setTimeout(
      finishBackNavigation,
      ADDRESS_PANEL_TRANSITION_MS,
    );
  }

  const isParticipationsReturn = returnHref === "/profile/participations";

  return (
    <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-white">
      <SwipeUnderlay isEntered={isEntered} isExiting={isExiting}>
        {isParticipationsReturn ? (
          <>
            <ParticipationHistoryContent skipEnterAnimation />
            <BottomNavigator activeLabel="Participations" />
          </>
        ) : (
          <>
            <ProfileContent skipEnterAnimation />
            <BottomNavigator activeLabel="Profile" />
          </>
        )}
      </SwipeUnderlay>

      <div
        className={`product-page-panel absolute inset-0 z-10 flex flex-col overflow-hidden bg-white ${
          isEntered && !isExiting ? "product-page-active" : ""
        } ${isExiting ? "product-page-exit" : ""}`}
      >
        <AddressManagementContent
          onBack={handleBack}
          openFormOnEntry={openFormOnEntry}
          returnHref={returnHref}
        />
      </div>
    </div>
  );
}
