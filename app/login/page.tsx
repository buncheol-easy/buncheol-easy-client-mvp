import { LoginExperience } from "@/components/LoginExperience";
import {
  getOptionalSafeInternalHref,
  getSafeInternalHref,
} from "@/lib/auth-navigation";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

type LoginPageProps = {
  searchParams: Promise<{
    cancelTo?: string | string[];
    returnTo?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { cancelTo, returnTo } = await searchParams;

  return (
    <main className="system-chrome-white system-chrome-bottom-black h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <LoginExperience
        cancelHref={getOptionalSafeInternalHref(cancelTo)}
        returnHref={getSafeInternalHref(returnTo, "/profile")}
      />
    </main>
  );
}
