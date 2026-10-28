// 분철·참여·배송 상태의 단일 기준 모듈. 값은 서버 enum(BuncheolStatus·ParticipationStatus·
// DeliveryStatus) 이름 그대로이고, 예외는 프론트 전용 PUBLIC_PREVIEW 와 상태 없는 목업(빈 값)뿐이다.
// 화면마다 상태 리터럴을 비교하면 라벨이 어긋나므로 판정은 여기서만 한다.

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

export function isBuncheolHostCancelledStatus(status: string | null | undefined) {
  return normalizeStatusValue(status) === "HOST_CANCELLED";
}

// 취소 계열 전체 — 미성사 취소(CANCELLED)와 개최자 취소(HOST_CANCELLED)를 모두 포함한다.
export function isBuncheolCancelledStatus(status: string | null | undefined) {
  const normalizedStatus = normalizeStatusValue(status);

  return (
    normalizedStatus === "CANCELLED" || normalizedStatus === "HOST_CANCELLED"
  );
}

export function isBuncheolConfirmedStatus(status: string | null | undefined) {
  return normalizeStatusValue(status) === "CONFIRMED";
}

// C2C 입금 수집 중 — 입금 단계가 저절로 시작된 뒤 진행 확정되기 전 구간.
export function isBuncheolPaymentCollectingStatus(
  status: string | null | undefined,
) {
  return normalizeStatusValue(status) === "PAYMENT_COLLECTING";
}

// 진행 확정 버튼 판정. 서버(관리 응답·개최 목록)가 같은 판정으로 내려 주는 값이라 화면은 다시 계산하지 않는다.
// 입금 수집 중이 아니거나 옛 서버라 값이 없으면 null.
export type ConfirmCheck = "ALL_PAID" | "DUE_PASSED" | "BEFORE_DUE" | "NO_CONFIRMED";

const CONFIRM_CHECKS: readonly ConfirmCheck[] = [
  "ALL_PAID",
  "DUE_PASSED",
  "BEFORE_DUE",
  "NO_CONFIRMED",
];

export function toConfirmCheck(value: string | null | undefined): ConfirmCheck | null {
  const normalizedValue = normalizeStatusValue(value);

  return CONFIRM_CHECKS.find((check) => check === normalizedValue) ?? null;
}

// ALL_PAID 는 정상 흐름에서 오지 않는다(마지막 묶음 입금 확인이 그 자리에서 진행 확정한다). 옛 데이터 대비로 버튼을 연다.
export function isConfirmCheckReady(check: ConfirmCheck | null | undefined) {
  return check === "ALL_PAID" || check === "DUE_PASSED";
}

// 「개최한 분철」 카드의 「진행 확정해 주세요」 배지. 개최자가 직접 정해야 하는 건 기한이 지났을 때뿐이다.
export function showsConfirmBadge(check: ConfirmCheck | null | undefined) {
  return check === "DUE_PASSED";
}

