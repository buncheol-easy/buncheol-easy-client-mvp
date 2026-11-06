"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KakaoIcon } from "@/components/icons";
import { trackSignupCompleted } from "@/lib/analytics";
import {
  authLoginHrefStorageKey,
  authProfileSetupReturnHrefStorageKey,
  authReturnHrefStorageKey,
  writeAuthTokens,
} from "@/lib/auth-store";
import {
  getKakaoAuthorizationUrl,
  requestUserProfileStatus,
} from "@/lib/auth-api";
import {
  createLoginHref,
  getOptionalSafeInternalHref,
  getSafeInternalHref,
} from "@/lib/auth-navigation";
import {
  AUTH_SIGNUP_PARAM,
  AUTH_TOKEN_PARAM,
  type AuthLoginErrorReason,
} from "@/lib/auth-token-param";
import { authSignupProfileDraftStorageKey } from "@/lib/auth-store";
import { CONTACT_EMAIL } from "@/lib/site";

type AuthCallbackContentProps = {
  errorReason?: AuthLoginErrorReason;
  returnHref?: string;
};

const loginFailureCopy: Record<
  Exclude<AuthLoginErrorReason, "cancelled">,
  { title: string; description: string }
> = {
  email_required: {
    title: "카카오계정 이메일을 확인하지 못했어요",
    description:
      "분철이지를 이용하려면 카카오계정에 쓸 수 있는 이메일이 있어야 해요. 카카오톡 > 더보기 > 설정 > 카카오계정에서 이메일을 확인해 주세요. 이메일이 유효하지 않다는 안내가 보이면 다른 이메일로 바꾼 뒤 다시 로그인해 주세요.",
  },
  failed: {
    title: "로그인 정보를 확인하지 못했어요.",
    description: "한 번 더 시도해 주세요.",
  },
};

function getSafeReturnHref(value: string | null | undefined) {
  return getSafeInternalHref(value, "/profile");
}

// 카카오에서 취소하고 돌아오면 버튼을 누르기 전 로그인 화면으로 되돌린다. /login/callback 도
// "/login" 으로 시작하므로 로그인 화면 주소인지는 경로까지 맞춰 본다(아니면 이 화면을 다시 돈다).
function getLoginHrefBeforeKakao(fallbackReturnHref: string) {
  const storedLoginHref = getOptionalSafeInternalHref(
    window.sessionStorage.getItem(authLoginHrefStorageKey),
  );

  if (
    storedLoginHref &&
    (storedLoginHref === "/login" || storedLoginHref.startsWith("/login?"))
  ) {
    return storedLoginHref;
  }

  return createLoginHref({ returnTo: fallbackReturnHref });
}

