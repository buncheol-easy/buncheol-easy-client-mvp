export type HomeListTab = "all" | "favorite";

// 기기 설정이라 로그아웃 정리(lib/user-session.ts)에 넣지 않는다.
const homeListTabStorageKey = "buncheol-home-list-tab";
const defaultHomeListTab: HomeListTab = "all";

// 값은 모듈 변수가 들고 저장소는 다음 방문용 보조로만 쓴다 — 저장이 막힌 브라우저에서도
// 탭 전환과 상세 왕복 뒤 탭이 유지된다. 밑에 깔린 홈도 같은 값을 구독해 함께 바뀐다.
let currentHomeListTab: HomeListTab | null = null;
const homeListTabListeners = new Set<() => void>();

export function readHomeListTab(): HomeListTab {
  if (typeof window === "undefined") {
    return defaultHomeListTab;
  }

  if (currentHomeListTab !== null) {
    return currentHomeListTab;
  }

  try {
    currentHomeListTab =
      window.localStorage.getItem(homeListTabStorageKey) === "favorite"
        ? "favorite"
        : defaultHomeListTab;
  } catch {
    currentHomeListTab = defaultHomeListTab;
  }

  return currentHomeListTab;
}

export function getServerHomeListTab(): HomeListTab {
  return defaultHomeListTab;
}

export function writeHomeListTab(tab: HomeListTab) {
  currentHomeListTab = tab;

  try {
    window.localStorage.setItem(homeListTabStorageKey, tab);
  } catch {
    // 저장이 막혀도 이번 방문 동안은 모듈 변수로 유지된다.
  }

  homeListTabListeners.forEach((listener) => listener());
}

export function subscribeHomeListTab(onStoreChange: () => void) {
  homeListTabListeners.add(onStoreChange);

  return () => {
    homeListTabListeners.delete(onStoreChange);
  };
}
