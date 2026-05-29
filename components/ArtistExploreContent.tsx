"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { ArtistImage } from "@/components/ArtistRail";
import { BackIcon, SearchIcon } from "@/components/icons";
import {
  addFavoriteGroup,
  removeFavoriteGroup,
  requestFavoriteGroups,
  requestGroups,
  type ApiGroup,
} from "@/lib/auth-api";
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

const FAVORITE_GROUP_LIMIT = 5;

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
  variant = "card",
}: {
  group: ArtistGroup;
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

export function ArtistExploreContent() {
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
  const pendingGroupIdsRef = useRef(new Set<string>());

  const favoriteGroups = groups.filter((group) => group.favorited);
  const favoriteCount = favoriteGroups.length;
  const isFavoriteRailVisible = favoriteCount >= FAVORITE_GROUP_LIMIT;
  const visibleGroups = useMemo(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return sortFavoriteGroupsFirst(groups);
    }

    return sortFavoriteGroupsFirst(
      rankGroupSearchResults(groups, trimmedQuery, 80),
    );
  }, [groups, query]);

  useEffect(() => {
    let isActive = true;

    async function loadGroups() {
      const accessToken = authState.isLoggedIn
        ? await getFreshAccessToken()
        : null;

      const allGroups = await requestGroups("", accessToken ?? undefined);

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
      router.push("/login?returnTo=/artists");
      return;
    }

    const accessToken = await getFreshAccessToken();

    if (!accessToken) {
      router.push("/login?returnTo=/artists");
      return;
    }

    const nextFavorited = !group.favorited;
    const groupId = getFavoriteId(group);

    if (pendingGroupIdsRef.current.has(group.id)) {
      return;
    }

    pendingGroupIdsRef.current.add(group.id);
    setPendingGroupId(group.id);
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

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="shrink-0 border-b border-black/10 bg-white px-4 pb-4 pt-3">
        <div className="flex h-11 items-center gap-2">
          <button
            aria-label="뒤로가기"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white"
            onClick={() => router.back()}
            type="button"
          >
            <BackIcon />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-semibold leading-none tracking-[-0.06em]">
              아티스트
            </h1>
            <p className="mt-1 text-[12px] font-semibold text-black/40">
              최애 {favoriteCount}/{FAVORITE_GROUP_LIMIT}
            </p>
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
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black text-[14px] font-semibold text-white">
              ♥
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold tracking-[-0.03em]">
                내 최애가 가득 찼어요.
              </p>
              <p className="mt-0.5 text-[12px] font-semibold text-black/45">
                하나 비우면 지금 보고 있는 아티스트를 담을 수 있어요.
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
        ) : visibleGroups.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {visibleGroups.map((group) => {
              const isPending = pendingGroupId === group.id;
              const isFavoriteLimitReached =
                favoriteCount >= FAVORITE_GROUP_LIMIT && !group.favorited;

              return (
                <article
                  className="rounded-[1.2rem] border border-black/10 bg-white p-4"
                  key={group.id}
                >
                  <div className="flex justify-center">
                    <ArtistAvatar group={group} />
                  </div>
                  <div
                    className={`-mx-1 mt-4 flex min-h-[3rem] items-center gap-1.5 rounded-[1rem] py-1 pl-3 pr-1 ${
                      group.favorited ? "bg-[#f6f6f6]" : "bg-white"
                    }`}
                  >
                    <h2 className="line-clamp-2 min-w-0 flex-1 break-keep text-[16px] font-semibold leading-tight tracking-[-0.04em]">
                      {group.name}
                    </h2>
                    <button
                      aria-label={group.favorited ? "최애 해제" : "최애 추가"}
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px] font-semibold transition-transform active:scale-95 ${
                        group.favorited
                          ? "bg-black text-white shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
                          : "border border-black/10 bg-white text-black"
                      } ${
                        isFavoriteLimitReached
                          ? "bg-[#f4f4f4] text-black/25 shadow-none"
                          : ""
                      }`}
                      disabled={isPending || isFavoriteLimitReached}
                      onClick={() => handleFavoriteToggle(group)}
                      type="button"
                    >
                      {group.favorited ? "♥" : "♡"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[1.2rem] bg-[#f7f7f7] px-4 py-8 text-center">
            <p className="text-[15px] font-semibold text-black/45">
              검색 결과가 없어요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
