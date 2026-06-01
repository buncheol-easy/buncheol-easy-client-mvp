"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackIcon, BellIcon } from "@/components/icons";
import { boardPosts, type BoardCategory } from "@/lib/board-posts";

type BoardFilter = BoardCategory | "all";

type BoardContentProps = {
  onBack?: () => void;
  skipEnterAnimation?: boolean;
};

const categoryLabels: Record<BoardFilter, string> = {
  all: "전체",
  alert: "알림",
  notice: "공지",
};

export const BOARD_SKIP_ENTER_KEY = "skip-board-enter-animation";

function getCategoryTone(category: BoardCategory) {
  return category === "notice"
    ? "bg-black text-white"
    : "bg-[#f2f2f2] text-black/55";
}

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

function takeShouldSkipBoardEnter() {
  if (typeof window === "undefined") {
    return false;
  }

  const shouldSkip =
    window.sessionStorage.getItem(BOARD_SKIP_ENTER_KEY) === "true";
  window.sessionStorage.removeItem(BOARD_SKIP_ENTER_KEY);

  return shouldSkip;
}

export function BoardContent({
  onBack,
  skipEnterAnimation = false,
}: BoardContentProps) {
  const router = useRouter();
  const [shouldSkipEnterAnimation] = useState(
    () => skipEnterAnimation || takeShouldSkipBoardEnter(),
  );
  const [category, setCategory] = useState<BoardFilter>("all");
  const filteredItems = useMemo(() => {
    if (category === "all") {
      return boardPosts;
    }

    return boardPosts.filter((item) => item.category === category);
  }, [category]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="board-header shrink-0 px-4 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <button
            aria-label="이전 화면"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white"
            onClick={() => {
              if (onBack) {
                onBack();
                return;
              }

              const historyIndex = getHistoryIndex();

              if (historyIndex !== null && historyIndex > 0) {
                router.back();
                return;
              }

              router.replace("/");
            }}
            type="button"
          >
            <BackIcon />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-black/35">
              News
            </p>
            <h1 className="mt-1 text-[24px] font-semibold leading-none tracking-[-0.05em]">
              소식함
            </h1>
          </div>
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5] text-black">
            <BellIcon />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-1.5 rounded-[0.95rem] bg-[#f5f5f5] p-1.5">
          {(["all", "notice", "alert"] as const).map((value) => {
            const isActive = category === value;

            return (
              <button
                className={`h-10 rounded-[0.8rem] text-[13px] font-semibold tracking-[-0.04em] ${
                  isActive ? "bg-black text-white" : "text-black/45"
                }`}
                key={value}
                onClick={() => setCategory(value)}
                type="button"
              >
                {categoryLabels[value]}
              </button>
            );
          })}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <section className={shouldSkipEnterAnimation ? "" : "tab-content-enter"}>
          <div className="rounded-[1.15rem] border border-black/10 bg-white">
            {filteredItems.map((item, index) => (
              <Link
                className={`flex min-h-[4.75rem] items-center gap-3 px-4 py-3 ${
                  index === 0 ? "" : "border-t border-black/10"
                }`}
                href={`/board/${item.id}?from=board`}
                key={item.id}
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getCategoryTone(
                        item.category,
                      )}`}
                    >
                      {categoryLabels[item.category]}
                    </span>
                    {item.isPinned ? (
                      <span className="rounded-full bg-[#fff6d8] px-2 py-1 text-[11px] font-semibold text-[#7a5c00]">
                        고정
                      </span>
                    ) : null}
                    {item.isNew ? (
                      <span className="h-2 w-2 rounded-full bg-black" />
                    ) : null}
                  </div>
                  <h2 className="truncate text-[16px] font-semibold leading-tight tracking-[-0.04em] text-black">
                    {item.title}
                  </h2>
                </div>
                <time className="shrink-0 text-[12px] font-semibold text-black/35">
                  {item.date}
                </time>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
