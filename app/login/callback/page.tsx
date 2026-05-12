import { AuthCallbackContent } from "@/components/AuthCallbackContent";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

type LoginCallbackPageProps = {
  searchParams: Promise<{
    accessToken?: string | string[];
    returnTo?: string | string[];
  }>;
};

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getSafeReturnHref(returnTo: string | string[] | undefined) {
  const value = getFirstSearchParam(returnTo);

  return value?.startsWith("/") && !value.startsWith("//") ? value : undefined;
}

export default async function LoginCallbackPage({
  searchParams,
}: LoginCallbackPageProps) {
  const { accessToken, returnTo } = await searchParams;

  return (
    <AuthCallbackContent
      initialAccessToken={getFirstSearchParam(accessToken)}
      returnHref={getSafeReturnHref(returnTo)}
    />
  );
}
