import type { ArtistRailItem } from "@/components/ArtistRail";
import type { ApiGroup, ApiGroupMember } from "@/lib/auth-api";

type SearchableGroup = {
  aliases?: string[];
  group?: string;
  name: string;
};

const groupTones = [
  "from-zinc-950 via-zinc-600 to-zinc-200",
  "from-neutral-200 via-white to-zinc-500",
  "from-zinc-300 via-zinc-50 to-neutral-500",
  "from-black via-zinc-700 to-stone-300",
  "from-stone-200 via-zinc-50 to-neutral-300",
];

export function getInitials(value: string) {
  const initials = value
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "G";
}

export function getGroupTone(seed: string) {
  const hash = [...seed].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );

  return groupTones[hash % groupTones.length];
}

export function toArtistRailItem(group: ApiGroup): ArtistRailItem {
  return {
    apiId: group.id,
    id: `group:${group.id}`,
    name: group.name,
    favorited: group.favorited,
    imageUrl: group.imageUrl,
    initials: getInitials(group.name),
    tone: getGroupTone(group.id),
    type: "group",
  };
}

export function toMemberRailItem(
  member: ApiGroupMember,
  groupName?: string,
): ArtistRailItem {
  return {
    apiId: member.id,
    id: `member:${member.id}`,
    name: member.name,
    group: groupName,
    imageUrl: member.imageUrl,
    initials: getInitials(member.name),
    tone: getGroupTone(member.id),
    type: "member",
  };
}

/**
 * 그룹·멤버 이름 비교용 정규화. 서버의 `SearchText.normalize` / `search_name` 생성 컬럼과 같은 규칙을
 * 유지해야 한다 — 서버가 매칭해 내려준 그룹을 여기서 다르게 정규화하면 랭킹에서 탈락시켜 버린다.
 * (`·` 누락으로 "NCT · DREAM" 이 사라지던 문제가 그 사례다.)
 *
 * 서버가 지우지 않는 `{}`, 전각 괄호 `（）` 까지 지우는 차이는 남겨 둔다. 실제 그룹명에 쓰이지 않는
 * 문자라 더 지워도 매칭이 줄지 않고, 지우는 쪽이 사용자 오타에 관대하다.
 */
export function normalizeGroupSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._\-()（）[\]{}·]+/g, "");
}

function getSearchValues(group: SearchableGroup) {
  return [group.name, group.group, ...(group.aliases ?? [])]
    .filter((value): value is string => Boolean(value))
    .map(normalizeGroupSearchText)
    .filter(Boolean);
}

export function rankGroupSearchResults<T extends SearchableGroup>(
  groups: T[],
  query: string,
  limit = 3,
) {
  const normalizedQuery = normalizeGroupSearchText(query);

  if (!normalizedQuery) {
    return groups.slice(0, limit);
  }

  // 정확일치는 전부 돌려준다. 예전엔 첫 1건만 반환했는데, getSearchValues 에 별칭이 들어오면서
  // 서로 다른 그룹이 같은 별칭을 가질 수 있게 됐다(서버 UNIQUE 가 (group_id, search_alias) 라
  // 그룹 간 중복을 허용한다). 1건만 반환하면 나머지가 배열 순서에 따라 조용히 사라진다.
  const nameExactMatches = groups.filter(
    (group) => normalizeGroupSearchText(group.name) === normalizedQuery,
  );
  // 이름 정확일치가 별칭 정확일치보다 항상 우선한다 — "IU" 를 친 사람이 찾는 건 별칭이 IU 인
  // 다른 그룹이 아니라 이름이 IU 인 그룹이다.
  const exactMatches =
    nameExactMatches.length > 0
      ? nameExactMatches
      : groups.filter((group) =>
          getSearchValues(group).some((value) => value === normalizedQuery),
        );

  if (exactMatches.length > 0) {
    return exactMatches.slice(0, limit);
  }

  return groups
    .map((group, index) => {
      const values = getSearchValues(group);
      const initials = normalizeGroupSearchText(getInitials(group.name));
      const startsWithIndex = values.findIndex((value) =>
        value.startsWith(normalizedQuery),
      );
      const includesIndex = values.findIndex((value) =>
        value.includes(normalizedQuery),
      );
      const queryIncludesIndex = values.findIndex((value) =>
        normalizedQuery.includes(value),
      );

      let score = 80;

      if (startsWithIndex >= 0) {
        score = startsWithIndex === 0 ? 10 : 14;
      } else if (includesIndex >= 0) {
        score = includesIndex === 0 ? 20 : 24;
      } else if (queryIncludesIndex >= 0) {
        score = queryIncludesIndex === 0 ? 30 : 34;
      } else if (initials.startsWith(normalizedQuery)) {
        score = 40;
      }

      return { group, index, score };
    })
    .filter(({ score }) => score < 80)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      if (left.group.name.length !== right.group.name.length) {
        return left.group.name.length - right.group.name.length;
      }

      return left.index - right.index;
    })
    .slice(0, limit)
    .map(({ group }) => group);
}