function getHashParam(name: string) {
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
  errorReason,
  returnHref,
}: AuthCallbackContentProps) {
  const router = useRouter();
  const [isTokenMissing, setIsTokenMissing] = useState(false);

  useEffect(() => {
    const accessToken = getHashParam(AUTH_TOKEN_PARAM);
    const isNewAccount = getHashParam(AUTH_SIGNUP_PARAM) === "1";
    stripTokenFromUrl();
    const storedReturnHref = window.sessionStorage.getItem(
      authReturnHrefStorageKey,
    );
    const nextReturnHref = getSafeReturnHref(returnHref ?? storedReturnHref);

    // 서버가 실패로 돌려보냈으면 해시에 토큰이 있어도 로그인하지 않는다. 「로그인 뒤 갈 곳」은 지우지
    // 않아서 [카카오로 다시 로그인]이 성공하면 처음 가려던 곳으로 간다.
    if (errorReason) {
      if (errorReason === "cancelled") {
        router.replace(getLoginHrefBeforeKakao(nextReturnHref));
      }

      return;
    }

    if (!accessToken) {
      const errorTimer = window.setTimeout(() => {
        setIsTokenMissing(true);
      }, 0);

      return () => {
        window.clearTimeout(errorTimer);
      };
    }

    let isActive = true;

    // 가입(프로필) 완료를 확인하기 전에는 로그인으로 커밋하지 않는다 — 추가정보
    // 입력을 마치지 않고 뒤로가기해도 다른 화면에서 로그인된 것처럼 보이지 않게.
    writeAuthTokens({ accessToken, isLoggedIn: false });
    // 🔴 새 소셜 인증이 성립한 시점 = 가입 초안의 소유자가 바뀔 수 있는 유일한 지점.
    // 여기서 폐기하지 않으면 가입하다 떠난 앞사람의 이름·전화번호가 다음 가입자에게 프리필된다
    // (가입 이탈은 로그아웃 경로를 안 타서 clearUserSessionState 로는 못 잡는다).
    try {
      window.sessionStorage.removeItem(authSignupProfileDraftStorageKey);
    } catch {
      // 세션 저장소 접근 불가 환경이면 초안도 애초에 저장되지 않았다.
    }
    window.sessionStorage.removeItem(authLoginHrefStorageKey);

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

        // 추가정보 화면을 거치는 가입은 그 화면이 저장 성공 때 보낸다.
        if (isNewAccount) {
          trackSignupCompleted({ profile_form: false });
        }

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
  }, [errorReason, returnHref, router]);

  // replace — 다시 시도할 때마다 실패 화면이 기록에 쌓이면 [홈으로 가기] 뒤 뒤로가기에 앞 실패 화면이 나온다.
  // 「이동 중」 잠금은 두지 않는다 — 설치형 앱에서 카카오 창을 닫고 돌아오면 잠긴 채 남는다.
  function handleKakaoRetry() {
    window.location.replace(getKakaoAuthorizationUrl());
  }

  const failureReason =
    errorReason ?? (isTokenMissing ? ("failed" as const) : undefined);

  // 취소는 실패가 아니다 — 로그인 화면으로 바꿔치기하는 동안 아무 글자도 띄우지 않는다.
  if (failureReason === "cancelled") {
    return (
      <main className="system-chrome-white system-chrome-bottom-black h-[100dvh] bg-white" />
    );
  }

  const failureCopy = failureReason
    ? loginFailureCopy[failureReason]
    : undefined;

  return (
    <main className="system-chrome-white system-chrome-bottom-black flex h-[100dvh] items-center justify-center bg-white px-6 text-center text-[#111111]">
      {failureCopy ? (
        <div className="w-full max-w-[22rem]">
          <p className="break-keep text-[18px] font-semibold tracking-[-0.05em]">
            {failureCopy.title}
          </p>
          <p className="mt-2 break-keep text-[14px] font-medium leading-6 tracking-[-0.03em] text-black/55">
            {failureCopy.description}
          </p>
          <div className="mt-8 grid gap-2">
            <button
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#fee500] text-[15px] font-semibold text-black shadow-[0_10px_24px_rgba(254,229,0,0.32)]"
              onClick={handleKakaoRetry}
              type="button"
            >
              <KakaoIcon className="h-[18px] w-[18px]" />
              카카오로 다시 로그인
            </button>
            {/* replace — 뒤로가기로 이 실패 화면에 다시 돌아오지 않게 한다. */}
            <Link
              className="flex h-12 w-full items-center justify-center rounded-full bg-[#f4f4f4] text-[15px] font-semibold tracking-[-0.04em] text-[#111111]"
              href="/"
              replace
            >
              홈으로 가기
            </Link>
          </div>
          <p className="mt-6 break-keep text-[13px] font-medium leading-5 tracking-[-0.03em] text-black/45">
            도움이 필요하면{" "}
            <a
              className="font-semibold text-black/70 underline underline-offset-4"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
            으로 알려 주세요.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-[18px] font-semibold tracking-[-0.05em]">
            로그인 처리 중이에요.
          </p>
          <p className="mt-2 text-[13px] font-medium text-black/45">
            잠시만 기다려 주세요.
          </p>
        </div>
      )}
    </main>
  );
}
