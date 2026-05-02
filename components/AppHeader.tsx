"use client";

import Link from "next/link";
import { BellIcon, SearchIcon } from "@/components/icons";

const SEARCH_ENTRY_HISTORY_INDEX_KEY = "buncheol-search-entry-history-index";

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

export function AppHeader() {
  function handleSearchClick() {
    const historyIndex = getHistoryIndex();

    if (historyIndex === null) {
      sessionStorage.removeItem(SEARCH_ENTRY_HISTORY_INDEX_KEY);
      return;
    }

    sessionStorage.setItem(SEARCH_ENTRY_HISTORY_INDEX_KEY, String(historyIndex));
  }

  return (
    <header className="app-header shrink-0 border-b border-black bg-black px-5 py-3 text-white">
      <div className="app-header__inner flex items-center gap-3">
        <h1 className="app-header__title shrink-0 text-[22px] tracking-[-0.05em]">
          분철이지
        </h1>
        <Link
          href="/search"
          onClick={handleSearchClick}
          className="app-header__search flex h-10 min-w-0 flex-1 items-center justify-between rounded-full bg-white px-4 text-left text-[13px] text-black"
        >
          <span className="min-w-0 truncate text-black/35">
            포토카드를 검색해보세요!
          </span>
          <SearchIcon />
        </Link>
        <button
          aria-label="알림"
          className="app-header__notification inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white"
        >
          <BellIcon />
        </button>
      </div>
    </header>
  );
}
