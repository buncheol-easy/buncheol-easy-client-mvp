// MVP 오픈 범위에서 제외한 기능의 진입점을 막는 플래그.
// 기능을 되살릴 때 플래그를 켜고 관련 화면을 재QA한다.
type FeatureFlags = {
  favorites: boolean;
  search: boolean;
};

export const FEATURES: FeatureFlags = {
  favorites: false,
  search: false,
};
