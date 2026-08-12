"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  requestFavoriteGroups,
  requestGroups,
  type ApiGroup,
} from "@/lib/auth-api";
import { getFreshAccessToken } from "@/lib/auth-session";
import { FEATURES } from "@/lib/feature-flags";
import { allGroupsQueryKey, favoriteGroupsQueryKey } from "@/lib/query-keys";

// 그룹 마스터 목록은 운영이 아이돌을 추가할 때만 바뀐다 — 한 세션 안에서 다시 받을 이유가 없다.
export const ALL_GROUPS_STALE_MS = 30 * 60 * 1000;
// 최애는 홈 레일과 /artists 양쪽에서 바뀐다. 짧게 잡아 화면을 새로 열 때만 재검증한다.
export const FAVORITE_GROUPS_STALE_MS = 60 * 1000;

// 홈 레일과 /artists 가 같은 캐시를 보게 하는 공용 훅. 캐시는 루트 레이아웃의 QueryClient 에
// 살아 있으므로 화면을 오갈 때 첫 렌더부터 데이터가 있다 — 스켈레톤도, 목록이 통째로 갈리는
// 깜빡임도 생기지 않는다.
export function useAllGroupsQuery() {
  return useQuery({
    queryKey: allGroupsQueryKey,
    queryFn: () => requestGroups(""),
    staleTime: ALL_GROUPS_STALE_MS,
  });
}

export function useFavoriteGroupsQuery(isLoggedIn: boolean) {
  return useQuery({
    queryKey: favoriteGroupsQueryKey(isLoggedIn),
    queryFn: async () => {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        return [] as ApiGroup[];
      }

      return requestFavoriteGroups(accessToken);
    },
    enabled: FEATURES.favoriteArtists && isLoggedIn,
    staleTime: FAVORITE_GROUPS_STALE_MS,
  });
}

// 최애로 "세는" 판정. 캐시에는 이번 세션에 해제한 그룹이 favorited:false 로 남아 있다
// (아래 useFavoriteGroupsCache 주석 참고) — 그 항목은 최애가 아니다.
export function isFavoritedGroup(group: ApiGroup) {
  return group.favorited !== false;
}

export function useFavoriteGroupsCache(isLoggedIn: boolean) {
  const queryClient = useQueryClient();
  const queryKey = favoriteGroupsQueryKey(isLoggedIn);

  // 해제한 그룹을 목록에서 빼지 않고 favorited:false 로 남긴다 — 홈 레일이 그 자리를
  // 유지해야 오탭을 그 자리에서 되돌릴 수 있다 (빼버리면 /artists 까지 가야 복구된다).
  // 재조회가 돌면 서버 기준으로 정리되므로 이 잔류는 화면 수명 동안만 유지된다.
  function setFavorited(group: ApiGroup, favorited: boolean) {
    queryClient.setQueryData<ApiGroup[]>(queryKey, (current) => {
      const groups = current ?? [];
      const index = groups.findIndex((item) => item.id === group.id);

      if (index === -1) {
        return favorited ? [...groups, { ...group, favorited: true }] : groups;
      }

      return groups.map((item, itemIndex) =>
        itemIndex === index ? { ...item, favorited } : item,
      );
    });
  }

  return { setFavorited };
}
