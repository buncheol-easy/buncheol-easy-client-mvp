import type { Metadata } from "next";

type BuildPageMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
};

// Next 메타데이터 상속은 openGraph 를 필드 병합이 아니라 세그먼트 단위로 통째 교체한다.
// 페이지가 title 만 바꿔도 og:title 이 루트(홈) 것으로 남지 않도록, 페이지 메타데이터는
// 항상 이 헬퍼로 만들어 openGraph 까지 함께 채운다.
export function buildPageMetadata({
  title,
  description,
  path,
  image,
}: BuildPageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "분철이지",
      locale: "ko_KR",
      title,
      description,
      url: path,
      images: [image ?? "/brand/logo-black.png"],
    },
  };
}
