"use client";

import { useSyncExternalStore } from "react";
import { getHistoryIndex } from "@/lib/history-index";

/*
 * 이 화면에 앱 안에서 들어왔는지(뒤로 갈 이전 화면이 있는지) 판정한다.
 *
 * 하위 화면들은 뒤에 "언더레이"로 직전 화면을 깔고 패널을 옆에서 밀어 넣는데,
 * 카톡·X 링크나 새로고침으로 곧장 들어오면 뒤로 갈 화면이 없는데도 언더레이가 깔린다.
 * 예를 들어 /login 을 직접 열면 방문한 적 없는 마이페이지가 통째로 렌더된 뒤
 * 로그인 패널이 그 위로 밀려 들어왔다 — 사용자는 마이페이지를 먼저 보게 된다.
 * 화면 한 벌을 더 마운트하는 비용도 그대로 든다.
 *
 * history.state.idx 는 클라이언트에서만 읽을 수 있어 SSR 스냅샷은 항상 false 다.
 * 하이드레이션 전(=false)에는 언더레이를 붙이지 않는다 — 진입 애니메이션 동안 실제로
 * 보이는 건 왼쪽 몇 px 뿐이라 한 프레임 늦게 붙어도 티가 나지 않는다.
 */
function subscribeToNothing() {
  return () => {};
}

function readIsInAppNavigation() {
  const historyIndex = getHistoryIndex();

  return historyIndex !== null && historyIndex > 0;
}

function getServerSnapshot() {
  return false;
}

export function useIsInAppNavigation() {
  return useSyncExternalStore(
    subscribeToNothing,
    readIsInAppNavigation,
    getServerSnapshot,
  );
}
