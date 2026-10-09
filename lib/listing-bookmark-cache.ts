import type { Query, QueryClient } from "@tanstack/react-query";
import type { ProductCardItem } from "@/components/ProductCard";
import type { HomeListingsData } from "@/lib/home-listings";
import {
  buncheolsQueryKey,
  isLoggedInListingQueryKey,
} from "@/lib/query-keys";

function isHomeListingsData(value: unknown): value is HomeListingsData {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as HomeListingsData).pages)
  );
}

/**
 * 찜 토글 결과를 목록 캐시(홈·아티스트)에 반영한다.
 *
 * 찜은 로그인 상태에서만 가능하므로 로그아웃 캐시는 건드리지 않는다 — 고쳐 두면 로그아웃 후
 * 남의 하트가 켜진 목록을 보게 된다.
 */
export async function updateListingCachesLiked(
  queryClient: QueryClient,
  buncheolId: string,
  liked: boolean,
) {
  const filters = {
    queryKey: buncheolsQueryKey,
    predicate: (query: Query) => isLoggedInListingQueryKey(query.queryKey),
  };
  const markLiked = (items: ProductCardItem[]) =>
    items.map((item) =>
      (item.productId ?? item.id) === buncheolId ? { ...item, liked } : item,
    );

  // 진행 중인 목록 요청은 시작 시점 페이지로 결과를 써서, 두면 방금 반영한 찜을 덮는다.
  // 데이터 없는 첫 조회는 빼야 한다 — 취소되면 다시 시작하지 않아 스켈레톤에 갇힌다.
  await queryClient.cancelQueries({
    ...filters,
    predicate: (query) =>
      filters.predicate(query) && query.state.data !== undefined,
  });
  // 아티스트 목록은 배열, 홈 목록은 페이지 묶음이다.
  queryClient.setQueriesData<ProductCardItem[] | HomeListingsData>(
    filters,
    // 필터가 prefix 라, 목록이 아닌 캐시가 이 prefix 아래 생기면 map 이 던진다. 그 호출은
    // 찜 토글의 try 안이라 실패로 읽혀, 요청은 성공했는데 하트만 도로 풀리는 모양이 된다.
    (current) => {
      if (Array.isArray(current)) {
        return markLiked(current);
      }

      if (isHomeListingsData(current)) {
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: markLiked(page.items),
          })),
        };
      }

      return current;
    },
  );
}
