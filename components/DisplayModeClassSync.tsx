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

export function DisplayModeClassSync() {
  useLayoutEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const fullscreenQuery = window.matchMedia("(display-mode: fullscreen)");

    function addQueryListener(query: MediaQueryList) {
      if (typeof query.addEventListener === "function") {
        query.addEventListener("change", syncDisplayModeClass);

        return () => query.removeEventListener("change", syncDisplayModeClass);
      }

      const legacyQuery = query as LegacyMediaQueryList;

      legacyQuery.addListener(syncDisplayModeClass);

      return () => legacyQuery.removeListener(syncDisplayModeClass);
    }

    syncDisplayModeClass();

    const removeStandaloneListener = addQueryListener(standaloneQuery);
    const removeFullscreenListener = addQueryListener(fullscreenQuery);

    window.addEventListener("pageshow", syncDisplayModeClass);

    return () => {
      removeStandaloneListener();
      removeFullscreenListener();
      window.removeEventListener("pageshow", syncDisplayModeClass);
    };
  }, []);

  return null;
}
