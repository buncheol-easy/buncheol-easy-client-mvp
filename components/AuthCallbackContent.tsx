"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  authProfileSetupReturnHrefStorageKey,
  authReturnHrefStorageKey,
  writeAuthTokens,
} from "@/lib/auth-store";
import { requestUserProfileStatus } from "@/lib/auth-api";

type AuthCallbackContentProps = {
  initialAccessToken?: string;
  returnHref?: string;
};

function getSafeReturnHref(value: string | null | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

function getHashToken(name: string) {
  const hashValue = window.location.hash.replace(/^#/, "");
  const hashParams = new URLSearchParams(hashValue);

  return hashParams.get(name) ?? undefined;
}

export function AuthCallbackContent({
  initialAccessToken,
  returnHref,
}: AuthCallbackContentProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const accessToken = initialAccessToken ?? getHashToken("accessToken");
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

    writeAuthTokens({ accessToken });

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

        window.sessionStorage.removeItem(authReturnHrefStorageKey);
        window.sessionStorage.removeItem(authProfileSetupReturnHrefStorageKey);
        router.replace(nextReturnHref);
      })
      .catch(() => {
        if (isActive) {
          window.sessionStorage.removeItem(authReturnHrefStorageKey);
          router.replace(nextReturnHref);
        }
      });

    return () => {
      isActive = false;
    };
  }, [initialAccessToken, returnHref, router]);

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
