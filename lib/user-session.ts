import type { QueryClient } from "@tanstack/react-query";
import { clearAuthCookies, clearAuthState } from "@/lib/auth-store";
import { clearDeliveryAddressState } from "@/lib/delivery-address-store";
import { clearHostedProducts } from "@/lib/hosted-products-store";
import { buncheolsQueryKey } from "@/lib/query-keys";
import { clearSettlementAccountState } from "@/lib/settlement-account-store";

// 프로필 완료 판정 캐시(탭 단위). 가드가 쓰지만 세션 정리와 한 몸이라 여기서 소유한다 —
// 로그아웃 때 안 지우면 같은 탭에서 다른 계정으로 로그인했을 때 이전 계정 판정이 남는다.
export const profileCompleteCacheKey = "buncheol-profile-complete";

/**
 * 계정 스코프 로컬 상태 일괄 정리. 인증 토큰만 지우면 정산 계좌(예금주·계좌번호)·배송지·개최 목록 같은
 * localStorage 캐시가 남아, 같은 브라우저에서 다른 계정으로 로그인했을 때 서버 응답이 오기 전까지
 * 이전 사용자 정보가 화면에 그대로 보인다.
 *
 * 로그아웃·계정 전환 경로는 전부 이 함수를 거친다(마이페이지 로그아웃·계정 화면·개최 자격 재로그인 CTA).
 */
export function clearUserSessionState(queryClient?: QueryClient) {
  clearAuthCookies();
  clearAuthState();
  clearDeliveryAddressState();
  clearHostedProducts();
  clearSettlementAccountState();
  // 목록 캐시의 찜 여부도 계정 스코프다. gcTime(30분) 안에 다른 계정으로 로그인하면
  // 로그인 키가 같아 캐시가 그대로 맞아, 이전 사용자의 하트가 첫 페인트에 그려진다.
  queryClient?.removeQueries({ queryKey: buncheolsQueryKey });

  try {
    window.sessionStorage.removeItem(profileCompleteCacheKey);
  } catch {
    // 세션 저장소 접근 불가(사파리 프라이빗 등)는 무시한다 — 캐시가 없으면 가드가 다시 조회할 뿐이다.
  }
}
