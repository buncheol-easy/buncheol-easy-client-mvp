"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BottomNavigator } from "@/components/BottomNavigator";
import { HostingIneligibleNotice } from "@/components/HostingIneligibleNotice";
import { UploadProductForm } from "@/components/UploadProductForm";
import {
  requestHostingEligibility,
  type HostingEligibilityReason,
} from "@/lib/auth-api";
import { getFreshAccessToken } from "@/lib/auth-session";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";

type UploadEntryProps = {
  editProductId?: string;
  returnSource?: "home" | "profile" | "bids" | "favorites" | "upload";
};

// 조회 결과. 조회 실패는 적격으로 떨어뜨린다(fail-open) — 최종 차단은 개최 요청 시점의 서버 게이트가 한다.
// token 은 판정이 어느 세션의 것인지 표시한다 — 다른 탭에서 계정을 바꾸고 돌아오면 재조회가 끝나기 전까지
// 이전 계정의 판정이 그려지는데, 적격→부적격 전환이면 이 PR 이 없애려던 "폼 다 채우고 막힘"이 그대로 재현된다.
type EligibilityCheck = { token: string | null } & (
  | { eligible: true }
  | { eligible: false; reason: HostingEligibilityReason }
);

/**
 * 개최 폼 진입 게이트 (docs/53 Q-07). 폼을 다 채우고 제출해야 자격 실패가 드러나던 것을 진입 시점 조회로 앞당긴다.
 *
 * <p>수정 모드(`?edit=`)는 자격 게이트 대상이 아니다 — 서버 수정 API 도 개최 자격을 보지 않는다.
 */
export function UploadEntry({ editProductId, returnSource }: UploadEntryProps) {
  const isEditMode = Boolean(editProductId);
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  // 하이드레이션 전에는 서버 스냅샷(항상 로그아웃)이 쓰여, 로그인 유저가 /upload 를 하드 로드하면
  // SSR 이 폼을 먼저 그렸다가 확인 화면으로 후퇴한다. 확정 전까지는 확인 화면을 유지해 그 역전을 막는다.
  const isHydrated = useSyncExternalStore(
    subscribeAuthState,
    () => true,
    () => false,
  );
  // 비로그인은 기존 동작 유지 — 폼을 열어 두고 제출 시점에 로그인으로 보낸다. 수정 모드도 자격과 무관하다.
  const shouldCheck = !isEditMode && authState.isLoggedIn;
  const [check, setCheck] = useState<EligibilityCheck | null>(null);
  // 이펙트 안 동기 setState 없이(react-hooks/set-state-in-effect) 렌더 시점에 세션 일치만 확인한다.
  const currentCheck =
    check && check.token === authState.accessToken ? check : null;

  useEffect(() => {
    if (!shouldCheck) {
      return;
    }

    let isActive = true;

    getFreshAccessToken()
      .then((accessToken) => {
        if (!isActive) {
          return;
        }

        // 토큰이 갱신됐다면 판정도 갱신된 토큰 기준으로 남긴다 — 스토어도 곧 같은 값으로 바뀐다.
        if (!accessToken) {
          setCheck({ eligible: true, token: authState.accessToken });
          return;
        }

        return requestHostingEligibility(accessToken).then((eligibility) => {
          if (!isActive) {
            return;
          }

          setCheck(
            eligibility.eligible
              ? { eligible: true, token: accessToken }
              : {
                  eligible: false,
                  reason: eligibility.reason,
                  token: accessToken,
                },
          );
        });
      })
      .catch(() => {
        if (isActive) {
          setCheck({ eligible: true, token: authState.accessToken });
        }
      });

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, shouldCheck]);

  if (!isHydrated || (shouldCheck && currentCheck === null)) {
    return <UploadGateCheckingScreen />;
  }

  // 조회 이후 로그아웃했다면(shouldCheck=false) 직전 판정은 더 이상 이 세션의 것이 아니라 폼을 그대로 연다.
  if (shouldCheck && currentCheck && !currentCheck.eligible) {
    return <HostingIneligibleNotice reason={currentCheck.reason} />;
  }

  return (
    <UploadProductForm
      editProductId={editProductId}
      returnSource={returnSource}
    />
  );
}

// 자격 조회 중 화면 — 폼이 잠깐 보였다 안내로 바뀌는 깜빡임을 막는다.
// 헤더는 결과 화면과 같은 `upload-header` 계열 클래스를 그대로 쓴다 — 설치형 PWA 전용 규칙(globals.css)이
// 클래스 기준이라, 빼면 조회 중 작은 헤더 → 결과 화면 큰 헤더로 점프해 오히려 깜빡임이 생긴다.
function UploadGateCheckingScreen() {
  return (
    <main className="system-chrome-white system-chrome-bottom-black h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
          <div className="absolute inset-0 flex flex-col bg-white">
            <header className="upload-header shrink-0 border-b border-black/10 bg-white px-4 py-3 text-black">
              <div className="upload-header__inner flex h-10 items-center">
                <div className="upload-header__copy min-w-0 flex-1">
                  <h1 className="upload-header__title text-[20px] font-semibold leading-none tracking-[-0.05em]">
                    분철 개최
                  </h1>
                </div>
              </div>
            </header>

            <div className="flex min-h-0 flex-1 items-center justify-center px-4">
              <p
                aria-label="개최 자격을 확인하고 있어요"
                className="text-[14px] font-semibold tracking-[-0.04em] text-black/35"
                role="status"
              >
                개최 자격을 확인하고 있어요...
              </p>
            </div>
          </div>
        </div>

        <BottomNavigator activeLabel="Upload" />
      </div>
    </main>
  );
}
