"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArtistRail, type ArtistRailItem } from "@/components/ArtistRail";
import { BottomNavigator } from "@/components/BottomNavigator";
import { HomeContent } from "@/components/HomeContent";
import { CloseIcon } from "@/components/icons";
import type { ProductCardItem } from "@/components/ProductCard";
import { ProductGrid } from "@/components/ProductGrid";
import { SearchHeader } from "@/components/SearchHeader";

type RecentSearch = {
  label: string;
};

type PopularArtist = {
  rank: number;
  name: string;
  group: string;
  initials: string;
  tone: string;
};

type SearchExperienceProps = {
  query?: string;
};

const recentSearches: RecentSearch[] = [
  { label: "카리나" },
  { label: "사나" },
  { label: "설화" },
];

const popularArtists: PopularArtist[] = [
  {
    rank: 1,
    name: "안유진",
    group: "IVE",
    initials: "AY",
    tone: "from-stone-100 via-zinc-50 to-neutral-300",
  },
  {
    rank: 2,
    name: "카리나",
    group: "aespa",
    initials: "KR",
    tone: "from-zinc-900 via-zinc-700 to-stone-400",
  },
  {
    rank: 3,
    name: "사나",
    group: "TWICE",
    initials: "SN",
    tone: "from-neutral-200 via-white to-zinc-300",
  },
  {
    rank: 4,
    name: "설화",
    group: "NewJeans",
    initials: "SH",
    tone: "from-black via-zinc-800 to-zinc-400",
  },
  {
    rank: 5,
    name: "윈터",
    group: "aespa",
    initials: "WT",
    tone: "from-stone-300 via-zinc-100 to-white",
  },
];

const resultArtists: ArtistRailItem[] = [
  {
    id: "wonyoung",
    name: "장원영",
    group: "IVE",
    initials: "WY",
    tone: "from-zinc-100 via-white to-zinc-300",
  },
  {
    id: "yujin",
    name: "안유진",
    group: "IVE",
    initials: "YJ",
    tone: "from-stone-200 via-zinc-50 to-neutral-300",
  },
  {
    id: "karina",
    name: "카리나",
    group: "aespa",
    initials: "KR",
    tone: "from-neutral-200 via-stone-100 to-zinc-200",
  },
  {
    id: "winter",
    name: "윈터",
    group: "aespa",
    initials: "WR",
    tone: "from-neutral-200 via-stone-100 to-zinc-200",
  },
];

const resultItems: ProductCardItem[] = [
  {
    id: "result-love-dive-wonyoung-1st",
    title: "러브다이브 미공포 1차 분철",
    member: "장원영",
    era: "IVE LOVE DIVE",
    price: "3,000원",
    rating: "4.8",
    reviews: "41",
    badge: "인기",
    liked: true,
    tone: "from-black via-zinc-800 to-zinc-500",
  },
  {
    id: "result-favorite-cut-wonyoung-small",
    title: "최애컷 포카 소량 분철",
    member: "장원영",
    era: "공식 MD",
    price: "5,500원",
    rating: "4.9",
    reviews: "63",
    badge: "추천",
    liked: true,
    tone: "from-zinc-700 via-zinc-500 to-zinc-100",
  },
  {
    id: "result-season-greeting-yujin-special",
    title: "시즌그리팅 특전 공동구매",
    member: "안유진",
    era: "2026 SG",
    price: "4,500원",
    rating: "4.7",
    reviews: "29",
    badge: "신규",
    tone: "from-zinc-900 via-zinc-700 to-zinc-300",
  },
  {
    id: "result-drama-karina-fansign",
    title: "드라마 팬싸 포카 분철",
    member: "카리나",
    era: "aespa DRAMA",
    price: "6,000원",
    rating: "4.6",
    reviews: "87",
    badge: "마감임박",
    tone: "from-zinc-300 via-zinc-100 to-neutral-400",
  },
];
const SEARCH_ENTRY_HISTORY_INDEX_KEY = "buncheol-search-entry-history-index";
const SEARCH_QUERY_STACK_KEY = "buncheol-search-query-stack";
const SEARCH_SKIP_ENTER_KEY = "buncheol-search-skip-enter";

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

export function SearchExperience({ query }: SearchExperienceProps) {
  const router = useRouter();
  const isOpeningSearchSheetRef = useRef(false);
  const [isSearchEntered, setIsSearchEntered] = useState(
    takeShouldSkipSearchEnter,
  );
  const [isExiting, setIsExiting] = useState(false);
  const [isClearingSearch, setIsClearingSearch] = useState(false);
  const [searchSheetKey, setSearchSheetKey] = useState(0);
  const [isResultBacking, setIsResultBacking] = useState(false);
  const [isRestoringPreviousResult, setIsRestoringPreviousResult] =
    useState(false);
  const [previousKeyword, setPreviousKeyword] = useState<string | null>(null);
  const keyword = query?.trim();
  const hasResults = Boolean(keyword);

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
  }, [keyword]);

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

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]">
      <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-white">
        <div
          className={`pointer-events-none absolute inset-0 flex flex-col ${
            isExiting ? "home-page-underlay-exit" : ""
          }`}
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
        </div>

        <div
          className={`search-panel absolute inset-0 flex flex-col bg-white shadow-[-18px_0_36px_rgba(0,0,0,0.16)] ${
            isSearchEntered ? "search-panel--entered" : ""
          } ${isExiting ? "search-panel--exit" : ""} ${
            isResultBacking ? "search-panel--back" : ""
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
          <SearchHeader
            key={`search-header-${keyword ?? ""}`}
            defaultValue={keyword}
            inputReadOnly={hasResults}
            onInputActivate={openEmptySearch}
            onBack={handleBack}
            onSearch={handleSearch}
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-8">
            {hasResults ? (
              <>
                <section className="-mx-1">
                  <ArtistRail
                    items={resultArtists}
                    leadingItem={{ label: "전체", icon: "all", active: true }}
                  />
                </section>

                <section className="border-t border-black/10 pt-5">
                  <div className="mb-4 flex items-end justify-between">
                    <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                      검색 결과
                    </h2>
                    <span className="text-[13px] font-medium text-black/45">
                      {resultItems.length}개
                    </span>
                  </div>

                  <ProductGrid items={resultItems} />
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
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-black px-5 text-[15px] font-semibold tracking-[-0.04em] text-white"
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
            items={resultArtists}
            leadingItem={{ label: "전체", icon: "all", active: true }}
          />
        </section>

        <section className="border-t border-black/10 pt-5">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
              검색 결과
            </h2>
            <span className="text-[13px] font-medium text-black/45">
              {resultItems.length}개
            </span>
          </div>

          <ProductGrid items={resultItems} />
        </section>
      </>
    );
  }

}
