import { HostedBuncheolManageExperience } from "@/components/HostedBuncheolManageExperience";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

type HostedBuncheolManagePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function HostedBuncheolManagePage({
  params,
}: HostedBuncheolManagePageProps) {
  const { id } = await params;

  return <HostedBuncheolManageExperience id={id} />;
}
