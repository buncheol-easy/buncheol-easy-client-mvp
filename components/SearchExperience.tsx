"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type UIEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArtistImage,
  ArtistRail,
  type ArtistRailItem,
} from "@/components/ArtistRail";
import { BottomNavigator } from "@/components/BottomNavigator";
import { BusinessFooter } from "@/components/BusinessFooter";
import { HomeContent } from "@/components/HomeContent";
import { CloseIcon } from "@/components/icons";
import type { ProductCardItem } from "@/components/ProductCard";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductGridSkeleton } from "@/components/ProductGridSkeleton";
import { SearchHeader } from "@/components/SearchHeader";
import { SwipeUnderlay } from "@/components/SwipeUnderlay";
import {
  addFavoriteGroup,
  removeFavoriteGroup,
  requestBuncheols,
  requestFavoriteGroups,
  requestGroupMembers,
  requestGroups,
  requestGroupsByMemberKeyword,
  requestPopularGroups,
  requestRecentSearchKeywords,
  toProductCardItem,
  type ApiGroup,
} from "@/lib/auth-api";
import {
  createLoginHref,
  getCurrentBrowserHref,
} from "@/lib/auth-navigation";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import { getFreshAccessToken } from "@/lib/auth-session";
import { FEATURES } from "@/lib/feature-flags";
import {
  normalizeGroupSearchText,
  rankGroupSearchResults,
  toArtistRailItem,
  toMemberRailItem,
} from "@/lib/group-presenters";
import { mergeCachedProductImage } from "@/lib/product-card-image";

type SearchExperienceProps = {
  query?: string;
  relatedSearch?: boolean;
  selectedMemberId?: string;
  skipEnterAnimation?: boolean;
};

type RecentSearchItem = {
  label: string;
};

const SEARCH_ENTRY_HISTORY_INDEX_KEY = "buncheol-search-entry-history-index";
const SEARCH_QUERY_STACK_KEY = "buncheol-search-query-stack";
const SEARCH_RESULT_SCROLL_TOP_KEY_PREFIX = "search-result-scroll-top";
export const SEARCH_SKIP_ENTER_KEY = "buncheol-search-skip-enter";
const SCROLL_REVEAL_THRESHOLD = 8;
const SCROLL_HIDE_START = 24;
const SCROLL_EDGE_GUARD = 16;
const MEMBER_SEARCH_GROUP_LOOKUP_LIMIT = 8;

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