// 진행 확정 버튼이 켜졌을 때의 한 줄(사용자 확정 문구, 글자 그대로). 관리 화면과 「개최한 분철」 카드가 같이 쓴다.
export function getConfirmCheckLine(check: ConfirmCheck | null | undefined) {
  if (check === "ALL_PAID") {
    return "모든 참여자의 입금이 확인됐어요";
  }

  if (check === "DUE_PASSED") {
    return "입금 기한이 지났어요. 확인된 참여자로 진행하거나 운영진에게 알려 주세요";
  }

  return null;
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
// 개최 목록 카드 · 개최 관리 화면 머리 (개최자 전용 표시)
// ---------------------------------------------------------------------------

export type HostedBuncheolStatusKind =
  | "cancelled"
  | "ended"
  | "confirmed"
  | "paymentCollecting"
  | "recruitingClosed"
  | "recruiting";

const HOSTED_BUNCHEOL_STATUS_LABELS: Record<HostedBuncheolStatusKind, string> =
  {
    cancelled: "취소",
    ended: "종료",
    confirmed: "진행 확정",
    paymentCollecting: "입금 진행",
    recruitingClosed: "모집 종료",
    recruiting: "모집 중",
  };

type HostedBuncheolStatusInput = {
  status: string | null | undefined;
  // 서버 판정(진행확정 ∧ 미확정 참여 0 ∧ 확정 참여 전원 편의점 도착). 진행확정이 아니면 서버는 늘 false,
  // 구 응답이면 null.
  ended: boolean | null | undefined;
};

function getHostedBuncheolStatusKind({
  ended,
  isDeadlinePassed,
  status,
}: HostedBuncheolStatusInput & {
  isDeadlinePassed: boolean;
}): HostedBuncheolStatusKind {
  if (isBuncheolCancelledStatus(status)) {
    return "cancelled";
  }

  if (isBuncheolConfirmedStatus(status)) {
    return ended === true ? "ended" : "confirmed";
  }

  if (isBuncheolPaymentCollectingStatus(status)) {
    return "paymentCollecting";
  }

  if (isBuncheolRecruitingStatus(status) && !isDeadlinePassed) {
    return "recruiting";
  }

  // 마감 지난 모집(스케줄러가 입금 단계·취소로 넘기기 전 잠깐)과 알 수 없는 상태.
  return "recruitingClosed";
}

// 공용 getBuncheolStatusBadgeLabel 을 이 용도로 바꾸거나 deadline 인자를 붙이지 마라 — 공용 쪽은
// 마감을 모르므로 마감이 지난 모집 중이 「모집 중」으로 돌아간다(docs/98 §5-C).
export function getHostedBuncheolStatusBadge(
  input: HostedBuncheolStatusInput & { isDeadlinePassed: boolean },
) {
  const kind = getHostedBuncheolStatusKind(input);

  return { kind, label: HOSTED_BUNCHEOL_STATUS_LABELS[kind] };
}

// 개최 목록 「종료」 탭(값 closed) 판정 = 취소 ∨ (진행확정 ∧ ended). ended 가 없는 구 응답이면 null —
// 화면은 기존 규칙으로 폴백한다(서버 롤백 시 지금과 같은 분류).
export function isHostedBuncheolClosed({
  ended,
  status,
}: HostedBuncheolStatusInput) {
  if (typeof ended !== "boolean") {
    return null;
  }

  return (
    isBuncheolCancelledStatus(status) ||
    (isBuncheolConfirmedStatus(status) && ended)
  );
}

// ---------------------------------------------------------------------------
// 참여(participation) 상태
// ---------------------------------------------------------------------------

export function isParticipationAwaitingPaymentStatus(
  status: string | null | undefined,
) {
  return normalizeStatusValue(status) === "AWAITING_PAYMENT";
}

export function isParticipationConfirmedStatus(
  status: string | null | undefined,
) {
  return normalizeStatusValue(status) === "CONFIRMED";
}

export function isParticipationCancelledStatus(
  status: string | null | undefined,
) {
  return normalizeStatusValue(status) === "CANCELLED";
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

/**
 * 참여 카운트 표기 「멤버 N명」. C2C 는 한 사람이 멤버를 여러 명 고를 수 있어 멤버 수 ≠ 사람 수고,
 * LEGACY 는 1인 1멤버라 둘이 같다. 흐름과 상관없이 같은 표기를 쓴다.
 *
 * ⚠️ 숫자는 멤버(자리) 수 그대로 넘긴다. 사람 수로 바꾸면 서버의 최소 진행 판정(멤버 수 기준)과
 * 화면이 갈린다. 조사가 붙는 문장은 이 함수 대신 템플릿에 「멤버 ${n}명이에요」처럼 직접 쓴다.
 */
export function formatMemberCount(count: number) {
  return `멤버 ${count}명`;
}
