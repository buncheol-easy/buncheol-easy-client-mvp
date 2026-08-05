import type { Metadata } from "next";
import { AuthCallbackContent } from "@/components/AuthCallbackContent";
import { getOptionalSafeInternalHref } from "@/lib/auth-navigation";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type LoginCallbackPageProps = {
  searchParams: Promise<{
    accessToken?: string | string[];
    returnTo?: string | string[];
  }>;
};

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginCallbackPage({
  searchParams,
}: LoginCallbackPageProps) {
  const { accessToken, returnTo } = await searchParams;

  return (
    <AuthCallbackContent
      initialAccessToken={getFirstSearchParam(accessToken)}
      returnHref={getOptionalSafeInternalHref(returnTo)}
    />
  );
}
