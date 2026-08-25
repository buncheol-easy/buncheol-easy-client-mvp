// 개최자가 입력한 오픈채팅 URL 을 href 에 바인딩하기 전 검증한다.
// ① 스킴: React 는 href 스킴을 검사하지 않으므로 javascript:·intent: 등이 저장되면
//    클릭 시 앱 오리진에서 실행될 수 있다 — https 만 허용.
// ② 호스트: "개최자 오픈채팅 참여하기"라는 신뢰 문구로 노출되는 UGC 링크라
//    카카오 오픈채팅(open.kakao.com)만 허용한다 — 입금 직전 화면의 피싱 링크 방지
//    (서버 개최 폼 검증과 같은 기준, docs/46 §4.6).
export function getSafeOpenChatHref(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname === "open.kakao.com"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

// 개최자가 입력한 값을 저장 가능한 형태로 다듬는다. 스킴을 빼고 적는 경우가 흔해
// (open.kakao.com/o/...) https 를 한 번 보정해 본다. 통과하지 못하면 null — 호출부가 안내를 띄운다.
export function normalizeOpenChatUrlInput(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return (
    getSafeOpenChatHref(trimmedValue) ??
    getSafeOpenChatHref(`https://${trimmedValue}`)
  );
}
