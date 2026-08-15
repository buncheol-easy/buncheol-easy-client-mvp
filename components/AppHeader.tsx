"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BellIcon, BrandSparkleIcon, SearchIcon } from "@/components/icons";
import { FEATURES } from "@/lib/feature-flags";
import { getHistoryIndex } from "@/lib/history-index";

const SEARCH_ENTRY_HISTORY_INDEX_KEY = "buncheol-search-entry-history-index";

type AppHeaderProps = {
  tone?: "dark" | "light";
};

export function AppHeader({ tone = "dark" }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isDarkTone = tone === "dark";

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
      className={`app-header shrink-0 border-b px-5 py-2.5 ${
        isDarkTone
          ? "border-black bg-black text-white"
          : "border-black/10 bg-white text-black"
      }`}
    >
      <div className="app-header__inner flex items-center gap-3">
        {/*
         * 로고를 "브랜드 별 + 텍스트"로 조립한다.
         * 워드마크 PNG 를 106×40 으로 줄여 쓰면 글자를 감싼 라운드 사각 테두리가 1px
         * 헤어라인이 되어 정체불명의 선으로 보이고, 좌측 카드 심볼은 뭉개진다.
         * 카드 심볼은 어두운 면이라 검정 헤더에서 묻히는데, 그렇다고 흰 칩 위에 올리면
         * 로고에만 배경이 생겨 헤더에서 따로 논다. 마크 안의 라임 별만 떼어 쓰면
         * 배경 없이도 검정·흰 헤더 양쪽에서 형태가 남는다.
         * 워드마크 PNG 는 404·서비스 소개처럼 80px 이상 확보되는 자리에만 남긴다.
         */}
        <button
          aria-label="분철이지 홈"
          className="motion-icon-button app-header__title -ml-1 flex h-10 shrink-0 items-center gap-1.5 rounded-[0.75rem] px-1"
          onClick={handleLogoClick}
          type="button"
        >
          <BrandSparkleIcon className="h-[18px] w-[18px] shrink-0 text-brand-strong" />
          <span className="text-[17px] font-bold leading-none tracking-[-0.055em]">
            분철이지
          </span>
        </button>
        {FEATURES.search ? (
          <a
            className="motion-card app-header__search flex h-10 min-w-0 flex-1 items-center justify-between rounded-full bg-white px-4 text-left text-[13px] text-black shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
            href="/search"
            onClick={handleSearchClick}
          >
            <span className="min-w-0 truncate text-[16px] text-black/35">
              포토카드
            </span>
            <SearchIcon />
          </a>
        ) : (
          <div aria-hidden="true" className="min-w-0 flex-1" />
        )}
        {/* 라임 원 + 그림자는 헤더 우측 끝으로 시선을 끌어당겨, 검색창이 빠진 가운데 공백을
            더 넓어 보이게 만들었다. 보조 액션답게 조용한 고스트 버튼으로 낮춘다. */}
        <Link
          aria-label="소식함"
          className={`motion-icon-button app-header__notification inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isDarkTone
              ? "bg-white/10 text-white"
              : "bg-surface-2 text-black"
          }`}
          href="/board"
        >
          <BellIcon />
        </Link>
      </div>
    </header>
  );
}
