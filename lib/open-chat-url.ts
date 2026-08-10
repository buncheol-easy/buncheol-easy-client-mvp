// 개최자가 입력한 오픈채팅 URL 을 href 에 바인딩하기 전 스킴을 검증한다.
// React 는 href 스킴을 검사하지 않으므로 javascript:·intent: 등이 저장되면
// 클릭 시 앱 오리진에서 실행될 수 있다 — https 만 링크로 허용한다(그 외는 미노출).
export function getSafeOpenChatHref(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
