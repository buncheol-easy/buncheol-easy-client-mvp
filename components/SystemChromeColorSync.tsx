"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const black = "#000000";
const white = "#ffffff";

type ChromeColors = {
  bottom: string;
  top: string;
};

function getChromeColors(pathname: string, hasSearchQuery = false): ChromeColors {
  if (pathname === "/" || pathname.startsWith("/search")) {
    return {
      top: black,
      bottom: pathname.startsWith("/search") && !hasSearchQuery ? white : black,
    };
  }

  if (pathname.startsWith("/upload")) {
    return {
      top: black,
      bottom: black,
    };
  }

  if (pathname.startsWith("/products")) {
    return {
      top: white,
      bottom: white,
    };
  }

  if (pathname.startsWith("/favorites") || pathname.startsWith("/profile")) {
    return {
      top: white,
      bottom: black,
    };
  }

  return {
    top: white,
    bottom: black,
  };
}

function setMetaContent(name: string, content: string) {
  const metas = document.querySelectorAll<HTMLMetaElement>(`meta[name="${name}"]`);

  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.name = name;
    meta.content = content;
    document.head.appendChild(meta);
    return;
  }

  metas.forEach((meta) => {
    meta.content = content;
  });
}

// 404 화면 등 경로 기반 판정 밖의 화면이 크롬 색을 직접 맞출 때도 재사용한다.
export function applyChromeColors(top: string, bottom: string) {
  document.documentElement.style.setProperty("--system-top-color", top);
  document.documentElement.style.setProperty("--system-bottom-color", bottom);

  setMetaContent("theme-color", top);
  setMetaContent("msapplication-navbutton-color", top);
  setMetaContent(
    "apple-mobile-web-app-status-bar-style",
    top === black ? "black-translucent" : "default",
  );
}

export function SystemChromeColorSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q");

  useEffect(() => {
    const hasSearchQuery = Boolean(searchQuery?.trim());
    const { top, bottom } = getChromeColors(pathname, hasSearchQuery);

    applyChromeColors(top, bottom);
  }, [pathname, searchQuery]);

  return null;
}
