// 환불계좌 입력 공통 규칙 — 마이페이지 폼(ProfileContent)과 체크아웃 계좌 시트가
// 같은 검증을 쓴다. 두 곳에 복사되면 규칙이 드리프트하므로 여기서만 정의한다.

// 하이픈은 숫자 사이에만 허용 — 선두/말미 하이픈과 연속 하이픈(--)을 막는다.
export const accountNumberPattern = /^\d+(-\d+)*$/;

// 서버 컬럼 길이와 동일한 입력 상한 (은행·계좌번호·예금주 공통).
export const bankAccountFieldMaxLength = 50;

export function sanitizeAccountNumber(value: string) {
  return value.replace(/[^\d-]/g, "");
}

/*
 * 저장된 계좌번호를 화면에 보여줄 때 쓰는 가림 처리.
 * 마이페이지는 카페·지하철에서도 여는 화면인데 환불계좌가 가장 큰 글씨로 그대로 떠 있었다.
 * 앞 4자리와 뒤 2자리만 남기고 가운데를 가린다 — 내 계좌가 맞는지 확인하는 데는 충분하고,
 * 어깨너머로 옮겨 적기에는 부족한 정도다. 하이픈 등 구분자는 위치를 유지한다.
 */
export function maskAccountNumber(value: string) {
  const visiblePrefixLength = 4;
  const visibleSuffixLength = 2;
  const digits = value.replace(/\D/g, "");

  if (digits.length <= visiblePrefixLength + visibleSuffixLength) {
    return value;
  }

  let digitIndex = 0;

  return value.replace(/\d/g, (digit) => {
    const currentIndex = digitIndex;

    digitIndex += 1;

    return currentIndex < visiblePrefixLength ||
      currentIndex >= digits.length - visibleSuffixLength
      ? digit
      : "•";
  });
}
