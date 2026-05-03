"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { BackIcon, SearchIcon } from "@/components/icons";

type SearchHeaderProps = {
  autoFocus?: boolean;
  autoFocusDelayMs?: number;
  backHref?: string;
  defaultValue?: string;
  inputReadOnly?: boolean;
  onSearch?: (query: string) => void;
  onInputActivate?: () => void;
  onBack?: () => void;
  placeholder?: string;
};

export function SearchHeader({
  autoFocus = false,
  autoFocusDelayMs = 0,
  backHref = "/",
  defaultValue,
  inputReadOnly = false,
  onSearch,
  onInputActivate,
  onBack,
  placeholder = "포토카드를 검색해보세요!",
}: SearchHeaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, autoFocusDelayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoFocus, autoFocusDelayMs]);

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }

    router.push(backHref);
  }

  function handleInputPointerDown(event: React.PointerEvent<HTMLInputElement>) {
    if (!inputReadOnly || !onInputActivate) {
      return;
    }

    event.preventDefault();
    onInputActivate();
  }

  return (
    <header className="search-header shrink-0 border-b border-black bg-black px-4 py-3 text-white">
      <form
        className="search-header__form flex h-10 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();

          const formData = new FormData(event.currentTarget);
          const query = formData.get("q")?.toString().trim();

          onSearch?.(query ?? "");
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로가기"
          className="search-header__back inline-flex h-10 w-10 shrink-0 items-center justify-center text-white"
        >
          <BackIcon />
        </button>

        <label className="search-header__field flex h-10 min-w-0 flex-1 items-center gap-3 rounded-full bg-white px-4 text-black">
          <input
            aria-label="검색어"
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-black/35"
            defaultValue={defaultValue}
            onPointerDown={handleInputPointerDown}
            readOnly={inputReadOnly}
            ref={inputRef}
            name="q"
            placeholder={placeholder}
            type="search"
          />
          <SearchIcon />
        </label>
      </form>
    </header>
  );
}