function readSearchQueryStack() {
  const rawStack = sessionStorage.getItem(SEARCH_QUERY_STACK_KEY);

  if (!rawStack) {
    return [];
  }

  try {
    const stack = JSON.parse(rawStack);
    return Array.isArray(stack)
      ? stack.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeSearchQueryStack(stack: string[]) {
  sessionStorage.setItem(SEARCH_QUERY_STACK_KEY, JSON.stringify(stack));
}

function getPreviousSearchQuery(currentQuery: string) {
  const stack = readSearchQueryStack();
  const currentIndex = stack.lastIndexOf(currentQuery);

  if (currentIndex > 0) {
    return stack[currentIndex - 1];
  }

  return null;
}

function popCurrentSearchQuery(currentQuery: string) {
  const stack = readSearchQueryStack();
  const currentIndex = stack.lastIndexOf(currentQuery);

  if (currentIndex >= 0) {
    writeSearchQueryStack(stack.slice(0, currentIndex));
  }
}

function markNextSearchEnterSkipped() {
  sessionStorage.setItem(SEARCH_SKIP_ENTER_KEY, "true");
}

function getSearchResultScrollTopKey(
  keyword: string,
  selectedMemberId?: string,
) {
  return `${SEARCH_RESULT_SCROLL_TOP_KEY_PREFIX}:${keyword}:${selectedMemberId ?? ""}`;
}

function readStoredSearchResultScrollTop(
  keyword: string,
  selectedMemberId?: string,
) {
  if (typeof window === "undefined") {
    return null;
  }

  const storedScrollTop = window.sessionStorage.getItem(
    getSearchResultScrollTopKey(keyword, selectedMemberId),
  );

  if (storedScrollTop === null) {
    return null;
  }

  const parsedScrollTop = Number(storedScrollTop);

  return Number.isFinite(parsedScrollTop) ? parsedScrollTop : null;
}

function takeShouldSkipSearchEnter() {
  if (typeof window === "undefined") {
    return false;
  }

  const shouldSkip = sessionStorage.getItem(SEARCH_SKIP_ENTER_KEY) === "true";

  if (shouldSkip) {
    sessionStorage.removeItem(SEARCH_SKIP_ENTER_KEY);
  }

  return shouldSkip;
}

function mergeFavoriteGroups<T extends ApiGroup>(
  groups: T[],
  favorites: ApiGroup[],
) {
  const favoriteIds = new Set(favorites.map((group) => group.id));

  return groups.map((group) => ({
    ...group,
    favorited: group.favorited === true || favoriteIds.has(group.id),
  }));
}

export function SearchExperience({
  query,
  relatedSearch = false,
  selectedMemberId,
  skipEnterAnimation = false,
}: SearchExperienceProps) {
  const router = useRouter();
  const isOpeningSearchSheetRef = useRef(false);
  const lastResultScrollTopRef = useRef(0);
  const resultScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isSearchEntered, setIsSearchEntered] = useState(
    () => skipEnterAnimation || takeShouldSkipSearchEnter(),
  );
  const [isExiting, setIsExiting] = useState(false);
  const [isClearingSearch, setIsClearingSearch] = useState(false);
  const [searchSheetKey, setSearchSheetKey] = useState(0);
  const [isResultBacking, setIsResultBacking] = useState(false);
  const [isRestoringPreviousResult, setIsRestoringPreviousResult] =
    useState(false);
  const [previousKeyword, setPreviousKeyword] = useState<string | null>(null);
  const [isResultHeaderHidden, setIsResultHeaderHidden] = useState(false);
  const [apiResultItems, setApiResultItems] = useState<ProductCardItem[] | null>(
    null,
  );
  const [apiResultGroups, setApiResultGroups] = useState<ArtistRailItem[] | null>(
    null,
  );
  const [apiPopularGroups, setApiPopularGroups] = useState<
    ArtistRailItem[] | null
  >(null);
  const [apiRecentSearches, setApiRecentSearches] = useState<
    RecentSearchItem[] | null
  >(null);
  const [apiRecentSearchesToken, setApiRecentSearchesToken] = useState<
    string | null
  >(null);
  const [resultMessage, setResultMessage] = useState("");
  const [groupMessage, setGroupMessage] = useState("");
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const keyword = query?.trim();
  const hasResults = Boolean(keyword);
  const isResultLoading =
    hasResults && (apiResultItems === null || apiResultGroups === null);
  const resultItems = hasResults ? apiResultItems ?? [] : [];
  const resultFilters = hasResults ? apiResultGroups ?? [] : [];
  const normalizedKeyword = keyword ? normalizeGroupSearchText(keyword) : "";
  const selectedMemberFilterId = selectedMemberId?.trim();
  const exactResultFilters = resultFilters.filter(
    (item) =>
      item.type === "member" &&
      normalizeGroupSearchText(item.name) === normalizedKeyword,
  );
  const isMemberDisambiguation =
    !selectedMemberFilterId && exactResultFilters.length > 1;
  const selectedRelatedItemId =
    selectedMemberFilterId
      ? `member:${selectedMemberFilterId}`
      : exactResultFilters.length === 1
      ? exactResultFilters[0].id
      : null;
  const popularGroupItems = apiPopularGroups ?? [];
  const isPopularGroupsLoading = !hasResults && apiPopularGroups === null;
  const currentRecentSearchToken = authState.isLoggedIn
    ? authState.accessToken ?? null
    : null;
  const recentSearchItems = authState.isLoggedIn
    ? (apiRecentSearchesToken === currentRecentSearchToken
        ? apiRecentSearches
        : null) ?? []
    : [];
  const isRecentSearchesLoading =
    authState.isLoggedIn &&
    apiRecentSearches === null &&
    apiRecentSearchesToken === null;

  useLayoutEffect(() => {
    if (!hasResults || !keyword || isResultLoading) {
      return;
    }

    const storedScrollTop = readStoredSearchResultScrollTop(
      keyword,
      selectedMemberFilterId,
    );

    if (storedScrollTop === null || !resultScrollContainerRef.current) {
      return;
    }

    const restoreFrame = window.requestAnimationFrame(() => {
      if (!resultScrollContainerRef.current) {
        return;
      }

      resultScrollContainerRef.current.scrollTop = storedScrollTop;
      lastResultScrollTopRef.current = storedScrollTop;

      if (!skipEnterAnimation) {
        window.sessionStorage.removeItem(
          getSearchResultScrollTopKey(keyword, selectedMemberFilterId),
        );
      }
    });

    return () => {
      window.cancelAnimationFrame(restoreFrame);
    };
  }, [
    hasResults,
    isResultLoading,
    keyword,
    resultItems.length,
    selectedMemberFilterId,
    skipEnterAnimation,
  ]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--system-bottom-color",
      hasResults ? "#000000" : "#ffffff",
    );

    return () => {
      document.documentElement.style.setProperty("--system-bottom-color", "#000000");
    };
  }, [hasResults]);

  useEffect(() => {
    if (isSearchEntered) {
      return;
    }

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        setIsSearchEntered(true);
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [isSearchEntered]);

  useEffect(() => {
    if (isRestoringPreviousResult) {
      setIsResultBacking(false);
      setPreviousKeyword(null);

      const animationFrame = requestAnimationFrame(() => {
        setIsRestoringPreviousResult(false);
      });

      return () => {
        cancelAnimationFrame(animationFrame);
      };
    }

    if (!keyword) {
      return;
    }

    const stack = readSearchQueryStack();

    if (stack.at(-1) !== keyword) {
      writeSearchQueryStack([...stack, keyword]);
    }
  }, [isRestoringPreviousResult, keyword]);

  useEffect(() => {
    let isActive = true;

    setApiRecentSearches(null);
    setApiRecentSearchesToken(null);

    if (!authState.isLoggedIn) {
      return () => {
        isActive = false;
      };
    }

    getFreshAccessToken()
      .then((accessToken) =>
        accessToken
          ? requestRecentSearchKeywords(accessToken).then((searchKeywords) => ({
              accessToken,
              searchKeywords,
            }))
          : null,
      )
      .then((result) => {
        if (!isActive) {
          return;
        }

        if (!result) {
          setApiRecentSearches(null);
          setApiRecentSearchesToken(null);
          return;
        }

        setApiRecentSearches(
          result.searchKeywords.map((searchKeyword) => ({
            label: searchKeyword.keyword,
          })),
        );
        setApiRecentSearchesToken(result.accessToken);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setApiRecentSearches([]);
        setApiRecentSearchesToken(currentRecentSearchToken);
      });

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, authState.isLoggedIn, currentRecentSearchToken]);

  useEffect(() => {
    const accessToken = authState.isLoggedIn
      ? authState.accessToken ?? undefined
      : undefined;
    let isActive = true;

    if (keyword) {
      setApiResultItems(null);
      setResultMessage("");
      setGroupMessage("");
    } else {
      setApiPopularGroups(null);
      setGroupMessage("");
    }

    const loadSearchData = async () => {
      const searchKeyword = keyword ?? "";
      const [rawGroups, rawMemberSearchGroups, favoriteGroups] =
        await Promise.all([
          searchKeyword ? requestGroups(searchKeyword) : requestPopularGroups(),
          searchKeyword
            ? requestGroupsByMemberKeyword(searchKeyword).catch(() => [])
            : [],
          authState.isLoggedIn
            ? getFreshAccessToken()
                .then((accessToken) =>
                  accessToken
                    ? requestFavoriteGroups(accessToken).catch(() => [])
                    : [],
                )
                .catch(() => [])
            : [],
        ]);
      const groups = mergeFavoriteGroups(rawGroups, favoriteGroups);
      const memberSearchGroups = mergeFavoriteGroups(
        rawMemberSearchGroups,
        favoriteGroups,
      );

      if (!searchKeyword) {
        return {
          groupItems: groups.slice(0, 5).map(toArtistRailItem),
          productItems: null,
        };
      }

      const candidateGroups =
        groups.length > 0 || memberSearchGroups.length > 0
          ? [...groups, ...memberSearchGroups].filter(
              (group, index, allGroups) =>
                allGroups.findIndex((candidate) => candidate.id === group.id) ===
                index,
            )
          : mergeFavoriteGroups(
              await requestGroups("").catch(() => []),
              favoriteGroups,
            );
      const rankedGroups = rankGroupSearchResults(
        candidateGroups,
        searchKeyword,
        3,
      );
      const rankedGroupIds = new Set(rankedGroups.map((group) => group.id));
      const memberSearchGroupMap = new Map(
        memberSearchGroups.map((group) => [group.id, group.members]),
      );
      const normalizedKeyword = normalizeGroupSearchText(searchKeyword);
      const memberGroups = [
        ...memberSearchGroups,
        ...rankedGroups,
        ...groups,
        ...candidateGroups,
      ]
        .filter(
          (group, index, groups) =>
            groups.findIndex((candidate) => candidate.id === group.id) ===
            index,
        )
        .slice(0, MEMBER_SEARCH_GROUP_LOOKUP_LIMIT);
      const memberMatches = (
        await Promise.all(
          memberGroups.map(async (group) => {
            try {
              const cachedMembers = memberSearchGroupMap.get(group.id);
              const members =
                cachedMembers && cachedMembers.length > 0
                  ? cachedMembers
                  : await requestGroupMembers(group.id);
              const isRankedGroup = rankedGroupIds.has(group.id);
              const matchedMembers = members
                .filter((member) =>
                  normalizeGroupSearchText(member.name).includes(
                    normalizedKeyword,
                  ),
                )
                .slice(0, 3);
              const relatedMembers =
                matchedMembers.length > 0 || isRankedGroup
                  ? members
                      .filter(
                        (member) =>
                          !matchedMembers.some(
                            (matchedMember) => matchedMember.id === member.id,
                          ),
                      )
                      .slice(0, 5)
                  : [];

              return {
                allMembers: members,
                group,
                matchedMembers,
                relatedMembers,
              };
            } catch {
              return {
                allMembers: [],
                group,
                matchedMembers: [],
                relatedMembers: [],
              };
            }
          }),
        )
      ).filter(
        (match) =>
          match.matchedMembers.length > 0 || rankedGroupIds.has(match.group.id),
      );
      const primaryMemberMatch = memberMatches[0];
      const selectedMemberMatch = selectedMemberFilterId
        ? memberMatches.find((match) =>
            match.allMembers.some((member) => member.id === selectedMemberFilterId),
          )
        : undefined;
      const matchedMemberEntries = memberMatches
        .flatMap((match) =>
          match.matchedMembers.map((member) => ({
            groupName: match.group.name,
            member,
          })),
        )
        .filter(
          (entry, index, entries) =>
            entries.findIndex(
              (candidate) => candidate.member.id === entry.member.id,
            ) === index,
        );
      const hasMemberCandidates =
        !selectedMemberFilterId && matchedMemberEntries.length > 1;
      const memberItems = hasMemberCandidates
        ? matchedMemberEntries
            .slice(0, 8)
            .map((entry) => toMemberRailItem(entry.member, entry.groupName))
        : (
            selectedMemberMatch?.allMembers ??
            primaryMemberMatch?.allMembers ??
            []
          )
            .slice(0, 8)
            .map((member) =>
              toMemberRailItem(
                member,
                selectedMemberMatch?.group.name ?? primaryMemberMatch?.group.name,
              ),
            );
      const memberGroupItems = memberMatches
        .map(({ group }) => group)
        .filter(
          (group, index, allGroups) =>
            allGroups.findIndex((candidate) => candidate.id === group.id) ===
            index,
        )
        .filter(
          (group) =>
            !rankedGroups.some((rankedGroup) => rankedGroup.id === group.id),
        )
        .slice(0, 2)
        .map(toArtistRailItem);
      const groupItems = rankedGroups.map(toArtistRailItem);
      const matchedMemberIds = memberMatches
        .flatMap((match) => match.matchedMembers)
        .map((member) => member.id)
        .filter((memberId, index, memberIds) => memberIds.indexOf(memberId) === index)
        .slice(0, 6);
      const [keywordItems, ...relatedItemGroups] = await Promise.all(
        selectedMemberFilterId
          ? [
              requestBuncheols(accessToken, {
                memberId: selectedMemberFilterId,
                size: 50,
              }),
            ]
          : [
              requestBuncheols(accessToken, { keyword: searchKeyword, size: 50 }),
              ...rankedGroups.map((group) =>
                requestBuncheols(accessToken, {
                  groupId: group.id,
                  size: 50,
                }).catch(() => []),
              ),
              ...matchedMemberIds.map((memberId) =>
                requestBuncheols(accessToken, { memberId, size: 50 }).catch(
                  () => [],
                ),
              ),
            ],
      );
      const productItems = [...keywordItems, ...relatedItemGroups.flat()].filter(
        (item, index, items) =>
          items.findIndex((candidate) => candidate.id === item.id) === index,
      );
      const railItems = selectedMemberMatch
        ? [
            toArtistRailItem(selectedMemberMatch.group),
            ...memberItems,
          ]
        : hasMemberCandidates
        ? memberItems
        : [
            ...groupItems,
            ...memberGroupItems,
            ...memberItems,
          ];

      return {
        groupItems: railItems.slice(0, 8),
        productItems,
      };
    };

    loadSearchData()
      .then(({ groupItems, productItems }) => {
        if (!isActive) {
          return;
        }

        if (keyword) {
          setApiResultGroups(groupItems);
          setApiResultItems(
            (productItems ?? [])
              .map(toProductCardItem)
              .map(mergeCachedProductImage),
          );
          setResultMessage("");
        } else {
          setApiPopularGroups(groupItems);
        }

        setGroupMessage("");
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        if (keyword) {
          setApiResultGroups((currentGroups) => currentGroups ?? []);
          setApiResultItems([]);
        } else {
          setApiPopularGroups([]);
        }

        setGroupMessage(
          error instanceof Error
            ? error.message
            : "그룹 정보를 불러오지 못했어요.",
        );
      });

    return () => {
      isActive = false;
    };
  }, [
    authState.accessToken,
    authState.isLoggedIn,
    keyword,
    relatedSearch,
    selectedMemberFilterId,
  ]);

  function closeSearch() {
    const searchEntryHistoryIndex = sessionStorage.getItem(
      SEARCH_ENTRY_HISTORY_INDEX_KEY,
    );

    sessionStorage.removeItem(SEARCH_ENTRY_HISTORY_INDEX_KEY);
    sessionStorage.removeItem(SEARCH_QUERY_STACK_KEY);
    sessionStorage.removeItem(SEARCH_SKIP_ENTER_KEY);

    if (searchEntryHistoryIndex !== null) {
      const currentHistoryIndex = getHistoryIndex();
      const searchHistoryDelta =
        currentHistoryIndex === null
          ? 0
          : currentHistoryIndex - Number(searchEntryHistoryIndex);

      if (searchHistoryDelta > 0) {
        window.history.go(-searchHistoryDelta);
        return;
      }
    }

    router.replace("/");
  }

  function handleBack() {
    if (isExiting || isResultBacking) {
      return;
    }

    if (isClearingSearch) {
      isOpeningSearchSheetRef.current = false;
      setIsClearingSearch(false);
      return;
    }

    if (hasResults) {
      const previousSearchQuery = getPreviousSearchQuery(keyword ?? "");

      if (!previousSearchQuery) {
        setIsExiting(true);
        return;
      }

      setPreviousKeyword(previousSearchQuery);
      setIsResultBacking(true);
      return;
    }

    setIsExiting(true);
  }

  function openEmptySearch() {
    if (!hasResults || isOpeningSearchSheetRef.current) {
      return;
    }

    isOpeningSearchSheetRef.current = true;
    setSearchSheetKey((currentKey) => currentKey + 1);
    setIsClearingSearch(true);
  }

  function handleSearch(nextQuery: string, source?: "related") {
    if (!nextQuery) {
      if (hasResults) {
        isOpeningSearchSheetRef.current = true;
        setSearchSheetKey((currentKey) => currentKey + 1);
        setIsClearingSearch(true);
        return;
      }

      isOpeningSearchSheetRef.current = false;
      setIsClearingSearch(false);
      router.replace("/search");
      return;
    }

    isOpeningSearchSheetRef.current = false;
    setIsClearingSearch(false);
    const nextHref = `/search?q=${encodeURIComponent(nextQuery)}${
      source === "related" ? "&from=related" : ""
    }`;

    if (hasResults) {
      router.push(nextHref);
      return;
    }

    router.replace(nextHref);
  }

  function openRelatedSearch(item: ArtistRailItem) {
    if (item.type === "member" && item.apiId) {
      if (selectedMemberFilterId === item.apiId) {
        return;
      }

      const nextQuery = keyword ?? item.name;
      const nextHref = `/search?q=${encodeURIComponent(
        nextQuery,
      )}&memberId=${encodeURIComponent(item.apiId)}&from=related`;

      if (hasResults) {
        router.push(nextHref);
        return;
      }

      router.replace(nextHref);
      return;
    }

    if (
      keyword &&
      normalizeGroupSearchText(item.name) === normalizeGroupSearchText(keyword)
    ) {
      return;
    }

    handleSearch(item.name, "related");
  }

  async function handleFavoriteGroupToggle(item: ArtistRailItem) {
    const accessToken = authState.accessToken;

    if (!authState.isLoggedIn || !accessToken) {
      const returnHref = `/search${keyword ? `?q=${encodeURIComponent(keyword)}` : ""}`;
      router.push(
        createLoginHref({
          cancelTo: getCurrentBrowserHref(),
          returnTo: returnHref,
        }),
      );
      return;
    }

    if (item.type === "member") {
      return;
    }

    const favoriteGroupId = item.apiId ?? item.id;
    const nextFavorited = item.favorited !== true;
    const updateGroups = (groups: ArtistRailItem[] | null) =>
      groups?.map((group) =>
        group.id === item.id ? { ...group, favorited: nextFavorited } : group,
      ) ?? groups;

    setApiResultGroups(updateGroups);
    setApiPopularGroups(updateGroups);

    try {
      if (nextFavorited) {
        await addFavoriteGroup(accessToken, favoriteGroupId);
      } else {
        await removeFavoriteGroup(accessToken, favoriteGroupId);
      }
      setGroupMessage("");
    } catch (error) {
      const rollbackGroups = (groups: ArtistRailItem[] | null) =>
        groups?.map((group) =>
          group.id === item.id
            ? { ...group, favorited: !nextFavorited }
            : group,
        ) ?? groups;

      setApiResultGroups(rollbackGroups);
      setApiPopularGroups(rollbackGroups);
      setGroupMessage(
        error instanceof Error
          ? error.message
          : "최애 그룹을 변경하지 못했어요.",
      );
    }
  }

  function handleResultScroll(event: UIEvent<HTMLDivElement>) {
    if (!hasResults) {
      return;
    }

    const scrollElement = event.currentTarget;
    const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
    const nextScrollTop = Math.max(
      0,
      Math.min(scrollElement.scrollTop, maxScrollTop),
    );
    const previousScrollTop = lastResultScrollTopRef.current;
    const isNearBottom = maxScrollTop - nextScrollTop <= SCROLL_EDGE_GUARD;

    if (keyword) {
      window.sessionStorage.setItem(
        getSearchResultScrollTopKey(keyword, selectedMemberFilterId),
        String(nextScrollTop),
      );
    }

    if (nextScrollTop <= SCROLL_REVEAL_THRESHOLD) {
      setIsResultHeaderHidden(false);
      lastResultScrollTopRef.current = nextScrollTop;
      return;
    }

    if (
      isNearBottom ||
      Math.abs(nextScrollTop - previousScrollTop) <= SCROLL_REVEAL_THRESHOLD
    ) {
      lastResultScrollTopRef.current = nextScrollTop;
      return;
    }

    const shouldHide =
      nextScrollTop > previousScrollTop && nextScrollTop > SCROLL_HIDE_START;

    setIsResultHeaderHidden((current) =>
      current === shouldHide ? current : shouldHide,
    );
    lastResultScrollTopRef.current = nextScrollTop;
  }

  function renderRecentSearchSkeleton() {
    return (
      <div aria-label="최근 검색어를 불러오는 중" className="mt-4 flex flex-wrap gap-3" role="status">
        {Array.from({ length: 4 }).map((_, index) => (
          <span
            className="h-10 w-24 animate-pulse rounded-full bg-black/8"
            key={`recent-search-skeleton-${index}`}
          />
        ))}
      </div>
    );
  }

  function renderPopularGroupSkeleton() {
    return (
      <div aria-label="인기 아티스트를 불러오는 중" className="mt-5 border-y border-black/10" role="status">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            className="grid h-[72px] w-full grid-cols-[3.5rem_4.5rem_1fr] items-center border-b border-black/10 last:border-b-0"
            key={`popular-group-skeleton-${index}`}
          >
            <span className="h-6 w-6 animate-pulse rounded-full bg-black/8" />
            <span className="h-12 w-12 animate-pulse rounded-full bg-black/8" />
            <span>
              <span className="block h-5 w-32 animate-pulse rounded-full bg-black/8" />
              <span className="mt-2 block h-3 w-20 animate-pulse rounded-full bg-black/8" />
            </span>
          </div>
        ))}
      </div>
    );
  }

  function renderSearchRailSkeleton() {
    return (
      <div
        aria-label="검색 필터를 불러오는 중"
        className="flex gap-4 overflow-hidden pb-4"
        role="status"
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="min-w-[65px]" key={`search-rail-skeleton-${index}`}>
            <div className="h-[65px] w-[65px] animate-pulse rounded-[1.1rem] bg-black/8" />
            <div className="mt-2 h-3 w-12 animate-pulse rounded-full bg-black/8" />
            <div className="mt-1 h-2.5 w-9 animate-pulse rounded-full bg-black/8" />
          </div>
        ))}
      </div>
    );
  }

  function renderResultFilterRail() {
    if (selectedMemberFilterId && isResultLoading) {
      return renderSearchRailSkeleton();
    }

    if (resultFilters.length === 0) {
      return isResultLoading ? renderSearchRailSkeleton() : null;
    }

    const rail = (
      <ArtistRail
        items={resultFilters}
        onFavoriteToggle={
          FEATURES.favorites ? handleFavoriteGroupToggle : undefined
        }
        onItemClick={openRelatedSearch}
        pinFirstItem={!isMemberDisambiguation}
        selectedId={selectedRelatedItemId ?? undefined}
      />
    );

    if (!isMemberDisambiguation || !keyword) {
      return rail;
    }

    return (
      <div className="mx-1 rounded-[1.1rem] bg-[#f7f7f7] px-4 pb-1 pt-4">
        <p className="text-[14px] font-semibold tracking-[-0.04em]">
          어떤 {keyword}를 찾고 있어요?
        </p>
        <p className="mt-1 text-[12px] font-semibold tracking-[-0.04em] text-black/45">
          그룹을 보고 한 명을 고르면 해당 멤버 결과만 보여줘요.
        </p>
        <div className="mt-4">
          {rail}
        </div>
      </div>
    );
  }

  function renderSearchResultSkeleton() {
    return <ProductGridSkeleton ariaLabel="검색 결과를 불러오는 중" />;
  }

  return (
    <main
      className={`system-chrome-black h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111] ${
        hasResults
          ? "search-results-shell"
          : "search-entry-shell system-chrome-bottom-white"
      }`}
    >
      <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-white">
        <SwipeUnderlay
          isEntered={isSearchEntered}
          isExiting={isExiting || isResultBacking}
        >
          {isResultBacking && previousKeyword ? (
            <>
              <SearchHeader
                defaultValue={previousKeyword}
                inputReadOnly
                onBack={() => undefined}
              />
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-8">
                <div className="flex min-h-full flex-col">
                  {renderPreviousSearchResultsContent()}
                </div>
              </div>
            </>
          ) : (
            <>
              <HomeContent skipEnterAnimation />
              <BottomNavigator />
            </>
          )}
        </SwipeUnderlay>

        {isResultBacking ? (
          <div className="absolute bottom-0 left-0 right-0 z-[1] mx-auto w-full max-w-[430px]">
            <BottomNavigator activeLabel={null} />
          </div>
        ) : null}

        <div
          className={`search-panel absolute inset-0 flex flex-col bg-white shadow-[-18px_0_36px_rgba(0,0,0,0.16)] ${
            isSearchEntered ? "search-panel--entered" : ""
          } ${isExiting ? "search-panel--exit" : ""} ${
            isResultBacking ? "search-panel--back" : ""
          } ${
            isClearingSearch ? "swipe-underlay swipe-underlay-active" : ""
          } ${
            isRestoringPreviousResult ? "search-panel--no-transition" : ""
          }`}
          onTransitionEnd={(event) => {
            if (
              isExiting &&
              event.currentTarget === event.target &&
              event.propertyName === "transform"
            ) {
              closeSearch();
              return;
            }

            if (
              isResultBacking &&
              event.currentTarget === event.target &&
              event.propertyName === "transform"
            ) {
              popCurrentSearchQuery(keyword ?? "");
              markNextSearchEnterSkipped();
              setIsRestoringPreviousResult(true);
              router.back();
            }
          }}
        >
          <div className="scroll-reactive-shell">
            <div
              className={`scroll-reactive-header ${
                hasResults && isResultHeaderHidden
                  ? "scroll-reactive-header--hidden"
                  : ""
              }`}
            >
              <div className="scroll-reactive-header__inner">
                <SearchHeader
                  key={`search-header-${keyword ?? ""}`}
                  defaultValue={keyword}
                  inputReadOnly={hasResults}
                  onInputActivate={openEmptySearch}
                  onBack={handleBack}
                  onSearch={handleSearch}
                />
              </div>
            </div>

            <div
              className="scroll-reactive-content scroll-reactive-content--search min-h-0 flex-1 overflow-y-auto px-5"
              data-product-scroll-container="search"
              onScroll={handleResultScroll}
              ref={resultScrollContainerRef}
            >
              <div className="flex min-h-full flex-col">
              {hasResults ? (
                <>
                  <section className="-mx-1">
                    {renderResultFilterRail()}
                  </section>

                  <section className="border-t border-black/10 pt-5">
                    <div className="mb-4 flex items-end justify-between">
                      <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                        검색 결과
                      </h2>
                      <span className="text-[13px] font-medium text-black/45">
                        {isResultLoading ? "" : `${resultItems.length}개`}
                      </span>
                    </div>

                    {resultMessage ? (
                      <div className="mb-4 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3">
                        <p className="text-[13px] font-semibold text-black/45">
                          {resultMessage}
                        </p>
                      </div>
                    ) : null}
                    {groupMessage ? (
                      <div className="mb-4 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3">
                        <p className="text-[13px] font-semibold text-black/45">
                          {groupMessage}
                        </p>
                      </div>
                    ) : null}
                    {isResultLoading ? (
                      renderSearchResultSkeleton()
                    ) : (
                      <ProductGrid items={resultItems} />
                    )}
                  </section>
                  <div className="-mx-5 mt-auto pt-8">
                    <BusinessFooter />
                  </div>
                </>
              ) : (
                <>
                  <section>
                    <h2 className="text-[28px] font-semibold tracking-[-0.06em]">
                      최근 검색어
                    </h2>
                    {isRecentSearchesLoading ? (
                      renderRecentSearchSkeleton()
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {recentSearchItems.map((search) => (
                          <button
                            key={search.label}
                            onClick={() => handleSearch(search.label)}
                            className="inline-flex h-10 items-center gap-2 rounded-full bg-black px-5 text-[15px] font-semibold tracking-[-0.04em] text-white"
                            type="button"
                          >
                            <span>{search.label}</span>
                            <CloseIcon />
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="mt-20">
                    <h2 className="text-[28px] font-semibold tracking-[-0.06em]">
                      인기 아티스트
                    </h2>
                    {isPopularGroupsLoading ? (
                      renderPopularGroupSkeleton()
                    ) : (
                    <div className="mt-5 border-y border-black/20">
                      {popularGroupItems.map((artist, index) => (
                        <button
                          key={artist.id}
                          className="grid h-[72px] w-full grid-cols-[3.5rem_4.5rem_1fr] items-center border-b border-black/20 text-left last:border-b-0"
                          onClick={() => handleSearch(artist.name)}
                          type="button"
                        >
                          <span className="text-[21px] font-medium tracking-[-0.04em]">
                            {index + 1}
                          </span>
                          <span
                            className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${artist.tone} text-[13px] font-semibold tracking-[-0.05em] text-black ring-1 ring-black/10`}
                          >
                            {artist.imageUrl ? (
                              <ArtistImage
                                imageUrl={artist.imageUrl}
                                name={artist.name}
                                roundedClassName="rounded-full"
                              />
                            ) : (
                              artist.initials
                            )}
                          </span>
                          <span>
                            <span className="block text-[24px] font-medium tracking-[-0.05em]">
                              {artist.name}
                            </span>
                            <span className="mt-0.5 block text-[12px] font-medium text-black/40">
                              {artist.group}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                    )}
                  </section>
                  <div className="-mx-5 mt-auto pt-8">
                    <BusinessFooter />
                  </div>
                </>
              )}
              </div>
            </div>
          </div>

          {hasResults && !isResultBacking ? (
            <BottomNavigator activeLabel={null} />
          ) : null}
        </div>

        {isClearingSearch ? (
          <div
            key={searchSheetKey}
            className="search-panel-enter-motion absolute inset-0 z-10 flex flex-col bg-white shadow-[-18px_0_36px_rgba(0,0,0,0.16)]"
          >
            <SearchHeader
              autoFocus
              autoFocusDelayMs={320}
              key="empty-search-header"
              defaultValue=""
              onBack={handleBack}
              onSearch={handleSearch}
            />

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-8">
              <section>
                <h2 className="text-[28px] font-semibold tracking-[-0.06em]">
                  최근 검색어
                </h2>
                {isRecentSearchesLoading ? (
                  renderRecentSearchSkeleton()
                ) : (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {recentSearchItems.map((search) => (
                      <button
                        key={search.label}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-black px-5 text-[15px] font-semibold tracking-[-0.04em] text-white"
                        onClick={() => handleSearch(search.label)}
                        type="button"
                      >
                        <span>{search.label}</span>
                        <CloseIcon />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="mt-20">
                <h2 className="text-[28px] font-semibold tracking-[-0.06em]">
                  인기 아티스트
                </h2>
                {isPopularGroupsLoading ? (
                  renderPopularGroupSkeleton()
                ) : (
                  <div className="mt-5 border-y border-black/20">
                    {popularGroupItems.map((artist, index) => (
                      <button
                        key={artist.id}
                        className="grid h-[72px] w-full grid-cols-[3.5rem_4.5rem_1fr] items-center border-b border-black/20 text-left last:border-b-0"
                        onClick={() => handleSearch(artist.name)}
                        type="button"
                      >
                        <span className="text-[21px] font-medium tracking-[-0.04em]">
                          {index + 1}
                        </span>
                        <span
                          className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${artist.tone} text-[13px] font-semibold tracking-[-0.05em] text-black ring-1 ring-black/10`}
                        >
                          {artist.imageUrl ? (
                            <ArtistImage
                              imageUrl={artist.imageUrl}
                              name={artist.name}
                              roundedClassName="rounded-full"
                            />
                          ) : (
                            artist.initials
                          )}
                        </span>
                        <span>
                          <span className="block text-[24px] font-medium tracking-[-0.05em]">
                            {artist.name}
                          </span>
                          <span className="mt-0.5 block text-[12px] font-medium text-black/40">
                            {artist.group}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );

  function renderPreviousSearchResultsContent() {
    return (
      <>
        <section className="-mx-1">
          {renderResultFilterRail()}
        </section>

        <section className="border-t border-black/10 pt-5">
          <div className="mb-4 flex items-end justify-between">
          <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
            검색 결과
          </h2>
          <span className="text-[13px] font-medium text-black/45">
              {isResultLoading ? "" : `${resultItems.length}개`}
          </span>
        </div>

          {isResultLoading ? renderSearchResultSkeleton() : <ProductGrid items={resultItems} />}
      </section>
        <div className="-mx-5 mt-auto pt-8">
          <BusinessFooter />
        </div>
      </>
    );
  }

}
