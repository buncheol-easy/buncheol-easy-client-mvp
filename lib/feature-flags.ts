// MVP 오픈 범위에서 제외한 기능의 진입점을 막는 플래그.
// 기능을 되살릴 때 플래그를 켜고 관련 화면을 재QA한다.
type FeatureFlags = {
  favoriteArtists: boolean;
  search: boolean;
  // 오픈 이벤트 "배송비 돌려받기" UI (참여내역 CTA/시트·상세 안내·홈 배지·어드민 탭).
  // 개최 기능 오픈 시 false 로 내리면 이후 0원 분철에는 이벤트 UI가 붙지 않는다 (서버 설정과 세트로 종료).
  shippingFeePayback: boolean;
};

export const FEATURES: FeatureFlags = {
  favoriteArtists: false,
  search: false,
  shippingFeePayback: true,
};
