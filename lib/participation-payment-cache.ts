import type { BankAccountInfo } from "@/lib/auth-api";
import type { DeliveryAddress } from "@/lib/mock-delivery-addresses";

const participationPaymentCacheKey = "buncheol-participation-payment-cache";
const maxCachedPaymentCount = 40;

export type CachedParticipationPayment = {
  bidAmount?: number | null;
  hostBankAccount?: BankAccountInfo | null;
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
