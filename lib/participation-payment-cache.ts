import type { DeliveryAddress } from "@/lib/mock-delivery-addresses";

// v3: 개최자 계좌(hostBankAccount)를 캐시에서 제거 — C2C 오픈 후에는 일반 유저 계좌가
// sessionStorage 에 평문으로 남게 되므로(docs/48 §6.3-6) 계좌는 항상 서버에서 조회한다.
// 키를 올려 계좌가 담긴 구 번들의 v2 엔트리를 통째로 무효화한다.
// (v2: bidAmount 의미가 "입금 총액" → "멤버(상품) 금액"으로 바뀐 참여 단일 선택 전환분)
const participationPaymentCacheKey = "buncheol-participation-payment-cache-v3";
const maxCachedPaymentCount = 40;

export type CachedParticipationPayment = {
  bidAmount?: number | null;
  participationId: string;
  participationStatus?: string;
  paymentAmount?: number | null;
  paymentDueAt?: string | null;
  shippingAddress?: DeliveryAddress | null;
  shippingFee?: number | null;
};

function canUseSessionStorage() {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

function readPaymentCache() {
  if (!canUseSessionStorage()) {
    return {};
  }

  try {
    const rawValue = window.sessionStorage.getItem(participationPaymentCacheKey);

    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue) as unknown;

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, CachedParticipationPayment>)
      : {};
  } catch {
    return {};
  }
}

function writePaymentCache(cache: Record<string, CachedParticipationPayment>) {
  if (!canUseSessionStorage()) {
    return;
  }

  const entries = Object.entries(cache).slice(-maxCachedPaymentCount);

  try {
    window.sessionStorage.setItem(
      participationPaymentCacheKey,
      JSON.stringify(Object.fromEntries(entries)),
    );
  } catch {
    // The API response can still be fetched again if session storage is full.
  }
}

export function readCachedParticipationPayment(participationId: string) {
  return readPaymentCache()[participationId] ?? null;
}

export function writeCachedParticipationPayment(
  payment: CachedParticipationPayment,
) {
  writePaymentCache({
    ...readPaymentCache(),
    [payment.participationId]: payment,
  });
}
