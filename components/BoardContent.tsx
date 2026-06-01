"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BackIcon, BellIcon } from "@/components/icons";

type BoardCategory = "all" | "notice" | "alert";

type BoardItem = {
  id: number;
  category: Exclude<BoardCategory, "all">;
  title: string;
  date: string;
  isNew?: boolean;
  isPinned?: boolean;
};

const boardItems: BoardItem[] = [
  {
    id: 1,
    category: "notice",
    title: "입금 확인 방식이 계좌이체 기반으로 변경될 예정이에요",
    date: "오늘",
    isNew: true,
    isPinned: true,
  },
  {
    id: 2,
    category: "alert",
    title: "낙찰된 분철은 결제 가능 시간 안에 입금해 주세요",
    date: "오늘",
    isNew: true,
  },
  {
    id: 3,
    category: "notice",
    title: "편의점 반값택배 배송지는 상품별 지원 택배사만 선택할 수 있어요",
    date: "5월 31일",
  },
  {
    id: 4,
    category: "alert",
    title: "마감된 입찰은 주최자 확인 후 결제 대기 상태로 바뀝니다",
    date: "5월 30일",
  },
  {
    id: 5,
    category: "notice",
    title: "최애 아티스트는 최대 5개까지 등록할 수 있어요",
    date: "5월 29일",
  },
  {
    id: 6,
    category: "notice",
    title: "분철 등록 시 멤버별 옵션과 배송 방법을 다시 확인해 주세요",
    date: "5월 28일",
  },
];

const categoryLabels: Record<BoardCategory, string> = {
  all: "전체",
  alert: "알림",
  notice: "공지",
};

function getCategoryTone(category: BoardItem["category"]) {
  return category === "notice"
    ? "bg-black text-white"
    : "bg-[#f2f2f2] text-black/55";
}

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

export function BoardContent() {
  const router = useRouter();
  const [category, setCategory] = useState<BoardCategory>("all");
  const filteredItems = useMemo(() => {
    if (category === "all") {
      return boardItems;
    }

    return boardItems.filter((item) => item.category === category);
  }, [category]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="board-header shrink-0 px-4 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <button
            aria-label="이전 화면"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white"
            onClick={() => {
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
        <section className="tab-content-enter">
          <div className="rounded-[1.15rem] border border-black/10 bg-white">
            {filteredItems.map((item, index) => (
              <article
                className={`flex min-h-[4.75rem] items-center gap-3 px-4 py-3 ${
                  index === 0 ? "" : "border-t border-black/10"
                }`}
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
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
