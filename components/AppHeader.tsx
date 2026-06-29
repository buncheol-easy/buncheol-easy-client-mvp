"use client";

import type { MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BellIcon, SearchIcon } from "@/components/icons";

const SEARCH_ENTRY_HISTORY_INDEX_KEY = "buncheol-search-entry-history-index";

type AppHeaderProps = {
  tone?: "dark" | "light";
};

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

export function AppHeader({ tone = "dark" }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isDarkTone = tone === "dark";
  const logoSrc = isDarkTone
    ? "/brand/logo-white.png"
    : "/brand/logo-black.png";

  function rememberSearchEntry() {
    try {
      const historyIndex = getHistoryIndex();

      if (historyIndex === null) {
        window.sessionStorage.removeItem(SEARCH_ENTRY_HISTORY_INDEX_KEY);
        return;
      }

      window.sessionStorage.setItem(
        SEARCH_ENTRY_HISTORY_INDEX_KEY,
        String(historyIndex),
      );
    } catch {
      // Navigation should still work if iOS blocks storage access.
    }
  }

  function handleSearchClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    rememberSearchEntry();

    router.push("/search");
  }

  function handleLogoClick() {
    if (pathname === "/") {
      window.location.reload();
      return;
    }

    router.push("/");
  }

  return (
    <header
      className={`app-header shrink-0 border-b px-5 py-3 ${
        isDarkTone
          ? "border-black bg-black text-white"
          : "border-black/10 bg-white text-black"
      }`}
    >
      <div className="app-header__inner flex items-center gap-3">
        <button
          aria-label="분철이지 홈"
          className="app-header__title relative -ml-2 h-10 w-[106px] shrink-0"
          onClick={handleLogoClick}
          type="button"
        >
          <Image
            alt="분철이지"
            className="object-contain object-left"
            fill
            priority
            sizes="106px"
            src={logoSrc}
          />
        </button>
        <a
          className="app-header__search flex h-10 min-w-0 flex-1 items-center justify-between rounded-full bg-white px-4 text-left text-[13px] text-black"
          href="/search"
          onClick={handleSearchClick}
        >
          <span className="min-w-0 truncate text-[16px] text-black/35">
            포토카드
          </span>
          <SearchIcon />
        </a>
        <Link
          aria-label="소식함"
          className={`app-header__notification inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
            isDarkTone
              ? "border-white/20 bg-white/10 text-white"
              : "border-black/10 bg-black/[0.04] text-black"
          }`}
          href="/board"
        >
          <BellIcon />
        </Link>
      </div>
    </header>
  );
}
