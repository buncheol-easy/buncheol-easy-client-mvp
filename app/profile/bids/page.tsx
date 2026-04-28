import { BidHistoryExperience } from "@/components/BidHistoryExperience";

type BidHistoryPageProps = {
  searchParams: Promise<{
    from?: string | string[];
  }>;
};

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BidHistoryPage({
  searchParams,
}: BidHistoryPageProps) {
  const { from } = await searchParams;
  const returnSource = getFirstSearchParam(from);

  return (
    <BidHistoryExperience
      initialReturnSource={returnSource === "profile" ? "profile" : undefined}
    />
  );
}
