import { AddressManagementExperience } from "@/components/AddressManagementExperience";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

type AddressManagementPageProps = {
  searchParams: Promise<{
    openAdd?: string | string[];
    returnTo?: string | string[];
  }>;
};

export default async function AddressManagementPage({
  searchParams,
}: AddressManagementPageProps) {
  const { openAdd, returnTo } = await searchParams;
  const openFormOnEntry = Array.isArray(openAdd)
    ? openAdd.includes("1")
    : openAdd === "1";
  const returnTarget = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  const returnHref =
    returnTarget === "bids"
      ? "/profile/bids"
      : returnTarget === "profile"
        ? "/profile"
        : null;

  return (
    <main className="system-chrome-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <AddressManagementExperience
        openFormOnEntry={openFormOnEntry}
        returnHref={returnHref}
      />
    </main>
  );
}
