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

export function normalizeGroupSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._\-()（）[\]{}]+/g, "");
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

  const exactMatch = groups.find((group) =>
    getSearchValues(group).some((value) => value === normalizedQuery),
  );

  if (exactMatch) {
    return [exactMatch];
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
