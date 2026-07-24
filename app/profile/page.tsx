import { BottomNavigator } from "@/components/BottomNavigator";
import { ProfileContent } from "@/components/ProfileContent";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

type ProfilePageProps = {
  searchParams: Promise<{
    openAccount?: string | string[];
    returnTo?: string | string[];
  }>;
};

function getSafeReturnHref(returnTo: string | string[] | undefined) {
  const returnTarget = Array.isArray(returnTo) ? returnTo[0] : returnTo;

  if (returnTarget?.startsWith("/products/")) {
    return returnTarget;
  }

  return null;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const { openAccount, returnTo } = await searchParams;
  const openSettlementAccountOnEntry = Array.isArray(openAccount)
    ? openAccount.includes("1")
    : openAccount === "1";
  const settlementAccountReturnHref = getSafeReturnHref(returnTo);

  return (
    <main className="system-chrome-white system-chrome-bottom-black h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <ProfileContent
          openSettlementAccountOnEntry={openSettlementAccountOnEntry}
          settlementAccountReturnHref={settlementAccountReturnHref}
        />
        <BottomNavigator activeLabel="Profile" />
      </div>
    </main>
  );
}
