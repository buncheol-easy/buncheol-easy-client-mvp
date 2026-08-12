// React Query 키 모음. 무효화(invalidateQueries)는 prefix 매칭이므로
// buncheolsQueryKey 하나로 목록 계열 전체를 갱신할 수 있다.
export const buncheolsQueryKey = ["buncheols"] as const;

export function homeListingsQueryKey(loggedIn: boolean) {
  // 목록 응답의 찜 여부(bookmarked)가 로그인 사용자별로 달라 키에 포함한다.
  return [...buncheolsQueryKey, "list", loggedIn] as const;
}

// 아티스트 페이지의 멤버 필터 결과. 그룹 전체(멤버 미선택)는 서버 렌더 결과를 쓰므로 키가 없다.
export function artistMemberListingsQueryKey(
  groupId: string,
  memberId: string,
) {
  return [...buncheolsQueryKey, "artist", groupId, memberId] as const;
}

// 홈 "내 최애 분철" 섹션. 최애 구성이 바뀌면 무효화되도록 accessToken 대신 로그인 여부만 키에 담고,
// 최애 토글 시 호출 측이 명시적으로 invalidate 한다.
export const favoriteListingsQueryKey = [...buncheolsQueryKey, "favorites"] as const;

export const bannersQueryKey = ["banners"] as const;
