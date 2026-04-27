"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNavigator } from "@/components/BottomNavigator";
import { HomeContent } from "@/components/HomeContent";
import { CloseIcon } from "@/components/icons";
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

const recentSearches: RecentSearch[] = [
  { label: "가두" },
  { label: "나두" },
  { label: "다두" },
];

const popularArtists: PopularArtist[] = [
  {
    rank: 1,
    name: "Aodu",
    group: "IVE",
    initials: "AO",
    tone: "from-stone-100 via-zinc-50 to-neutral-300",
  },
  {
    rank: 2,
    name: "Bodu",
    group: "aespa",
    initials: "BO",
    tone: "from-zinc-900 via-zinc-700 to-stone-400",
  },
  {
    rank: 3,
    name: "Codu",
    group: "NewJeans",
    initials: "CO",
    tone: "from-neutral-200 via-white to-zinc-300",
  },
  {
    rank: 4,
    name: "Dodu",
    group: "LE SSERAFIM",
    initials: "DO",
    tone: "from-black via-zinc-800 to-zinc-400",
  },
  {
    rank: 5,
    name: "Eodu",
    group: "NMIXX",
    initials: "EO",
    tone: "from-stone-300 via-zinc-100 to-white",
  },
];

const SEARCH_ENTRY_HISTORY_LENGTH_KEY = "buncheol-search-entry-history-length";

export function SearchExperience() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  function closeSearch() {
    const searchEntryHistoryLength = sessionStorage.getItem(
      SEARCH_ENTRY_HISTORY_LENGTH_KEY,
    );

    sessionStorage.removeItem(SEARCH_ENTRY_HISTORY_LENGTH_KEY);

    if (
      searchEntryHistoryLength !== null &&
      window.history.length === Number(searchEntryHistoryLength) + 1
    ) {
      router.back();
      return;
    }

    router.replace("/");
  }

  function handleBack() {
    if (isExiting) {
      return;
    }

    setIsExiting(true);
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]">
      <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-white">
        <div
          className={`home-page-underlay pointer-events-none absolute inset-0 flex flex-col ${
            isExiting ? "home-page-underlay-exit" : ""
          }`}
        >
          <HomeContent />
          <BottomNavigator />
        </div>

        <div
          className={`search-page-enter absolute inset-0 flex flex-col bg-white shadow-[-18px_0_36px_rgba(0,0,0,0.16)] ${
            isExiting ? "search-page-exit" : ""
          }`}
          onAnimationEnd={(event) => {
            if (
              isExiting &&
              event.currentTarget === event.target &&
              event.animationName === "search-page-exit"
            ) {
              closeSearch();
            }
          }}
        >
          <SearchHeader onBack={handleBack} />

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
      </div>
    </main>
  );
}
