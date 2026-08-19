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
  rejectParticipationPaymentSent,
  requestBuncheolDetail,
  requestBuncheolManagement,
  requestDeliveryTrackingRegistration,
  requestPaymentConfirmation,
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
  isBuncheolConfirmedStatus,
  isBuncheolPaymentCollectingStatus,
  isBuncheolRecruitingStatus,
  isParticipationAppliedStatus,
  isParticipationAwaitingPaymentStatus,
  isParticipationCancelledStatus,
  isParticipationConfirmedStatus,
  isParticipationPaymentSentStatus,
} from "@/lib/buncheol-states";
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
  const refundTargetParticipants = cancelledParticipants.filter(
    (participant) =>
      Boolean(participant.confirmedAt) || Boolean(participant.paymentSentAt),
  );
  const unpaidCancelledCount =
    cancelledParticipants.length - refundTargetParticipants.length;
  const minHeadcount = detail?.minHeadcount ?? 0;
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
  const activeC2CParticipants = (detail?.participants ?? []).filter(
    (participant) => !isParticipationCancelledStatus(participant.status),
  );
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
  // 서버가 참여자를 최상위 participants 로만 내려주는 응답 대비 — 옵션 중첩분과 머지한다.
  const c2cParticipantsByOptionId = getParticipantsByOptionId(
    activeC2CParticipants,
  );
  // 옵션 id 공간이 어긋나 어느 카드에도 못 실린 참여 — 집계에는 잡히는데 리스트에서
  // 사라지면 개최자가 액션을 못 하므로 경고로 드러낸다.
  const c2cUnmatchedParticipantCount = activeC2CParticipants.filter(
    (participant) =>
      !participant.buncheolMemberId ||
      !(detail?.options ?? []).some(
        (option) => option.buncheolMemberId === participant.buncheolMemberId,
      ),
  ).length;
  // C2C 배송 집계는 winner(대표 1명)가 아닌 활성 참여 전건 기준. 배송 스냅샷은 입금 전에도
  // 생기므로(참여 생성 시 배송지 전송) 입금 확인 완료 건만 "운송장 대기"로 센다 — 행 렌더와 동일 조건.
  const c2cDeliveryReadyCount = activeC2CParticipants.filter(
    (participant) =>
      (isParticipationConfirmedStatus(participant.status) ||
        Boolean(participant.confirmedAt)) &&
      Boolean(participant.delivery?.deliveryId) &&
      !participant.delivery?.trackingNumber,
  ).length;
  const c2cTrackingCompletedCount = activeC2CParticipants.filter((participant) =>
    Boolean(participant.delivery?.trackingNumber),
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
        ? `최소 진행 인원 ${minHeadcount}명 중 ${applicantCount}명만 신청했어요. 미달인 채로 확정하면 신청자 전원에게 입금 안내 알림톡이 발송돼요.`
        : `신청자 ${applicantCount}명 전원에게 입금 계좌와 24시간 기한이 담긴 알림톡이 발송돼요.`,
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
        `성사를 확정했어요. ${result.awaitingCount ?? applicantCount}명에게 입금 안내가 발송됐어요.`,
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
      title: `입금한 ${c2cConfirmedCount}명으로 진행할까요?`,
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

  // C2C 참여 단위 입금확인 — 입금 대기·보냈어요 모두 대상 (docs/46 §4.3).
  async function handleConfirmC2CPayment(
    participant: BuncheolManagementParticipant,
  ) {
    if (pendingC2CAction) {
      return;
    }

    setPendingC2CAction(`confirm:${participant.participationId}`);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        setMessage("로그인이 만료됐어요. 다시 로그인해 주세요.");
        return;
      }

      await requestPaymentConfirmation(accessToken, participant.participationId, {
        ignoreConflict: true,
      });
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

  // C2C 미입금 반려 — 보냈어요 해제 + 기한 +24h 연장 + 재확인 알림톡 (docs/46 §4.5).
  function requestRejectPaymentSent(
    participant: BuncheolManagementParticipant,
  ) {
    if (pendingC2CAction) {
      return;
    }

    const depositorName =
      participant.refundAccount?.holder || participant.participantNickname;

    setConfirmSheetRequest({
      confirmLabel: "표시 해제",
      // 개최자가 반려를 "취소"로 오해하는 걸 막는다 — 실제로는 참여가 유지된 채 기한만 늘어난다 (docs/54 1-7).
      description: `취소가 아니에요. ${depositorName}님에게 재확인을 요청하고 기한이 24시간 연장돼요.`,
      onConfirm: () => {
        setConfirmSheetRequest(null);
        void runRejectPaymentSent(participant);
      },
      title: "'보냈어요' 표시를 해제할까요?",
    });
  }

  async function runRejectPaymentSent(
    participant: BuncheolManagementParticipant,
  ) {
    if (pendingC2CAction) {
      return;
    }

    setPendingC2CAction(`reject:${participant.participationId}`);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        setMessage("로그인이 만료됐어요. 다시 로그인해 주세요.");
        return;
      }

      await rejectParticipationPaymentSent(
        accessToken,
        participant.participationId,
      );
      await reloadManagementDetail(accessToken);
      setMessage("보냈어요 표시를 해제하고 재확인 안내를 보냈어요.");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "반려를 처리하지 못했어요.",
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
                  {`${participantCount}\uba85`}
                </p>
              </div>
              <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  {"\uc785\uae08 \ub300\uae30"}
                </p>
                <p className="mt-1 text-[15px] font-semibold">
                  {`${isC2C ? c2cAwaitingCount : awaitingPaymentCount}\uba85`}
                </p>
              </div>
              {isC2C ? (
                <>
                  <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                    <p className="text-[11px] font-medium text-black/35">
                      {"\uc2e0\uccad"}
                    </p>
                    <p className="mt-1 text-[15px] font-semibold">
                      {`${c2cAppliedCount}\uba85`}
                    </p>
                  </div>
                  <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                    <p className="text-[11px] font-medium text-black/35">
                      {"\ubcf4\ub0c8\uc5b4\uc694"}
                    </p>
                    <p className="mt-1 text-[15px] font-semibold">
                      {`${c2cPaymentSentCount}\uba85`}
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

          {isC2C && isBuncheolRecruitingStatus(detail.status) ? (
            <section className="mt-4 rounded-[1.05rem] border border-[#DDE7B8] bg-[#F7FAEE] px-4 py-4">
              <p className="text-[15px] font-semibold tracking-[-0.04em]">
                성사 확정
              </p>
              <p className="mt-1 text-[13px] font-medium leading-5 text-black/50">
                지금까지 신청 {c2cAppliedCount}명이에요. 확정하면 신청자
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
                입금 확인 {c2cConfirmedCount}명 · 입금 대기 {c2cAwaitingCount}명
                · 보냈어요 {c2cPaymentSentCount}명
              </p>
              {/* 부분 확정은 미입금 활성 참여가 0이고 확정이 1건 이상일 때만 서버 CAS(confirmIfAllCollected)를
                  통과한다. 전원 입금이면 입금확인 경로에서 자동으로 CONFIRMED 가 되므로, 이 버튼이 실제로
                  필요한 것은 "입금 안 한 참여가 취소·기한만료로 정리된" 경우뿐이다. 누를 수 없는 동안에도
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
                      : `입금한 ${c2cConfirmedCount}명으로 진행 확정`}
                  </button>
                  <p className="mt-2 text-[12px] font-medium leading-5 text-black/40">
                    입금을 기다리는 참여가 더 없어요. 확정하면 입금한{" "}
                    {c2cConfirmedCount}명으로 분철을 진행해요.
                  </p>
                </>
              ) : c2cUnpaidActiveCount > 0 ? (
                <p className="mt-2 text-[12px] font-medium leading-5 text-black/40">
                  입금을 확인하거나, 기한이 지나 자동 취소되면 입금한 사람만으로
                  진행을 확정할 수 있어요.
                </p>
              ) : (
                <p className="mt-2 text-[12px] font-medium leading-5 text-black/40">
                  입금 확인된 참여가 아직 없어요. 최소 1명을 확인해야 진행을
                  확정할 수 있어요.
                </p>
              )}
            </section>
          ) : null}

          {/* 입금 흔적이 있는 취소 참여는 활성 목록에서 빠져 환불 계좌에 닿을 길이 없어진다. C2C 전용이다 —
              LEGACY 는 환불 주체가 플랫폼이라 개최자에게 계좌를 보여주면 없는 의무를 만든다. */}
          {isC2C && refundTargetParticipants.length > 0 ? (
            <section className="mt-6 rounded-[1.05rem] border border-black/10 bg-[#f7f7f7] px-4 py-4">
              <p className="text-[15px] font-semibold tracking-[-0.04em]">
                환불이 필요한 참여 {refundTargetParticipants.length}건
              </p>
              <p className="mt-1 text-[13px] font-medium leading-5 text-black/50">
                입금 내역이 있는 취소 건이에요. 통장을 확인하고 아래 계좌로
                환불해 주세요.
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
                          {participant.participantNickname}
                        </p>
                        {/* 파서 최종 폴백이 리터럴 "멤버" 라 그대로 찍으면 의미 없는 줄이 된다. */}
                        {participant.memberName && participant.memberName !== "멤버" ? (
                          <p className="mt-0.5 truncate text-[12px] font-medium text-black/40">
                            {participant.memberName}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[12px] font-semibold text-black/45">
                          {participant.confirmedAt
                            ? "입금 확인됨"
                            : "입금 확인 전 · 보냈어요 표시만 있음"}
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
              {unpaidCancelledCount > 0 ? (
                <p className="mt-3 text-[12px] font-medium leading-5 text-black/40">
                  입금 전에 취소된 참여 {unpaidCancelledCount}건은 환불할 금액이
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
                  ? "참여자가 '보냈어요'를 누르면 상태가 '보냈어요'로 바뀌어요. 입금자명으로 통장 내역을 대조하고, 입금이 확인되지 않으면 '입금 못 찾음'으로 재확인을 요청할 수 있어요."
                  : "멤버마다 입금 확인 → 운송장 등록 순서로 처리해요."}
              </p>
            </div>

            <div className="space-y-3">
              {detail.options.length === 0 ? (
                <p className="rounded-[1rem] bg-[#f7f7f7] px-4 py-5 text-center text-[13px] font-semibold text-black/40">
                  옵션 정보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.
                </p>
              ) : isC2C ? (
                // C2C: 다슬롯이라 대표 참여자(winner)가 아닌 활성 참여 전건을 멤버별로 보여준다.
                detail.options.map((option) => {
                  // 파서(getBuncheolManagementDetailFromBody)가 최상위·옵션 중첩 참여자를
                  // participationId 기준으로 이미 합쳐 두므로, 활성 참여 그룹핑만 쓰면 된다.
                  const optionParticipants =
                    c2cParticipantsByOptionId[option.buncheolMemberId] ?? [];

                  return (
                    <article
                      className="overflow-hidden rounded-[1.05rem] border border-black/10 bg-white shadow-[0_10px_28px_rgba(0,0,0,0.035)]"
                      key={option.buncheolMemberId}
                    >
                      <div className="flex items-center gap-3 border-b border-black/[0.06] px-4 py-3">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[0.9rem] bg-[#f1f1f1] ring-1 ring-black/[0.04]">
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
                          <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                            {option.memberName ||
                              `멤버 ${option.memberId ?? option.buncheolMemberId}`}
                          </p>
                          <p className="mt-0.5 text-[12px] font-medium text-black/40">
                            참여 {optionParticipants.length}명
                          </p>
                        </div>
                      </div>

                      {optionParticipants.length === 0 ? (
                        <p className="px-4 py-4 text-[13px] font-medium text-black/35">
                          아직 신청한 참여자가 없어요.
                        </p>
                      ) : (
                        <div className="space-y-2 px-4 py-3">
                          {optionParticipants.map((participant) => {
                            const depositorName =
                              participant.refundAccount?.holder ||
                              participant.participantNickname;
                            const isRowConfirmed =
                              isParticipationConfirmedStatus(
                                participant.status,
                              ) || Boolean(participant.confirmedAt);
                            const isRowSent = isParticipationPaymentSentStatus(
                              participant.status,
                            );
                            const isRowAwaiting =
                              isParticipationAwaitingPaymentStatus(
                                participant.status,
                              );
                            const isRowApplied = isParticipationAppliedStatus(
                              participant.status,
                            );
                            const isRowConfirming =
                              pendingC2CAction ===
                              `confirm:${participant.participationId}`;
                            const isRowRejecting =
                              pendingC2CAction ===
                              `reject:${participant.participationId}`;
                            const isRowRegisteringTracking =
                              pendingC2CAction ===
                              `tracking:${participant.participationId}`;
                            const trackingInput =
                              participantTrackingInputs[
                                participant.participationId
                              ] ?? "";
                            const hasTracking = Boolean(
                              participant.delivery?.trackingNumber,
                            );
                            // 운송장 등록은 분철 진행 확정 후에만 — 서버 가드(DLV-009)와 동일한
                            // 정확한 CONFIRMED 비교를 의도적으로 유지한다.
                            const canRegisterTracking = Boolean(
                              participant.delivery?.deliveryId &&
                                isRowConfirmed &&
                                detail.status === "CONFIRMED",
                            );
                            const rowTimeInfo =
                              isRowSent && participant.paymentSentAt
                                ? ` · 보냈어요 ${formatKoreaDateTime(participant.paymentSentAt)}`
                                : isRowAwaiting && participant.dueAt
                                  ? ` · 기한 ${formatKoreaDateTime(participant.dueAt)}`
                                  : isRowConfirmed && participant.confirmedAt
                                    ? ` · 확인 ${formatKoreaDateTime(participant.confirmedAt)}`
                                    : "";

                            return (
                              <div
                                className="rounded-[0.85rem] border border-black/[0.08] px-3 py-3"
                                key={participant.participationId}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-[14px] font-semibold tracking-[-0.04em]">
                                      입금자명 {depositorName}
                                    </p>
                                    <p className="mt-0.5 text-[12px] font-medium text-black/40">
                                      {formatWonAmount(participant.amount)}
                                      {rowTimeInfo}
                                    </p>
                                    {/* 다슬롯은 배송비가 묶음 첫 슬롯에만 붙어 같은 사람의 두 참여 금액이 달라진다.
                                        합계만 보여주면 개최자가 통장 금액과 왜 다른지 설명할 수 없다 (docs/53 Q-22). */}
                                    {/* 배송비 0원은 다슬롯 묶음뿐 아니라 무료 배송 개최에서도 나온다.
                                        0원에 "다른 참여에 부과돼요"를 붙이면 없는 참여를 가리키므로,
                                        실제로 부과된 건에서만 내역을 쪼개 보여준다 (docs/53 Q-22). */}
                                    {typeof participant.shippingFee === "number" &&
                                    participant.shippingFee > 0 ? (
                                      <p className="mt-0.5 text-[11px] font-medium text-black/30">
                                        {`상품 ${formatWonAmount(Math.max(participant.amount - participant.shippingFee, 0))} + 배송비 ${formatWonAmount(participant.shippingFee)}`}
                                      </p>
                                    ) : null}
                                  </div>
                                  <span
                                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                      isRowConfirmed
                                        ? "bg-black text-white"
                                        : isRowSent
                                          ? "bg-[#D7FF5F] text-black"
                                          : "bg-[#eeeeee] text-black/60"
                                    }`}
                                  >
                                    {isRowConfirmed
                                      ? "입금 확인 완료"
                                      : isRowSent
                                        ? "보냈어요"
                                        : isRowAwaiting
                                          ? "입금 대기"
                                          : isRowApplied
                                            ? "신청됨"
                                            : "확인 필요"}
                                  </span>
                                </div>

                                {isRowSent || isRowAwaiting ? (
                                  <div className="mt-3 flex justify-end gap-2">
                                    {isRowSent ? (
                                      <button
                                        className="h-9 rounded-full border border-black/10 bg-white px-3 text-[12px] font-semibold text-black/55 disabled:text-black/25"
                                        disabled={pendingC2CAction !== null}
                                        onClick={() =>
                                          requestRejectPaymentSent(participant)
                                        }
                                        type="button"
                                      >
                                        {isRowRejecting
                                          ? "해제 중"
                                          : "입금 못 찾음"}
                                      </button>
                                    ) : null}
                                    <button
                                      className="h-9 rounded-full bg-black px-3.5 text-[12px] font-semibold text-white disabled:bg-black/15 disabled:text-black/35"
                                      disabled={pendingC2CAction !== null}
                                      onClick={() =>
                                        void handleConfirmC2CPayment(
                                          participant,
                                        )
                                      }
                                      type="button"
                                    >
                                      {isRowConfirming
                                        ? "처리 중"
                                        : "입금 확인"}
                                    </button>
                                  </div>
                                ) : null}

                                {isRowConfirmed && participant.delivery ? (
                                  <div className="mt-3 border-t border-black/[0.06] pt-3">
                                    <p className="text-[12px] font-medium text-black/40">
                                      {[
                                        getShippingMethodLabel(
                                          participant.delivery.shippingMethod,
                                        ),
                                        participant.delivery.storeName,
                                        participant.delivery
                                          .receiverPhoneNumber,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </p>
                                    {hasTracking ? (
                                      <p className="mt-1.5 text-[13px] font-semibold text-black/55">
                                        운송장{" "}
                                        {participant.delivery.trackingNumber}
                                        {getDeliveryStatusLabel(
                                          participant.delivery.status,
                                        )
                                          ? ` · ${getDeliveryStatusLabel(participant.delivery.status)}`
                                          : ""}
                                      </p>
                                    ) : (
                                      <div className="mt-2 flex gap-2">
                                        <input
                                          className="h-10 min-w-0 flex-1 rounded-[0.7rem] border border-black/10 px-3 text-[13px] outline-none placeholder:text-black/25 focus:border-black disabled:bg-black/[0.03]"
                                          disabled={!canRegisterTracking}
                                          inputMode="numeric"
                                          onChange={(event) => {
                                            const nextValue =
                                              event.currentTarget.value;

                                            setParticipantTrackingInputs(
                                              (current) => ({
                                                ...current,
                                                [participant.participationId]:
                                                  nextValue,
                                              }),
                                            );
                                          }}
                                          placeholder={
                                            canRegisterTracking
                                              ? "운송장 번호 입력"
                                              : "분철 진행 확정 후 등록 가능"
                                          }
                                          value={trackingInput}
                                        />
                                        <button
                                          className="h-10 shrink-0 rounded-full bg-black px-3.5 text-[12px] font-semibold text-white disabled:bg-black/15 disabled:text-black/35"
                                          disabled={
                                            !canRegisterTracking ||
                                            pendingC2CAction !== null ||
                                            trackingInput.trim().length === 0
                                          }
                                          onClick={() =>
                                            void handleRegisterParticipantTracking(
                                              participant,
                                            )
                                          }
                                          type="button"
                                        >
                                          {isRowRegisteringTracking
                                            ? "등록 중"
                                            : "운송장 등록"}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
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
                // holder 는 빈 문자열일 수 있어 ?? 가 아니라 || 로 폴백한다.
                const optionDepositorName =
                  option.participants?.find(
                    (participant) =>
                      participant.participationId ===
                      option.winner?.participationId,
                  )?.refundAccount?.holder ||
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
                                      {option.winner?.depositorName ?? "-"}
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
              {isC2C && c2cUnmatchedParticipantCount > 0 ? (
                <p className="rounded-[1rem] border border-[#F3C1C1] bg-[#fff2f2] px-4 py-3 text-[13px] font-medium leading-5 text-[#c03131]">
                  멤버 정보와 연결되지 않은 참여가{" "}
                  {c2cUnmatchedParticipantCount}건 있어요. 화면을 새로고침해도
                  계속 보이면 분철이지로 문의해 주세요.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <ConfirmSheet
        onCancel={() => setConfirmSheetRequest(null)}
        request={confirmSheetRequest}
      />
    </main>
  );
}
