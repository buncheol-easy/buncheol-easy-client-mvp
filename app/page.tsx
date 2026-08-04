import type { Metadata } from "next";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { BottomNavigator } from "@/components/BottomNavigator";
import { HomeContent } from "@/components/HomeContent";
import { requestAllBuncheols, toProductCardItem } from "@/lib/auth-api";
import { homeListingsQueryKey } from "@/lib/query-keys";
import { blackChromeViewport } from "@/lib/system-chrome";

export const viewport = blackChromeViewport;

// 분철 목록이 초기 HTML 에 실리도록 60초 간격으로 재생성한다 (클라 staleTime 과 동일).
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// requestAllBuncheols 는 최대 20페이지 순차 fetch 라 서버 경로에 자체 상한이 없다.
// ISR 재생성·빌드 크리티컬 패스에 올라가므로 프리페치에만 별도 상한을 둔다.
const HOME_PREFETCH_TIMEOUT_MS = 10_000;

async function fetchHomeListingsForPrefetch() {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const listings = await Promise.race([
      requestAllBuncheols(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `홈 목록 프리페치가 ${HOME_PREFETCH_TIMEOUT_MS}ms 를 초과했습니다.`,
            ),
          );
        }, HOME_PREFETCH_TIMEOUT_MS);
      }),
    ]);

    return listings.map(toProductCardItem);
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function Home() {
  // 비로그인 키로만 프리페치한다 — 로그인 사용자는 찜 여부가 키에 갈려 기존처럼
  // 클라이언트에서 다시 가져오고, keepPreviousData 가 그동안 이 목록을 유지한다.
  // 프리페치 실패는 dehydrate 에 아무것도 남기지 않아 기존 클라이언트 fetch 로 폴백된다.
  // retry 기본값(3회 지수 백오프)은 ISR 생성 시간을 잡아먹으므로 끈다.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const listingsKey = homeListingsQueryKey(false);

  await queryClient.prefetchQuery({
    queryKey: listingsKey,
    queryFn: fetchHomeListingsForPrefetch,
  });

  const prefetchedListings = queryClient.getQueryData(listingsKey);

  if (prefetchedListings) {
    // dehydrate 는 서버 렌더 시각(dataUpdatedAt)까지 복원해 staleTime 60초 동안
    // 클라이언트 재검증이 걸리지 않는다. 즉시 stale 로 표시해 첫 페인트는 서버
    // 목록을 쓰되 마운트 직후 재검증(+로컬 이미지 캐시 병합)이 따라붙게 한다.
    queryClient.setQueryData(listingsKey, prefetchedListings, {
      updatedAt: 0,
    });
  } else {
    console.warn(
      "[home] 분철 목록 서버 프리페치 실패 — 클라이언트 fetch 로 폴백합니다.",
    );
  }

  return (
    <main className="system-chrome-black h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <h1 className="sr-only">분철이지 — 최애 포카 분철 플랫폼</h1>
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <HydrationBoundary state={dehydrate(queryClient)}>
            <HomeContent />
          </HydrationBoundary>
        </div>
        <BottomNavigator />
      </div>
    </main>
  );
}
