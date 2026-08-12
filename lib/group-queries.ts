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

export function useFavoriteGroupsCache(isLoggedIn: boolean) {
  const queryClient = useQueryClient();
  const queryKey = favoriteGroupsQueryKey(isLoggedIn);

  // 이 캐시는 "지금 최애인 그룹" 만 담는다 — 서버 목록과 같은 뜻이다. 해제하면 빼고,
  // 등록하면 넣는다. 해제한 항목을 남겨두면 그 화면을 떠난 뒤에도(예: /artists 에서 해제하고
  // 홈으로 복귀) 홈 레일에 계속 떠 있게 된다. 해제 직후 그 자리에서 되돌리는 동선은 캐시가
  // 아니라 각 화면의 로컬 상태로 처리한다 (HomeContent 의 releasedRailGroups).
  function setFavorited(group: ApiGroup, favorited: boolean) {
    queryClient.setQueryData<ApiGroup[]>(queryKey, (current) => {
      const groups = current ?? [];

      if (!favorited) {
        return groups.filter((item) => item.id !== group.id);
      }

      return groups.some((item) => item.id === group.id)
        ? groups
        : [...groups, { ...group, favorited: true }];
    });
  }

  return { setFavorited };
}
