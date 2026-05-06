"use client";

import { useLayoutEffect } from "react";

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type LegacyMediaQueryList = MediaQueryList & {
  addListener: (listener: () => void) => void;
  removeListener: (listener: () => void) => void;
};

function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as NavigatorWithStandalone).standalone === true
  );
}

function syncDisplayModeClass() {
  const standalone = isStandaloneDisplay();

  document.body.classList.toggle("is-pwa-standalone", standalone);
  document.body.classList.toggle("is-browser-tab", !standalone);
}

let stableViewportHeight = 0;

function resetDocumentScroll() {
  if (!isStandaloneDisplay()) {
    return;
  }

  window.scrollTo(0, 0);
}

function syncViewportHeight({ allowShrink = false, reset = false } = {}) {
  if (reset) {
    stableViewportHeight = 0;
  }

  const viewportHeight = Math.max(
    window.innerHeight,
    window.visualViewport?.height ?? 0,
  );
  stableViewportHeight = allowShrink
    ? viewportHeight
    : Math.max(stableViewportHeight, viewportHeight);

  document.documentElement.style.setProperty(
    "--app-viewport-height",
    `${stableViewportHeight}px`,
  );
}

export function DisplayModeClassSync() {
  useLayoutEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const fullscreenQuery = window.matchMedia("(display-mode: fullscreen)");
    let animationFrame = 0;

    function syncDisplayModeChange() {
      syncDisplayModeState(true);
    }

    function addQueryListener(query: MediaQueryList) {
      if (typeof query.addEventListener === "function") {
        query.addEventListener("change", syncDisplayModeChange);

        return () => query.removeEventListener("change", syncDisplayModeChange);
      }

      const legacyQuery = query as LegacyMediaQueryList;

      legacyQuery.addListener(syncDisplayModeChange);

      return () => legacyQuery.removeListener(syncDisplayModeChange);
    }

    function syncDisplayModeState(allowViewportShrink = false) {
      syncDisplayModeClass();
      syncViewportHeight({ allowShrink: allowViewportShrink });
      resetDocumentScroll();

      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        syncViewportHeight({ allowShrink: allowViewportShrink });
        resetDocumentScroll();
      });
    }

    function syncOrientationChange() {
      syncDisplayModeClass();
      syncViewportHeight({ allowShrink: true, reset: true });
      resetDocumentScroll();

      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        syncViewportHeight({ allowShrink: true, reset: true });
        resetDocumentScroll();
      });
    }

    function syncWindowResize() {
      syncDisplayModeState(true);
    }

    function syncVisualViewportChange() {
      syncDisplayModeState(false);
    }

    syncDisplayModeState(true);

    const removeStandaloneListener = addQueryListener(standaloneQuery);
    const removeFullscreenListener = addQueryListener(fullscreenQuery);

    window.addEventListener("orientationchange", syncOrientationChange);
    window.addEventListener("pageshow", syncWindowResize);
    window.addEventListener("resize", syncWindowResize);
    window.visualViewport?.addEventListener("resize", syncVisualViewportChange);
    window.visualViewport?.addEventListener("scroll", syncVisualViewportChange);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      removeStandaloneListener();
      removeFullscreenListener();
      window.removeEventListener("orientationchange", syncOrientationChange);
      window.removeEventListener("pageshow", syncWindowResize);
      window.removeEventListener("resize", syncWindowResize);
      window.visualViewport?.removeEventListener("resize", syncVisualViewportChange);
      window.visualViewport?.removeEventListener("scroll", syncVisualViewportChange);
    };
  }, []);

  return null;
}
