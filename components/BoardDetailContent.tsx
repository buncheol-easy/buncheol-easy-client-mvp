"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackIcon, BellIcon, BidIcon } from "@/components/icons";
import type { BoardCategory, BoardPost } from "@/lib/board-posts";

const categoryLabels: Record<BoardCategory, string> = {
  alert: "알림",
  notice: "공지",
};

function getCategoryTone(category: BoardCategory) {
  return category === "notice"
    ? "bg-black text-white"
    : "bg-[#f2f2f2] text-black/55";
}

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

type BoardDetailContentProps = {
  isLoading?: boolean;
  message?: string;
  onBack?: () => void;
  post?: BoardPost | null;
};

export function BoardDetailContent({
  isLoading = false,
  message,
  onBack,
  post,
}: BoardDetailContentProps) {
  const router = useRouter();

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }

    const historyIndex = getHistoryIndex();

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace("/board");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="board-header shrink-0 px-4 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <button
            aria-label="이전 화면"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white"
            onClick={handleBack}
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
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {!post ? (
          <section className="tab-content-enter rounded-[1.15rem] bg-[#f7f7f7] px-4 py-8 text-center">
            <p className="text-[14px] font-semibold text-black/40">
              {isLoading
                ? "소식 내용을 불러오는 중이에요."
                : message || "소식 내용을 확인할 수 없어요."}
            </p>
            {!isLoading ? (
              <Link
                className="mx-auto mt-5 flex w-fit items-center justify-center rounded-full px-4 py-2 text-[13px] font-semibold tracking-[-0.04em] text-black/45"
                href="/board"
              >
                소식함 목록 보기
              </Link>
            ) : null}
          </section>
        ) : (
          <article className="tab-content-enter">
            <section className="rounded-[1.15rem] border border-black/10 bg-white px-4 py-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getCategoryTone(
                    post.category,
                  )}`}
                >
                  {categoryLabels[post.category]}
                </span>
                {post.isPinned ? (
                  <span className="rounded-full bg-[#fff6d8] px-2 py-1 text-[11px] font-semibold text-[#7a5c00]">
                    고정
                  </span>
                ) : null}
                {post.isNew ? (
                  <span className="rounded-full bg-black px-2 py-1 text-[11px] font-semibold text-white">
                    NEW
                  </span>
                ) : null}
                <time className="ml-auto text-[12px] font-semibold text-black/35">
                  {post.date}
                </time>
              </div>

              <h2 className="mt-4 text-[23px] font-semibold leading-[1.22] tracking-[-0.06em] text-black">
                {post.title}
              </h2>
              <p className="mt-3 text-[14px] font-medium leading-6 tracking-[-0.03em] text-black/45">
                {post.summary}
              </p>
            </section>

            <section className="mt-3 rounded-[1.15rem] bg-[#f7f7f7] px-4 py-5">
              <div className="grid gap-4">
                {post.body.map((paragraph, index) => (
                  <p
                    className="text-[15px] font-medium leading-7 tracking-[-0.04em] text-black/72"
                    key={`${paragraph}-${index}`}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>

            {post.action ? (
              <section className="mt-3 rounded-[1.15rem] bg-black px-4 py-4 text-white">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black">
                    <BidIcon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                      {post.action.title}
                    </p>
                    <p className="mt-1 text-[12px] font-medium text-white/45">
                      알림과 연결된 화면으로 바로 이동해요.
                    </p>
                  </div>
                </div>
                <Link
                  className="mt-4 flex h-11 items-center justify-center rounded-full bg-white text-[14px] font-semibold tracking-[-0.04em] text-black"
                  href={post.action.href}
                >
                  {post.action.label}
                </Link>
              </section>
            ) : (
              <Link
                className="mx-auto mt-5 flex w-fit items-center justify-center rounded-full px-4 py-2 text-[13px] font-semibold tracking-[-0.04em] text-black/45"
                href="/board"
              >
                소식함 목록 보기
              </Link>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
