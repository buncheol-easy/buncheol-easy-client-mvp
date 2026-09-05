"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackIcon } from "@/components/icons";
import {
  ConfirmSheet,
  type ConfirmSheetRequest,
} from "@/components/ConfirmSheet";
import {
  confirmBuncheolRecruitment,
  finalizeBuncheolCollected,
  confirmBundlePayment,
  releaseBundle,
  requestBuncheolDetail,
  requestBuncheolManagement,
  requestDeliveryTrackingRegistration,
  requestPaymentConfirmation,
  updateBuncheolOpenChatUrl,
  type BuncheolDetail,
  type BuncheolManagementDetail,
  type BuncheolManagementOption,
  type BuncheolManagementParticipant,
  type BuncheolManagementWinner,
} from "@/lib/auth-api";
import {
  getBuncheolStatusBadgeLabel,
  getDeliveryStatusLabel as getCentralDeliveryStatusLabel,
  getFlowType,
  isBuncheolCancelledStatus,
  isBuncheolConfirmedStatus,
  isBuncheolPaymentCollectingStatus,
  isBuncheolRecruitingStatus,
  isParticipationAppliedStatus,
  isParticipationAwaitingPaymentStatus,
  isParticipationCancelledStatus,
  isParticipationConfirmedStatus,
  isParticipationPaymentSentStatus,
  getCountUnit,
} from "@/lib/buncheol-states";
import { normalizeOpenChatUrlInput } from "@/lib/open-chat-url";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import { createLoginHref } from "@/lib/auth-navigation";
import { getFreshAccessToken } from "@/lib/auth-session";

type HostedBuncheolManageProps = {
  id: string;
  onBack?: () => void;
};

type DeliveryState = {
  isShipped: boolean;
  trackingNumber: string;
};

function formatWonAmount(value: number | null | undefined) {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return "-";
  }

  return `${value.toLocaleString("ko-KR")}원`;
}

// 입금자명 표기 규칙. 개최자가 통장에서 대조하는 이름이라 확인 시트 문구와 목록 행이 반드시 같은 값을
// 써야 한다 — 세 곳에 흩어져 있던 같은 식을 모았다(한쪽만 바뀌면 시트와 행의 이름이 조용히 갈린다).
function getDepositorName(participant: BuncheolManagementParticipant) {
  // 파서(lib/auth-api.ts)가 depositorName 안에서 이미 refundAccount.holder 를 흡수하므로
  // 여기서 holder 를 다시 보면 도달 불가 분기가 된다 — 닉네임 폴백만 남긴다.
  return participant.depositorName || participant.participantNickname;
}

function formatKoreaDateTime(value: string | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  /*
   * 참여 내역·개최 기록과 같은 "8월 12일 17:30" 모양으로 맞춘다.
   * 같은 정보가 화면마다 "8.12 17시" / "2026년 07월 05일 14시" / "2026. 12. 22. 20:00"
   * 세 가지로 보이고 있었다. 연도는 올해가 아닐 때만 붙인다.
   */
  const parts = new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "numeric",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(date);
  const partMap = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const currentYear = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(new Date());
  const yearPrefix = currentYear.includes(partMap.year)
    ? ""
    : `${partMap.year}년 `;

  return `${yearPrefix}${partMap.month}월 ${partMap.day}일 ${partMap.hour}:${partMap.minute}`;
}

function getHighestBidAmount(option: BuncheolManagementOption) {
  return (
    option.currentHighestBid ??
    option.winner?.paymentAmount ??
    option.winner?.bidAmount ??
    0
  );
}

function getWinnerBidAmount(option: BuncheolManagementOption) {
  return option.winner?.paymentAmount ?? option.winner?.bidAmount ?? null;
}

function getBuncheolStatusLabel(detail: BuncheolManagementDetail) {
  return getBuncheolStatusBadgeLabel(detail.status);
}

function isPastDateTime(value: string | undefined) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

function getShippingMethodLabel(method: string | undefined) {
  if (!method) {
    return "";
  }

  if (method === "GS25_HALF") {
    return "GS25 반값택배";
  }

  if (method === "CU_HALF") {
    return "CU 알뜰택배";
  }

  return method;
}

// 운송장 입력 전(SNAPSHOTTED)에는 배송 상태를 표시하지 않는다.
function getDeliveryStatusLabel(status: string | undefined) {
  if (!status || status === "SNAPSHOTTED") {
    return "";
  }

  return getCentralDeliveryStatusLabel(status);
}

