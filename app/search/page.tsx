import { SearchExperience } from "@/components/SearchExperience";
import { blackChromeViewport } from "@/lib/system-chrome";

export const viewport = blackChromeViewport;

type SearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
  }>;
};

function normalizeQuery(query: string | string[] | undefined) {
  return Array.isArray(query) ? query[0] : query;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;

  return <SearchExperience query={normalizeQuery(q)} />;
}
