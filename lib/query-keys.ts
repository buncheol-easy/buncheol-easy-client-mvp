// React Query 키 모음. 무효화(invalidateQueries)는 prefix 매칭이므로
// buncheolsQueryKey 하나로 목록 계열 전체를 갱신할 수 있다.
export const buncheolsQueryKey = ["buncheols"] as const;

export function homeListingsQueryKey(loggedIn: boolean) {
  // 목록 응답의 찜 여부(bookmarked)가 로그인 사용자별로 달라 키에 포함한다.
  return [...buncheolsQueryKey, "list", loggedIn] as const;
}

// 아티스트 페이지 목록. memberId 가 빈 문자열이면 그룹 전체 탭이다.
// 홈 목록과 같은 이유로 로그인 여부를 키에 포함한다.
export function artistListingsQueryKey(
  groupId: string,
  memberId: string,
  loggedIn: boolean,
) {
  return [...buncheolsQueryKey, "artist", groupId, memberId, loggedIn] as const;
}

// 목록 키의 로그인 여부는 마지막 조각이다. 이 판별을 키 정의와 떼어 놓으면, 키에 조각이
// 하나 더 붙었을 때 타입 에러 없이 찜 동기화만 조용히 끊긴다.
export function isLoggedInListingQueryKey(queryKey: readonly unknown[]) {
  return queryKey.at(-1) === true;
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
