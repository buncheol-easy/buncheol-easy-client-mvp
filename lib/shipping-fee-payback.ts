// 오픈 이벤트 "배송비 돌려받기" 도메인 유틸.
// 유저 노출 문구에는 "환불" 대신 "돌려받기"를 쓴다 (환불은 실패/취소 뉘앙스).
// 내부 식별자(API 경로·상태값)는 shipping-fee-payback / payback 을 사용한다.

// 인용 대상 이벤트 트윗 퍼머링크 (쿼리스트링 없이). 이벤트 기간 동안 삭제/비공개 금지 — 인용 카드가 깨진다.
// 트윗이 바뀌면 이 상수만 수정해 배포한다 (feature-flags 와 동일한 빌드타임 관리).
export const EVENT_TWEET_URL =
  "https://x.com/BuncheolEasy/status/2072210832600264848";

export type ShippingFeePaybackStatus =
  | "NONE"
  | "ELIGIBLE"
  | "REQUESTED"
  | "APPROVED"
  | "COMPLETED"
  | "REJECTED"
  | "EXPIRED";

export const PAYBACK_CTA_LABEL = "후기 쓰고 배송비 돌려받기";
export const PAYBACK_RETRY_CTA_LABEL = "후기 다시 제출하기";

// 상태 배지/안내 워딩. REQUESTED 는 카드 배지("돌려받기 확인 중")와
// 신청 직후 완료 안내("돌려받기 신청 완료")를 구분해 쓴다.
export const PAYBACK_STATUS_LABELS: Partial<
  Record<ShippingFeePaybackStatus, string>
> = {
  REQUESTED: "돌려받기 확인 중",
  COMPLETED: "배송비를 돌려드렸어요",
  REJECTED: "후기를 다시 확인해 주세요",
  EXPIRED: "돌려받기 기간이 지났어요",
};

// 트윗 퍼머링크 형식 (서버 검증과 동일). 쿼리스트링은 서버가 제거 후 저장하므로 허용한다.
const TWEET_URL_PATTERN =
  /^https:\/\/(x|twitter)\.com\/[A-Za-z0-9_]+\/status\/\d+/;

export function isValidTweetUrl(url: string) {
  return TWEET_URL_PATTERN.test(url.trim());
}

// X 트윗 작성창을 여는 intent URL. url 파라미터의 이벤트 트윗은 게시 시 인용 트윗으로 렌더링된다.
// 프리필 문구는 유저가 수정할 수 있으므로 조건 충족의 최종 확인은 운영진 검수로 한다.
export function buildReviewTweetIntentUrl(productTitle: string) {
  const text = [
    `분철이지에서 "${productTitle}" 무료 분철 참여하고 앨범 받았어요! 🎁`,
    "",
    "#분철이지 #무료분철이벤트",
  ].join("\n");

  return `https://x.com/intent/tweet?${new URLSearchParams({
    text,
    url: EVENT_TWEET_URL,
  })}`;
}
