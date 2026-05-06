"use client";

import { useEffect, useRef, useState, type UIEvent } from "react";
import { useRouter } from "next/navigation";
import { ArtistRail } from "@/components/ArtistRail";
import { BottomNavigator } from "@/components/BottomNavigator";
import { HomeContent } from "@/components/HomeContent";
import { CloseIcon } from "@/components/icons";
import { ProductGrid } from "@/components/ProductGrid";
import { SearchHeader } from "@/components/SearchHeader";
import { SwipeUnderlay } from "@/components/SwipeUnderlay";
import {
  popularArtists,
  recentSearches,
  searchResultArtists,
  searchResultItems,
} from "@/lib/mock-home-search";

type SearchExperienceProps = {
  query?: string;
  skipEnterAnimation?: boolean;
};

const SEARCH_ENTRY_HISTORY_INDEX_KEY = "buncheol-search-entry-history-index";
const SEARCH_QUERY_STACK_KEY = "buncheol-search-query-stack";
export const SEARCH_SKIP_ENTER_KEY = "buncheol-search-skip-enter";
const SCROLL_REVEAL_THRESHOLD = 8;
const SCROLL_HIDE_START = 24;
const SCROLL_EDGE_GUARD = 16;

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

function readSearchQueryStack() {
  const rawStack = sessionStorage.getItem(SEARCH_QUERY_STACK_KEY);

  if (!rawStack) {
    return [];
  }

  try {
    const stack = JSON.parse(rawStack);
    return Array.isArray(stack)
      ? stack.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeSearchQueryStack(stack: string[]) {
  sessionStorage.setItem(SEARCH_QUERY_STACK_KEY, JSON.stringify(stack));
}

function getPreviousSearchQuery(currentQuery: string) {
  const stack = readSearchQueryStack();
  const currentIndex = stack.lastIndexOf(currentQuery);

  if (currentIndex > 0) {
    return stack[currentIndex - 1];
  }

  return null;
}

function popCurrentSearchQuery(currentQuery: string) {
  const stack = readSearchQueryStack();
  const currentIndex = stack.lastIndexOf(currentQuery);

  if (currentIndex >= 0) {
    writeSearchQueryStack(stack.slice(0, currentIndex));
  }
}

function markNextSearchEnterSkipped() {
  sessionStorage.setItem(SEARCH_SKIP_ENTER_KEY, "true");
}

function takeShouldSkipSearchEnter() {
  if (typeof window === "undefined") {
    return false;
  }

  const shouldSkip = sessionStorage.getItem(SEARCH_SKIP_ENTER_KEY) === "true";

  if (shouldSkip) {
    sessionStorage.removeItem(SEARCH_SKIP_ENTER_KEY);
  }

  return shouldSkip;
}

export function SearchExperience({
  query,
  skipEnterAnimation = false,
}: SearchExperienceProps) {
  const router = useRouter();
  const isOpeningSearchSheetRef = useRef(false);
  const lastResultScrollTopRef = useRef(0);
  const [isSearchEntered, setIsSearchEntered] = useState(
    () => skipEnterAnimation || takeShouldSkipSearchEnter(),
  );
  const [isExiting, setIsExiting] = useState(false);
  const [isClearingSearch, setIsClearingSearch] = useState(false);
  const [searchSheetKey, setSearchSheetKey] = useState(0);
  const [isResultBacking, setIsResultBacking] = useState(false);
  const [isRestoringPreviousResult, setIsRestoringPreviousResult] =
    useState(false);
  const [previousKeyword, setPreviousKeyword] = useState<string | null>(null);
  const [isResultHeaderHidden, setIsResultHeaderHidden] = useState(false);
  const keyword = query?.trim();
  const hasResults = Boolean(keyword);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--system-bottom-color",
      hasResults ? "#000000" : "#ffffff",
    );

    return () => {
      document.documentElement.style.setProperty("--system-bottom-color", "#000000");
    };
  }, [hasResults]);

  useEffect(() => {
    if (isSearchEntered) {
      return;
    }

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        setIsSearchEntered(true);
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [isSearchEntered]);

  useEffect(() => {
    if (isRestoringPreviousResult) {
      setIsResultBacking(false);
      setPreviousKeyword(null);

      const animationFrame = requestAnimationFrame(() => {
        setIsRestoringPreviousResult(false);
      });

      return () => {
        cancelAnimationFrame(animationFrame);
      };
    }

    if (!keyword) {
      return;
    }

    const stack = readSearchQueryStack();

    if (stack.at(-1) !== keyword) {
      writeSearchQueryStack([...stack, keyword]);
    }
  }, [isRestoringPreviousResult, keyword]);

  function closeSearch() {
    const searchEntryHistoryIndex = sessionStorage.getItem(
      SEARCH_ENTRY_HISTORY_INDEX_KEY,
    );

    sessionStorage.removeItem(SEARCH_ENTRY_HISTORY_INDEX_KEY);
    sessionStorage.removeItem(SEARCH_QUERY_STACK_KEY);
    sessionStorage.removeItem(SEARCH_SKIP_ENTER_KEY);

    if (searchEntryHistoryIndex !== null) {
      const currentHistoryIndex = getHistoryIndex();
      const searchHistoryDelta =
        currentHistoryIndex === null
          ? 0
          : currentHistoryIndex - Number(searchEntryHistoryIndex);

      if (searchHistoryDelta > 0) {
        window.history.go(-searchHistoryDelta);
        return;
      }
    }

    router.replace("/");
  }

  function handleBack() {
    if (isExiting || isResultBacking) {
      return;
    }

    if (isClearingSearch) {
      isOpeningSearchSheetRef.current = false;
      setIsClearingSearch(false);
      return;
    }

    if (hasResults) {
      const previousSearchQuery = getPreviousSearchQuery(keyword ?? "");

      if (!previousSearchQuery) {
        setIsExiting(true);
        return;
      }

      setPreviousKeyword(previousSearchQuery);
      setIsResultBacking(true);
      return;
    }

    setIsExiting(true);
  }

  function openEmptySearch() {
    if (!hasResults || isOpeningSearchSheetRef.current) {
      return;
    }

    isOpeningSearchSheetRef.current = true;
    setSearchSheetKey((currentKey) => currentKey + 1);
    setIsClearingSearch(true);
  }

  function handleSearch(nextQuery: string) {
    if (!nextQuery) {
      if (hasResults) {
        isOpeningSearchSheetRef.current = true;
        setSearchSheetKey((currentKey) => currentKey + 1);
        setIsClearingSearch(true);
        return;
      }

      isOpeningSearchSheetRef.current = false;
      setIsClearingSearch(false);
      router.replace("/search");
      return;
    }

    isOpeningSearchSheetRef.current = false;
    setIsClearingSearch(false);
    const nextHref = `/search?q=${encodeURIComponent(nextQuery)}`;

    if (hasResults) {
      router.push(nextHref);
      return;
    }

    router.replace(nextHref);
  }

  function handleResultScroll(event: UIEvent<HTMLDivElement>) {
    if (!hasResults) {
      return;
    }

    const scrollElement = event.currentTarget;
    const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
    const nextScrollTop = Math.max(0, Math.min(scrollElement.scrollTop, maxScrollTop));
    const previousScrollTop = lastResultScrollTopRef.current;
    const isNearBottom = maxScrollTop - nextScrollTop <= SCROLL_EDGE_GUARD;

    if (nextScrollTop <= SCROLL_REVEAL_THRESHOLD) {
      setIsResultHeaderHidden(false);
      lastResultScrollTopRef.current = nextScrollTop;
      return;
    }

    if (
      isNearBottom ||
      Math.abs(nextScrollTop - previousScrollTop) <= SCROLL_REVEAL_THRESHOLD
    ) {
      lastResultScrollTopRef.current = nextScrollTop;
      return;
    }

    const shouldHide =
      nextScrollTop > previousScrollTop && nextScrollTop > SCROLL_HIDE_START;

    setIsResultHeaderHidden((current) =>
      current === shouldHide ? current : shouldHide,
    );
    lastResultScrollTopRef.current = nextScrollTop;
  }

  return (
    <main
      className={`system-chrome-black h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111] ${
        hasResults
          ? "search-results-shell"
          : "search-entry-shell system-chrome-bottom-white"
      }`}
    >
      <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-white">
        <SwipeUnderlay
          isEntered={isSearchEntered}
          isExiting={isExiting || isResultBacking}
        >
          {isResultBacking && previousKeyword ? (
            <>
              <SearchHeader
                defaultValue={previousKeyword}
                inputReadOnly
                onBack={() => undefined}
              />
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-8">
                {renderPreviousSearchResultsContent()}
              </div>
              <BottomNavigator activeLabel={null} />
            </>
          ) : (
            <>
              <HomeContent />
              <BottomNavigator />
            </>
          )}
        </SwipeUnderlay>

        <div
          className={`search-panel absolute inset-0 flex flex-col bg-white shadow-[-18px_0_36px_rgba(0,0,0,0.16)] ${
            isSearchEntered ? "search-panel--entered" : ""
          } ${isExiting ? "search-panel--exit" : ""} ${
            isResultBacking ? "search-panel--back" : ""
          } ${
            isClearingSearch ? "swipe-underlay swipe-underlay-active" : ""
          } ${
            isRestoringPreviousResult ? "search-panel--no-transition" : ""
          }`}
          onTransitionEnd={(event) => {
            if (
              isExiting &&
              event.currentTarget === event.target &&
              event.propertyName === "transform"
            ) {
              closeSearch();
              return;
            }

            if (
              isResultBacking &&
              event.currentTarget === event.target &&
              event.propertyName === "transform"
            ) {
              popCurrentSearchQuery(keyword ?? "");
              markNextSearchEnterSkipped();
              setIsRestoringPreviousResult(true);
              router.back();
            }
          }}
        >
          <div className="scroll-reactive-shell">
            <div
              className={`scroll-reactive-header ${
                hasResults && isResultHeaderHidden
                  ? "scroll-reactive-header--hidden"
                  : ""
              }`}
            >
              <div className="scroll-reactive-header__inner">
                <SearchHeader
                  key={`search-header-${keyword ?? ""}`}
                  defaultValue={keyword}
                  inputReadOnly={hasResults}
                  onInputActivate={openEmptySearch}
                  onBack={handleBack}
                  onSearch={handleSearch}
                />
              </div>
            </div>

            <div
              className="scroll-reactive-content scroll-reactive-content--search min-h-0 flex-1 overflow-y-auto px-5"
              onScroll={handleResultScroll}
            >
              {hasResults ? (
                <>
                  <section className="-mx-1">
                    <ArtistRail
                      items={searchResultArtists}
                      leadingItem={{ label: "전체", icon: "all", active: true }}
                    />
                  </section>

                  <section className="border-t border-black/10 pt-5">
                    <div className="mb-4 flex items-end justify-between">
                      <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                        검색 결과
                      </h2>
                      <span className="text-[13px] font-medium text-black/45">
                        {searchResultItems.length}개
                      </span>
                    </div>

                    <ProductGrid items={searchResultItems} />
                  </section>
                </>
              ) : (
                <>
                  <section>
                    <h2 className="text-[28px] font-semibold tracking-[-0.06em]">
                      최근 검색어
                    </h2>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {recentSearches.map((search) => (
                        <button
                          key={search.label}
                          onClick={() => handleSearch(search.label)}
                          className="inline-flex h-10 items-center gap-2 rounded-full bg-black px-5 text-[15px] font-semibold tracking-[-0.04em] text-white"
                          type="button"
                        >
                          <span>{search.label}</span>
                          <CloseIcon />
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="mt-20">
                    <h2 className="text-[28px] font-semibold tracking-[-0.06em]">
                      인기 아티스트
                    </h2>
                    <div className="mt-5 border-y border-black/20">
                      {popularArtists.map((artist) => (
                        <button
                          key={artist.rank}
                          className="grid h-[72px] w-full grid-cols-[3.5rem_4.5rem_1fr] items-center border-b border-black/20 text-left last:border-b-0"
                          onClick={() => handleSearch(artist.name)}
                          type="button"
                        >
                          <span className="text-[21px] font-medium tracking-[-0.04em]">
                            {artist.rank}
                          </span>
                          <span
                            className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${artist.tone} text-[13px] font-semibold tracking-[-0.05em] text-black ring-1 ring-black/10`}
                          >
                            {artist.initials}
                          </span>
                          <span>
                            <span className="block text-[24px] font-medium tracking-[-0.05em]">
                              {artist.name}
                            </span>
                            <span className="mt-0.5 block text-[12px] font-medium text-black/40">
                              {artist.group}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>

          {hasResults ? <BottomNavigator activeLabel={null} /> : null}
        </div>

        {isClearingSearch ? (
          <div
            key={searchSheetKey}
            className="search-panel-enter-motion absolute inset-0 z-10 flex flex-col bg-white shadow-[-18px_0_36px_rgba(0,0,0,0.16)]"
          >
            <SearchHeader
              autoFocus
              autoFocusDelayMs={320}
              key="empty-search-header"
              defaultValue=""
              onBack={handleBack}
              onSearch={handleSearch}
            />

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-8">
              <section>
                <h2 className="text-[28px] font-semibold tracking-[-0.06em]">
                  최근 검색어
                </h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  {recentSearches.map((search) => (
                    <button
                      key={search.label}
                      className="inline-flex h-10 items-center gap-2 rounded-full bg-black px-5 text-[15px] font-semibold tracking-[-0.04em] text-white"
                      onClick={() => handleSearch(search.label)}
                      type="button"
                    >
                      <span>{search.label}</span>
                      <CloseIcon />
                    </button>
                  ))}
                </div>
              </section>

              <section className="mt-20">
                <h2 className="text-[28px] font-semibold tracking-[-0.06em]">
                  인기 아티스트
                </h2>
                <div className="mt-5 border-y border-black/20">
                  {popularArtists.map((artist) => (
                    <button
                      key={artist.rank}
                      className="grid h-[72px] w-full grid-cols-[3.5rem_4.5rem_1fr] items-center border-b border-black/20 text-left last:border-b-0"
                      onClick={() => handleSearch(artist.name)}
                      type="button"
                    >
                      <span className="text-[21px] font-medium tracking-[-0.04em]">
                        {artist.rank}
                      </span>
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${artist.tone} text-[13px] font-semibold tracking-[-0.05em] text-black ring-1 ring-black/10`}
                      >
                        {artist.initials}
                      </span>
                      <span>
                        <span className="block text-[24px] font-medium tracking-[-0.05em]">
                          {artist.name}
                        </span>
                        <span className="mt-0.5 block text-[12px] font-medium text-black/40">
                          {artist.group}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );

  function renderPreviousSearchResultsContent() {
    return (
      <>
        <section className="-mx-1">
          <ArtistRail
            items={searchResultArtists}
            leadingItem={{ label: "전체", icon: "all", active: true }}
          />
        </section>

        <section className="border-t border-black/10 pt-5">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
              검색 결과
            </h2>
            <span className="text-[13px] font-medium text-black/45">
              {searchResultItems.length}개
            </span>
          </div>

          <ProductGrid items={searchResultItems} />
        </section>
      </>
    );
  }

}
