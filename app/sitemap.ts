import type { MetadataRoute } from "next";
import { requestAllBuncheols } from "@/lib/auth-api";
import { SITE_URL } from "@/lib/site";

// 분철 목록이 수시로 열리고 닫히므로 1시간마다 재생성한다.
export const revalidate = 3600;

// requestAllBuncheols 의 페이지 상한(20)과 곱해 수집 가능한 최대 분철 수.
const SITEMAP_PAGE_SIZE = 100;
const SITEMAP_MAX_ITEMS = 20 * SITEMAP_PAGE_SIZE;

// /search·/artists 는 feature flag off 로 홈으로 307 리다이렉트되므로 제외한다.
// 로그인 전용 경로(/favorites·/profile·/upload 등)는 noindex 라 제외한다.
const staticRoutes = [
  "",
  "/intro",
  "/board",
  "/privacy",
  "/terms",
  "/broker-notice",
  "/refund-policy",
  "/shipping-policy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
  }));

  let productEntries: MetadataRoute.Sitemap = [];

  try {
    const buncheols = await requestAllBuncheols(undefined, {
      size: SITEMAP_PAGE_SIZE,
    });

    if (buncheols.length >= SITEMAP_MAX_ITEMS) {
      console.warn(
        `[sitemap] 분철이 수집 상한(${SITEMAP_MAX_ITEMS}건)에 도달해 일부가 누락될 수 있습니다.`,
      );
    }

    productEntries = buncheols.map((item) => {
      // API 가 updatedAt 을 내려주지 않아 createdAt 만 사용한다.
      // 파싱 불가한 날짜가 하나라도 섞이면 사이트맵 직렬화 전체가 깨지므로 반드시 걸러낸다.
      const lastModified = item.createdAt ? new Date(item.createdAt) : null;

      return {
        url: `${SITE_URL}/products/${item.id}`,
        ...(lastModified && !Number.isNaN(lastModified.getTime())
          ? { lastModified }
          : {}),
      };
    });
  } catch (error) {
    // 빌드·재생성 시점에 백엔드 조회가 실패하면 정적 경로만으로 제공된다.
    // 무음으로 두면 1시간짜리 반쪽 사이트맵이 배포돼도 알 수 없으니 로그를 남긴다.
    console.warn("[sitemap] 분철 목록 조회 실패 — 정적 경로만 포함합니다.", error);
  }

  return [...staticEntries, ...productEntries];
}