// 개최자가 운송장을 쓸 때 그대로 옮겨 적는 번호다 — 하이픈 없이 붙어 있으면 자릿수를
// 눈으로 세게 된다. 저장 값은 건드리지 않고 표시할 때만 끊어 준다.
function formatPhoneNumberForDisplay(value: string) {
  const digits = value.replace(/\D/g, "");

  // 10자리(01x-xxx-xxxx) / 11자리(01x-xxxx-xxxx). 가운데 자릿수가 다르다.
  if (/^01\d{8}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (/^01\d{9}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return value;
}

function getWinnerReceiverLabel(
  winner: BuncheolManagementWinner | null | undefined,
) {
  const phoneNumber = winner?.receiverPhoneNumber ?? "";

  return phoneNumber ? formatPhoneNumberForDisplay(phoneNumber) : "";
}

function getPaymentStatusLabel(winner: BuncheolManagementWinner | null) {
  if (!winner) {
    return "참여 없음";
  }

  if (
    winner.paymentConfirmedAt ||
    isParticipationConfirmedStatus(winner.paymentStatus)
  ) {
    return "입금 확인 완료";
  }

  if (isParticipationCancelledStatus(winner.paymentStatus)) {
    return "참여 취소";
  }

  // C2C "보냈어요" — 참여자가 입금을 마쳤다고 알린 상태라 개최자에게 확인을 재촉한다.
  if (isParticipationPaymentSentStatus(winner.paymentStatus)) {
    return "입금 확인 필요";
  }

  if (isParticipationAwaitingPaymentStatus(winner.paymentStatus)) {
    return "입금 대기";
  }

  // 알 수 없는 상태를 "입금 대기"로 접으면 개최자에게 틀린 신호가 되므로 raw 를 유지한다.
  return winner.paymentStatus ?? "입금 대기";
}

export type ManagementBundle = {
  key: string;
  bundleId: string | null;
  slots: BuncheolManagementParticipant[];
};

// 활성 참여를 묶음으로 접는다. 묶음 = 이체 1회 · 택배 1개이고, 「제외」·입금확인이 그 단위로 돈다.
// 묶음이 없는 구 행은 자기 자신이 한 묶음이다.
function getParticipantBundles(
  participants: BuncheolManagementParticipant[],
): ManagementBundle[] {
  const order: string[] = [];
  const byKey = new Map<string, ManagementBundle>();

  for (const participant of participants) {
    const key = participant.bundleId ?? `p:${participant.participationId}`;
    const bundle = byKey.get(key);

    if (bundle) {
      bundle.slots.push(participant);
      continue;
    }

    order.push(key);
    byKey.set(key, {
      key,
      bundleId: participant.bundleId ?? null,
      slots: [participant],
    });
  }

  return order.map((key) => byKey.get(key)!);
}

// 「제외」가 왜 안 되는지. 버튼만 흐려 두면 개최자가 이유를 못 찾는다.
// 판정은 서버 값(releasability)을 그대로 읽는다 — 화면이 재판정하면 서버 가드와 갈린다.
// 파서 최종 폴백이 리터럴 "멤버" 라, 그대로 찍으면 칩에 "멤버" 가 뜬다.
function getSlotMemberLabel(slot: BuncheolManagementParticipant) {
  const name = slot.memberName?.trim();

  return !name || name === "멤버" ? "멤버 확인 필요" : name;
}

// ⚠️ 인자를 optional 로 두지 않는다. undefined 를 받으면 호출부가 「막힌 자리 없음」을 넘겨도
// default 문구가 뜬다. null 은 서버가 판정을 못 준 경우(구 응답·미연결 행)라 받아야 한다.
function getReleaseBlockedReason(releasability: string | null) {
  switch (releasability) {
    case "RECRUITING":
      return "모집 중에는 뺄 수 없어요.";
    case "BEFORE_DUE":
      return "입금 기한이 지나야 뺄 수 있어요.";
    case "HAS_CONFIRMED":
      return "입금 확인된 자리가 있어 뺄 수 없어요.";
    case "ALREADY_CLOSED":
      return "이미 정리된 참여예요.";
    // 호출부가 막힌 자리가 있을 때만 부르므로 지금은 도달하지 않는다. 방어용으로 남긴다 —
    // 다른 호출부가 생겼을 때 RELEASABLE 이 default 문구로 떨어지면 이 PR 의 버그가 재발한다.
    case "RELEASABLE":
      return null;
    // 판정이 없는 구 응답 — 버튼은 흐려 두되 사유를 단정하지 않는다.
    default:
      return "지금은 뺄 수 없어요.";
  }
}

function getParticipantsByOptionId(
  participants: BuncheolManagementParticipant[],
) {
  return participants.reduce(
    (groups, participant) => {
      if (!participant.buncheolMemberId) {
        return groups;
      }

      const optionParticipants = groups[participant.buncheolMemberId] ?? [];
      optionParticipants.push(participant);
      groups[participant.buncheolMemberId] = optionParticipants;

      return groups;
    },
    {} as Record<string, BuncheolManagementParticipant[]>,
  );
}

function getCurrentParticipant(
  participants: BuncheolManagementParticipant[],
) {
  return (
    participants.find((participant) =>
      isParticipationAwaitingPaymentStatus(participant.status),
    ) ??
    participants.find((participant) =>
      isParticipationConfirmedStatus(participant.status),
    ) ??
    participants[0] ??
    null
  );
}

function getWinnerFromParticipant(
  participant: BuncheolManagementParticipant,
): BuncheolManagementWinner {
  const delivery = participant.delivery;

  return {
    bidAmount: participant.amount,
    depositorName: participant.participantNickname,
    deliveryId: delivery?.deliveryId,
    deliveryStatus: delivery?.status,
    participationId: participant.participationId,
    paymentAmount: participant.amount,
    paymentConfirmedAt: participant.confirmedAt ?? undefined,
    paymentDueAt: participant.dueAt ?? undefined,
    paymentStatus: participant.status,
    receiverNickname: delivery?.receiverNickname,
    receiverPhoneNumber: delivery?.receiverPhoneNumber,
    shippingMethod: delivery?.shippingMethod,
    storeName: delivery?.storeName,
    trackingNumber: delivery?.trackingNumber,
  };
}

function getManagementOptionsFromDetail(
  managementDetail: BuncheolManagementDetail,
  buncheolDetail: BuncheolDetail,
): BuncheolManagementOption[] {
  const participantsByOptionId = getParticipantsByOptionId(
    managementDetail.participants,
  );

  return buncheolDetail.members.map((member) => {
    const participants = participantsByOptionId[member.id] ?? [];
    const currentParticipant = getCurrentParticipant(participants);
    const highestParticipantAmount = participants.reduce(
      (highestAmount, participant) =>
        Math.max(highestAmount, participant.amount),
      0,
    );

    return {
      buncheolMemberId: member.id,
      currentHighestBid:
        highestParticipantAmount || member.currentBidAmount || member.bidMinPrice,
      memberId: member.memberId,
      memberImage: member.imageUrl,
      memberName: member.name,
      participants,
      participationCount: Math.max(member.participantCount, participants.length),
      winner: currentParticipant
        ? getWinnerFromParticipant(currentParticipant)
        : null,
    };
  });
}

async function requestHostedBuncheolManagement(
  accessToken: string,
  id: string,
) {
  const managementDetail = await requestBuncheolManagement(accessToken, id);

  if (managementDetail.options.length > 0) {
    return managementDetail;
  }

  try {
    const buncheolDetail = await requestBuncheolDetail(accessToken, id);
    const fallbackOptions = getManagementOptionsFromDetail(
      managementDetail,
      buncheolDetail,
    );

    if (fallbackOptions.length === 0) {
      return managementDetail;
    }

    return {
      ...managementDetail,
      optionCount: managementDetail.optionCount || fallbackOptions.length,
      options: fallbackOptions,
    };
  } catch {
    return managementDetail;
  }
}

export function HostedBuncheolManage({
  id,
  onBack,
}: HostedBuncheolManageProps) {
  const router = useRouter();
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const [detail, setDetail] = useState<BuncheolManagementDetail | null>(null);
  const [message, setMessage] = useState("개최한 분철 정보를 불러오고 있어요.");
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(
    null,
  );
  const [registeringTrackingId, setRegisteringTrackingId] = useState<
    string | null
  >(null);
  const [deliveryStates, setDeliveryStates] = useState<
    Record<string, DeliveryState>
  >({});
  // C2C 액션(성사 확정·부분 확정·입금확인·반려·운송장) 진행 중 식별자 — 중복 호출 방지.
  const [pendingC2CAction, setPendingC2CAction] = useState<string | null>(null);
  // 되돌리기 어려운 액션의 확인 요청 — 인앱 브라우저 confirm 억제 대응 (ConfirmSheet).
  const [confirmSheetRequest, setConfirmSheetRequest] =
    useState<ConfirmSheetRequest | null>(null);
  const [participantTrackingInputs, setParticipantTrackingInputs] = useState<
    Record<string, string>
  >({});
  // 오픈채팅 링크 수정 시트 — null 이면 닫힘. 전체 수정(모집중 전용)과 달리 상태와 무관하게 열린다.
  const [openChatUrlDraft, setOpenChatUrlDraft] = useState<string | null>(null);
  const [openChatUrlError, setOpenChatUrlError] = useState("");
  const [isSavingOpenChatUrl, setIsSavingOpenChatUrl] = useState(false);

  useEffect(() => {
    const accessToken = authState.isLoggedIn
      ? authState.accessToken ?? undefined
      : undefined;
    let isActive = true;

    if (!authState.isLoggedIn || !accessToken) {
      const returnHref = `/products/${encodeURIComponent(id)}/manage`;
      const frame = window.requestAnimationFrame(() => {
        if (!isActive) {
          return;
        }

        setDetail(null);
        setMessage("로그인 후 관리할 수 있어요.");
        router.replace(
          createLoginHref({ cancelTo: "/", returnTo: returnHref }),
        );
      });

      return () => {
        isActive = false;
        window.cancelAnimationFrame(frame);
      };
    }

    requestHostedBuncheolManagement(accessToken, id)
      .then((nextDetail) => {
        if (!isActive) {
          return;
        }

        setDetail(nextDetail);
        setMessage("");
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setDetail(null);
        // 아래 화면이 "메시지 없음 = 불러오는 중"으로 분기하므로 빈 문자열을 넣으면 안 된다.
        setMessage(
          (error instanceof Error ? error.message.trim() : "") ||
            "개최한 분철 정보를 불러오지 못했어요.",
        );
      });

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, authState.isLoggedIn, id, router]);

  const memberCount = detail?.optionCount ?? detail?.options.length ?? 0;
  const participantCount =
    detail?.totalParticipationCount ??
    detail?.options.reduce(
      (total, option) => total + option.participationCount,
      0,
    ) ??
    0;
  const confirmedCount =
    detail?.confirmedCount ??
    detail?.participants.filter((participant) =>
      isParticipationConfirmedStatus(participant.status),
    ).length ??
    detail?.options.filter((option) =>
      isParticipationConfirmedStatus(option.winner?.paymentStatus),
    ).length ??
    0;
  // 취소분은 서버가 participants 와 분리해 내려준다 — 슬롯을 점유하지 않아 참여 수·정원 집계에 섞이면 안 된다.
  const cancelledParticipants = detail?.cancelledParticipants ?? [];
  // 취소분 대다수는 입금 기한 만료라 돈이 오간 적이 없고, 같은 사람이 재참여해 활성으로도 있다.
  // 🔴 판정 키는 <b>입금확인 시각 하나</b>다. 서버의 needsHostRefund 와 반드시 같아야 한다 —
  // 여기만 「보냈어요」를 포함하면 목록에는 뜨는데 서버가 계좌를 안 내려 <b>계좌가 빈 행</b>이 된다.
  // 「보냈어요」는 자기신고라 개최자가 통장에서 확인한 적이 없는 돈이다.
  const refundTargetParticipants = cancelledParticipants.filter((participant) =>
    Boolean(participant.confirmedAt),
  );
  // 🔴 「보냈어요」만 하고 확인 전에 빠진 건을 <b>따로 센다</b>. 이걸 「금액 없음」에 섞으면
  // 개최자가 "환불할 금액이 없어요" 를 읽는데 실제로는 통장에 돈이 있을 수 있다 —
  // 「제외」가 기한 뒤에만 열리는 이유가 "이체가 통장에 늦게 찍히는 일이 흔해서" 다.
  // 계좌를 못 보여주는 것과 존재 자체를 부정하는 것은 다르다.
  const sentButUnconfirmedCount = cancelledParticipants.filter(
    (participant) => !participant.confirmedAt && participant.paymentSentAt,
  ).length;
  const noTraceCancelledCount =
    cancelledParticipants.length -
    refundTargetParticipants.length -
    sentButUnconfirmedCount;
  const minHeadcount = detail?.minHeadcount ?? 0;
  // ⚠️ 여기만 「명」으로 남긴다. 분자(confirmedCount)는 C2C 에서 자리 수지만, 분모
  // (minHeadcount)는 개최자가 「최소 진행 인원」으로 입력한 정책값이다. 분자만 「자리」로 바꾸면
  // 「4자리 / 5명」이 되고, 분모까지 바꾸는 것은 그 입력 항목의 의미를 바꾸는 <b>정책 결정</b>이라
  // 화면에서 임의로 정하지 않는다. 서버는 이 둘을 자리 수로 비교한다.
  const confirmedProgressLabel = minHeadcount
    ? `${confirmedCount}\uba85 / ${minHeadcount}\uba85`
    : `${confirmedCount}\uba85`;
  const confirmedProgressPercent = minHeadcount
    ? Math.min(100, Math.round((confirmedCount / minHeadcount) * 100))
    : participantCount > 0
      ? 100
      : 0;
  const awaitingPaymentCount =
    detail?.options.filter((option) =>
      isParticipationAwaitingPaymentStatus(option.winner?.paymentStatus),
    ).length ?? 0;
  const deliveryReadyCount =
    detail?.options.filter((option) => {
      const isPaymentConfirmed =
        isParticipationConfirmedStatus(option.winner?.paymentStatus) ||
        Boolean(option.winner?.paymentConfirmedAt);

      return (
        isPaymentConfirmed &&
        Boolean(option.winner?.deliveryId) &&
        !option.winner?.trackingNumber
      );
    }).length ?? 0;
  const trackingCompletedCount =
    detail?.options.filter((option) =>
      Boolean(option.winner?.trackingNumber),
    ).length ?? 0;
  // ── C2C 파생값 (docs/46 §4.6 — 관리 응답은 활성 참여 전건을 내려준다) ──
  const isC2C = getFlowType(detail?.flowType) === "C2C";
  // 아래 카운트들은 전부 자리 수다(멤버 슬롯 점유 건수). 규약은 getCountUnit 참조.
  const countUnit = getCountUnit(detail?.flowType);
  const activeC2CParticipants = (detail?.participants ?? []).filter(
    (participant) => !isParticipationCancelledStatus(participant.status),
  );
  const c2cBundles = getParticipantBundles(activeC2CParticipants);

  const c2cAppliedCount = activeC2CParticipants.filter((participant) =>
    isParticipationAppliedStatus(participant.status),
  ).length;
  const c2cAwaitingCount = activeC2CParticipants.filter((participant) =>
    isParticipationAwaitingPaymentStatus(participant.status),
  ).length;
  const c2cPaymentSentCount = activeC2CParticipants.filter((participant) =>
    isParticipationPaymentSentStatus(participant.status),
  ).length;
  const c2cConfirmedCount = activeC2CParticipants.filter(
    (participant) =>
      isParticipationConfirmedStatus(participant.status) ||
      Boolean(participant.confirmedAt),
  ).length;
  // 부분 확정은 미입금 활성 참여(입금 대기·보냈어요)가 0일 때만 가능하다 (docs/46 §4.7-E1).
  const c2cUnpaidActiveCount = c2cAwaitingCount + c2cPaymentSentCount;
  // 서버 CAS(confirmIfAllCollected)와 같은 조건 — 이때만 부분 확정 버튼을 노출한다 (docs/56 H-12).
  const canFinalizeCollected =
    c2cUnpaidActiveCount === 0 && c2cConfirmedCount > 0;
  // 🔴 배송 집계는 <b>배송 단위</b>다. 참여 단위로 세면 한 묶음의 두 슬롯이 같은 배송을 물고 있을 때
  // 목록에는 운송장 입력칸이 1개인데 "운송장 대기 2건" 으로 뜬다. deliveryId 로 중복을 제거한다.
  // 배송 스냅샷은 입금 전에도 생기므로(참여 생성 시 배송지 전송) 입금확인된 건만 대기로 센다.
  const c2cDeliveries = new Map<
    string,
    { confirmed: boolean; trackingNumber?: string | null }
  >();

  for (const participant of activeC2CParticipants) {
    const deliveryId = participant.delivery?.deliveryId;

    if (!deliveryId) {
      continue;
    }

    const confirmed =
      isParticipationConfirmedStatus(participant.status) ||
      Boolean(participant.confirmedAt);
    const previous = c2cDeliveries.get(deliveryId);
    c2cDeliveries.set(deliveryId, {
      // 같은 배송을 문 슬롯 중 하나라도 확정이면 그 택배는 나가야 한다.
      confirmed: confirmed || Boolean(previous?.confirmed),
      trackingNumber:
        participant.delivery?.trackingNumber ?? previous?.trackingNumber ?? null,
    });
  }

  const c2cDeliveryReadyCount = [...c2cDeliveries.values()].filter(
    (delivery) => delivery.confirmed && !delivery.trackingNumber,
  ).length;
  const c2cTrackingCompletedCount = [...c2cDeliveries.values()].filter(
    (delivery) => Boolean(delivery.trackingNumber),
  ).length;

  function updateTrackingNumber(optionId: string, trackingNumber: string) {
    setDeliveryStates((current) => ({
      ...current,
      [optionId]: {
        isShipped: current[optionId]?.isShipped ?? false,
        trackingNumber,
      },
    }));
  }

  async function completeShipping(option: BuncheolManagementOption) {
    const optionId = option.buncheolMemberId;
    const deliveryId = option.winner?.deliveryId;
    const trackingNumber = (
      deliveryStates[optionId]?.trackingNumber ??
      option.winner?.trackingNumber ??
      ""
    ).trim();

    if (!deliveryId) {
      setMessage("운송장을 등록할 배송 ID가 없어요.");
      return;
    }

    if (!trackingNumber) {
      setMessage("운송장 번호를 입력해 주세요.");
      return;
    }

    setRegisteringTrackingId(deliveryId);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        return;
      }

      await requestDeliveryTrackingRegistration(
        accessToken,
        deliveryId,
        trackingNumber,
      );
      const nextDetail = await requestHostedBuncheolManagement(accessToken, id);

      setDetail(nextDetail);
      setDeliveryStates((current) => ({
        ...current,
        [optionId]: {
          isShipped: true,
          trackingNumber,
        },
      }));
      setMessage("운송장 번호를 등록했어요.");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "운송장 번호를 등록하지 못했어요.",
      );
    } finally {
      setRegisteringTrackingId(null);
    }
  }

  async function confirmPayment(option: BuncheolManagementOption) {
    const participationId = option.winner?.participationId;

    if (!option.winner || confirmingPaymentId) {
      return;
    }

    if (!participationId) {
      setMessage("입금 확인에 필요한 참여 ID가 없어요.");
      return;
    }

    setConfirmingPaymentId(participationId);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        return;
      }

      await requestPaymentConfirmation(accessToken, participationId, {
        ignoreConflict: true,
      });
      const nextDetail = await requestHostedBuncheolManagement(accessToken, id);

      setDetail(nextDetail);
      setMessage("입금 확인이 완료됐어요.");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "입금 확인을 처리하지 못했어요.",
      );
    } finally {
      setConfirmingPaymentId(null);
    }
  }


  async function reloadManagementDetail(accessToken: string) {
    const nextDetail = await requestHostedBuncheolManagement(accessToken, id);

    setDetail(nextDetail);
  }

  function openOpenChatUrlSheet() {
    setOpenChatUrlError("");
    setOpenChatUrlDraft(detail?.openChatUrl ?? "");
  }

  async function saveOpenChatUrl() {
    if (openChatUrlDraft === null || isSavingOpenChatUrl) {
      return;
    }

    const trimmedDraft = openChatUrlDraft.trim();
    // 빈 값은 "링크 제거" 로 그대로 보낸다 — 서버가 빈 문자열을 제거로 받는다.
    const normalizedUrl = trimmedDraft ? normalizeOpenChatUrlInput(trimmedDraft) : "";

    if (normalizedUrl === null) {
      setOpenChatUrlError("카카오 오픈채팅 주소만 등록할 수 있어요.");
      return;
    }

    setIsSavingOpenChatUrl(true);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        // 스토어를 지우지 않고 null 이 돌아오는 경로가 있어 안내가 없으면 눌러도 아무 일이 없다 (다른 C2C 액션과 같은 문구).
        setOpenChatUrlError("로그인이 만료됐어요. 다시 로그인해 주세요.");
        return;
      }

      await updateBuncheolOpenChatUrl(accessToken, id, normalizedUrl);

      // 저장 성공 처리를 재조회보다 먼저 한다 — 순서를 바꾸면 GET 이 흔들릴 때
      // 이미 반영된 저장이 "저장 실패" 로 보이고 개최자가 다시 누른다.
      setOpenChatUrlDraft(null);
      setOpenChatUrlError("");
      setMessage(
        normalizedUrl ? "오픈채팅 링크를 저장했어요." : "오픈채팅 링크를 지웠어요.",
      );

      try {
        await reloadManagementDetail(accessToken);
      } catch {
        setMessage("저장했어요. 화면 갱신에 실패해 잠시 뒤 다시 열어 주세요.");
      }
    } catch (error: unknown) {
      setOpenChatUrlError(
        error instanceof Error ? error.message : "오픈채팅 링크를 저장하지 못했어요.",
      );
    } finally {
      setIsSavingOpenChatUrl(false);
    }
  }

  // C2C 성사 확정 — 신청 전원을 입금 대기(24h)로 일괄 전이 + 입금 안내 알림톡 발송.
  // 정원 미달은 개최자 재량 확정 허용, 미달 경고 후 재확인만 (docs/46 §7.1-2).
  function requestConfirmRecruitment() {
    if (!detail || pendingC2CAction) {
      return;
    }

    // 확정으로 전이되는 대상은 APPLIED 뿐 — 화면 모수도 동일 기준으로 통일한다.
    const applicantCount = c2cAppliedCount;
    const isUnderMinHeadcount =
      minHeadcount > 0 && applicantCount < minHeadcount;

    setConfirmSheetRequest({
      confirmLabel: "성사 확정",
      description: isUnderMinHeadcount
        ? `최소 진행 인원 ${minHeadcount}명 중 ${applicantCount}${countUnit}만 신청했어요. 미달인 채로 확정하면 신청자 전원에게 입금 안내 알림톡이 발송돼요.`
        : `신청자 ${applicantCount}${countUnit} 전원에게 입금 계좌와 24시간 기한이 담긴 알림톡이 발송돼요.`,
      onConfirm: () => {
        setConfirmSheetRequest(null);
        void runConfirmRecruitment(applicantCount);
      },
      title: "성사를 확정할까요?",
    });
  }

  async function runConfirmRecruitment(applicantCount: number) {
    if (pendingC2CAction) {
      return;
    }

    setPendingC2CAction("confirm-recruitment");

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        setMessage("로그인이 만료됐어요. 다시 로그인해 주세요.");
        return;
      }

      const result = await confirmBuncheolRecruitment(accessToken, id);

      await reloadManagementDetail(accessToken);
      setMessage(
        `성사를 확정했어요. ${result.awaitingCount ?? applicantCount}${countUnit}에 입금 안내가 발송됐어요.`,
      );
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "성사 확정을 처리하지 못했어요.",
      );
    } finally {
      setPendingC2CAction(null);
    }
  }

  // C2C 입금 수집 종료(부분 확정) — 입금 확인된 참여만으로 진행 확정 (docs/46 §7.1-6).
  function requestFinalizeCollected() {
    if (!detail || pendingC2CAction) {
      return;
    }

    setConfirmSheetRequest({
      confirmLabel: "진행 확정",
      description:
        "입금이 확인된 참여만으로 분철을 진행해요. 확정 후에는 참여를 더 받을 수 없어요.",
      onConfirm: () => {
        setConfirmSheetRequest(null);
        void runFinalizeCollected();
      },
      title: `입금한 ${c2cConfirmedCount}${countUnit}로 진행할까요?`,
    });
  }

  async function runFinalizeCollected() {
    if (pendingC2CAction) {
      return;
    }

    setPendingC2CAction("finalize-collected");

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        setMessage("로그인이 만료됐어요. 다시 로그인해 주세요.");
        return;
      }

      await finalizeBuncheolCollected(accessToken, id);
      await reloadManagementDetail(accessToken);
      setMessage("진행을 확정했어요. 이제 굿즈 구매와 배송을 진행해 주세요.");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "진행 확정을 처리하지 못했어요.",
      );
    } finally {
      setPendingC2CAction(null);
    }
  }

  // C2C 묶음 입금확인. 되돌릴 수 없고(참여가 CONFIRMED 로 확정되며 알림톡이 나간다) 전원 확인 시
  // 분철까지 진행확정으로 넘어가므로 확인 시트를 태운다.
  function requestConfirmBundlePayment(
    bundle: ManagementBundle,
    expectedSlotIds: string[],
  ) {
    if (pendingC2CAction) {
      return;
    }

    const head = bundle.slots[0];
    // 개최자가 통장에서 대조하는 값 그대로 — 입금자명과 묶음 총액. 이체가 한 번이므로 합계로 묻는다.
    const depositorName = getDepositorName(head);
    const total = bundle.slots.reduce((sum, slot) => sum + slot.amount, 0);
    const memberNames = bundle.slots.map(getSlotMemberLabel).join(" · ");

    setConfirmSheetRequest({
      confirmLabel: "입금 확인",
      // formatWonAmount 는 0 이하를 "-" 로 돌려줘 문장 안에서는 "- 을 받으셨나요" 가 된다.
      // 0원 슬롯 조합에서 실제로 도달할 수 있어, 금액을 못 쓰면 절을 통째로 뺀다.
      description:
        total > 0
          ? `${depositorName}님의 ${memberNames} ${formatWonAmount(total)}을 받으셨나요? 확인하면 되돌릴 수 없어요.`
          : `${depositorName}님의 ${memberNames} 입금을 받으셨나요? 확인하면 되돌릴 수 없어요.`,
      onConfirm: () => {
        setConfirmSheetRequest(null);
        void runConfirmBundlePayment(bundle, expectedSlotIds);
      },
      title:
        bundle.slots.length > 1
          ? `자리 ${bundle.slots.length}개를 한 번에 확인할까요?`
          : "입금을 확인할까요?",
    });
  }

  // 묶음 입금확인 — all-or-nothing (docs/70 §5). 슬롯마다 확인하면 묶음 안 상태가 갈려
  // 「제외」가 HAS_CONFIRMED 로 영구히 막히는 묶음이 남는다.
  async function runConfirmBundlePayment(
    bundle: ManagementBundle,
    expectedSlotIds: string[],
  ) {
    if (pendingC2CAction) {
      return;
    }

    setPendingC2CAction(`confirm:${bundle.key}`);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        setMessage("로그인이 만료됐어요. 다시 로그인해 주세요.");
        return;
      }

      if (bundle.bundleId) {
        await confirmBundlePayment(
          accessToken,
          bundle.bundleId,
          expectedSlotIds,
        );
      } else {
        // 묶음이 없는 구 행 폴백 — 신규 참여는 전부 묶음을 갖는다.
        await requestPaymentConfirmation(
          accessToken,
          bundle.slots[0].participationId,
          { ignoreConflict: true },
        );
      }

      await reloadManagementDetail(accessToken);
      setMessage("입금 확인이 완료됐어요.");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "입금 확인을 처리하지 못했어요.",
      );
    } finally {
      setPendingC2CAction(null);
    }
  }

  // 묶음 「제외」 — 입금 기한이 지난 미입금 참여를 개최자가 정리한다 (docs/71 §1·§8-1).
  // C2C 는 자동 취소가 없어 이것이 유일한 출구다. 참여자는 기한 후 스스로 빠질 수 없다.
  function requestReleaseBundle(bundle: ManagementBundle) {
    if (pendingC2CAction) {
      return;
    }

    const depositorName = getDepositorName(bundle.slots[0]);
    const memberNames = bundle.slots.map(getSlotMemberLabel).join(" · ");

    setConfirmSheetRequest({
      confirmLabel: "제외",
      description: `${depositorName}님의 ${memberNames} 자리를 뺄까요? 참여자에게 취소 안내가 나가고, 그 자리는 다시 신청받을 수 있어요. 되돌릴 수 없어요.`,
      onConfirm: () => {
        setConfirmSheetRequest(null);
        void runReleaseBundle(bundle);
      },
      title:
        bundle.slots.length > 1
          ? `자리 ${bundle.slots.length}개를 함께 뺄까요?`
          : "이 참여를 뺄까요?",
    });
  }

  async function runReleaseBundle(bundle: ManagementBundle) {
    if (pendingC2CAction) {
      return;
    }

    if (!bundle.bundleId) {
      setMessage("이 참여는 묶음 정보가 없어 뺄 수 없어요. 고객센터로 문의해 주세요.");
      return;
    }

    setPendingC2CAction(`release:${bundle.key}`);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        setMessage("로그인이 만료됐어요. 다시 로그인해 주세요.");
        return;
      }

      await releaseBundle(accessToken, bundle.bundleId);
      await reloadManagementDetail(accessToken);
      setMessage("참여를 뺐어요. 그 자리는 다시 신청받을 수 있어요.");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error ? error.message : "참여를 빼지 못했어요.",
      );
    } finally {
      setPendingC2CAction(null);
    }
  }

  // C2C 참여 단위 운송장 등록 — 다슬롯이라 옵션(winner)이 아닌 참여 기준으로 처리한다.
  async function handleRegisterParticipantTracking(
    participant: BuncheolManagementParticipant,
  ) {
    const deliveryId = participant.delivery?.deliveryId;

    if (!deliveryId) {
      setMessage("운송장을 등록할 배송 ID가 없어요.");
      return;
    }

    const trackingNumber = (
      participantTrackingInputs[participant.participationId] ?? ""
    ).trim();

    if (!trackingNumber) {
      setMessage("운송장 번호를 입력해 주세요.");
      return;
    }

    if (pendingC2CAction) {
      return;
    }

    setPendingC2CAction(`tracking:${participant.participationId}`);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        setMessage("로그인이 만료됐어요. 다시 로그인해 주세요.");
        return;
      }

      await requestDeliveryTrackingRegistration(
        accessToken,
        deliveryId,
        trackingNumber,
      );
      await reloadManagementDetail(accessToken);
      setParticipantTrackingInputs((current) => {
        const next = { ...current };

        delete next[participant.participationId];

        return next;
      });
      setMessage("운송장 번호를 등록했어요.");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "운송장 번호를 등록하지 못했어요.",
      );
    } finally {
      setPendingC2CAction(null);
    }
  }

  // ⚠️ 높이는 100dvh 가 아니라 h-full 이어야 한다. 이 화면은 HostedBuncheolManageExperience 의
  // .product-page-panel(absolute inset-0) 안에서 렌더되는데, 바깥 셸이 그 높이를 100dvh 보다
  // 작게 잡는 표시 모드가 여럿이다 — 데스크톱 폰 프레임(app/globals.css 의 desktop-web-shell:
  // min(840px, 100dvh - clamp(96px,12vh,148px), …)), safe-area 패딩이 붙는 인앱 웹뷰,
  // --app-viewport-height 를 쓰는 설치형 PWA. 100dvh 를 쓰면 그만큼 패널보다 내부가 커져
  // ① 참여자 리스트 끝이 프레임 밖으로 잘려 스크롤해도 못 보고(docs/56 H-01)
  // ② 패널 자체가 스크롤 가능해져, 데스크톱에서 fixed → absolute 로 바뀌는 확인 시트가
  //    스크롤된 패널 원점 기준으로 화면 밖에 그려진다(docs/56 H-10).
  // 어긋남이 가장 큰 데스크톱에서 먼저 발견됐을 뿐, 위 두 모드에도 inset 만큼 같은 문제가 있었다.
  /*
   * 상세를 못 받은 상태 — 불러오는 중이거나, 남의 분철 관리 URL 로 들어와 403 이 난 경우다.
   * 이전에는 문장 한 줄만 흰 화면 한가운데 떠 있어서, 뒤로가기도 다른 화면으로 갈 길도 없었다.
   * (하단 탭도 이 화면에는 없다.) 헤더와 나갈 길을 함께 준다.
   */
  if (!detail) {
    const isLoadingDetail = !message;

    return (
      <main className="system-chrome-white system-chrome-bottom-white h-full bg-white">
        <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
          <header className="shrink-0 px-5 pb-3 pt-4">
            <div className="flex items-center gap-3">
              <button
                aria-label="이전 화면"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white"
                onClick={onBack ?? (() => router.back())}
                type="button"
              >
                <BackIcon />
              </button>
              <div className="min-w-0 flex-1 text-right">
                <p className="text-[12px] font-semibold text-black/35">
                  분철 개최 관리
                </p>
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
            <p className="break-keep text-[15px] font-semibold leading-6 text-black/55">
              {isLoadingDetail ? "분철 정보를 불러오는 중이에요." : message}
            </p>
            {isLoadingDetail ? null : (
              <Link
                className="mt-5 flex h-12 w-full max-w-[240px] items-center justify-center rounded-full bg-[#CFE86B] text-[14px] font-semibold tracking-[-0.04em] text-black shadow-[0_10px_24px_rgba(120,132,82,0.2)]"
                href="/profile/bids"
              >
                내 분철로 돌아가기
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="system-chrome-white system-chrome-bottom-white h-full bg-white">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <header className="shrink-0 px-5 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white"
              aria-label="이전 화면"
              onClick={onBack ?? (() => router.back())}
            >
              <BackIcon />
            </button>
            <div className="min-w-0 flex-1 text-right">
              {/* 제목은 아래 검정 카드로 내렸다 — 헤더에서 truncate 로 잘리는 대신 두 줄까지 펼쳐진다 (docs/54 1-2 시안 A). */}
              <p className="text-[12px] font-semibold text-black/35">
                분철 개최 관리
              </p>
            </div>
          </div>
        </header>

        <div className="app-page-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-8">
          {message ? (
            <p className="mb-3 rounded-[0.8rem] bg-black/[0.04] px-3 py-2 text-[12px] font-semibold text-black/45">
              {message}
            </p>
          ) : null}

          <section className="overflow-hidden rounded-[1.05rem] border border-black/10 bg-white shadow-[0_14px_34px_rgba(0,0,0,0.045)]">
            <div className="bg-black px-4 py-4 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {/* 제목이 이 화면의 주인공 — 두 줄까지 보여주고, 그룹·구매처는 아래 메타 한 줄로 내린다. */}
                  <h1 className="line-clamp-2 text-[19px] font-semibold leading-[1.32] tracking-[-0.05em]">
                    {detail.title}
                  </h1>
                  <p className="mt-2 truncate text-[12px] font-semibold text-white/55">
                    {detail.groupName}
                    <span className="px-1.5 text-white/30">·</span>
                    {detail.purchaseSite || "구매처 미입력"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold ${
                    isBuncheolConfirmedStatus(detail.status)
                      ? "bg-white text-black"
                      : "bg-white/12 text-white/75"
                  }`}
                >
                  {getBuncheolStatusLabel(detail)}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-[12px] font-semibold text-white/55">
                  <span>입금 확인</span>
                  <span>{confirmedProgressLabel}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-white transition-[width]"
                    style={{ width: `${confirmedProgressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-black/40">
                  운영 요약
                </p>
                <p className="mt-1 text-[14px] font-semibold text-black/55">
                  입금 확인 후 운송장 등록까지 한 곳에서 처리해요.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[0.85rem] border border-black/10 bg-white px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">{"멤버"}</p>
                <p className="mt-1 text-[15px] font-semibold">
                  {`${memberCount}명`}
                </p>
              </div>
              <div className="rounded-[0.85rem] border border-black/10 bg-white px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  {"\ucd5c\uc18c \uc9c4\ud589 \uc778\uc6d0"}
                </p>
                <p className="mt-1 text-[15px] font-semibold">
                  {minHeadcount ? `${minHeadcount}\uba85` : "-"}
                </p>
              </div>
              <div className="rounded-[0.85rem] border border-black/10 bg-white px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">{"\ucc38\uc5ec"}</p>
                <p className="mt-1 text-[15px] font-semibold">
                  {`${participantCount}${countUnit}`}
                </p>
              </div>
              <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  {"\uc785\uae08 \ub300\uae30"}
                </p>
                <p className="mt-1 text-[15px] font-semibold">
                  {`${isC2C ? c2cAwaitingCount : awaitingPaymentCount}${countUnit}`}
                </p>
              </div>
              {isC2C ? (
                <>
                  <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                    <p className="text-[11px] font-medium text-black/35">
                      {"\uc2e0\uccad"}
                    </p>
                    <p className="mt-1 text-[15px] font-semibold">
                      {`${c2cAppliedCount}${countUnit}`}
                    </p>
                  </div>
                  <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                    <p className="text-[11px] font-medium text-black/35">
                      {"\ubcf4\ub0c8\uc5b4\uc694"}
                    </p>
                    <p className="mt-1 text-[15px] font-semibold">
                      {`${c2cPaymentSentCount}${countUnit}`}
                    </p>
                  </div>
                </>
              ) : null}
              <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  운송장 대기
                </p>
                <p className="mt-1 text-[15px] font-semibold">
                  {`${isC2C ? c2cDeliveryReadyCount : deliveryReadyCount}건`}
                </p>
              </div>
              <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  운송장 완료
                </p>
                <p className="mt-1 text-[15px] font-semibold">
                  {`${isC2C ? c2cTrackingCompletedCount : trackingCompletedCount}건`}
                </p>
              </div>
              <div className="col-span-2 rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  {"\ubaa8\uc9d1 \uae30\ud55c"}
                </p>
                <p className="mt-1 whitespace-nowrap text-[15px] font-semibold tracking-[-0.04em]">
                  {formatKoreaDateTime(detail.deadline)}
                </p>
              </div>
            </div>
            </div>
          </section>

          {/*
            오픈채팅 링크는 전체 수정(모집중 전용)과 달리 상태와 무관하게 여기서 고친다 —
            링크가 가장 필요한 구간이 입금·문의가 몰리는 성사 확정 이후이기 때문이다.
            비어 있을 때 등록을 유도할 자리가 필요해 검정 카드 안이 아니라 독립 카드로 뒀다.

            C2C 전용이다 — 링크를 실제로 보여주는 세 화면(분철 상세·참여 내역·입금 안내 시트)이
            전부 C2C 게이트라, LEGACY 에 노출하면 "상세와 입금 안내에 보여요" 가 거짓이 되고
            등록해도 아무 데도 뜨지 않는다. 취소된 분철은 링크 등록을 권할 자리가 아니라 함께 접는다.
          */}
          {isC2C && !isBuncheolCancelledStatus(detail.status) ? (
          <section
            className={`mt-4 rounded-[1.05rem] border px-4 py-4 ${
              detail.openChatUrl
                ? "border-black/10 bg-white"
                : "border-dashed border-black/15 bg-[#f8f8f8]"
            }`}
          >
            <p className="text-[15px] font-semibold tracking-[-0.04em]">
              오픈채팅
            </p>
            <p className="mt-1 break-keep text-[13px] font-medium leading-5 text-black/50">
              참여자가 문의할 소통 창구예요. 분철 상세와 입금 안내 화면에 보여요.
            </p>
            {detail.openChatUrl ? (
              <div className="mt-3 flex items-center gap-2 rounded-[0.85rem] bg-[#f4f4f4] px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-black/70">
                  {detail.openChatUrl}
                </span>
                <button
                  className="shrink-0 rounded-full bg-[#CFE86B] px-3 py-1.5 text-[12px] font-semibold text-black"
                  onClick={openOpenChatUrlSheet}
                  type="button"
                >
                  수정
                </button>
              </div>
            ) : (
              <button
                className="mt-3 h-11 w-full rounded-full bg-black text-[14px] font-semibold tracking-[-0.04em] text-[#D7FF5F]"
                onClick={openOpenChatUrlSheet}
                type="button"
              >
                링크 등록하기
              </button>
            )}
          </section>
          ) : null}

          {isC2C && isBuncheolRecruitingStatus(detail.status) ? (
            <section className="mt-4 rounded-[1.05rem] border border-[#DDE7B8] bg-[#F7FAEE] px-4 py-4">
              <p className="text-[15px] font-semibold tracking-[-0.04em]">
                성사 확정
              </p>
              <p className="mt-1 text-[13px] font-medium leading-5 text-black/50">
                지금까지 신청 {c2cAppliedCount}
                {countUnit}
                이에요. 확정하면 신청자
                전원에게 입금 계좌와 24시간 기한이 담긴 알림톡이 발송돼요.
              </p>
              <button
                className="mt-3 h-12 w-full rounded-full bg-black text-[15px] font-semibold tracking-[-0.04em] text-[#D7FF5F] disabled:bg-black/15 disabled:text-black/35"
                disabled={c2cAppliedCount === 0 || pendingC2CAction !== null}
                onClick={requestConfirmRecruitment}
                type="button"
              >
                {pendingC2CAction === "confirm-recruitment"
                  ? "확정하는 중"
                  : "성사 확정하기"}
              </button>
              {c2cAppliedCount === 0 ? (
                <p className="mt-2 text-[12px] font-medium text-black/40">
                  신청자가 생기면 확정할 수 있어요.
                </p>
              ) : null}
            </section>
          ) : null}

          {isC2C && isBuncheolPaymentCollectingStatus(detail.status) ? (
            <section className="mt-4 rounded-[1.05rem] border border-black/10 bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-semibold tracking-[-0.04em]">
                  입금 수집 중
                </p>
                {detail.paymentDueAt ? (
                  <span className="shrink-0 text-[12px] font-semibold text-black/45">
                    기한 {formatKoreaDateTime(detail.paymentDueAt)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[13px] font-medium leading-5 text-black/50">
                {/* ⚠️ 한 줄로 붙인다. 값 뒤에서 줄을 바꾸면 다음 텍스트 노드의 <b>선두 개행+들여쓰기가
                    통째로 버려져</b> 공백이 사라진다("1자리· 보냈어요"). 아래 「입금한{" "}」이 같은 이유다. */}
                {`입금 확인 ${c2cConfirmedCount}${countUnit} · 입금 대기 ${c2cAwaitingCount}${countUnit} · 보냈어요 ${c2cPaymentSentCount}${countUnit}`}
              </p>
              {/* 부분 확정은 미입금 활성 참여가 0이고 확정이 1건 이상일 때만 서버 CAS(confirmIfAllCollected)를
                  통과한다. 전원 입금이면 입금확인 경로에서 자동으로 CONFIRMED 가 되므로, 이 버튼이 실제로
                  필요한 것은 "입금 안 한 참여가 취소·제외로 정리된" 경우뿐이다. C2C 는 자동 만료가
                  없어 개최자가 직접 정리해야 이 조건이 성립한다. 누를 수 없는 동안에도
                  계속 보여서 개최자가 용도를 되묻게 됐으므로(docs/56 H-12) 조건이 맞을 때만 노출한다.
                  위 성사 확정 섹션이 disabled 유지인 것과 정책이 다른 이유: 성사 확정은 "신청자가 생기면
                  누르게 될 버튼"이라 자리를 예고하는 값이 있지만, 부분 확정은 정상 진행(전원 입금 → 자동
                  확정)에서는 끝까지 쓸 일이 없는 예외 경로라 평소에는 존재 자체가 질문거리가 된다. */}
              {canFinalizeCollected ? (
                <>
                  {/* 라벨은 "빼고"처럼 제외를 단정하지 않는다 — 최소 인원 미달 등으로 자동 CAS 가 돌지
                      않아 전원 입금 상태에서 이 버튼을 보게 되는 경우도 있다. 확인 시트 제목과 같은 문장. */}
                  <button
                    className="mt-3 h-12 w-full rounded-full bg-black text-[15px] font-semibold tracking-[-0.04em] text-[#D7FF5F] disabled:bg-black/15 disabled:text-black/35"
                    disabled={pendingC2CAction !== null}
                    onClick={requestFinalizeCollected}
                    type="button"
                  >
                    {pendingC2CAction === "finalize-collected"
                      ? "확정하는 중"
                      : `입금한 ${c2cConfirmedCount}${countUnit}로 진행 확정`}
                  </button>
                  <p className="mt-2 text-[12px] font-medium leading-5 text-black/40">
                    입금을 기다리는 참여가 더 없어요. 확정하면 입금한{" "}
                    {c2cConfirmedCount}
                    {countUnit}로 분철을 진행해요.
                  </p>
                </>
              ) : c2cUnpaidActiveCount > 0 ? (
                <p className="mt-2 text-[12px] font-medium leading-5 text-black/40">
                  입금을 확인하거나, 기한이 지난 미입금 참여를 직접 정리하면
                  입금한 사람만으로 진행을 확정할 수 있어요.
                </p>
              ) : (
                <p className="mt-2 text-[12px] font-medium leading-5 text-black/40">
                  입금 확인된 참여가 아직 없어요. 최소 1명을 확인해야 진행을
                  확정할 수 있어요.
                </p>
              )}
            </section>
          ) : null}

          {/* 입금 확인된 취소 참여는 활성 목록에서 빠져 환불 계좌에 닿을 길이 없어진다. C2C 전용이다 —
              LEGACY 는 환불 주체가 플랫폼이라 개최자에게 계좌를 보여주면 없는 의무를 만든다.
              ⚠️ 노출 조건이 cancelledParticipants 기준이다. refundTargetParticipants 로 좁히면
              취소분이 전부 「보냈어요만」일 때 섹션째 사라져 안내조차 안 나온다. */}
          {isC2C && cancelledParticipants.length > 0 ? (
            <section className="mt-6 rounded-[1.05rem] border border-black/10 bg-[#f7f7f7] px-4 py-4">
              <p className="text-[15px] font-semibold tracking-[-0.04em]">
                환불이 필요한 참여 {refundTargetParticipants.length}건
              </p>
              <p className="mt-1 text-[13px] font-medium leading-5 text-black/50">
                입금 확인된 취소 건이에요. 통장을 확인하고 아래 계좌로 환불해
                주세요.
              </p>
              <div className="mt-3 space-y-2">
                {refundTargetParticipants.map((participant) => (
                  <div
                    className="rounded-[0.85rem] bg-white px-3 py-3"
                    key={participant.participationId}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold tracking-[-0.04em]">
                          {/* 🔴 통장 대조가 필요한 섹션이라 닉네임이 아니라 <b>입금자명</b>을 쓴다 —
                            바로 위 문구가 "통장을 확인하고" 이고, getDepositorName 규약이
                            "확인 시트 문구와 목록 행이 반드시 같은 값" 을 요구한다. */}
                        {getDepositorName(participant)}
                        </p>
                        {/* 파서 최종 폴백이 리터럴 "멤버" 라 그대로 찍으면 의미 없는 줄이 된다. */}
                        {participant.memberName && participant.memberName !== "멤버" ? (
                          <p className="mt-0.5 truncate text-[12px] font-medium text-black/40">
                            {participant.memberName}
                          </p>
                        ) : null}
                        {/* 목록이 confirmedAt 로 좁혀져 있어 여기 오는 건 전부 확인된 건이다. */}
                        <p className="mt-1 text-[12px] font-semibold text-black/45">
                          입금 확인됨
                        </p>
                      </div>
                      <p className="shrink-0 text-[14px] font-semibold tabular-nums">
                        {formatWonAmount(participant.amount)}
                      </p>
                    </div>
                    {participant.refundAccount ? (
                      <p className="mt-1 break-all text-[13px] font-medium text-black/60">
                        {participant.refundAccount.bank}{" "}
                        {participant.refundAccount.account} (예금주:{" "}
                        {participant.refundAccount.holder})
                      </p>
                    ) : (
                      <p className="mt-1 text-[13px] font-medium text-black/35">
                        환불 계좌가 등록되어 있지 않아요.
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {sentButUnconfirmedCount > 0 ? (
                <p className="mt-3 text-[12px] font-medium leading-5 text-black/55">
                  입금 확인 전에 빠진 참여 {sentButUnconfirmedCount}건이 있어요.
                  보냈다고 표시했지만 확인되지 않은 건이라 계좌를 보여드리지
                  않아요 — 통장에 늦게 찍힌 이체가 있는지 확인해 주세요.
                </p>
              ) : null}
              {noTraceCancelledCount > 0 ? (
                <p className="mt-2 text-[12px] font-medium leading-5 text-black/40">
                  입금 전에 취소된 참여 {noTraceCancelledCount}건은 환불할 금액이
                  없어 여기 표시하지 않아요.
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="mt-6">
            <div className="mb-3">
              <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                {isC2C ? "참여자 관리" : "멤버별 참여 관리"}
              </h2>
              <p className="mt-1 text-[13px] font-medium text-black/40">
                {/* 리스트 모수는 취소를 뺀 활성 참여 전건(신청됨·입금 대기 포함)이라
                    "여기에 표시돼요"로 쓰면 안 된다 — 바뀌는 것은 존재가 아니라 상태다. */}
                {isC2C
                  ? "참여자가 '보냈어요'를 누르면 상태가 '보냈어요'로 바뀌어요. 입금자명으로 통장 내역을 대조해 확인하고, 입금 기한이 지난 참여는 '제외'로 정리할 수 있어요."
                  : "멤버마다 입금 확인 → 운송장 등록 순서로 처리해요."}
              </p>
            </div>

            <div className="space-y-3">
              {detail.options.length === 0 ? (
                <p className="rounded-[1rem] bg-[#f7f7f7] px-4 py-5 text-center text-[13px] font-semibold text-black/40">
                  옵션 정보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.
                </p>
              ) : isC2C && c2cBundles.length === 0 ? (
                <p className="rounded-[1rem] bg-[#f7f7f7] px-4 py-5 text-center text-[13px] font-semibold text-black/40">
                  아직 신청한 참여자가 없어요.
                </p>
              ) : isC2C ? (
                // 🔴 C2C 는 <b>묶음</b> 단위로 보여준다 — 「제외」·입금확인이 묶음 API 하나뿐이라,
                // 멤버 자리 줄에 버튼을 달면 "한 줄을 눌렀는데 그 사람 자리가 전부 빠지는" 화면이 된다.
                // 대신 자리 축(누가 남았나)이 흐려지므로 줄 안에 멤버명을 칩으로 나열한다 (docs/84 §3-5).
                c2cBundles.map((bundle) => {
                  const head = bundle.slots[0];
                  const depositorName = getDepositorName(head);
                  const isBundleConfirmed = bundle.slots.every(
                    (slot) =>
                      isParticipationConfirmedStatus(slot.status) ||
                      Boolean(slot.confirmedAt),
                  );
                  const isBundleSent = bundle.slots.some((slot) =>
                    isParticipationPaymentSentStatus(slot.status),
                  );
                  const isBundleAwaiting = bundle.slots.some((slot) =>
                    isParticipationAwaitingPaymentStatus(slot.status),
                  );
                  const isBundleApplied = bundle.slots.some((slot) =>
                    isParticipationAppliedStatus(slot.status),
                  );
                  // 🔴 확정 대상은 서버가 슬롯마다 내려주는 confirmTarget 이다. 화면이 상태로
                  // 재판정하면 서버가 가진 집합과 갈려 409(BCH-115)가 영구히 난다.
                  // 판정이 없는 구 응답에서는 입금 가능 상태로 폴백한다.
                  const confirmTargetIds = bundle.slots
                    .filter((slot) =>
                      typeof slot.confirmTarget === "boolean"
                        ? slot.confirmTarget
                        : isParticipationAwaitingPaymentStatus(slot.status) ||
                          isParticipationPaymentSentStatus(slot.status),
                    )
                    .map((slot) => slot.participationId);
                  // 슬롯마다 내려오는 값이라 전부 같아야 정상이지만, 갈리는 순간 "버튼은 열렸는데
                  // 409" 가 된다 — 전원이 RELEASABLE 일 때만 연다. 사유는 막힌 슬롯의 것을 쓴다.
                  const blockedSlot = bundle.slots.find(
                    (slot) => slot.releasability !== "RELEASABLE",
                  );
                  const canRelease = !blockedSlot && Boolean(bundle.bundleId);
                  // 🔴 막힌 자리가 있을 때만 사유를 만든다 — 「막힌 자리 없음」과 「판정값 없음」이
                  // 둘 다 undefined 라, 그냥 넘기면 제외 가능한 묶음에도 default 문구가 붙는다.
                  const releaseBlockedReason = !bundle.bundleId
                    ? // 7. 시트를 통과한 뒤 실패하지 않게 미리 알린다.
                      "묶음 정보가 없어 뺄 수 없어요. 고객센터로 문의해 주세요."
                    : blockedSlot
                      ? // 슬롯 필드는 optional 이라 undefined 가 올 수 있다. 「판정값 없음」은
                        // null 로 명시해 넘긴다 — 그게 default 문구가 나와야 하는 유일한 경우다.
                        getReleaseBlockedReason(blockedSlot.releasability ?? null)
                      : null;
                  const isBundleConfirming =
                    pendingC2CAction === `confirm:${bundle.key}`;
                  const isBundleReleasing =
                    pendingC2CAction === `release:${bundle.key}`;
                  const bundleTotal = bundle.slots.reduce(
                    (sum, slot) => sum + slot.amount,
                    0,
                  );
                  const bundleShippingFee = bundle.slots.reduce(
                    (sum, slot) =>
                      sum +
                      (typeof slot.shippingFee === "number"
                        ? slot.shippingFee
                        : 0),
                    0,
                  );
                  // 택배 1개 = 묶음 1개 — 배송은 묶음에 하나뿐이라 대표 슬롯에서 읽는다.
                  // 🔴 배송은 <b>deliveryId 로 중복 제거해 전건</b>을 낸다. 서버가 묶음당 1건으로
                  // 정리했지만(#166) 그 배포 전 데이터·롤아웃 순서에서는 슬롯마다 배송이 따로 온다.
                  // 첫 건만 그리면 두 번째 택배의 운송장을 등록할 UI 경로가 사라진다.
                  const bundleDeliveries: {
                    delivery: NonNullable<
                      BuncheolManagementParticipant["delivery"]
                    >;
                    ownerId: string;
                  }[] = [];

                  for (const slot of bundle.slots) {
                    // 배송 스냅샷은 신청 시점에 생기므로, 확정 전에는 지점명·연락처를 그리지 않는다.
                    // 판정은 묶음 전체가 아니라 배송을 문 슬롯 기준 — 전체로 보면 부분 확정 묶음에서
                    // 이미 확정된 자리의 운송장 입력칸까지 사라진다.
                    const isSlotConfirmed =
                      isParticipationConfirmedStatus(slot.status) ||
                      Boolean(slot.confirmedAt);

                    if (
                      !slot.delivery?.deliveryId ||
                      !isSlotConfirmed ||
                      bundleDeliveries.some(
                        (entry) =>
                          entry.delivery.deliveryId === slot.delivery?.deliveryId,
                      )
                    ) {
                      continue;
                    }

                    bundleDeliveries.push({
                      delivery: slot.delivery,
                      ownerId: slot.participationId,
                    });
                  }

                  const sentAtSlot = bundle.slots.find(
                    (slot) => slot.paymentSentAt,
                  );
                  const bundleTimeInfo =
                    isBundleSent && sentAtSlot?.paymentSentAt
                      ? ` · 보냈어요 ${formatKoreaDateTime(sentAtSlot.paymentSentAt)}`
                      : isBundleAwaiting && head.dueAt
                        ? ` · 기한 ${formatKoreaDateTime(head.dueAt)}`
                        : isBundleConfirmed && head.confirmedAt
                          ? ` · 확인 ${formatKoreaDateTime(head.confirmedAt)}`
                          : "";

                  return (
                    <article
                      className="overflow-hidden rounded-[1.05rem] border border-black/10 bg-white px-4 py-3.5 shadow-[0_10px_28px_rgba(0,0,0,0.035)]"
                      key={bundle.key}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {/* ⚠️ 값이 같으면 감춘다. 입금자명은 비면 닉네임으로 폴백하고(getDepositorName),
                              파서의 participantNickname 도 depositorName 을 별칭으로 흡수한다 — 그대로 두면
                              같은 이름이 두 줄 뜬다. */}
                          {head.participantNickname !== depositorName ? (
                            <p className="truncate text-[13px] font-semibold text-black/55">
                              <span className="mr-1.5 text-black/35">참여자</span>
                              {head.participantNickname}
                            </p>
                          ) : null}
                          <p className="mt-0.5 truncate text-[14px] font-semibold tracking-[-0.04em]">
                            입금자명 {depositorName}
                          </p>
                          <p className="mt-0.5 text-[12px] font-medium text-black/40">
                            {formatWonAmount(bundleTotal)}
                            {bundle.slots.length > 1
                              ? ` · 자리 ${bundle.slots.length}개`
                              : ""}
                            {bundleTimeInfo}
                          </p>
                          {/* 배송비는 묶음에 1회만 붙는다 — 합계만 보여주면 개최자가 통장 금액과
                              왜 다른지 설명할 수 없다 (docs/53 Q-22). */}
                          {bundleShippingFee > 0 ? (
                            <p className="mt-0.5 text-[11px] font-medium text-black/30">
                              {`상품 ${formatWonAmount(Math.max(bundleTotal - bundleShippingFee, 0))} + 배송비 ${formatWonAmount(bundleShippingFee)}`}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            isBundleConfirmed
                              ? "bg-black text-white"
                              : isBundleSent
                                ? "bg-[#D7FF5F] text-black"
                                : "bg-[#eeeeee] text-black/60"
                          }`}
                        >
                          {isBundleConfirmed
                            ? "입금 확인 완료"
                            : isBundleSent
                              ? "보냈어요"
                              : isBundleAwaiting
                                ? "입금 대기"
                                : isBundleApplied
                                  ? "신청됨"
                                  : "확인 필요"}
                        </span>
                      </div>

                      {/* 묶음으로 접으면서 "어느 자리를 잡았나" 가 흐려진다 — 칩으로 되살린다. */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {bundle.slots.map((slot) => (
                          <span
                            className="rounded-full bg-[#f1f1f1] px-2 py-0.5 text-[11px] font-semibold text-black/55"
                            key={slot.participationId}
                          >
                            {getSlotMemberLabel(slot)}
                          </span>
                        ))}
                      </div>

                      {/* 상태 화이트리스트로 게이트하면 모르는 status(제외 직후 서버가 새 값을 주는 등)에서
                          버튼이 0개인 유령 줄이 남는다. 실제로 할 수 있는 것이 하나라도 있으면 연다. */}
                      {!isBundleConfirmed &&
                      (canRelease ||
                        releaseBlockedReason ||
                        confirmTargetIds.length > 0) ? (
                        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                          {/* 「제외」는 입금 기한이 지난 뒤에만 열린다 — 이체가 통장에 늦게 찍히는
                              일이 흔해, 기한 안에 뺄 수 있게 하면 정상 입금자를 빼는 사고가 난다
                              (docs/71 §8-1). 버튼을 감추지 않고 사유를 보여준다. */}
                          {releaseBlockedReason ? (
                            <p className="mr-auto text-[11px] font-medium leading-4 text-black/35">
                              {releaseBlockedReason}
                            </p>
                          ) : null}
                          <button
                            className="h-9 shrink-0 rounded-full border border-black/10 bg-white px-3 text-[12px] font-semibold text-black/55 disabled:border-black/[0.06] disabled:text-black/25"
                            disabled={!canRelease || pendingC2CAction !== null}
                            onClick={() => requestReleaseBundle(bundle)}
                            type="button"
                          >
                            {isBundleReleasing ? "빼는 중" : "제외"}
                          </button>
                          {confirmTargetIds.length > 0 ? (
                            <button
                              className="h-9 shrink-0 rounded-full bg-black px-3.5 text-[12px] font-semibold text-white disabled:bg-black/15 disabled:text-black/35"
                              disabled={pendingC2CAction !== null}
                              onClick={() =>
                                requestConfirmBundlePayment(
                                  bundle,
                                  confirmTargetIds,
                                )
                              }
                              type="button"
                            >
                              {isBundleConfirming ? "처리 중" : "입금 확인"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      {bundleDeliveries.length > 0 ? (
                        <div className="mt-3 space-y-3 border-t border-black/[0.06] pt-3">
                          {bundleDeliveries.map((entry) => {
                            const hasTracking = Boolean(
                              entry.delivery.trackingNumber,
                            );
                            // 자리 확정 여부는 위에서 이미 걸렀으므로 분철 확정만 남는다.
                            const canRegisterTracking =
                              detail.status === "CONFIRMED";
                            const isRegistering =
                              pendingC2CAction === `tracking:${entry.ownerId}`;
                            const trackingInput =
                              participantTrackingInputs[entry.ownerId] ?? "";

                            return (
                              <div key={entry.delivery.deliveryId}>
                                <p className="text-[12px] font-medium text-black/40">
                                  {[
                                    getShippingMethodLabel(
                                      entry.delivery.shippingMethod,
                                    ),
                                    entry.delivery.storeName,
                                    entry.delivery.receiverPhoneNumber,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                                {hasTracking ? (
                                  <p className="mt-1.5 text-[13px] font-semibold text-black/55">
                                    운송장 {entry.delivery.trackingNumber}
                                    {getDeliveryStatusLabel(
                                      entry.delivery.status,
                                    )
                                      ? ` · ${getDeliveryStatusLabel(entry.delivery.status)}`
                                      : ""}
                                  </p>
                                ) : (
                                  <div className="mt-2 flex gap-2">
                                    <input
                                      className="h-10 min-w-0 flex-1 rounded-[0.7rem] border border-black/10 px-3 text-[13px] outline-none placeholder:text-black/25 focus:border-black disabled:bg-black/[0.03]"
                                      disabled={!canRegisterTracking}
                                      inputMode="numeric"
                                      // 🔴 값을 updater 밖에서 먼저 꺼낸다. updater 는 React 가
                                      // 나중에 부르는데 그때 currentTarget 은 이미 null 이라
                                      // 렌더가 예외를 던지고, 그 재시도가 무한히 돌아 탭이 죽는다.
                                      onChange={(event) => {
                                        const trackingNumber =
                                          event.currentTarget.value;
                                        setParticipantTrackingInputs(
                                          (inputs) => ({
                                            ...inputs,
                                            [entry.ownerId]: trackingNumber,
                                          }),
                                        );
                                      }}
                                      // 버튼을 흐리기만 하면 개최자가 이유를 못 찾는다 — 「제외」와 같은 규칙.
                                      placeholder={
                                        canRegisterTracking
                                          ? "운송장 번호 입력"
                                          : "분철 진행 확정 후 등록 가능"
                                      }
                                      value={trackingInput}
                                    />
                                    <button
                                      className="h-10 shrink-0 rounded-full bg-black px-4 text-[13px] font-semibold text-white disabled:bg-black/15 disabled:text-black/35"
                                      disabled={
                                        !canRegisterTracking ||
                                        trackingInput.trim().length === 0 ||
                                        pendingC2CAction !== null
                                      }
                                      onClick={() =>
                                        void handleRegisterParticipantTracking(
                                          bundle.slots.find(
                                            (slot) =>
                                              slot.participationId ===
                                              entry.ownerId,
                                          ) ?? head,
                                        )
                                      }
                                      type="button"
                                    >
                                      {isRegistering ? "등록 중" : "등록"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                detail.options.map((option) => {
                const optionId = option.buncheolMemberId;
                const deliveryState = deliveryStates[optionId] ?? {
                  isShipped: false,
                  trackingNumber: option.winner?.trackingNumber ?? "",
                };
                const isPaymentAwaiting = isParticipationAwaitingPaymentStatus(
                  option.winner?.paymentStatus,
                );
                const isConfirming =
                  confirmingPaymentId === option.winner?.participationId;
                const shippingMethodLabel = getShippingMethodLabel(
                  option.winner?.shippingMethod,
                );
                const storeName = option.winner?.storeName ?? "";
                const receiverLabel = getWinnerReceiverLabel(option.winner);
                const deliveryStatusLabel = getDeliveryStatusLabel(
                  option.winner?.deliveryStatus,
                );
                const isPaymentConfirmed =
                  isParticipationConfirmedStatus(option.winner?.paymentStatus) ||
                  Boolean(option.winner?.paymentConfirmedAt);
                // 운송장 등록은 분철이 진행확정(CONFIRMED)된 뒤에만 가능하다 — 모집중 발송 후
                // 분철이 무산(최소 인원 미달 취소)되는 모순을 막는 서버 가드(DLV-009)와 동일 조건.
                // 중앙 confirmed 계열(PAID 등 동의어 포함)로 넓히지 않고 서버 가드와 같은
                // 정확한 CONFIRMED 비교를 의도적으로 유지한다.
                const isBuncheolConfirmedForShipping =
                  detail.status === "CONFIRMED";
                const canUseTrackingInput = Boolean(
                  option.winner?.deliveryId &&
                    isPaymentConfirmed &&
                    isBuncheolConfirmedForShipping,
                );
                const isRegisteringTracking =
                  registeringTrackingId === option.winner?.deliveryId;
                const hasRegisteredTrackingNumber = Boolean(
                  option.winner?.trackingNumber || deliveryState.isShipped,
                );
                const isPaymentDuePassed = isPastDateTime(
                  option.winner?.paymentDueAt,
                );
                const shouldShowPaymentRecord =
                  Boolean(option.winner) &&
                  (isPaymentAwaiting || isPaymentConfirmed);
                const optionPurchaseAmount = getHighestBidAmount(option);
                const paymentAmount = getWinnerBidAmount(option);
                const hasOrder = Boolean(option.winner);
                // 통장 대조용 이름 — 예금주 우선, 없으면 닉네임 (C2C 참여자 목록과 같은 규칙, docs/53 Q-18).
                // ⚠️ participationId 가 일치하는 참여만 쓴다. LEGACY 는 슬롯당 참여가 여러 건이라
                // participants[0] 은 낙찰자라는 보장이 없고, 그걸 폴백으로 쓰면 제3자의 실명 예금주가
                // "입금자명"에 찍힌다 — 대조를 틀리게 만들 뿐 아니라 실명 노출이다.
                const matchedParticipant = option.participants?.find(
                  (participant) =>
                    participant.participationId ===
                    option.winner?.participationId,
                );
                const optionDepositorName =
                  matchedParticipant?.depositorName ||
                  option.winner?.depositorName ||
                  null;
                const isTrackingRegistered = Boolean(
                  option.winner?.trackingNumber || deliveryState.isShipped,
                );
                const paymentStatusLabel = getPaymentStatusLabel(
                  option.winner ?? null,
                );
                const paymentStatusClass = isPaymentConfirmed
                  ? "bg-black text-white"
                  : hasOrder
                    ? "bg-[#eeeeee] text-black/60"
                    : "bg-[#f7f7f7] text-black/40";

                return (
                  <article
                    className={`overflow-hidden rounded-[1.05rem] border bg-white shadow-[0_10px_28px_rgba(0,0,0,0.035)] ${
                      hasOrder ? "border-black/10" : "border-dashed border-black/10"
                    }`}
                    key={optionId}
                  >
                    <div className="px-4 pb-4 pt-4">
                    <div className="flex items-start gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[1rem] bg-[#f1f1f1] ring-1 ring-black/[0.04]">
                        {option.memberImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt=""
                            className="h-full w-full object-cover"
                            src={option.memberImage}
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-semibold tracking-[-0.04em]">
                          {option.memberName || `멤버 ${option.memberId ?? optionId}`}
                        </p>
                        <p className="mt-1 text-[12px] font-medium text-black/40">
                          참여 {option.participationCount}명
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${paymentStatusClass}`}
                      >
                        {paymentStatusLabel}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-[1.15fr_0.85fr] gap-2">
                      {/* 읽기 전용 금액이라 검정 면을 쓰지 않는다 — 이 화면에서 검정은
                          기본 버튼·현재 선택을 뜻해서, 누를 수 있는 것처럼 보였다. */}
                      <div className="rounded-[0.9rem] bg-brand-pale px-3 py-3 ring-1 ring-[#E4F6A5]/70">
                        <p className="text-[11px] font-medium text-black/35">
                          상품 금액
                        </p>
                        <p className="mt-1 text-[17px] font-semibold tracking-[-0.04em]">
                          {formatWonAmount(optionPurchaseAmount)}
                        </p>
                      </div>
                      <div className="rounded-[0.9rem] bg-[#f7f7f7] px-3 py-3">
                        <p className="text-[11px] font-medium text-black/35">
                          참여
                        </p>
                        <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                          {option.participationCount}명
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                      <span
                        className={`rounded-full px-2 py-1.5 text-[11px] font-semibold ${
                          hasOrder
                            ? "bg-black text-white"
                            : "bg-[#f7f7f7] text-black/35"
                        }`}
                      >
                        참여
                      </span>
                      <span
                        className={`rounded-full px-2 py-1.5 text-[11px] font-semibold ${
                          isPaymentConfirmed
                            ? "bg-black text-white"
                            : "bg-[#f7f7f7] text-black/35"
                        }`}
                      >
                        입금 확인
                      </span>
                      <span
                        className={`rounded-full px-2 py-1.5 text-[11px] font-semibold ${
                          isTrackingRegistered
                            ? "bg-black text-white"
                            : "bg-[#f7f7f7] text-black/35"
                        }`}
                      >
                        배송 등록
                      </span>
                    </div>

                    </div>

                    <div className="border-t border-black/10 px-4 py-4">
                      {(
                        <>
                          {shouldShowPaymentRecord ? (
                            <div className="rounded-[0.9rem] border border-black/[0.06] bg-white px-3 py-3 shadow-[0_8px_20px_rgba(0,0,0,0.025)]">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium text-black/35">
                                    입금 확인
                                  </p>
                                  <div className="mt-2 space-y-1">
                                    <p className="text-[13px] font-semibold text-black/55">
                                      <span className="mr-2 text-black/35">
                                        참여자
                                      </span>
                                      {/* ⚠️ winner.depositorName 을 쓰면 안 된다. winner 파서는
                                          depositorName → … → participantNickname 순으로 읽는데,
                                          서버가 참여 레코드에 depositorName(실명 예금주)을 싣기 시작하면
                                          이 줄이 실명으로 바뀐다 — 라벨과 값이 어긋나고 바로 아래
                                          "입금자명"과 같은 값이 두 번 뜨며 닉네임이 화면에서 사라진다.
                                          이 줄은 닉네임 전용이다. */}
                                      {matchedParticipant?.participantNickname ??
                                        "-"}
                                    </p>
                                    {/* 통장에 찍히는 건 예금주명이라, 닉네임(참여자)만으로는 대조가 안 된다 (docs/53 Q-18).
                                        C2C 참여자 목록과 같은 규칙(예금주 우선)을 여기서도 보여준다. */}
                                    <p className="text-[13px] font-semibold text-black/55">
                                      <span className="mr-2 text-black/35">
                                        입금자명
                                      </span>
                                      {optionDepositorName ?? "-"}
                                    </p>
                                    <p className="text-[13px] font-semibold text-black/55">
                                      <span className="mr-2 text-black/35">
                                        입금액
                                      </span>
                                      {formatWonAmount(paymentAmount)}
                                    </p>
                                    <p className="text-[13px] font-semibold text-black/55">
                                      <span className="mr-2 text-black/35">
                                        {isPaymentConfirmed ? "확인" : "기한"}
                                      </span>
                                      {formatKoreaDateTime(
                                        isPaymentConfirmed
                                          ? option.winner?.paymentConfirmedAt
                                          : option.winner?.paymentDueAt,
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  className="h-10 shrink-0 rounded-full bg-black px-4 text-[13px] font-semibold text-white disabled:bg-black/10 disabled:text-black/30"
                                  disabled={
                                    !option.winner?.participationId ||
                                    isPaymentConfirmed ||
                                    isPaymentDuePassed ||
                                    isConfirming
                                  }
                                  onClick={() => void confirmPayment(option)}
                                  type="button"
                                >
                                  {isPaymentConfirmed
                                    ? "입금 확인 완료"
                                    : isConfirming
                                      ? "확인 중"
                                      : "입금 확인"}
                                </button>
                              </div>
                              {/* "확인 시각 …" 줄을 뺐다 — 바로 위 "확인 …" 이 같은
                                  paymentConfirmedAt 을 이미 보여주고 있어, 입금 확인이
                                  끝난 건마다 같은 시각이 두 줄 연속으로 찍혔다. */}
                            </div>
                          ) : (
                            <div className="rounded-[0.85rem] bg-[#f7f7f7] px-3 py-3">
                              <p className="text-[11px] font-medium text-black/35">
                                입금 확인
                              </p>
                              <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em] text-black/55">
                                {option.winner
                                  ? isPaymentDuePassed
                                    ? "입금 기한이 지났어요."
                                    : "참여자 입금을 기다리고 있어요."
                                  : "아직 참여자가 없어요."}
                              </p>
                              {option.winner?.paymentDueAt ? (
                                <p className="mt-1 text-[12px] font-medium text-black/35">
                                  기한{" "}
                                  {formatKoreaDateTime(
                                    option.winner.paymentDueAt,
                                  )}
                                </p>
                              ) : null}
                            </div>
                          )}

                          {isPaymentConfirmed ? (
                            <>
                              <div className="mt-3 rounded-[0.85rem] bg-black/[0.04] px-3 py-3">
                                <p className="text-[11px] font-medium text-black/35">
                                  배송 정보
                                </p>
                                {shippingMethodLabel || storeName ? (
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {shippingMethodLabel ? (
                                      <span className="inline-flex h-8 items-center rounded-full bg-black px-3 text-[12px] font-semibold text-white">
                                        {shippingMethodLabel}
                                      </span>
                                    ) : null}
                                    {storeName ? (
                                      <span className="text-[15px] font-semibold tracking-[-0.04em] text-black">
                                        {storeName}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : (
                                  <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em] text-black/55">
                                    배송 정보가 아직 내려오지 않았어요.
                                  </p>
                                )}
                                {receiverLabel ? (
                                  <p className="mt-3 text-[13px] font-semibold text-black/45">
                                    연락처 {receiverLabel}
                                  </p>
                                ) : null}
                                {deliveryStatusLabel ? (
                                  <p className="mt-2 text-[12px] font-medium text-black/35">
                                    {deliveryStatusLabel}
                                  </p>
                                ) : null}
                              </div>

                              <label className="mt-3 block">
                                <span className="text-[12px] font-semibold text-black/45">
                                  운송장 번호
                                </span>
                                <input
                                  className="mt-2 h-12 w-full rounded-[0.85rem] border border-black/10 bg-white px-4 text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black disabled:bg-[#f7f7f7] disabled:text-black/35"
                                  disabled={
                                    hasRegisteredTrackingNumber ||
                                    !canUseTrackingInput ||
                                    isRegisteringTracking
                                  }
                                  inputMode="numeric"
                                  onChange={(event) =>
                                    updateTrackingNumber(
                                      optionId,
                                      event.currentTarget.value,
                                    )
                                  }
                                  placeholder={
                                    canUseTrackingInput
                                      ? "운송장 번호 입력"
                                      : isBuncheolConfirmedForShipping
                                        ? "배송 ID 확인 중"
                                        : "분철 진행 확정 후 등록 가능"
                                  }
                                  value={deliveryState.trackingNumber}
                                />
                              </label>

                              <button
                                type="button"
                                className="mt-3 h-12 w-full rounded-full bg-black text-[15px] font-semibold tracking-[-0.04em] text-white disabled:bg-black/15 disabled:text-black/35"
                                disabled={
                                  hasRegisteredTrackingNumber ||
                                  !canUseTrackingInput ||
                                  isRegisteringTracking ||
                                  deliveryState.trackingNumber.trim().length === 0
                                }
                                onClick={() => void completeShipping(option)}
                              >
                                {hasRegisteredTrackingNumber
                                  ? "운송장 등록 완료"
                                  : isRegisteringTracking
                                    ? "등록 중"
                                    : "운송장 등록"}
                              </button>
                            </>
                          ) : null}
                        </>
                      )}
                    </div>
                  </article>
                );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {openChatUrlDraft !== null ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-4 backdrop-blur-[2px]">
          <div className="w-full max-w-[402px] rounded-[1.2rem] bg-white px-5 pb-5 pt-5">
            <p className="text-[16px] font-semibold tracking-[-0.04em]">
              오픈채팅 링크
            </p>
            <p className="mt-1 break-keep text-[13px] font-medium leading-5 text-black/50">
              카카오 오픈채팅 주소를 붙여 넣어 주세요. 비우고 저장하면 링크가
              지워져요.
            </p>
            <input
              aria-invalid={openChatUrlError ? true : undefined}
              aria-label="오픈채팅 링크"
              autoFocus
              className="mt-3 h-12 w-full rounded-[0.9rem] border border-black/10 px-4 text-[15px] tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
              inputMode="url"
              maxLength={200}
              onChange={(event) => {
                setOpenChatUrlDraft(event.currentTarget.value);
                setOpenChatUrlError("");
              }}
              placeholder="https://open.kakao.com/o/..."
              type="url"
              value={openChatUrlDraft}
            />
            {openChatUrlError ? (
              <p className="mt-2 text-[12px] font-semibold text-danger-base">
                {openChatUrlError}
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="h-12 rounded-full bg-[#f4f4f4] text-[15px] font-semibold text-black/55 disabled:text-black/25"
                disabled={isSavingOpenChatUrl}
                onClick={() => {
                  setOpenChatUrlDraft(null);
                  setOpenChatUrlError("");
                }}
                type="button"
              >
                취소
              </button>
              <button
                className="h-12 rounded-full bg-[#CFE86B] text-[15px] font-semibold text-black disabled:bg-black/20 disabled:text-white"
                disabled={isSavingOpenChatUrl}
                onClick={saveOpenChatUrl}
                type="button"
              >
                {isSavingOpenChatUrl ? "저장 중" : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmSheet
        onCancel={() => setConfirmSheetRequest(null)}
        request={confirmSheetRequest}
      />
    </main>
  );
}
