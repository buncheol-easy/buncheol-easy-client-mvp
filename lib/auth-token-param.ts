// 로그인 콜백이 토큰을 받는 파라미터 이름. 서버 OAuth2LoginSuccessHandler 의 프래그먼트 키와
// 짝이다 — 콜백 파싱·URL 정리·분석 리댁션이 전부 이 상수를 봐야, 키가 바뀔 때 리댁션만 조용히
// 실패하는 조합이 생기지 않는다(리댁션은 실패해도 아무 신호가 없다).
export const AUTH_TOKEN_PARAM = "accessToken";

export const AUTH_TOKEN_REDACT_PATTERN = new RegExp(
  `${AUTH_TOKEN_PARAM}=[^&#\\s]+`,
  "g",
);
