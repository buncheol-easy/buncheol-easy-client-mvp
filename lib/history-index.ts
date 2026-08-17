// Next.js App Router 가 history.state 에 넣는 내부 인덱스(idx). 뒤로가기가 앱 밖으로
// 빠져나가는지(첫 진입) 판정할 때 쓴다. 동일 구현이 화면마다 복붙돼 있던 것을 통합.
export function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}
