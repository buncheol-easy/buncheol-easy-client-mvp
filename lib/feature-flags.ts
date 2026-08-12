// MVP 오픈 범위에서 제외한 기능의 진입점을 막는 플래그.
// 기능을 되살릴 때 플래그를 켜고 관련 화면을 재QA한다.
type FeatureFlags = {
  // 아이돌 단위 브라우즈 — 홈 아티스트 레일과 /artists/[groupId] 페이지.
  // favoriteArtists·search 와 독립이다: 최애 등록(로그인 필요)이나 키워드 검색 없이
  // 그룹만 눌러 분철을 보는 경로라, 두 플래그가 꺼진 상태에서도 단독으로 동작한다.
  artistBrowse: boolean;
  favoriteArtists: boolean;
  search: boolean;
  // 오픈 이벤트 "배송비 돌려받기" UI (참여내역 CTA/시트·상세 안내·홈 배지·어드민 탭).
  // 개최 기능 오픈 시 false 로 내리면 이후 0원 분철에는 이벤트 UI가 붙지 않는다 (서버 설정과 세트로 종료).
  shippingFeePayback: boolean;
};

export const FEATURES: FeatureFlags = {
  artistBrowse: true,
  favoriteArtists: false,
  search: false,
  shippingFeePayback: true,
};
