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
    <header className="shrink-0 border-b border-black bg-black px-5 pb-4 pt-5 text-white">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-[26px] tracking-[-0.05em]">분철이지</h1>
        <button
          aria-label="알림"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white"
        >
          <BellIcon />
        </button>
      </div>

      <Link
        href="/search"
        onClick={handleSearchClick}
        className="flex h-12 w-full items-center justify-between rounded-[1rem] bg-white px-5 text-left text-[15px] text-black"
      >
        <span className="text-black/35">포토카드를 검색해보세요!</span>
        <SearchIcon />
      </Link>
    </header>
  );
}
