// 내 분철 화면이 다음 진입 때 되살리는 탭 상태. 화면 밖(체험 계정 전환 등)에서 탭을 미리 정할 때도 같은 키를 쓴다.
export const BID_HISTORY_VIEW_STATE_KEY = "bid-history-view-state";

export function storeBidHistoryMode(mode: "joined" | "hosted") {
  try {
    window.sessionStorage.setItem(
      BID_HISTORY_VIEW_STATE_KEY,
      JSON.stringify({ mode }),
    );
  } catch {
    // 저장소가 막혀 있으면 기본 탭으로 연다.
  }
}
