"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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
type EligibilityCheck =
  { eligible: true } | { eligible: false; reason: HostingEligibilityReason };

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
  // 비로그인은 기존 동작 유지 — 폼을 열어 두고 제출 시점에 로그인으로 보낸다. 수정 모드도 자격과 무관하다.
  const shouldCheck = !isEditMode && authState.isLoggedIn;
  const [check, setCheck] = useState<EligibilityCheck | null>(null);

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

        if (!accessToken) {
          setCheck({ eligible: true });
          return;
        }

        return requestHostingEligibility(accessToken).then((eligibility) => {
          if (!isActive) {
            return;
          }

          setCheck(
            eligibility.eligible
              ? { eligible: true }
              : { eligible: false, reason: eligibility.reason },
          );
        });
      })
      .catch(() => {
        if (isActive) {
          setCheck({ eligible: true });
        }
      });

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, shouldCheck]);

  if (shouldCheck && check === null) {
    return <UploadGateCheckingScreen />;
  }

  // 조회 이후 로그아웃했다면(shouldCheck=false) 직전 판정은 더 이상 이 세션의 것이 아니라 폼을 그대로 연다.
  if (shouldCheck && check && !check.eligible) {
    return <HostingIneligibleNotice reason={check.reason} />;
  }

  return (
    <UploadProductForm
      editProductId={editProductId}
      returnSource={returnSource}
    />
  );
}

// 자격 조회 중 화면 — 폼이 잠깐 보였다 안내로 바뀌는 깜빡임을 막는다.
function UploadGateCheckingScreen() {
  return (
    <main
      aria-busy="true"
      className="system-chrome-black h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]"
    >
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <header className="shrink-0 border-b border-black bg-black px-4 py-3 text-white">
          <div className="flex h-10 items-center justify-end">
            <div className="translate-y-0.5 text-right">
              <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-white/45">
                Upload
              </p>
              <h1 className="mt-1 text-[20px] leading-none tracking-[-0.05em]">
                분철 개최
              </h1>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center px-4">
          <p className="text-[14px] font-semibold tracking-[-0.04em] text-black/35">
            개최 자격을 확인하고 있어요...
          </p>
        </div>
      </div>
    </main>
  );
}
