// 분철·참여·배송 상태의 단일 기준 모듈. 상태 리터럴 비교와 한국어 라벨이 화면별 로컬 함수에
// 흩어져 문구가 어긋나던 문제(진행확정/진행 확정, 모집종료/모집 종료, HOST_CANCELLED 미처리)를
// 여기로 모은다. C2C 오픈에서 추가되는 상태값(PAYMENT_SENT·PAYMENT_COLLECTING 등)은
// 서버(docs/46)와 같은 이름의 판정 함수로만 선반영하고, 상태 유니온 타입·사용자 노출 라벨은
// 실제 소비 화면이 생기는 단계에서 함께 도입한다(미사용 카피의 검증 불가 문제 방지).

type DeliveryStatus = "SNAPSHOTTED" | "SHIPPING" | "DELIVERED" | "RECEIVED";

export type FlowType = "LEGACY" | "C2C";

function normalizeStatusValue(status: string | null | undefined) {
  return status?.trim().toUpperCase() ?? "";
}

// 분철 flow_type (docs/46 §2.1). 컬럼 추가 전 응답에는 필드가 없으므로
// C2C 명시가 아니면 전부 LEGACY 로 본다 — 기존 분철이 새 플로우를 타는 사고 방지.
export function getFlowType(value: string | null | undefined): FlowType {
  return normalizeStatusValue(value) === "C2C" ? "C2C" : "LEGACY";
}

// ---------------------------------------------------------------------------
// 분철(buncheol) 상태
// ---------------------------------------------------------------------------

// 진행 확정 계열. CONFIRMED 외 값들은 구 응답 호환용 동의어다.
const confirmedBuncheolStatuses = new Set([
  "CONFIRMED",
  "PAYMENT_CONFIRMED",
  "PAID",
  "SETTLING",
  "FINISHED",
]);

export function isBuncheolHostCancelledStatus(status: string | null | undefined) {
  return normalizeStatusValue(status) === "HOST_CANCELLED";
}

// 취소 계열 전체 — 미성사 취소(CANCELLED)와 개최자 취소(HOST_CANCELLED)를 모두 포함한다.
export function isBuncheolCancelledStatus(status: string | null | undefined) {
  const normalizedStatus = normalizeStatusValue(status);

  return (
    normalizedStatus === "CANCELLED" ||
    normalizedStatus === "CANCELED" ||
    normalizedStatus === "HOST_CANCELLED"
  );
}

export function isBuncheolConfirmedStatus(status: string | null | undefined) {
  return confirmedBuncheolStatuses.has(normalizeStatusValue(status));
}

export function isBuncheolDeletedStatus(status: string | null | undefined) {
  return normalizeStatusValue(status) === "DELETED";
}

// C2C 입금 수집 중 — 개최자 성사 확정 후 전원 입금확인 전 구간 (docs/46 §1.2).
export function isBuncheolPaymentCollectingStatus(
  status: string | null | undefined,
) {
  return normalizeStatusValue(status) === "PAYMENT_COLLECTING";
}

// 상태 필드가 없는 구 응답·목업은 모집중으로 취급한다.
export function isBuncheolRecruitingStatus(status: string | null | undefined) {
  const normalizedStatus = normalizeStatusValue(status);

  return normalizedStatus === "" || normalizedStatus === "RECRUITING";
}

// 참여(구매) 진입이 열려 있는 상태. PUBLIC_PREVIEW 는 비로그인 미리보기용 프론트 상태다.
export function isBuncheolPurchasableStatus(status: string | null | undefined) {
  return (
    isBuncheolRecruitingStatus(status) ||
    normalizeStatusValue(status) === "PUBLIC_PREVIEW"
  );
}

