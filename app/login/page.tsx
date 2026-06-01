import { LoginExperience } from "@/components/LoginExperience";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

type LoginPageProps = {
  searchParams: Promise<{
    returnTo?: string | string[];
  }>;
};

function getSafeReturnHref(returnTo: string | string[] | undefined) {
  const value = Array.isArray(returnTo) ? returnTo[0] : returnTo;

  return value?.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { returnTo } = await searchParams;

  return (
    <main className="system-chrome-white system-chrome-bottom-black h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <LoginExperience returnHref={getSafeReturnHref(returnTo)} />
    </main>
  );
}
