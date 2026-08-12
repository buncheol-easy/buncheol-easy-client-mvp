// 아티스트 페이지 복귀 계약(`/products/[id]?from=artist&groupId=`)에서 서로 다른 파일이
// 같은 키·같은 검증을 써야 하는 것들만 모은다. 문자열을 각자 들고 있으면 한쪽만 바뀌었을 때
// 저장은 되는데 읽히지 않는(=조용히 복원 실패) 형태로 어긋난다.

// 그룹 id 는 숫자다. `/artists/abc` 같은 오링크는 서버가 400(타입 미스매치)을 내려주므로,
// 조회 전에 걸러야 500 으로 새지 않는다. 복귀처 판정도 같은 기준을 써야 뒤로가기가 404 로 떨어지지 않는다.
export function isGroupIdShape(groupId: string) {
  return /^[0-9]+$/.test(groupId);
}

// 스크롤은 그룹당 하나만 저장한다 — 선택 멤버를 같이 복원하므로 저장 시점의 목록과 복원 시점의
// 목록이 항상 같다. (검색처럼 필터별로 키를 쪼갤 이유가 없다.)
export function getArtistScrollTopKey(groupId: string) {
  return `artist-scroll-top:${groupId}`;
}

export function getArtistSelectedMemberKey(groupId: string) {
  return `artist-selected-member:${groupId}`;
}

// 저장은 카드 클릭 시점, 복원은 아티스트 화면 마운트 시점이라 "돌아온 마운트인가" 를 따로 가려야 한다.
// 이 표기가 없으면 상세에서 홈으로 빠져나간 뒤 레일로 같은 그룹을 새로 열 때도 지난번 멤버 필터가
// 걸린 채 열린다 — 스크롤 오프셋과 달리 멤버 필터는 화면 제목과 목록 내용까지 바꾼다.
export function getArtistRestoreIndexKey(groupId: string) {
  return `artist-restore-index:${groupId}`;
}

// ProductCard(저장)와 ProductDetail(판독)이 같은 값을 봐야 한다.
export const PRODUCT_ARTIST_ENTRY_INDEX_KEY = "product-artist-entry-index";
