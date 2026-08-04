import type { Metadata } from "next";
import { ApiProductDetail } from "@/components/ApiProductDetail";
import { UploadedProductDetail } from "@/components/UploadedProductDetail";
import { requestBuncheolDetail } from "@/lib/auth-api";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  if (id.startsWith("uploaded-")) {
    return {};
  }

  try {
    const detail = await requestBuncheolDetail(undefined, id);
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

    return {
      title: `${title} | 분철.`,
      description,
      openGraph: {
        title,
        description,
        ...(imageUrl ? { images: [imageUrl] } : {}),
      },
    };
  } catch {
    // 상세 조회 실패(삭제·비공개 등) 시 루트 레이아웃 기본 메타데이터를 쓴다.
    return {};
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

  return (
    <ApiProductDetail
      id={id}
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
  );
}
