"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArtistImage } from "@/components/ArtistRail";
import { BottomNavigator } from "@/components/BottomNavigator";
import { BusinessFooter } from "@/components/BusinessFooter";
import { BackIcon } from "@/components/icons";
import type { ProductCardItem } from "@/components/ProductCard";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductGridSkeleton } from "@/components/ProductGridSkeleton";
import {
  requestBuncheols,
  toProductCardItem,
  type ApiGroupDetail,
} from "@/lib/auth-api";
import { isBuncheolCancelledStatus } from "@/lib/buncheol-states";
import { getInitials, getGroupTone } from "@/lib/group-presenters";
import { mergeCachedProductImage } from "@/lib/product-card-image";
import { artistMemberListingsQueryKey } from "@/lib/query-keys";

type ArtistBrowseContentProps = {
  group: ApiGroupDetail;
  initialItems: ProductCardItem[];
};

const ARTIST_SCROLL_TOP_KEY_PREFIX = "artist-scroll-top";
// 서버 렌더 초기 목록과 같은 크기로 맞춰, 멤버 선택 전후 목록 길이 기준이 어긋나지 않게 한다.
const ARTIST_PAGE_SIZE = 30;

export function ArtistBrowseContent({
  group,
  initialItems,
}: ArtistBrowseContentProps) {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // 멤버 칩은 서버가 내려준 첫 페이지를 클라이언트에서 거르는 대신 재조회한다.
  // 초기 목록에는 size 상한이 걸려 있어, 해당 멤버 분철이 첫 페이지 밖에 있으면
  // 클라이언트 필터로는 "없음"으로 잘못 보인다.
  const memberListingsQuery = useQuery({
    enabled: selectedMemberId !== null,
    queryKey: artistMemberListingsQueryKey(group.id, selectedMemberId ?? ""),
    queryFn: async () => {
      const summaries = await requestBuncheols(undefined, {
        groupId: group.id,
        memberId: selectedMemberId ?? "",
        size: ARTIST_PAGE_SIZE,
      });

      return summaries.map(toProductCardItem).map(mergeCachedProductImage);
    },
  });

  const isMemberSelected = selectedMemberId !== null;
  // 취소 계열(미성사·개최자 취소)은 아티스트 페이지에서 감춘다. 이 화면은 색인 대상 유입
  // 랜딩이라(sitemap 도 같은 기준으로 취소분을 제외한다) 취소된 분철만 남으면 "이 그룹은
  // 분철이 없다"는 인상만 준다. 마감된 진행확정 분철은 그룹이 활성이라는 신호라 남긴다.
  const items: ProductCardItem[] = (
    isMemberSelected ? memberListingsQuery.data ?? [] : initialItems
  ).filter((item) => !isBuncheolCancelledStatus(item.status));
  const isLoading = isMemberSelected && memberListingsQuery.isPending;
  const message =
    isMemberSelected && memberListingsQuery.isError
      ? memberListingsQuery.error instanceof Error
        ? memberListingsQuery.error.message
        : "분철을 불러오지 못했어요."
      : "";

  function rememberScrollPosition() {
    if (!scrollContainerRef.current) {
      return;
    }

    window.sessionStorage.setItem(
      `${ARTIST_SCROLL_TOP_KEY_PREFIX}:${group.id}`,
      String(scrollContainerRef.current.scrollTop),
    );
  }

  function handleBack() {
    rememberScrollPosition();
    router.push("/");
  }

  const selectedMemberName = selectedMemberId
    ? group.members.find((member) => member.id === selectedMemberId)?.name
    : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-1 border-b border-black/8 px-2 py-2">
        <button
          aria-label="뒤로가기"
          className="inline-flex h-10 w-10 items-center justify-center"
          onClick={handleBack}
          type="button"
        >
          <BackIcon />
        </button>
        <h1 className="text-[16px] font-semibold tracking-[-0.05em]">
          {group.name}
        </h1>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto"
        data-product-scroll-container="artist"
        ref={scrollContainerRef}
      >
        <section className="flex items-center gap-4 px-4 pb-5 pt-5">
          <span
            className={`relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${getGroupTone(
              group.id,
            )} text-[18px] font-semibold tracking-[-0.05em] text-black ring-1 ring-black/10`}
          >
            {group.imageUrl ? (
              <ArtistImage
                imageUrl={group.imageUrl}
                name={group.name}
                roundedClassName="rounded-full"
              />
            ) : (
              getInitials(group.name)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[24px] font-semibold leading-tight tracking-[-0.06em]">
              {group.name}
            </p>
            {/* "모집중 0개" 를 그대로 쓰면 아래 목록에 마감 분철이 보일 때 서로 모순처럼 읽힌다. */}
            <p className="mt-1 text-[13px] font-medium text-black/45">
              {group.recruitingBuncheolCount > 0
                ? `모집중 분철 ${group.recruitingBuncheolCount}개`
                : "지금 모집중인 분철은 없어요"}
            </p>
          </div>
        </section>

        {group.members.length > 0 ? (
          <section className="px-4 pb-5">
            <div className="rounded-[1.1rem] bg-[#f7f7f7] px-4 py-4">
              <p className="text-[12px] font-semibold tracking-[-0.03em] text-black/45">
                멤버별 분철 보기
              </p>
              {/* 멤버가 많으면 칩이 가로로 넘친다. 오른쪽 페이드로 더 있다는 걸 알린다. */}
              <div className="relative mt-3">
                <div className="flex gap-2 overflow-x-auto pb-1 pr-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  className={`h-9 shrink-0 rounded-full px-4 text-[13.5px] font-semibold tracking-[-0.04em] ${
                    selectedMemberId === null
                      ? "bg-black text-white"
                      : "border border-black/10 bg-white text-black/60"
                  }`}
                  onClick={() => setSelectedMemberId(null)}
                  type="button"
                >
                  전체
                </button>
                {group.members.map((member) => (
                  <button
                    className={`h-9 shrink-0 rounded-full px-4 text-[13.5px] font-semibold tracking-[-0.04em] ${
                      selectedMemberId === member.id
                        ? "bg-black text-white"
                        : "border border-black/10 bg-white text-black/60"
                    }`}
                    key={member.id}
                    onClick={() => setSelectedMemberId(member.id)}
                    type="button"
                  >
                    {member.name}
                  </button>
                ))}
                </div>
                <span className="pointer-events-none absolute bottom-0 right-0 top-0 w-6 bg-gradient-to-l from-[#f7f7f7] to-transparent" />
              </div>
            </div>
          </section>
        ) : null}

        <section className="px-4">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
              {selectedMemberName ? `${selectedMemberName} 분철` : "전체 분철"}
            </h2>
            <span className="text-[13px] font-medium text-black/45">
              {isLoading ? "" : `${items.length}개`}
            </span>
          </div>

          {message ? (
            <div className="mb-4 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3">
              <p className="text-[13px] font-semibold text-black/45">
                {message}
              </p>
            </div>
          ) : null}

          {isLoading ? (
            <ProductGridSkeleton ariaLabel="분철을 불러오는 중" variant="wide" />
          ) : items.length > 0 ? (
            /* 카드 형태는 홈 목록과 같은 wide 로 맞춘다. */
            <ProductGrid
              items={items}
              keyPrefix={`artist-${group.id}`}
              variant="wide"
            />
          ) : (
            <div className="rounded-[1.1rem] bg-[#f7f7f7] px-5 py-10 text-center">
              <p className="text-[15px] font-semibold tracking-[-0.05em]">
                {selectedMemberName
                  ? `${selectedMemberName} 분철이 아직 없어요`
                  : `${group.name} 분철이 아직 없어요`}
              </p>
              {selectedMemberName ? (
                <button
                  className="mt-4 inline-flex h-11 items-center rounded-full bg-black px-5 text-[14px] font-semibold tracking-[-0.04em] text-white"
                  onClick={() => setSelectedMemberId(null)}
                  type="button"
                >
                  {group.name} 전체 보기
                </button>
              ) : null}
            </div>
          )}
        </section>

        <div className="pt-8">
          <BusinessFooter />
        </div>
      </div>

      <BottomNavigator activeLabel={null} />
    </div>
  );
}
