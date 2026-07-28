"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BusinessFooter } from "@/components/BusinessFooter";
import { BackIcon, BellIcon } from "@/components/icons";
import { SlidingTabs } from "@/components/SlidingTabs";
import {
  readCachedNoticeInboxMessages,
  requestCachedNoticeInboxMessages,
  requestInboxMessages,
} from "@/lib/auth-api";
import { getFreshAccessToken } from "@/lib/auth-session";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import {
  getBoardPostFromInboxMessage,
  type BoardCategory,
  type BoardPost,
} from "@/lib/board-posts";

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

function getInboxTypeFromFilter(category: BoardFilter) {
  if (category === "notice") {
    return "NOTICE" as const;
  }

  if (category === "alert") {
    return "NOTIFICATION" as const;
  }

  return undefined;
}

function mergePinnedItems(pinnedItems: BoardPost[], feedItems: BoardPost[]) {
  const seenIds = new Set<string>();

  return [...pinnedItems, ...feedItems].filter((item) => {
    if (seenIds.has(item.id)) {
      return false;
    }

    seenIds.add(item.id);
    return true;
  });
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

function rememberBoardReturn(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  window.sessionStorage.setItem(BOARD_SKIP_ENTER_KEY, "true");
}

export function BoardContent({
  onBack,
  skipEnterAnimation = false,
}: BoardContentProps) {
  const router = useRouter();
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const [shouldSkipEnterAnimation] = useState(
    () => skipEnterAnimation || takeShouldSkipBoardEnter(),
  );
  const [category, setCategory] = useState<BoardFilter>("all");
  const [feedItems, setFeedItems] = useState<BoardPost[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [message, setMessage] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pinnedItems, setPinnedItems] = useState<BoardPost[]>([]);
  const displayedItems =
    category === "alert"
      ? feedItems
      : mergePinnedItems(pinnedItems, feedItems);

  useEffect(() => {
    let isActive = true;

    async function loadMessages() {
      if (category === "alert" && !authState.isLoggedIn) {
        setFeedItems([]);
        setPinnedItems([]);
        setHasNext(false);
        setNextCursor(null);
        setMessage("로그인하면 내 알림을 확인할 수 있어요.");
        setIsLoading(false);
        return;
      }

      const requestParams = {
        size: 20,
        type: getInboxTypeFromFilter(category),
      };
      const shouldUseNoticeCache = category === "notice";
      const cachedMessages = shouldUseNoticeCache
        ? readCachedNoticeInboxMessages(requestParams)
        : null;

      if (cachedMessages) {
        setPinnedItems(cachedMessages.pinned.map(getBoardPostFromInboxMessage));
        setFeedItems(
          cachedMessages.feed.items.map(getBoardPostFromInboxMessage),
        );
        setHasNext(cachedMessages.feed.hasNext);
        setNextCursor(cachedMessages.feed.nextCursor);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }

      setMessage("");

      try {
        const accessToken = !shouldUseNoticeCache && authState.isLoggedIn
          ? await getFreshAccessToken()
          : undefined;
        const response = shouldUseNoticeCache
          ? await requestCachedNoticeInboxMessages(requestParams)
          : await requestInboxMessages(accessToken ?? undefined, requestParams);

        if (!isActive) {
          return;
        }

        setPinnedItems(response.pinned.map(getBoardPostFromInboxMessage));
        setFeedItems(response.feed.items.map(getBoardPostFromInboxMessage));
        setHasNext(response.feed.hasNext);
        setNextCursor(response.feed.nextCursor);
        setMessage("");
      } catch (error: unknown) {
        if (!isActive) {
          return;
        }

        setFeedItems([]);
        setPinnedItems([]);
        setHasNext(false);
        setNextCursor(null);
        setMessage(
          error instanceof Error
            ? error.message
            : "공지와 알림을 불러오지 못했어요.",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadMessages();

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, authState.isLoggedIn, category]);

  async function loadMoreMessages() {
    if (!hasNext || !nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setMessage("");

    try {
      const accessToken = category !== "notice" && authState.isLoggedIn
        ? await getFreshAccessToken()
        : undefined;
      const requestParams = {
        cursor: nextCursor,
        size: 20,
        type: getInboxTypeFromFilter(category),
      };
      const response =
        category === "notice"
          ? await requestCachedNoticeInboxMessages(requestParams)
          : await requestInboxMessages(accessToken ?? undefined, requestParams);

      setFeedItems((current) => [
        ...current,
        ...response.feed.items.map(getBoardPostFromInboxMessage),
      ]);
      setHasNext(response.feed.hasNext);
      setNextCursor(response.feed.nextCursor);
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "다음 소식을 불러오지 못했어요.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  }

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

        <div className="mt-5">
          <SlidingTabs
            barClassName="bg-[#f5f5f5]"
            onChange={setCategory}
            pillClassName="bg-black"
            tabs={(["all", "notice", "alert"] as const).map((value) => ({
              label: categoryLabels[value],
              value,
            }))}
            value={category}
          />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <section
          className={`flex min-h-full flex-col ${
            shouldSkipEnterAnimation ? "" : "tab-content-enter"
          }`}
        >
          {isLoading ? (
            <p className="rounded-[1.15rem] bg-[#f7f7f7] px-4 py-8 text-center text-[14px] font-semibold text-black/40">
              소식을 불러오는 중이에요.
            </p>
          ) : displayedItems.length > 0 ? (
            <>
              <div className="content-reveal rounded-[1.15rem] border border-black/10 bg-white">
                {displayedItems.map((item, index) => (
                  <Link
                    className={`flex min-h-[4.75rem] items-center px-4 py-3 ${
                      index === 0 ? "" : "border-t border-black/10"
                    }`}
                    href={`/board/${item.id}?from=board`}
                    key={item.id}
                    onClick={rememberBoardReturn}
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
                        <time className="ml-auto shrink-0 text-[12px] font-semibold text-black/35">
                          {item.date}
                        </time>
                      </div>
                      <h2 className="truncate text-[16px] font-semibold leading-tight tracking-[-0.04em] text-black">
                        {item.title}
                      </h2>
                    </div>
                  </Link>
                ))}
              </div>

              {hasNext ? (
                <button
                  className="mt-3 h-11 w-full rounded-full bg-[#f7f7f7] text-[13px] font-semibold tracking-[-0.04em] text-black/45 disabled:text-black/25"
                  disabled={isLoadingMore}
                  onClick={() => void loadMoreMessages()}
                  type="button"
                >
                  {isLoadingMore ? "불러오는 중" : "더 보기"}
                </button>
              ) : null}
            </>
          ) : (
            <p className="content-reveal rounded-[1.15rem] bg-[#f7f7f7] px-4 py-8 text-center text-[14px] font-semibold text-black/40">
              {message || "아직 도착한 소식이 없어요."}
            </p>
          )}

          {message && displayedItems.length > 0 ? (
            <p className="mt-3 text-center text-[12px] font-semibold text-black/35">
              {message}
            </p>
          ) : null}
          <div className="-mx-4 -mb-6 mt-auto pt-6">
            <BusinessFooter />
          </div>
        </section>
      </main>
    </div>
  );
}
