import { redirect } from "next/navigation";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { ArtistExploreExperience } from "@/components/ArtistExploreExperience";
import { requestGroups } from "@/lib/auth-api";
import { FEATURES } from "@/lib/feature-flags";
import { allGroupsQueryKey } from "@/lib/query-keys";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

// 그룹 마스터 목록이 초기 HTML 에 실리도록 재생성한다. 운영이 아이돌을 추가할 때만
// 바뀌는 데이터라 홈(60초)보다 길게 잡는다.
export const revalidate = 600;

export default async function ArtistsPage() {
  if (!FEATURES.favoriteArtists) {
    redirect("/");
  }

  // 188개 카드를 하이드레이션 후에 받으면 진입할 때 빈 스켈레톤이 통째로 한 번 그려졌다
  // 갈린다. 서버에서 미리 받아 첫 페인트부터 카드가 있게 한다 (홈과 같은 패턴).
  // 프리페치가 실패하면 dehydrate 에 아무것도 남지 않아 기존 클라이언트 fetch 로 폴백된다.
  //
  // 홈과 달리 updatedAt: 0 으로 즉시 stale 처리하지 않는다 — 재검증 응답이 도착하면 카드
  // 188장이 통째로 다시 렌더돼 방금 없앤 깜빡임이 되살아난다. 그룹은 운영이 아이돌을 추가할
  // 때만 바뀌는 마스터 데이터라 staleTime(30분) 만큼 늦게 보여도 문제가 없다.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  await queryClient.prefetchQuery({
    queryKey: allGroupsQueryKey,
    queryFn: () => requestGroups(""),
  });

  if (!queryClient.getQueryData(allGroupsQueryKey)) {
    console.warn(
      "[artists] 그룹 목록 서버 프리페치 실패 — 클라이언트 fetch 로 폴백합니다.",
    );
  }

  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ArtistExploreExperience />
      </HydrationBoundary>
    </main>
  );
}
