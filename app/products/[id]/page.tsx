import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ApiProductDetail } from "@/components/ApiProductDetail";
import { JsonLd } from "@/components/JsonLd";
import { UploadedProductDetail } from "@/components/UploadedProductDetail";
import { isGroupIdShape } from "@/lib/artist-browse";
import {
  ApiRequestError,
  requestBuncheolDetail,
  toProductDetailItem,
} from "@/lib/auth-api";
import { isBuncheolDeletedStatus } from "@/lib/buncheol-states";
import type { ProductDetailItem } from "@/lib/mock-products";
import { SITE_URL } from "@/lib/site";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

// generateMetadata 와 페이지 본문(JSON-LD)이 같은 요청 안에서 상세 조회를 공유한다.
const getBuncheolDetailCached = cache((id: string) =>
  requestBuncheolDetail(undefined, id),
);

// 분철 제목은 대부분 "분철"이라는 말과 아티스트명을 이미 포함해, 그대로 이어 붙이면
// "프로미스나인 … 분철 분철"처럼 중복된다. 겹치는 조각은 생략한다.
// - "분철"은 위치를 따지지 않는다 — "…분철 (2차)", "…분철 모집합니다"처럼 꼬리가 붙는 제목이 흔하다.
// - 아티스트명 비교는 대소문자·공백 표기 차이("IVE" vs "ive 앨범")를 흡수해 판정한다.
function formatBuncheolPageTitle(groupName: string, title: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "");
  const trimmedTitle = title.trim();
  const trimmedGroupName = groupName.trim();
  const titleHasGroupName =
    trimmedGroupName.length > 0 &&
    normalize(trimmedTitle).includes(normalize(trimmedGroupName));
  const base = [titleHasGroupName ? "" : trimmedGroupName, trimmedTitle]
    .filter(Boolean)
    .join(" ");

  if (!base) {
    return "분철";
  }

  return base.includes("분철") ? base : `${base} 분철`;
}

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  if (id.startsWith("uploaded-")) {
    // 클라이언트 임시 저장 분철 — 백엔드 레코드가 없어 색인 대상이 아니다.
    return { robots: { index: false, follow: false } };
  }

  try {
    const detail = await getBuncheolDetailCached(id);
    const title = formatBuncheolPageTitle(detail.groupName, detail.title);
    const trimmedDescription = detail.description?.trim() ?? "";
    const description =
      (trimmedDescription.length > 90
        ? `${trimmedDescription.slice(0, 90)}…`
        : trimmedDescription) ||
      `${title} — 멤버별 포토카드를 나눠 사고 모아 보세요.`;
    // thumbnailUrl 은 파서가 thumbnail 플래그 → 첫 이미지 순으로 이미 보정해 내려준다.
    const imageUrl = detail.thumbnailUrl;

    // openGraph 는 세그먼트 단위로 통째 교체되므로 루트의 type/siteName/locale 을 다시 채운다.
    return {
      title,
      description,
      alternates: { canonical: `/products/${id}` },
      openGraph: {
        type: "website",
        siteName: "분철이지",
        locale: "ko_KR",
        title,
        description,
        url: `/products/${id}`,
        images: [imageUrl ?? "/brand/logo-black.png"],
      },
    };
  } catch (error) {
    // 없는 분철(404)은 페이지 본문의 notFound() 로 이어지는 정상 흐름이라 경고를 남기지 않는다.
    if (!(error instanceof ApiRequestError && error.status === 404)) {
      console.warn(`[metadata] 분철 상세 조회 실패 (id=${id})`, error);
    }

    // 상세 조회 실패(삭제·비공개·일시 오류) 화면은 색인 대상이 아니다.
    return { robots: { index: false, follow: false } };
  }
}

type ProductDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    from?: string | string[];
    groupId?: string | string[];
    hosted?: string | string[];
    q?: string | string[];
  }>;
};

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: ProductDetailPageProps) {
  const { id } = await params;
  const { from, groupId, hosted, q } = await searchParams;
  const returnSource = getFirstSearchParam(from);
  const isHostedView = getFirstSearchParam(hosted) === "true";
  const returnQuery = getFirstSearchParam(q);
  // 주소창에 그대로 노출되는 값이라 손으로 고친 링크가 들어온다. 형태를 여기서 걸러야
  // 뒤로가기가 `/artists/abc` → 404 로 떨어지지 않고 홈 폴백으로 안전하게 흡수된다.
  const rawReturnGroupId = getFirstSearchParam(groupId);
  const returnGroupId =
    rawReturnGroupId && isGroupIdShape(rawReturnGroupId)
      ? rawReturnGroupId
      : undefined;

  if (id.startsWith("uploaded-")) {
    return (
      <UploadedProductDetail
        id={id}
        returnSource={
          returnSource === "home" ||
          returnSource === "bids" ||
          returnSource === "favorites" ||
          returnSource === "upload"
            ? returnSource
            : undefined
        }
      />
    );
  }

  // 서버 렌더 시각 — 카운트다운(deadlineTick)의 하이드레이션 첫 렌더를 SSR HTML 과
  // 동일하게 만들기 위한 기준시각. 마운트 후에는 클라이언트 시계로 넘어간다.
  // 요청 시각을 캡처하는 것이 목적이므로 purity 규칙을 의도적으로 예외 처리한다.
  // eslint-disable-next-line react-hooks/purity -- 요청 시각 캡처가 목적
  const initialNowMs = Date.now();
  // 빵부스러기 구조화 데이터 — 상세 조회 실패(삭제·비공개 등) 시 생략한다.
  let breadcrumbJsonLd: Record<string, unknown> | null = null;
  // 익명 조회 상세를 초기 HTML 에 실어 크롤러·첫 페인트가 실제 내용을 보게 한다.
  let initialProduct: ProductDetailItem | null = null;

  try {
    const detail = await getBuncheolDetailCached(id);
    initialProduct = toProductDetailItem(detail);
    const detailName = formatBuncheolPageTitle(detail.groupName, detail.title);

    breadcrumbJsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "홈",
          item: `${SITE_URL}/`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: detailName,
          item: `${SITE_URL}/products/${id}`,
        },
      ],
    };
  } catch (error) {
    // 백엔드가 404 를 내려준 분철은 soft 404(HTTP 200) 대신 실제 404 문서로 응답한다.
    if (error instanceof ApiRequestError && error.status === 404) {
      notFound();
    }

    // 그 외 실패(네트워크·서버 오류)는 클라이언트 재조회에 맡긴다.
    // generateMetadata 쪽에서 이미 같은 실패를 로그로 남긴다.
    breadcrumbJsonLd = null;
  }

  // 백엔드 삭제(HOST_CANCELLED)는 상세에서 404 로 떨어지지만, 목록 파서가 방어적으로
  // 거르는 DELETED 상태가 200 으로 내려오는 경우까지 같은 방어선을 둔다.
  // notFound() 는 예외를 던지므로 위 catch 에 삼켜지지 않게 try 밖에서 호출한다.
  if (initialProduct && isBuncheolDeletedStatus(initialProduct.status)) {
    notFound();
  }

  return (
    <>
      {breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
      <ApiProductDetail
        id={id}
        initialNowMs={initialNowMs}
        initialProduct={initialProduct}
        isHostedView={isHostedView}
        returnGroupId={returnSource === "artist" ? returnGroupId : undefined}
        returnQuery={returnSource === "search" ? returnQuery ?? "" : undefined}
        returnSource={
          returnSource === "home" ||
          returnSource === "bids" ||
          returnSource === "favorites" ||
          returnSource === "upload" ||
          (returnSource === "artist" && returnGroupId)
            ? returnSource
            : undefined
        }
      />
    </>
  );
}
