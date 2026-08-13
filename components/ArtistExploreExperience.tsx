"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArtistExploreContent } from "@/components/ArtistExploreContent";
import { BottomNavigator } from "@/components/BottomNavigator";
import { HOME_SKIP_ENTER_KEY, HomeContent } from "@/components/HomeContent";
import { SwipeUnderlay } from "@/components/SwipeUnderlay";

const ARTIST_EXPLORE_PANEL_TRANSITION_MS = 240;

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

export function ArtistExploreExperience() {
  const router = useRouter();
  const exitTimerRef = useRef<number | null>(null);
  const [isEntered, setIsEntered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  // 언더레이 홈은 홈 화면 한 벌을 통째로 더 마운트한다(상품 카드 수십 장 + 이미지).
  // 진입 애니메이션 동안 실제로 보이는 건 왼쪽 14px 뿐이라, 그 비용을 진입 경로에서
  // 걷어내고 애니메이션이 끝난 뒤 한가할 때 붙인다. 나갈 때는 패널이 비켜나며 전체가
  // 드러나므로 그 전에 반드시 준비돼 있어야 한다.
  const [isUnderlayMounted, setIsUnderlayMounted] = useState(false);

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
    if (isUnderlayMounted) {
      return;
    }

    // requestIdleCallback 이 없는 브라우저(사파리 구버전)는 진입 애니메이션 직후로 대체한다.
    const mountUnderlay = () => setIsUnderlayMounted(true);

    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(mountUnderlay, { timeout: 1000 });

      return () => window.cancelIdleCallback(handle);
    }

    const timer = window.setTimeout(
      mountUnderlay,
      ARTIST_EXPLORE_PANEL_TRANSITION_MS,
    );

    return () => window.clearTimeout(timer);
  }, [isUnderlayMounted]);

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

    // 아직 안 붙었으면 지금 붙인다 — 패널이 비켜나며 언더레이가 전부 드러난다.
    setIsUnderlayMounted(true);
    setIsExiting(true);
    setIsEntered(false);

    exitTimerRef.current = window.setTimeout(
      finishBackNavigation,
      ARTIST_EXPLORE_PANEL_TRANSITION_MS,
    );
  }

  return (
    <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-white">
      <SwipeUnderlay isEntered={isEntered} isExiting={isExiting}>
        {isUnderlayMounted ? (
          <>
            <HomeContent skipEnterAnimation />
            <BottomNavigator />
          </>
        ) : null}
      </SwipeUnderlay>

      <div
        className={`product-page-panel absolute inset-0 z-10 flex flex-col overflow-hidden bg-white ${
          isEntered && !isExiting ? "product-page-active" : ""
        } ${isExiting ? "product-page-exit" : ""}`}
      >
        <ArtistExploreContent onBack={handleBack} />
      </div>
    </div>
  );
}
