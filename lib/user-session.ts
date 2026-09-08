import type { QueryClient } from "@tanstack/react-query";
import {
  authSignupProfileDraftStorageKey,
  clearAuthCookies,
  clearAuthState,
} from "@/lib/auth-store";
import { clearDeliveryAddressState } from "@/lib/delivery-address-store";
import { clearHostedProducts } from "@/lib/hosted-products-store";
import {
  buncheolsQueryKey,
  favoriteGroupsQueryKey,
  isLoggedInListingQueryKey,
} from "@/lib/query-keys";
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
export function clearUserSessionState(queryClient: QueryClient) {
  clearAuthCookies();
  clearAuthState();
  clearDeliveryAddressState();
  clearHostedProducts();
  clearSettlementAccountState();
  // 목록의 찜 여부·최애 그룹도 계정 스코프다. gcTime(30분) 안에 다른 계정으로 로그인하면
  // 로그인 키가 그대로 맞아, 이전 사용자의 하트·최애 레일이 첫 페인트에 그려진다.
  // 비로그인 키는 남긴다 — 서버 프리페치로 채워지는 공용 캐시라 지우면 홈이 다시 전량 조회한다.
  queryClient.removeQueries({
    queryKey: buncheolsQueryKey,
    predicate: (query) => isLoggedInListingQueryKey(query.queryKey),
  });
  queryClient.removeQueries({ queryKey: favoriteGroupsQueryKey(true) });

  try {
    window.sessionStorage.removeItem(profileCompleteCacheKey);
    // 🔴 가입 초안(이름·닉네임·전화번호)도 계정 스코프다. 안 지우면 A 가 가입하다 만 초안이
    // 같은 탭의 다음 가입자 B 입력칸에 미리 채워진다 — 남의 개인정보 프리필.
    window.sessionStorage.removeItem(authSignupProfileDraftStorageKey);
  } catch {
    // 세션 저장소 접근 불가(사파리 프라이빗 등)는 무시한다 — 캐시가 없으면 가드가 다시 조회할 뿐이다.
  }
}
