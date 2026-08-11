import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ApiProductDetail } from "@/components/ApiProductDetail";
import { JsonLd } from "@/components/JsonLd";
import { UploadedProductDetail } from "@/components/UploadedProductDetail";
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
    const title = `${[detail.groupName, detail.title]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(" ")} 분철`;
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
  const { from, hosted, q } = await searchParams;
  const returnSource = getFirstSearchParam(from);
  const isHostedView = getFirstSearchParam(hosted) === "true";
  const returnQuery = getFirstSearchParam(q);

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

  // 빵부스러기 구조화 데이터 — 상세 조회 실패(삭제·비공개 등) 시 생략한다.
  let breadcrumbJsonLd: Record<string, unknown> | null = null;
  // 익명 조회 상세를 초기 HTML 에 실어 크롤러·첫 페인트가 실제 내용을 보게 한다.
  let initialProduct: ProductDetailItem | null = null;

  try {
    const detail = await getBuncheolDetailCached(id);
    initialProduct = toProductDetailItem(detail);
    const detailName = `${[detail.groupName, detail.title]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(" ")} 분철`;

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
        initialProduct={initialProduct}
        isHostedView={isHostedView}
        returnQuery={returnSource === "search" ? returnQuery ?? "" : undefined}
        returnSource={
          returnSource === "home" ||
          returnSource === "bids" ||
          returnSource === "favorites" ||
          returnSource === "upload"
            ? returnSource
            : undefined
        }
      />
    </>
  );
}
