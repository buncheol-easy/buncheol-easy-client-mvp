// React Query 키 모음. 무효화(invalidateQueries)는 prefix 매칭이므로
// buncheolsQueryKey 하나로 목록 계열 전체를 갱신할 수 있다.
export const buncheolsQueryKey = ["buncheols"] as const;

export function homeListingsQueryKey(loggedIn: boolean) {
  // 목록 응답의 찜 여부(bookmarked)가 로그인 사용자별로 달라 키에 포함한다.
  return [...buncheolsQueryKey, "list", loggedIn] as const;
}

export const bannersQueryKey = ["banners"] as const;
