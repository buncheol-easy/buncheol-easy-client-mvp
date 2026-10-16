import type { InfiniteData } from "@tanstack/react-query";
import type { ProductCardItem } from "@/components/ProductCard";
import { requestBuncheolPage, toProductCardItem } from "@/lib/auth-api";

const HOME_LISTINGS_PAGE_SIZE = 20;

export type HomeListingsPage = {
  hasNext: boolean;
  items: ProductCardItem[];
  nextCursor: string | null;
};

export type HomeListingsData = InfiniteData<HomeListingsPage>;

export const homeListingsInitialPageParam: string | null = null;

export async function requestHomeListingsPage(
  accessToken: string | undefined,
  cursor: string | null,
): Promise<HomeListingsPage> {
  const page = await requestBuncheolPage(accessToken, {
    cursor: cursor ?? undefined,
    size: HOME_LISTINGS_PAGE_SIZE,
  });

  return { ...page, items: page.items.map(toProductCardItem) };
}

export function getHomeListingsNextPageParam(lastPage: HomeListingsPage) {
  return lastPage.hasNext ? lastPage.nextCursor : null;
}

// 서버 커서는 페이지를 넘기는 사이 마감으로 바뀐 분철을 마감 묶음에서 한 번 더 내려준다
// (누락 대신 중복을 택한 계약, BuncheolListCursor javadoc). 자리는 처음 것, 상태는 최신 것을 쓴다.
export function flattenHomeListings(data: HomeListingsData | undefined) {
  const latestById = new Map<string, ProductCardItem>();

  for (const item of (data?.pages ?? []).flatMap((page) => page.items)) {
    latestById.set(item.productId ?? item.id, item);
  }

  return [...latestById.values()];
}
