"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArtistImage } from "@/components/ArtistRail";
import { BottomNavigator } from "@/components/BottomNavigator";
import { BusinessFooter } from "@/components/BusinessFooter";
import { BackIcon, CheckIcon } from "@/components/icons";
import { getHistoryIndex } from "@/lib/history-index";
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

// 스크롤 저장/복원은 아직 없다. ProductCard 의 목록 복귀 계약(`?from=...`)에 이 화면이 연결되지 않아
// 저장해도 읽는 쪽이 없었고, 배선만 남기면 동작하는 것처럼 보여 더 위험하다.
// 서버 렌더 초기 목록과 같은 크기로 맞춰, 멤버 선택 전후 목록 길이 기준이 어긋나지 않게 한다.
const ARTIST_PAGE_SIZE = 30;

// 5열 × 2행 - "전체" 칸 = 멤버 9명. 전체 그룹의 97%가 9명 이하라 대부분 접힘 없이 다 보인다.
const MEMBER_GRID_COLUMNS = 5;
const MEMBER_GRID_COLLAPSED_ROWS = 2;
const COLLAPSED_MEMBER_LIMIT = MEMBER_GRID_COLUMNS * MEMBER_GRID_COLLAPSED_ROWS - 1;
// 1~2명 감추자고 "더보기"를 띄우면 누를 이유 없는 버튼만 생긴다. 그런 그룹은 3행째를 그냥 편다.
const MIN_HIDDEN_MEMBERS_TO_COLLAPSE = 3;

/**
 * 그룹 로고용 {@link ArtistImage} 를 쓰지 않는다 — 그쪽은 배경 대비색을 구하려고 이미지마다
 * canvas 픽셀을 읽는데, 얼굴은 원형으로 꽉 채워 잘라 배경이 안 보이므로 그 계산이 통째로 낭비다.
 */
function MemberFace({
  imageUrl,
  name,
  toneSeed,
}: {
  imageUrl?: string;
  name: string;
  toneSeed: string;
}) {
  const [didImageFail, setDidImageFail] = useState(false);

  if (!imageUrl || didImageFail) {
    return (
      <span
        className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${getGroupTone(
          toneSeed,
        )} text-[13px] font-semibold tracking-[-0.05em] text-black`}
      >
        {getInitials(name)}
      </span>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      alt={name}
      /* 원본이 4:5 세로컷이고 얼굴이 상단 55% 안에 있어, 정중앙에서 자르면 이마·턱이 날아간다. */
      className="h-full w-full object-cover [object-position:50%_16%]"
      decoding="async"
      loading="lazy"
      onError={() => setDidImageFail(true)}
      src={imageUrl}
    />
  );
}

export function ArtistBrowseContent({
  group,
  initialItems,
}: ArtistBrowseContentProps) {
  const router = useRouter();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isMemberListExpanded, setIsMemberListExpanded] = useState(false);

  const hiddenMemberCount = Math.max(
    group.members.length - COLLAPSED_MEMBER_LIMIT,
    0,
  );
  const isMemberListCollapsible =
    hiddenMemberCount >= MIN_HIDDEN_MEMBERS_TO_COLLAPSE;
  const visibleMembers =
    isMemberListCollapsible && !isMemberListExpanded
      ? group.members.slice(0, COLLAPSED_MEMBER_LIMIT)
      : group.members;

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

  function handleBack() {
    // 레포 컨벤션(PolicyPageContent·BoardExperience)과 동일 — 앱 내부에서 들어왔으면 되돌아가고,
    // SEO 유입 같은 직접 진입만 홈으로 보낸다. push 로 홈을 쌓으면 기기 뒤로가기가 다시 이 페이지로
    // 돌아오는 왕복이 생긴다.
    const historyIndex = getHistoryIndex();

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace("/");
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
              <div className="mt-3 grid grid-cols-5 gap-x-2 gap-y-2.5">
                <button
                  aria-label="전체 분철 보기"
                  aria-pressed={selectedMemberId === null}
                  className="flex flex-col items-center gap-1.5"
                  onClick={() => setSelectedMemberId(null)}
                  type="button"
                >
                  <span
                    className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-full text-[12.5px] font-bold tracking-[-0.04em] transition ${
                      selectedMemberId === null
                        ? "scale-95 bg-brand-accent text-black"
                        : "bg-white text-black/55 ring-1 ring-black/10"
                    }`}
                  >
                    전체
                  </span>
                  <span
                    className={`break-keep wrap-anywhere text-center text-[11.5px] leading-tight tracking-[-0.04em] ${
                      selectedMemberId === null
                        ? "font-bold text-black"
                        : "font-semibold text-black/50"
                    }`}
                  >
                    전체
                  </span>
                </button>
                {visibleMembers.map((member) => {
                  const isSelected = selectedMemberId === member.id;

                  return (
                    <button
                      aria-label={`${member.name} 분철만 보기`}
                      aria-pressed={isSelected}
                      className="flex flex-col items-center gap-1.5"
                      key={member.id}
                      onClick={() => setSelectedMemberId(member.id)}
                      type="button"
                    >
                      <span
                        className={`relative block w-full transition-transform ${
                          isSelected ? "scale-95" : ""
                        }`}
                      >
                        <span
                          className={`block aspect-square w-full overflow-hidden rounded-full bg-[#f1f1f1] ${
                            isSelected
                              ? "ring-[2.5px] ring-black"
                              : "ring-1 ring-black/10"
                          }`}
                        >
                          <MemberFace
                            imageUrl={member.imageUrl}
                            name={member.name}
                            toneSeed={member.id}
                          />
                        </span>
                        {/* 라임은 링으로 쓰면 패널과 1.06:1 이라 사라진다 — 면(배지)으로만 쓴다. */}
                        {isSelected ? (
                          <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-[19px] w-[19px] items-center justify-center rounded-full bg-brand-accent ring-2 ring-[#f7f7f7]">
                            <CheckIcon className="h-[11px] w-[11px]" />
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`break-keep wrap-anywhere text-center text-[11.5px] leading-tight tracking-[-0.04em] ${
                          isSelected
                            ? "font-bold text-black"
                            : "font-semibold text-black/50"
                        }`}
                      >
                        {member.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {isMemberListCollapsible ? (
                <button
                  aria-expanded={isMemberListExpanded}
                  className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-full border border-black/10 bg-white text-[12.5px] font-semibold tracking-[-0.04em] text-black/55"
                  onClick={() => setIsMemberListExpanded((current) => !current)}
                  type="button"
                >
                  {isMemberListExpanded
                    ? "접기"
                    : `멤버 ${hiddenMemberCount}명 더보기`}
                </button>
              ) : null}
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
          ) : message ? (
            /* 조회 실패는 위 문구로만 알린다. "분철이 아직 없어요" 를 같이 띄우면 실패를
               0건으로 잘못 읽게 된다. */
            null
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
