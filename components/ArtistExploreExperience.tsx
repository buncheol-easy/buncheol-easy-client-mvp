"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArtistExploreContent } from "@/components/ArtistExploreContent";
import { BottomNavigator } from "@/components/BottomNavigator";
import { HOME_SKIP_ENTER_KEY, HomeContent } from "@/components/HomeContent";
import { SwipeUnderlay } from "@/components/SwipeUnderlay";
import { getHistoryIndex } from "@/lib/history-index";

const ARTIST_EXPLORE_PANEL_TRANSITION_MS = 240;

export function ArtistExploreExperience() {
  const router = useRouter();
  const exitTimerRef = useRef<number | null>(null);
  const [isEntered, setIsEntered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  // 이 화면은 그룹 페이지에서 돌아올 때도 새로 마운트돼 화면 밖에서 출발한다. 돌아온 경우엔 슬라이드 없이
  // 제자리에 바로 둔다. 판정은 목록이 검색어·스크롤을 되살릴 때 알려 준다 — 그 표시는 읽자마자 지워진다.
  const [isEnterTransitionSkipped, setIsEnterTransitionSkipped] =
    useState(false);
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

  // 위치 클래스와 전환 끄기는 같은 갱신에 넣는다. 클래스만 먼저 붙으면 화면 밖 위치에서 슬라이드가 돈다.
  const handleRestoreView = useCallback(() => {
    setIsEntered(true);
    setIsEnterTransitionSkipped(true);
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
        /* globals.css 의 패널 전환이 레이어 밖 규칙이라 Tailwind transition-none 은 지지 않는다.
           나갈 때(‹ → 홈)는 전환을 되살려 퇴장 슬라이드를 그대로 튼다. */
        style={
          isEnterTransitionSkipped && !isExiting
            ? { transition: "none" }
            : undefined
        }
      >
        <ArtistExploreContent
          onBack={handleBack}
          onRestoreView={handleRestoreView}
        />
      </div>
    </div>
  );
}
