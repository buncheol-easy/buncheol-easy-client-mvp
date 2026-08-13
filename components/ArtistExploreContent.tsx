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
import {
  useAllGroupsQuery,
  useFavoriteGroupsCache,
  useFavoriteGroupsQuery,
} from "@/lib/group-queries";

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

// 정렬 기준은 "지금 최애인지"가 아니라 "이 목록을 세울 때 최애였는지"다 (pinnedIds).
// 하트를 누른 그룹만 조용히 빈 하트가 되고 카드는 제자리를 지킨다 — 현재 상태로 매번 다시
// 정렬하면 하나를 해제하는 순간 상단에 모여 있던 최애가 전부 제자리로 흩어진다.
function sortFavoriteGroupsFirst(groups: ArtistGroup[], pinnedIds: Set<string>) {
  return [...groups].sort((left, right) => {
    const leftPinned = pinnedIds.has(left.id);
    const rightPinned = pinnedIds.has(right.id);

    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }

    return 0;
  });
}

function getFavoritedIds(groups: ArtistGroup[]) {
  return new Set(
    groups.filter((group) => group.favorited).map((group) => group.id),
  );
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
  // 홈 레일과 같은 캐시를 본다. 서버 프리페치(app/artists/page.tsx)로 전체 그룹은
  // 첫 렌더부터 채워져 있고, 최애도 홈에서 이미 받아뒀다면 그대로 재사용한다 —
  // 그래서 진입할 때 8칸 스켈레톤과 0/5 카운터가 스쳐 지나가지 않는다.
  const allGroupsQuery = useAllGroupsQuery();
  const favoriteGroupsQuery = useFavoriteGroupsQuery(authState.isLoggedIn);
  const { setFavorited } = useFavoriteGroupsCache(authState.isLoggedIn);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  // 하트를 처음 누른 시점의 최애 집합을 고정해 그 뒤로는 카드가 움직이지 않게 한다.
  const [pinnedFavoriteIds, setPinnedFavoriteIds] = useState<Set<string> | null>(
    null,
  );
  const allGroupsData = allGroupsQuery.data;
  const favoriteGroupsData = favoriteGroupsQuery.data;
  const isLoading = allGroupsData === undefined;
  const groups = useMemo<ArtistGroup[]>(
    () => mergeFavoriteGroups(allGroupsData ?? [], favoriteGroupsData ?? []),
    [allGroupsData, favoriteGroupsData],
  );
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
  const trimmedQuery = deferredQuery.trim();
  const [lastPinnedQuery, setLastPinnedQuery] = useState(trimmedQuery);

  // 검색어가 바뀌면 목록이 통째로 다시 구성돼 지킬 자리가 없다. 고정을 풀어 현재 최애 기준으로
  // 다시 정렬한다 — 안 풀면 검색을 다녀온 뒤 이미 해제한 그룹이 계속 상단에 박혀 있다.
  // 렌더 중 조정이라 다음 커밋 전에 수렴한다 (effect 로 미루면 헌 순서가 한 프레임 비친다).
  if (lastPinnedQuery !== trimmedQuery) {
    setLastPinnedQuery(trimmedQuery);
    setPinnedFavoriteIds(null);
  }

  const visibleGroups = useMemo(() => {
    const pinnedIds = pinnedFavoriteIds ?? getFavoritedIds(groups);

    if (!trimmedQuery) {
      return sortFavoriteGroupsFirst(groups, pinnedIds);
    }

    const rankedGroups = rankGroupSearchResults(groups, trimmedQuery, 80);

    return sortFavoriteGroupsFirst(rankedGroups, pinnedIds);
  }, [groups, trimmedQuery, pinnedFavoriteIds]);

  // 최애 조회가 401 이면 토큰이 죽은 것이라 로그인 상태를 정리한다 (기존 fetch 경로와 동일).
  const favoriteGroupsError = favoriteGroupsQuery.error;

  useEffect(() => {
    if (!favoriteGroupsError) {
      return;
    }

    const message = favoriteGroupsError.message;

    if (message.includes("401") || message.includes("Unauthorized")) {
      clearAuthState();
    }
  }, [favoriteGroupsError]);

  // 토글 실패 안내(message)가 있으면 그것을 우선 보여준다 — 사용자가 방금 한 행동의 결과다.
  const loadErrorMessage = allGroupsQuery.isError
    ? (allGroupsQuery.error.message || "아티스트 목록을 불러오지 못했어요.")
    : favoriteGroupsQuery.isError
      ? (favoriteGroupsQuery.error.message || "최애 그룹을 불러오지 못했어요.")
      : "";
  const visibleMessage = message || loadErrorMessage;

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
    // 누르기 직전의 최애 집합으로 정렬을 고정한다. 이미 고정돼 있으면 그대로 둬야
    // 두 번째 이후 토글에도 처음 본 순서가 유지된다.
    setPinnedFavoriteIds((current) => current ?? getFavoritedIds(groups));
    // 캐시를 바로 고쳐 하트를 즉시 반영한다. 같은 캐시를 보는 홈 레일도 함께 갱신된다.
    setFavorited(group, nextFavorited);

    try {
      if (nextFavorited) {
        const result = await addFavoriteGroup(accessToken, groupId);

        if (result.alreadyExists) {
          setFavorited(group, true);
        }
      } else {
        await removeFavoriteGroup(accessToken, groupId);
      }

      setMessage("");
    } catch (error) {
      setFavorited(group, !nextFavorited);
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
        {visibleMessage ? (
          <div className="mb-4 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3">
            <p className="text-[13px] font-semibold text-black/45">
              {visibleMessage}
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
