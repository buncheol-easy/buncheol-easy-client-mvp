// 환불계좌 입력 공통 규칙 — 마이페이지 폼(ProfileContent)과 체크아웃 계좌 시트가
// 같은 검증을 쓴다. 두 곳에 복사되면 규칙이 드리프트하므로 여기서만 정의한다.

// 하이픈은 숫자 사이에만 허용 — 선두/말미 하이픈과 연속 하이픈(--)을 막는다.
export const accountNumberPattern = /^\d+(-\d+)*$/;

// 서버 컬럼 길이와 동일한 입력 상한 (은행·계좌번호·예금주 공통).
export const bankAccountFieldMaxLength = 50;

export function sanitizeAccountNumber(value: string) {
  return value.replace(/[^\d-]/g, "");
}
