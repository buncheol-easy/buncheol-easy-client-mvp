"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { requestUserProfileStatus } from "@/lib/auth-api";
import { getCurrentBrowserHref } from "@/lib/auth-navigation";
import { getFreshAccessToken } from "@/lib/auth-session";
import {
  authProfileSetupReturnHrefStorageKey,
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";

const profileCompleteCacheKey = "buncheol-profile-complete";

// 가드를 적용하지 않는 경로 — 가입/로그인 플로우 자체, 관리자 화면(자체 인증 체계),
// 그리고 가입 도중에도 열람할 수 있어야 하는 약관·정책·안내 페이지.
const EXCLUDED_PATH_PREFIXES = [
  "/signup",
  "/login",
  "/admin",
  "/intro",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/shipping-policy",
  "/broker-notice",
];

function isExcludedPath(pathname: string) {
  return EXCLUDED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// 로그인 상태에서 프로필(추가정보) 미완료 유저를 /signup/profile 로 강제 이동시키는 공용 가드.
// 루트 레이아웃의 ProfileCompletionGate 가 전역으로 1회 사용한다 — 페이지별 부착은
// 누락된 화면(뒤로가기·URL 직접 진입)이 구멍이 되므로 제외 목록 방식으로 전 경로를 덮는다.
// 완료 판정만 sessionStorage 에 캐시한다 — 완료는 되돌아가지 않는 단방향 전이라 안전하고,
// 미완료는 즉시 이동시키므로 캐시할 일이 없다. 캐시는 탭 단위이며 로그아웃 시 지워
// 같은 탭에서 다른 계정으로 로그인해도 이전 판정이 남지 않게 한다.
// 상태 확인이 실패하면 이동하지 않는다 — 참여·배송지 등록은 서버 가드(403)가 최종 차단한다.
export function useProfileCompletionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );

  useEffect(() => {
    // 레이아웃에 상주하므로 라우트 이동 시 remount 가 아니라 pathname 의존성으로 재검사한다.
    if (isExcludedPath(pathname)) {
      return;
    }

    if (!authState.isLoggedIn) {
      window.sessionStorage.removeItem(profileCompleteCacheKey);
      return;
    }

    if (window.sessionStorage.getItem(profileCompleteCacheKey) === "true") {
      return;
    }

    let isActive = true;

    getFreshAccessToken()
      .then((accessToken) => {
        if (!isActive || !accessToken) {
          return;
        }

        return requestUserProfileStatus(accessToken).then(
          ({ isProfileComplete }) => {
            if (!isActive) {
              return;
            }

            if (isProfileComplete) {
              window.sessionStorage.setItem(profileCompleteCacheKey, "true");
              return;
            }

            window.sessionStorage.setItem(
              authProfileSetupReturnHrefStorageKey,
              getCurrentBrowserHref(),
            );
            router.replace("/signup/profile");
          },
        );
      })
      .catch(() => {
        // 확인 실패 시 현재 화면에 머문다.
      });

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, authState.isLoggedIn, pathname, router]);
}
