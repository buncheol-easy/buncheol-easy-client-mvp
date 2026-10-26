import type { Metadata } from "next";
import { AuthCallbackContent } from "@/components/AuthCallbackContent";
import { getOptionalSafeInternalHref } from "@/lib/auth-navigation";
import {
  AUTH_ERROR_PARAM,
  parseAuthLoginErrorReason,
} from "@/lib/auth-token-param";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type LoginCallbackPageProps = {
  // ⚠️ accessToken 은 받지 않는다 — 서버는 프래그먼트(#accessToken=…)로만 보낸다
  // (OAuth2LoginSuccessHandler 실측). 쿼리 입구를 열어 두면 요청 라인·프록시 로그·
  // Referer 에 토큰이 실리는 경로가 생긴다.
  searchParams: Promise<{
    [AUTH_ERROR_PARAM]?: string | string[];
    returnTo?: string | string[];
  }>;
};

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginCallbackPage({
  searchParams,
}: LoginCallbackPageProps) {
  const { [AUTH_ERROR_PARAM]: errorParam, returnTo } = await searchParams;

  return (
    <AuthCallbackContent
      errorReason={parseAuthLoginErrorReason(getFirstSearchParam(errorParam))}
      returnHref={getOptionalSafeInternalHref(getFirstSearchParam(returnTo))}
    />
  );
}
