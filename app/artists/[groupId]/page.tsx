import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { ArtistBrowseContent } from "@/components/ArtistBrowseContent";
import { JsonLd } from "@/components/JsonLd";
import type { ProductCardItem } from "@/components/ProductCard";
import {
  ApiRequestError,
  requestBuncheols,
  requestGroupDetail,
  toProductCardItem,
} from "@/lib/auth-api";
import { FEATURES } from "@/lib/feature-flags";
import { SITE_URL } from "@/lib/site";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

// 목록이 수시로 열리고 닫히므로 10분마다 재생성한다. 첫 화면 HTML 에 실제 분철이
// 실려 있어야 크롤러가 "아이브 분철" 같은 질의에 이 페이지를 매칭할 수 있다.
export const revalidate = 600;

const ARTIST_PAGE_SIZE = 30;

// 그룹 id 는 숫자다. `/artists/abc` 같은 오링크는 서버가 400(타입 미스매치)을 내려주므로,
// 그대로 두면 500 으로 새어 나간다. 조회 전에 걸러 404 로 응답한다.
function isGroupIdShape(groupId: string) {
  return /^[0-9]+$/.test(groupId);
}

// generateMetadata 와 페이지 본문(JSON-LD·초기 목록)이 같은 요청 안에서 조회를 공유한다.
const getGroupDetailCached = cache((groupId: string) =>
  requestGroupDetail(groupId),
);

type ArtistPageProps = {
  params: Promise<{ groupId: string }>;
};

export async function generateMetadata({
  params,
}: ArtistPageProps): Promise<Metadata> {
  const { groupId } = await params;

  if (!FEATURES.artistBrowse || !isGroupIdShape(groupId)) {
    return { robots: { index: false, follow: false } };
  }

  try {
    const group = await getGroupDetailCached(groupId);
    const title = `${group.name} 분철`;
    const description =
      group.recruitingBuncheolCount > 0
        ? `${group.name} 분철 ${group.recruitingBuncheolCount}건 모집중. 멤버별 포토카드를 나눠 사고 모아 보세요.`
        : `${group.name} 분철을 한곳에서. 멤버별 포토카드를 나눠 사고 모아 보세요.`;

    return {
      title,
      description,
      alternates: { canonical: `/artists/${groupId}` },
      openGraph: {
        type: "website",
        siteName: "분철이지",
        locale: "ko_KR",
        title,
        description,
        url: `/artists/${groupId}`,
        images: [group.imageUrl ?? "/brand/logo-black.png"],
      },
    };
  } catch (error) {
    if (!(error instanceof ApiRequestError && error.status === 404)) {
      console.warn(`[metadata] 그룹 상세 조회 실패 (groupId=${groupId})`, error);
    }

    return { robots: { index: false, follow: false } };
  }
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { groupId } = await params;

  if (!FEATURES.artistBrowse) {
    redirect("/");
  }

  if (!isGroupIdShape(groupId)) {
    notFound();
  }

  let group;

  try {
    group = await getGroupDetailCached(groupId);
  } catch (error) {
    // 404(없는 그룹)와 400(서버가 id 를 해석하지 못함) 모두 "그런 아티스트 없음" 이다.
    if (
      error instanceof ApiRequestError &&
      (error.status === 404 || error.status === 400)
    ) {
      notFound();
    }

    throw error;
  }

  // 목록 조회 실패는 페이지 전체를 죽이지 않는다 — 그룹 헤더·멤버 칩은 이미 렌더할 수 있고,
  // 클라이언트가 멤버 칩을 누르면 재조회한다.
  let initialItems: ProductCardItem[] = [];

  try {
    const summaries = await requestBuncheols(undefined, {
      groupId,
      size: ARTIST_PAGE_SIZE,
    });
    initialItems = summaries.map(toProductCardItem);
  } catch (error) {
    console.warn(`[artists] 분철 목록 조회 실패 (groupId=${groupId})`, error);
  }

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${group.name} 분철`,
    url: `${SITE_URL}/artists/${groupId}`,
    about: { "@type": "MusicGroup", name: group.name },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: initialItems.length,
      itemListElement: initialItems.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.title,
        url: `${SITE_URL}/products/${item.productId ?? item.id}`,
      })),
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: `${group.name} 분철`,
        item: `${SITE_URL}/artists/${groupId}`,
      },
    ],
  };

  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={collectionJsonLd} />
      <div className="mx-auto h-full w-full max-w-[430px]">
        <ArtistBrowseContent group={group} initialItems={initialItems} />
      </div>
    </main>
  );
}
