import type { MetadataRoute } from "next";
import { requestAllBuncheols } from "@/lib/auth-api";

// 분철 목록이 수시로 열리고 닫히므로 1시간마다 재생성한다.
export const revalidate = 3600;

const baseUrl = "https://buncheoleasy.com";

// /search·/artists 는 feature flag off 로 홈으로 307 리다이렉트되므로 제외한다.
// 로그인 전용 경로(/favorites·/profile·/upload 등)는 noindex 라 제외한다.
const staticRoutes = [
  "",
  "/intro",
  "/board",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/shipping-policy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
  }));

  let productEntries: MetadataRoute.Sitemap = [];

  try {
    const buncheols = await requestAllBuncheols();
    productEntries = buncheols.map((item) => ({
      url: `${baseUrl}/products/${item.id}`,
      // API 가 updatedAt 을 내려주지 않아 createdAt 만 사용한다.
      // 부정확한 lastmod 는 없느니만 못하므로 없으면 생략한다.
      ...(item.createdAt
        ? { lastModified: new Date(item.createdAt) }
        : {}),
    }));
  } catch {
    // 백엔드 조회 실패 시에도 정적 경로만으로 사이트맵을 제공한다.
  }

  return [...staticEntries, ...productEntries];
}
