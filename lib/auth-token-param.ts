// 로그인 콜백이 토큰을 받는 파라미터 이름. 서버 OAuth2LoginSuccessHandler 의 프래그먼트 키와
// 짝이다 — 콜백 파싱·URL 정리·분석 리댁션이 전부 이 상수를 봐야, 키가 바뀔 때 리댁션만 조용히
// 실패하는 조합이 생기지 않는다(리댁션은 실패해도 아무 신호가 없다).
export const AUTH_TOKEN_PARAM = "accessToken";

// 서버가 이번 로그인으로 계정을 새로 만들었을 때 토큰 옆에 붙이는 표시(signup=1).
export const AUTH_SIGNUP_PARAM = "signup";

// 로그인이 실패하면 서버가 콜백 주소에 붙이는 사유(?error=). 서버 OAuth2 실패 리다이렉터와 짝이다.
export const AUTH_ERROR_PARAM = "error";

const authLoginErrorReasons = ["cancelled", "email_required", "failed"] as const;

export type AuthLoginErrorReason = (typeof authLoginErrorReasons)[number];

// 사유 쿼리가 없으면 undefined(토큰 경로). 있는데 모르는 값·빈 값이면 failed — 서버가 값을 늘려도
// 주소 글자를 화면에 옮기지 않고 「그 밖의 실패」로 받는다.
export function parseAuthLoginErrorReason(
  value: string | undefined,
): AuthLoginErrorReason | undefined {
  if (value === undefined) {
    return undefined;
  }

  return authLoginErrorReasons.find((reason) => reason === value) ?? "failed";
}

export const AUTH_TOKEN_REDACT_PATTERN = new RegExp(
  `${AUTH_TOKEN_PARAM}=[^&#\\s]+`,
  "g",
);