// 배지·칩 공용 라벨. 알 수 없는 상태는 raw 문자열 대신 "모집 종료"로 접는다 —
// HOST_CANCELLED 가 화면에 그대로 노출되던 사고의 재발 방지.
export function getBuncheolStatusBadgeLabel(status: string | null | undefined) {
  if (isBuncheolCancelledStatus(status)) {
    return "분철 취소";
  }

  if (isBuncheolConfirmedStatus(status)) {
    return "진행 확정";
  }

  if (isBuncheolRecruitingStatus(status)) {
    return "모집 중";
  }

  // 참여 내역 칩(getBidRecordBuncheolChip)과 같은 문자열을 쓴다 — 한 상태를 두 이름으로
  // 부르면 목록과 상세가 서로 다른 말을 하게 된다.
  if (normalizeStatusValue(status) === "PAYMENT_COLLECTING") {
    return "입금 진행";
  }

  return "모집 종료";
}

// ---------------------------------------------------------------------------
// 참여(participation) 상태
// ---------------------------------------------------------------------------

export function isParticipationAwaitingPaymentStatus(
  status: string | null | undefined,
) {
  const normalizedStatus = normalizeStatusValue(status);

  return (
    normalizedStatus === "AWAITING_PAYMENT" ||
    normalizedStatus === "PENDING_PAYMENT"
  );
}

export function isParticipationConfirmedStatus(
  status: string | null | undefined,
) {
  const normalizedStatus = normalizeStatusValue(status);

  return (
    normalizedStatus === "CONFIRMED" || normalizedStatus === "PAYMENT_CONFIRMED"
  );
}

export function isParticipationCancelledStatus(
  status: string | null | undefined,
) {
  const normalizedStatus = normalizeStatusValue(status);

  return normalizedStatus === "CANCELLED" || normalizedStatus === "CANCELED";
}

// C2C 신청(무입금 슬롯 선점) 상태 (docs/46 §1.1). 입금 기한 없음, 계좌 비노출.
export function isParticipationAppliedStatus(status: string | null | undefined) {
  return normalizeStatusValue(status) === "APPLIED";
}

// C2C "보냈어요" 마킹 상태 (docs/46 §1.1).
export function isParticipationPaymentSentStatus(
  status: string | null | undefined,
) {
  return normalizeStatusValue(status) === "PAYMENT_SENT";
}

// C2C 참여자 자발 취소 사유 — 서버 ParticipationCancelReason.USER_CANCELLED (docs/46 §5).
export const USER_CANCELLED_REASON = "USER_CANCELLED";

export function isUserCancelledReason(reason: string | null | undefined) {
  return normalizeStatusValue(reason) === USER_CANCELLED_REASON;
}

// ---------------------------------------------------------------------------
// 배송(delivery) 상태
// ---------------------------------------------------------------------------

function normalizeDeliveryStatus(status: string | null | undefined) {
  const normalizedStatus = normalizeStatusValue(status);

  return normalizedStatus === "" ? undefined : normalizedStatus;
}

export function isDeliveryCompletedStatus(status: string | null | undefined) {
  const normalizedStatus = normalizeDeliveryStatus(status);

  return normalizedStatus === "DELIVERED" || normalizedStatus === "RECEIVED";
}

export function isDeliveryShippingStatus(status: string | null | undefined) {
  return normalizeDeliveryStatus(status) === "SHIPPING";
}

// 참여자·개최자 화면 공용 라벨. 수령 확인(RECEIVED)을 따로 구분해야 하는 운영 도구는
// (AdminPaymentsDashboard) 자체 라벨을 유지한다.
const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  SNAPSHOTTED: "운송장 입력 전",
  SHIPPING: "배송 중",
  DELIVERED: "배송 완료",
  RECEIVED: "배송 완료",
};

export function getDeliveryStatusLabel(status: string | null | undefined) {
  const normalizedStatus = normalizeDeliveryStatus(status);

  if (!normalizedStatus) {
    return "";
  }

  return (
    DELIVERY_STATUS_LABELS[normalizedStatus as DeliveryStatus] ?? ""
  );
}
