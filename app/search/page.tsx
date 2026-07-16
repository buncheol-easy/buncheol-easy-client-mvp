import { redirect } from "next/navigation";
import { SearchExperience } from "@/components/SearchExperience";
import { FEATURES } from "@/lib/feature-flags";
import { blackChromeViewport } from "@/lib/system-chrome";

export const viewport = blackChromeViewport;

type SearchPageProps = {
  searchParams: Promise<{
    from?: string | string[];
    memberId?: string | string[];
    q?: string | string[];
  }>;
};

function normalizeQuery(query: string | string[] | undefined) {
  return Array.isArray(query) ? query[0] : query;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  if (!FEATURES.search) {
    redirect("/");
  }

  const { from, memberId, q } = await searchParams;

  return (
    <SearchExperience
      query={normalizeQuery(q)}
      relatedSearch={normalizeQuery(from) === "related"}
      selectedMemberId={normalizeQuery(memberId)}
    />
  );
}
