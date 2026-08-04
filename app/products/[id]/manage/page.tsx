import type { Metadata } from "next";
import { HostedBuncheolManageExperience } from "@/components/HostedBuncheolManageExperience";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata: Metadata = {
  title: "분철 관리",
  robots: { index: false, follow: false },
};

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
