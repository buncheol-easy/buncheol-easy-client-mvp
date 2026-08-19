import type { QueryClient } from "@tanstack/react-query";
import type { ProductCardItem } from "@/components/ProductCard";
import {
  buncheolsQueryKey,
  isLoggedInListingQueryKey,
} from "@/lib/query-keys";

/**
 * 찜 토글 결과를 목록 캐시(홈·아티스트)에 반영한다.
 *
 * 찜은 로그인 상태에서만 가능하므로 로그아웃 캐시는 건드리지 않는다 — 고쳐 두면 로그아웃 후
 * 남의 하트가 켜진 목록을 보게 된다.
 */
export function updateListingCachesLiked(
  queryClient: QueryClient,
  buncheolId: string,
  liked: boolean,
) {
  queryClient.setQueriesData<ProductCardItem[]>(
    {
      queryKey: buncheolsQueryKey,
      predicate: (query) => isLoggedInListingQueryKey(query.queryKey),
    },
    (current) =>
      current?.map((item) =>
        (item.productId ?? item.id) === buncheolId ? { ...item, liked } : item,
      ),
  );
}
