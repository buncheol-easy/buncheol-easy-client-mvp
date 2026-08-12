"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { ArtistImage } from "@/components/ArtistRail";
import { BusinessFooter } from "@/components/BusinessFooter";
import { BackIcon, HeartIcon, SearchIcon } from "@/components/icons";
import {
  addFavoriteGroup,
  removeFavoriteGroup,
  requestFavoriteGroups,
  requestGroups,
  type ApiGroup,
} from "@/lib/auth-api";
import {
  createLoginHref,
  getCurrentBrowserHref,
} from "@/lib/auth-navigation";
import {
  clearAuthState,
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import { getFreshAccessToken } from "@/lib/auth-session";
import {
  getGroupTone,
  getInitials,
  rankGroupSearchResults,
} from "@/lib/group-presenters";

type ArtistGroup = ApiGroup & {
  favorited: boolean;
};

type ArtistExploreContentProps = {
  onBack?: () => void;
};

const FAVORITE_GROUP_LIMIT = 5;
const TOAST_DURATION_MS = 2400;

function getFavoriteId(group: ArtistGroup) {
  return group.id;
}

function mergeFavoriteGroups(groups: ApiGroup[], favorites: ApiGroup[]) {
  const favoriteIds = new Set(favorites.map((group) => group.id));

  return groups.map((group) => ({
    ...group,
    favorited: group.favorited === true || favoriteIds.has(group.id),
  }));
}

function sortFavoriteGroupsFirst(groups: ArtistGroup[]) {
  return [...groups].sort((left, right) => {
    if (left.favorited !== right.favorited) {
      return left.favorited ? -1 : 1;
    }

    return 0;
  });
}

function ArtistAvatar({
  group,
  loading,
  variant = "card",
}: {
  group: ArtistGroup;
  loading?: "eager" | "lazy";
  variant?: "card" | "chip";
}) {
  const isChip = variant === "chip";
  const roundedClassName = isChip ? "rounded-[0.85rem]" : "rounded-[1.45rem]";

  return (
    <div
      className={`relative overflow-hidden border border-black/8 bg-[#f1f1f1] ${roundedClassName} ${
        isChip ? "h-10 w-10" : "h-24 w-24"
      }`}
    >
      {group.imageUrl ? (
        <ArtistImage
          imageUrl={group.imageUrl}
          loading={loading}
          name={group.name}
          roundedClassName={roundedClassName}
        />
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br font-semibold tracking-[-0.06em] text-black ${getGroupTone(group.id)} ${
            isChip ? "text-[14px]" : "text-[30px]"
          }`}
        >
          {getInitials(group.name)}
        </span>
      )}
    </div>
  );
}

export function ArtistExploreContent({ onBack }: ArtistExploreContentProps) {
  const router = useRouter();
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const [groups, setGroups] = useState<ArtistGroup[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldPreserveExploreOrder, setShouldPreserveExploreOrder] =
    useState(false);
  const pendingGroupIdsRef = useRef(new Set<string>());
  // 한도 초과처럼 화면을 바꿀 필요 없는 안내는 잠깐 떴다 사라지는 토스트로 알린다.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const favoriteGroups = groups.filter((group) => group.favorited);
  const favoriteCount = favoriteGroups.length;
  // 등록한 최애는 한도에 도달했을 때만이 아니라 항상 상단에 모아 보여준다 — 아티스트가 많아
  // 그리드를 훑어서는 내가 누구를 담았는지 확인하기 어렵다.
  const isFavoriteRailVisible = favoriteCount > 0;
  // 검색어 한 글자에 카드가 그룹 수(수백 개)만큼 갈린다. 입력과 같은 렌더에 묶으면 타이핑이 밀린다.
  // 랭킹 자체는 0.1ms 라 병목이 아니다 — 비용은 전부 카드 렌더 쪽이니 여기 최적화하지 말 것.
  const deferredQuery = useDeferredValue(query);
  const visibleGroups = useMemo(() => {
    const trimmedQuery = deferredQuery.trim();
    const shouldPinFavorites = !shouldPreserveExploreOrder;

    if (!trimmedQuery) {
      return shouldPinFavorites ? sortFavoriteGroupsFirst(groups) : groups;
    }

    const rankedGroups = rankGroupSearchResults(groups, trimmedQuery, 80);

    return shouldPinFavorites
      ? sortFavoriteGroupsFirst(rankedGroups)
      : rankedGroups;
  }, [groups, deferredQuery, shouldPreserveExploreOrder]);

  useEffect(() => {
    let isActive = true;

    async function loadGroups() {
      const accessToken = authState.isLoggedIn
        ? await getFreshAccessToken()
        : null;

      const allGroups = await requestGroups("");

      if (!authState.isLoggedIn || !accessToken) {
        return {
          groups: mergeFavoriteGroups(allGroups, []),
          message: "",
        };
      }

      try {
        const favoriteGroups = await requestFavoriteGroups(accessToken);

        return {
          groups: mergeFavoriteGroups(allGroups, favoriteGroups),
          message: "",
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "";

        if (message.includes("401") || message.includes("Unauthorized")) {
          clearAuthState();
        }

        return {
          groups: mergeFavoriteGroups(allGroups, []),
          message:
            error instanceof Error
              ? error.message
              : "최애 그룹을 불러오지 못했어요.",
        };
      }
    }

    loadGroups()
      .then((result) => {
        if (!isActive) {
          return;
        }

        setShouldPreserveExploreOrder(false);
        setGroups(result.groups);
        setMessage(result.message);
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        const message = error instanceof Error ? error.message : "";

        if (message.includes("401") || message.includes("Unauthorized")) {
          clearAuthState();
        }

        setShouldPreserveExploreOrder(false);
        setGroups([]);
        setMessage(
          error instanceof Error
            ? error.message
            : "아티스트 목록을 불러오지 못했어요.",
        );
      })
      .finally(() => {
        if (!isActive) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, authState.isLoggedIn]);

  async function handleFavoriteToggle(group: ArtistGroup) {
    if (!authState.isLoggedIn) {
      router.push(
        createLoginHref({
          cancelTo: getCurrentBrowserHref(),
          returnTo: "/artists",
        }),
      );
      return;
    }

    const accessToken = await getFreshAccessToken();

    if (!accessToken) {
      router.push(
        createLoginHref({
          cancelTo: getCurrentBrowserHref(),
          returnTo: "/artists",
        }),
      );
      return;
    }

    const nextFavorited = !group.favorited;
    const groupId = getFavoriteId(group);

    if (pendingGroupIdsRef.current.has(group.id)) {
      return;
    }

    // 서버도 막지만(GRP-005), 왕복 없이 즉시 이유를 알려준다. 화면 상태는 그대로 두고 토스트로만 알린다.
    if (nextFavorited && favoriteCount >= FAVORITE_GROUP_LIMIT) {
      showToast(
        `최애 아티스트는 최대 ${FAVORITE_GROUP_LIMIT}개까지 등록가능해요.`,
      );
      return;
    }

    pendingGroupIdsRef.current.add(group.id);
    setPendingGroupId(group.id);
    setShouldPreserveExploreOrder(true);
    setGroups((current) =>
      current.map((item) =>
        item.id === group.id ? { ...item, favorited: nextFavorited } : item,
      ),
    );

    try {
      if (nextFavorited) {
        const result = await addFavoriteGroup(accessToken, groupId);

        if (result.alreadyExists) {
          setGroups((current) =>
            current.map((item) =>
              item.id === group.id ? { ...item, favorited: true } : item,
            ),
          );
        }
      } else {
        await removeFavoriteGroup(accessToken, groupId);
      }

      setMessage("");
    } catch (error) {
      setGroups((current) =>
        current.map((item) =>
          item.id === group.id ? { ...item, favorited: !nextFavorited } : item,
        ),
      );
      setMessage(
        error instanceof Error
          ? error.message
          : "최애 그룹을 변경하지 못했어요.",
      );
    } finally {
      pendingGroupIdsRef.current.delete(group.id);
      setPendingGroupId(null);
    }
  }

  function showToast(text: string) {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToast(text);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, TOAST_DURATION_MS);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-white">
      <header className="shrink-0 border-b border-black/10 bg-white px-4 pb-4 pt-3">
        <div className="flex h-11 items-center gap-2">
          <button
            aria-label="뒤로가기"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white"
            onClick={onBack ?? (() => router.back())}
            type="button"
          >
            <BackIcon />
          </button>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-black/35">
              Artists
            </p>
            <h1 className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.06em]">
              아티스트
            </h1>
          </div>
        </div>

        <label className="mt-4 flex h-12 items-center gap-3 rounded-full bg-[#f4f4f4] px-4 text-black">
          <SearchIcon />
          <input
            aria-label="아티스트 검색"
            className="min-w-0 flex-1 bg-transparent text-[16px] font-medium outline-none placeholder:text-black/35"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="그룹 검색"
            type="search"
            value={query}
          />
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black/55 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            {favoriteCount}/{FAVORITE_GROUP_LIMIT}
          </span>
        </label>

        <div
          aria-hidden={!isFavoriteRailVisible}
          className={`overflow-hidden transition-[max-height,opacity,transform,margin-top] duration-200 ease-out motion-reduce:transition-none ${
            isFavoriteRailVisible
              ? "mt-4 max-h-40 translate-y-0 opacity-100"
              : "pointer-events-none mt-0 max-h-0 -translate-y-1 opacity-0"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-like/10 text-like">
              <HeartIcon className="h-3.5 w-3.5" filled />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold tracking-[-0.03em]">
                나의 최애
              </p>
              <p className="mt-0.5 text-[12px] font-semibold text-black/45">
                최대 {FAVORITE_GROUP_LIMIT}개까지 담을 수 있어요.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {favoriteGroups.map((group) => {
              const isPending = pendingGroupId === group.id;

              return (
                <button
                  aria-label={`${group.name} 최애 해제`}
                  className="flex min-w-[218px] max-w-[250px] items-center gap-2 rounded-[1.25rem] border border-black/10 bg-[#f7f7f7] py-1.5 pl-1.5 pr-2 text-left disabled:opacity-45"
                  disabled={isPending || !isFavoriteRailVisible}
                  key={group.id}
                  onClick={() => handleFavoriteToggle(group)}
                  tabIndex={isFavoriteRailVisible ? undefined : -1}
                  type="button"
                >
                  <ArtistAvatar group={group} variant="chip" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[13px] font-semibold leading-tight tracking-[-0.04em]">
                      {group.name}
                    </span>
                  </span>
                  <span className="inline-flex h-7 shrink-0 items-center justify-center rounded-full bg-black px-3 text-[12px] font-semibold text-white">
                    해제
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
        <div className="flex min-h-full flex-col">
        {message ? (
          <div className="mb-4 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3">
            <p className="text-[13px] font-semibold text-black/45">
              {message}
            </p>
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                className="h-[194px] rounded-[1.2rem] bg-[#f5f5f5]"
                key={index}
              />
            ))}
          </div>
        ) : (
          /* 0건일 때도 그리드를 유지한다. 빈 상태와 삼항으로 가르면 0건 ↔ N건을 오갈 때마다
             카드 전부가 remount 되고 content-reveal 이 재생된다. */
          <>
          <div className="content-reveal grid grid-cols-2 gap-3">
            {visibleGroups.map((group) => {
              const isPending = pendingGroupId === group.id;
              const isFavoriteLimitReached =
                favoriteCount >= FAVORITE_GROUP_LIMIT && !group.favorited;

              return (
                <article
                  className="artist-card rounded-[1.2rem] border border-black/10 bg-white p-4"
                  key={group.id}
                >
                  <div className="flex justify-center">
                    <ArtistAvatar group={group} loading="lazy" />
                  </div>
                  <div
                    className={`-mx-1 mt-4 flex min-h-[3rem] items-center gap-1.5 rounded-[1rem] py-1 pl-3 pr-1 ${
                      group.favorited ? "bg-[#f6f6f6]" : "bg-white"
                    }`}
                  >
                    {/* break-keep 만 두면 공백 없는 긴 이름("BABYMONSTER")이 어디서도 안 끊겨
                        하트 밑으로 잘린다. 이름 자리는 76~111px 뿐이라 한 줄로는 애초에 못 담는다. */}
                    <h2 className="line-clamp-2 min-w-0 flex-1 break-keep wrap-anywhere text-[16px] font-semibold leading-tight tracking-[-0.04em]">
                      {group.name}
                    </h2>
                    <button
                      aria-label={group.favorited ? "최애 해제" : "최애 추가"}
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px] font-semibold transition-transform active:scale-95 ${
                        group.favorited
                          ? "bg-like/10 text-like ring-1 ring-like/25"
                          : "border border-black/10 bg-white text-black/45"
                      } ${
                        isFavoriteLimitReached
                          ? "bg-[#f4f4f4] text-black/25 shadow-none"
                          : ""
                      }`}
                      /* 한도에 걸린 하트도 눌리게 둔다 — 비활성이면 왜 안 되는지 알릴 방법이 없다. */
                      disabled={isPending}
                      onClick={() => handleFavoriteToggle(group)}
                      type="button"
                    >
                      <HeartIcon
                        className="h-[18px] w-[18px]"
                        filled={group.favorited}
                      />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {visibleGroups.length === 0 ? (
            <div className="rounded-[1.2rem] bg-[#f7f7f7] px-4 py-8 text-center">
              <p className="text-[15px] font-semibold text-black/45">
                검색 결과가 없어요.
              </p>
            </div>
          ) : null}
          </>
        )}
        <div className="-mx-4 -mb-6 mt-auto pt-6">
          <BusinessFooter />
        </div>
        </div>
      </div>

      {toast ? (
        <div
          aria-live="polite"
          className="artist-toast pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-6"
          role="status"
        >
          <p className="max-w-full rounded-full bg-black/85 px-4 py-2.5 text-center text-[13px] font-semibold tracking-[-0.03em] text-white shadow-[0_10px_28px_rgba(0,0,0,0.24)] backdrop-blur-sm">
            {toast}
          </p>
        </div>
      ) : null}
    </div>
  );
}
