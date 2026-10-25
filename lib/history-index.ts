/*
 * 방문 기록(history) 칸마다 "이 문서에서 몇 번째 칸인지" 번호를 붙인다. 뒤로가기가 앱 안의 직전
 * 화면으로 가는지(번호 > 0), 앱 밖으로 나가는지(0 = 이 문서의 첫 칸)를 가를 때 쓴다.
 *
 * Next 16 은 history.state 에 이런 번호(idx)를 넣지 않는다. 그래서 pushState 는 직전 칸 번호 + 1,
 * replaceState 는 지금 칸 번호를 붙이도록 감싼다. 번호는 칸이 생길 때 붙어야 하므로 이 모듈이
 * 처음 import 될 때(그 화면으로 가는 이동이 기록에 쓰이기 전) 설치한다 — 함수 호출 시점으로
 * 미루면 그 전에 생긴 칸은 번호가 없다. 번호 없는 칸(설치 전·새 문서)은 0 으로 읽어
 * "앞 화면 없음" 쪽(대체 화면으로 바꿔치기)으로 떨어진다.
 */
const HISTORY_INDEX_STATE_KEY = "__bceHistoryIndex";
const HISTORY_INDEX_INSTALLED_KEY = "__bceHistoryIndexInstalled";

function readHistoryIndex(state: unknown) {
  if (typeof state !== "object" || state === null) {
    return null;
  }

  const value = (state as Record<string, unknown>)[HISTORY_INDEX_STATE_KEY];

  return typeof value === "number" ? value : null;
}

function withHistoryIndex(data: unknown, index: number) {
  if (data === null || data === undefined) {
    return { [HISTORY_INDEX_STATE_KEY]: index };
  }

  // 객체가 아닌 state 는 바꾸지 않는다 — 그 칸은 번호 없이(0) 읽힌다.
  if (typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  return { ...data, [HISTORY_INDEX_STATE_KEY]: index };
}

function installHistoryIndex() {
  const installTarget = window as Window & {
    [HISTORY_INDEX_INSTALLED_KEY]?: boolean;
  };

  if (installTarget[HISTORY_INDEX_INSTALLED_KEY]) {
    return;
  }

  installTarget[HISTORY_INDEX_INSTALLED_KEY] = true;

  const { history } = window;
  const pushState = history.pushState;
  const replaceState = history.replaceState;

  history.pushState = (data, unused, url) => {
    const nextIndex = (readHistoryIndex(history.state) ?? 0) + 1;

    pushState.call(history, withHistoryIndex(data, nextIndex), unused, url);
  };
  history.replaceState = (data, unused, url) => {
    const currentIndex = readHistoryIndex(history.state) ?? 0;

    replaceState.call(history, withHistoryIndex(data, currentIndex), unused, url);
  };
}

if (typeof window !== "undefined") {
  installHistoryIndex();
}

export function getHistoryIndex() {
  return readHistoryIndex(window.history.state) ?? 0;
}

// 목록 카드를 누를 때 부른다. 다음 push 로 생길 칸의 번호를 적어 두면, 그 화면이 마운트 때
// 지금 번호와 대조해 "바로 앞 칸이 이 목록"인지 확인할 수 있다.
export function rememberNextHistoryIndex(storageKey: string) {
  window.sessionStorage.setItem(storageKey, String(getHistoryIndex() + 1));
}
