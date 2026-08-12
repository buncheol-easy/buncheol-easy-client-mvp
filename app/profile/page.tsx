import type { Metadata } from "next";
import { BottomNavigator } from "@/components/BottomNavigator";
import { ProfileContent } from "@/components/ProfileContent";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata: Metadata = {
  title: "마이페이지",
  robots: { index: false, follow: false },
};

type ProfilePageProps = {
  searchParams: Promise<{
    openAccount?: string | string[];
    returnTo?: string | string[];
  }>;
};

// 계좌 저장 후 돌아갈 화면. 오픈 리다이렉트를 막으려 목적지를 화이트리스트로 제한한다
// (참여 흐름의 분철 상세 + 개최 자격 안내에서 온 /upload — docs/53 Q-07).
function getSafeReturnHref(returnTo: string | string[] | undefined) {
  const returnTarget = Array.isArray(returnTo) ? returnTo[0] : returnTo;

  if (returnTarget?.startsWith("/products/") || returnTarget === "/upload") {
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
