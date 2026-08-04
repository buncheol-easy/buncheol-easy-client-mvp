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

export default async function Home() {
  // 비로그인 키로만 프리페치한다 — 로그인 사용자는 찜 여부가 키에 갈려 기존처럼
  // 클라이언트에서 다시 가져오고, keepPreviousData 가 그동안 이 목록을 유지한다.
  // 프리페치 실패는 dehydrate 에 아무것도 남기지 않아 기존 클라이언트 fetch 로 폴백된다.
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: homeListingsQueryKey(false),
    queryFn: async () => (await requestAllBuncheols()).map(toProductCardItem),
  });

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
