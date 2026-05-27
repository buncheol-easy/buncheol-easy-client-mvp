import { HostedBuncheolManage } from "@/components/HostedBuncheolManage";
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

  return <HostedBuncheolManage id={id} />;
}
