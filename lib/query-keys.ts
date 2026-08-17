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

export const bannersQueryKey = ["banners"] as const;

// 아이돌 그룹 계열. 홈 레일과 /artists 가 같은 데이터를 보므로 캐시를 공유해야 한다 —
// 화면마다 따로 받으면 이동할 때마다 스켈레톤과 미필터 목록이 한 번씩 그려졌다 갈린다.
export const groupsQueryKey = ["groups"] as const;

// 그룹 마스터 목록(전체). 키워드 없는 전량 조회만 캐시한다.
export const allGroupsQueryKey = [...groupsQueryKey, "all"] as const;

export function favoriteGroupsQueryKey(loggedIn: boolean) {
  // 최애는 사용자별 데이터라 로그아웃 상태의 빈 목록과 키를 분리한다.
  return [...groupsQueryKey, "favorites", loggedIn] as const;
}
