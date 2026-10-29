// 「개최한 분철」의 「수락해 주세요」가 관리 화면 주소에 붙이는 조각. 관리 화면이 첫 수락 대기 카드로 내려 준다.
export const EXTRA_ACCEPT_ANCHOR_ID = "extra-accept";

// 진행 확정 뒤 관리 화면에 처음 들어올 때 추가 모집을 권하는 시트를 한 번만 띄운다. 기기 기억이라
// 다른 브라우저에서 한 번 더 뜰 수 있고, 시트는 「나중에」로 바로 닫혀 손해가 없다.
const extraRecruitPromptStorageKey = "buncheol-extra-recruit-prompt-seen-v1";
const maxRememberedBuncheols = 50;

// 저장이 막힌 브라우저(시크릿 창 등)에서도 같은 방문 안에서는 다시 뜨지 않게 한다.
const seenInThisVisit = new Set<string>();

function readSeenBuncheolIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(extraRecruitPromptStorageKey) ?? "[]",
    );

    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function hasSeenExtraRecruitPrompt(buncheolId: string) {
  return (
    seenInThisVisit.has(buncheolId) ||
    readSeenBuncheolIds().includes(buncheolId)
  );
}

// 시트가 뜨는 순간 부른다 — 「나중에」, 「추가 모집 열기」, 바깥 누르기 모두 다시 뜨지 않는다.
export function markExtraRecruitPromptSeen(buncheolId: string) {
  seenInThisVisit.add(buncheolId);

  try {
    const ids = [
      ...readSeenBuncheolIds().filter((id) => id !== buncheolId),
      buncheolId,
    ].slice(-maxRememberedBuncheols);

    window.localStorage.setItem(
      extraRecruitPromptStorageKey,
      JSON.stringify(ids),
    );
  } catch {
    // 이번 방문 동안은 seenInThisVisit 이 막는다.
  }
}
