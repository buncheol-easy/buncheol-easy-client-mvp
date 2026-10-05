// 캐노니컬·OG·사이트맵 등 SEO 절대 URL 의 단일 기준.
// 스테이징 등 다른 환경은 NEXT_PUBLIC_SITE_URL 로 덮어쓴다.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ??
  "https://buncheoleasy.com";

// 공식 X 계정. 랜딩 팔로우 버튼·데스크톱 브랜드 패널·Organization sameAs 가
// 같은 값을 쓰도록 한곳에서 관리한다.
export const X_PROFILE_URL = "https://x.com/buncheoleasy";
export const X_HANDLE = "@buncheoleasy";

// 공식 문의 이메일. ⚠️ 바꾸면 개인정보처리방침 문의처(제11조)가 바뀌는 개정이라, 방침 시행일 항목에
// 개정 이력을 남기고 제12조(시행 7일 전 공지)를 따른다.
export const CONTACT_EMAIL = "teameasy024@gmail.com";
