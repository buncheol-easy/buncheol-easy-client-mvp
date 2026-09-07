"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  authProfileSetupReturnHrefStorageKey,
  authReturnHrefStorageKey,
  writeAuthTokens,
} from "@/lib/auth-store";
import { requestUserProfileStatus } from "@/lib/auth-api";
import { getSafeInternalHref } from "@/lib/auth-navigation";
import { AUTH_TOKEN_PARAM } from "@/lib/auth-token-param";

type AuthCallbackContentProps = {
  returnHref?: string;
};

function getSafeReturnHref(value: string | null | undefined) {
  return getSafeInternalHref(value, "/profile");
}

function getHashToken(name: string) {
  const hashValue = window.location.hash.replace(/^#/, "");
  const hashParams = new URLSearchParams(hashValue);

  return hashParams.get(name) ?? undefined;
}

// 🔴 토큰을 읽는 즉시 주소에서 지운다. 프래그먼트는 서버 로그에는 안 남지만 브라우저 히스토리·
// 북마크·분석 SDK 의 URL 수집에는 그대로 실린다 — 서버 OAuth2LoginSuccessHandler 주석이
// 명시한 「클라 replaceState 후속 조치」가 이것이다. 서버는 프래그먼트로만 보내지만,
// 쿼리로 들어온 경우까지 방어적으로 지운다(쿼리는 프록시 로그·Referer 에도 실린다).
function stripTokenFromUrl() {
  const url = new URL(window.location.href);
  const hasHashToken = url.hash.includes(AUTH_TOKEN_PARAM);
  const hasQueryToken = url.searchParams.has(AUTH_TOKEN_PARAM);
  if (!hasHashToken && !hasQueryToken) {
    return;
  }
  url.searchParams.delete(AUTH_TOKEN_PARAM);
  window.history.replaceState(
    window.history.state,
    "",
    url.pathname + url.search,
  );
}

export function AuthCallbackContent({
  returnHref,
}: AuthCallbackContentProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const accessToken = getHashToken(AUTH_TOKEN_PARAM);
    stripTokenFromUrl();
    const storedReturnHref = window.sessionStorage.getItem(
      authReturnHrefStorageKey,
    );
    const nextReturnHref = getSafeReturnHref(returnHref ?? storedReturnHref);

    if (!accessToken) {
      const errorTimer = window.setTimeout(() => {
        setErrorMessage("로그인 토큰을 확인하지 못했어요.");
      }, 0);

      return () => {
        window.clearTimeout(errorTimer);
      };
    }

    let isActive = true;

    // 가입(프로필) 완료를 확인하기 전에는 로그인으로 커밋하지 않는다 — 추가정보
    // 입력을 마치지 않고 뒤로가기해도 다른 화면에서 로그인된 것처럼 보이지 않게.
    writeAuthTokens({ accessToken, isLoggedIn: false });

    requestUserProfileStatus(accessToken)
      .then(({ isProfileComplete }) => {
        if (!isActive) {
          return;
        }

        if (!isProfileComplete) {
          window.sessionStorage.setItem(
            authProfileSetupReturnHrefStorageKey,
            nextReturnHref,
          );
          window.sessionStorage.removeItem(authReturnHrefStorageKey);
          router.replace("/signup/profile");
          return;
        }

        writeAuthTokens({ accessToken });
        window.sessionStorage.removeItem(authReturnHrefStorageKey);
        window.sessionStorage.removeItem(authProfileSetupReturnHrefStorageKey);
        router.replace(nextReturnHref);
      })
      .catch(() => {
        if (isActive) {
          // 완료 여부 확인에 실패해도 서비스로 통과시키지 않는다. 추가정보 화면이
          // 마운트 시 상태를 재확인해 완료 유저는 저장된 returnHref 로 되돌려보낸다.
          window.sessionStorage.setItem(
            authProfileSetupReturnHrefStorageKey,
            nextReturnHref,
          );
          window.sessionStorage.removeItem(authReturnHrefStorageKey);
          router.replace("/signup/profile");
        }
      });

    return () => {
      isActive = false;
    };
  }, [returnHref, router]);

  return (
    <main className="system-chrome-white system-chrome-bottom-black flex h-[100dvh] items-center justify-center bg-white px-6 text-center text-[#111111]">
      <div>
        <p className="text-[18px] font-semibold tracking-[-0.05em]">
          {errorMessage || "로그인 처리 중이에요."}
        </p>
        <p className="mt-2 text-[13px] font-medium text-black/45">
          잠시만 기다려 주세요.
        </p>
      </div>
    </main>
  );
}
