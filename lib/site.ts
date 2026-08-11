// 캐노니컬·OG·사이트맵 등 SEO 절대 URL 의 단일 기준.
// 스테이징 등 다른 환경은 NEXT_PUBLIC_SITE_URL 로 덮어쓴다.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ??
  "https://buncheoleasy.com";

// 공식 X 계정. 랜딩 팔로우 버튼·데스크톱 브랜드 패널·Organization sameAs 가
// 같은 값을 쓰도록 한곳에서 관리한다.
export const X_PROFILE_URL = "https://x.com/buncheoleasy";
export const X_HANDLE = "@buncheoleasy";
