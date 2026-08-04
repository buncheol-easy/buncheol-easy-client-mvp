// 캐노니컬·OG·사이트맵 등 SEO 절대 URL 의 단일 기준.
// 스테이징 등 다른 환경은 NEXT_PUBLIC_SITE_URL 로 덮어쓴다.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ??
  "https://buncheoleasy.com";
