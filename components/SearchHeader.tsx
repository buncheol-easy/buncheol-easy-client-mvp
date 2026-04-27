"use client";

import { BackIcon, SearchIcon } from "@/components/icons";

type SearchHeaderProps = {
  onBack?: () => void;
};

export function SearchHeader({ onBack }: SearchHeaderProps) {
  return (
    <header className="shrink-0 border-b border-black bg-black px-4 pb-4 pt-5 text-white">
      <div className="flex h-12 items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로가기"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-white"
        >
          <BackIcon />
        </button>

        <label className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-[1rem] bg-white px-4 text-black">
          <input
            aria-label="검색어"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-black/35"
            placeholder="포토카드를 검색해보세요!"
            type="search"
          />
          <SearchIcon />
        </label>
      </div>
    </header>
  );
}
