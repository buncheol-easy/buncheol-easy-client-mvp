import { AddressManagementExperience } from "@/components/AddressManagementExperience";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

type AddressManagementPageProps = {
  searchParams: Promise<{
    openAdd?: string | string[];
    returnTo?: string | string[];
  }>;
};

function getSafeReturnHref(returnTo: string | string[] | undefined) {
  const returnTarget = Array.isArray(returnTo) ? returnTo[0] : returnTo;

  if (returnTarget === "bids") {
    return "/profile/bids";
  }

  if (returnTarget === "profile") {
    return "/profile";
  }

  if (returnTarget?.startsWith("/products/")) {
    return returnTarget;
  }

  return null;
}

export default async function AddressManagementPage({
  searchParams,
}: AddressManagementPageProps) {
  const { openAdd, returnTo } = await searchParams;
  const openFormOnEntry = Array.isArray(openAdd)
    ? openAdd.includes("1")
    : openAdd === "1";
  const returnHref = getSafeReturnHref(returnTo);

  return (
    <main className="system-chrome-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <AddressManagementExperience
        openFormOnEntry={openFormOnEntry}
        returnHref={returnHref}
      />
    </main>
  );
}
