import type { Metadata } from "next";

type BuildPageMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
};

// Next 메타데이터 상속은 openGraph 를 필드 병합이 아니라 세그먼트 단위로 통째 교체한다.
// 페이지가 title 만 바꿔도 og:title 이 루트(홈) 것으로 남지 않도록, 페이지 메타데이터는
// 항상 이 헬퍼로 만들어 openGraph 까지 함께 채운다.
export function buildPageMetadata({
  title,
  description,
  path,
  image,
}: BuildPageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "분철이지",
      locale: "ko_KR",
      title,
      description,
      url: path,
      images: [image ?? "/brand/logo-black.png"],
    },
  };
}

// 분철이 아직 없어도 검색에 열어 둘 그룹 id. 곧 분철을 열 그룹을 미리 넣어 둔다.
// (네이버는 페이지를 다시 가져가기까지 몇 주가 걸려, 분철을 연 뒤에 열면 늦다.)
const PRE_INDEXED_GROUP_IDS: ReadonlySet<string> = new Set([
  "10", // NCT WISH
  "37", // 몬스타엑스
]);

// 빈 아티스트 페이지("지금 모집중인 분철은 없어요")가 검색 결과에 깔리지 않게 한다.
// 페이지 메타(robots)와 사이트맵이 이 판정 하나를 같이 써야 서로 반대 신호를 내지 않는다.
export function isArtistPageIndexable(groupId: string, buncheolCount: number) {
  return buncheolCount > 0 || PRE_INDEXED_GROUP_IDS.has(groupId);
}

// 제목이 영문 이름뿐이면 "샤이니 분철"처럼 한글로 찾는 검색에 걸리지 않는다. 별칭 하나를 붙인다.
export function getArtistSearchName(name: string, aliases: string[] = []) {
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "");
  const alias = aliases
    .map((value) => value.trim())
    .find((value) => value && normalize(value) !== normalize(name));

  return alias ? `${name}(${alias})` : name;
}

// 이름을 다 늘어놓으면 설명이 잘리므로 앞의 몇 명만 쓴다.
export function formatMemberNamesForSearch(names: string[], limit = 6) {
  const unique = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));

  if (unique.length <= limit) {
    return unique.join("·");
  }

  return `${unique.slice(0, limit).join("·")} 등`;
}
