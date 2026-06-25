"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { BackIcon } from "@/components/icons";
import {
  requestBuncheolDetail,
  requestBuncheolManagement,
  requestCloseBuncheol,
  requestDeliveryTrackingRegistration,
  requestPaymentConfirmation,
  requestPaymentExpiration,
  type BuncheolDetail,
  type BuncheolManagementDetail,
  type BuncheolManagementOption,
  type BuncheolManagementParticipant,
  type BuncheolManagementWinner,
} from "@/lib/auth-api";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
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

  return new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(date);
}

function isClosedBuncheol(detail: BuncheolManagementDetail) {
  if (detail.status && detail.status !== "RECRUITING") {
    return true;
  }

  const deadline = new Date(detail.deadline);

  return !Number.isNaN(deadline.getTime()) && deadline.getTime() <= Date.now();
}

function getHighestBidAmount(option: BuncheolManagementOption) {
  if (option.participationCount <= 0) {
    return 0;
  }

  return option.currentHighestBid ?? 0;
}

function getWinnerCount(option: BuncheolManagementOption) {
  return option.winner ? 1 : 0;
}

function getWinnerBidAmount(option: BuncheolManagementOption) {
  return option.winner?.paymentAmount ?? option.winner?.bidAmount ?? null;
}

function isPaymentConfirmedStatus(status: string | undefined) {
  return status === "CONFIRMED" || status === "PAYMENT_CONFIRMED";
}

function isPaymentAwaitingStatus(status: string | undefined) {
  return status === "AWAITING_PAYMENT" || status === "PENDING_PAYMENT";
}

function isPaymentReportedStatus(status: string | undefined) {
  return (
    status === "PAYMENT_REPORTED" ||
    status === "REPORTED" ||
    status === "PAID_REPORTED" ||
    status === "PAYMENT_REPORT" ||
    status === "PAYMENT_CONFIRMING" ||
    status === "CONFIRMATION_REQUESTED" ||
    status === "TRANSFER_REQUESTED"
  );
}

function hasPaymentReport(option: BuncheolManagementOption) {
  return Boolean(
    option.winner?.paymentReportedAt ||
      isPaymentReportedStatus(option.winner?.paymentStatus) ||
      isPaymentConfirmedStatus(option.winner?.paymentStatus),
  );
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

function getDeliveryStatusLabel(status: string | undefined) {
  if (!status || status === "SNAPSHOTTED") {
    return "";
  }

  if (status === "SHIPPING") {
    return "배송 중";
  }

  if (status === "DELIVERED") {
    return "배송 완료";
  }

  if (status === "RECEIVED") {
    return "수령 완료";
  }

  return status;
}

function getWinnerReceiverLabel(
  winner: BuncheolManagementWinner | null | undefined,
) {
  return winner?.receiverPhoneNumber ?? "";
}

function getPaymentStatusLabel(winner: BuncheolManagementWinner | null) {
  if (!winner) {
    return "참여 전";
  }

  if (winner.paymentConfirmedAt || isPaymentConfirmedStatus(winner.paymentStatus)) {
    return "입금 확인 완료";
  }

  if (hasPaymentReport({ winner } as BuncheolManagementOption)) {
    return "입금 신고 도착";
  }

  return "입금 대기";
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
      isPaymentAwaitingStatus(participant.status),
    ) ??
    participants.find((participant) =>
      isPaymentConfirmedStatus(participant.status),
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
  const [expiringPaymentId, setExpiringPaymentId] = useState<string | null>(
    null,
  );
  const [registeringTrackingId, setRegisteringTrackingId] = useState<
    string | null
  >(null);
  const [isClosingBuncheol, setIsClosingBuncheol] = useState(false);
  const [deliveryStates, setDeliveryStates] = useState<
    Record<string, DeliveryState>
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
        router.replace(`/login?returnTo=${encodeURIComponent(returnHref)}`);
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
        setMessage(
          error instanceof Error
            ? error.message
            : "개최한 분철 정보를 불러오지 못했어요.",
        );
      });

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, authState.isLoggedIn, id, router]);

  const isClosed = detail ? isClosedBuncheol(detail) : false;
  const memberCount = detail?.optionCount ?? detail?.options.length ?? 0;
  const participantCount =
    detail?.totalParticipationCount ??
    detail?.options.reduce(
      (total, option) => total + option.participationCount,
      0,
    ) ??
    0;

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

  async function closeBuncheol() {
    if (isClosed || isClosingBuncheol) {
      return;
    }

    setIsClosingBuncheol(true);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        return;
      }

      await requestCloseBuncheol(accessToken, id);
      const nextDetail = await requestHostedBuncheolManagement(accessToken, id);

      setDetail(nextDetail);
      setMessage("분철 모집을 마감했어요.");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "분철 모집을 마감하지 못했어요.",
      );
    } finally {
      setIsClosingBuncheol(false);
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

  async function expirePayment(option: BuncheolManagementOption) {
    const participationId = option.winner?.participationId;

    if (!option.winner || expiringPaymentId) {
      return;
    }

    if (!participationId) {
      setMessage("만료시킬 참여자 참여 ID가 없어요.");
      return;
    }

    if (
      !window.confirm(
        "이 참여자를 미입금 만료 처리하고 차순위 참여자로 승계할까요?",
      )
    ) {
      return;
    }

    setExpiringPaymentId(participationId);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        return;
      }

      await requestPaymentExpiration(accessToken, participationId);
      const nextDetail = await requestHostedBuncheolManagement(accessToken, id);

      setDetail(nextDetail);
      setMessage("미입금 참여자를 만료 처리하고 차순위 참여자를 반영했어요.");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "차순위 참여자 승계를 처리하지 못했어요.",
      );
    } finally {
      setExpiringPaymentId(null);
    }
  }

  if (!detail) {
    return (
      <main className="system-chrome-white system-chrome-bottom-white flex h-[100dvh] items-center justify-center bg-white px-6 text-center">
        <p className="text-[15px] font-semibold text-black/45">{message}</p>
      </main>
    );
  }

  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] bg-white">
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
              <p className="text-[12px] font-semibold text-black/35">
                개최 분철 관리
              </p>
              <h1 className="truncate text-[22px] font-semibold tracking-[-0.06em]">
                {detail.title}
              </h1>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
          {message ? (
            <p className="mb-3 rounded-[0.8rem] bg-black/[0.04] px-3 py-2 text-[12px] font-semibold text-black/45">
              {message}
            </p>
          ) : null}

          <section className="rounded-[1rem] border border-black/10 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-black/40">
                  {detail.groupName}
                </p>
                <p className="mt-1 truncate text-[19px] font-semibold tracking-[-0.05em]">
                  {detail.purchaseSite || "구매처 미입력"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold ${
                  isClosed ? "bg-[#f1f1f1] text-black/55" : "bg-black text-white"
                }`}
              >
                {isClosed ? "마감" : "모집중"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">옵션</p>
                <p className="mt-1 text-[15px] font-semibold">{memberCount}개</p>
              </div>
              <div className="rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">참여</p>
                <p className="mt-1 text-[15px] font-semibold">
                  {participantCount}명
                </p>
              </div>
              <div className="col-span-2 rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">마감</p>
                <p className="mt-1 whitespace-nowrap text-[15px] font-semibold tracking-[-0.04em]">
                  {formatKoreaDateTime(detail.deadline)}
                </p>
              </div>
            </div>
            {!isClosed ? (
              <button
                className="mt-3 h-11 w-full rounded-full bg-black text-[14px] font-semibold tracking-[-0.04em] text-white disabled:bg-black/15 disabled:text-black/35"
                disabled={isClosingBuncheol}
                onClick={() => void closeBuncheol()}
                type="button"
              >
                {isClosingBuncheol ? "마감 처리 중" : "분철 수동 마감"}
              </button>
            ) : null}
          </section>

          <section className="mt-6">
            <div className="mb-3">
              <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                옵션별 참여 현황
              </h2>
              <p className="mt-1 text-[13px] font-medium text-black/40">
                참여자 입금 상태와 배송 정보를 확인해요.
              </p>
            </div>

            <div className="space-y-3">
              {detail.options.length === 0 ? (
                <p className="rounded-[1rem] bg-[#f7f7f7] px-4 py-5 text-center text-[13px] font-semibold text-black/40">
                  옵션 정보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.
                </p>
              ) : (
                detail.options.map((option) => {
                const optionId = option.buncheolMemberId;
                const deliveryState = deliveryStates[optionId] ?? {
                  isShipped: false,
                  trackingNumber: option.winner?.trackingNumber ?? "",
                };
                const winnerCount = getWinnerCount(option);
                const hasNextWinnerCandidate =
                  option.participationCount > winnerCount;
                const paymentReportedAt = option.winner?.paymentReportedAt;
                const hasPaymentReportValue = hasPaymentReport(option);
                const isConfirming =
                  confirmingPaymentId === option.winner?.participationId;
                const isExpiring =
                  expiringPaymentId === option.winner?.participationId;
                const winnerBidAmount = getWinnerBidAmount(option);
                const shippingMethodLabel = getShippingMethodLabel(
                  option.winner?.shippingMethod,
                );
                const storeName = option.winner?.storeName ?? "";
                const receiverLabel = getWinnerReceiverLabel(option.winner);
                const deliveryStatusLabel = getDeliveryStatusLabel(
                  option.winner?.deliveryStatus,
                );
                const isPaymentConfirmed =
                  isPaymentConfirmedStatus(option.winner?.paymentStatus) ||
                  Boolean(option.winner?.paymentConfirmedAt);
                const canUseTrackingInput = Boolean(
                  option.winner?.deliveryId && isPaymentConfirmed,
                );
                const isRegisteringTracking =
                  registeringTrackingId === option.winner?.deliveryId;
                const hasRegisteredTrackingNumber = Boolean(
                  option.winner?.trackingNumber || deliveryState.isShipped,
                );
                const canShowExpireAction = false && Boolean(
                  option.winner?.participationId &&
                    isPaymentAwaitingStatus(option.winner?.paymentStatus) &&
                    !hasPaymentReportValue &&
                    !isPaymentConfirmed,
                );
                const isPaymentDuePassed = isPastDateTime(
                  option.winner?.paymentDueAt,
                );
                const isExpirable = Boolean(
                  canShowExpireAction &&
                    hasNextWinnerCandidate &&
                    isPaymentDuePassed,
                );
                const shouldShowPaymentReport =
                  Boolean(option.winner) &&
                  (hasPaymentReportValue ||
                    isPaymentConfirmed ||
                    isPaymentAwaitingStatus(option.winner?.paymentStatus));

                return (
                  <article
                    className="rounded-[1rem] border border-black/10 px-4 py-4"
                    key={optionId}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[0.85rem] bg-[#f1f1f1]">
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
                          {option.memberName || `옵션 ${option.memberId ?? optionId}`}
                        </p>
                        <p className="mt-1 text-[12px] font-medium text-black/40">
                          참여 {option.participationCount}명
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#f7f7f7] px-3 py-1.5 text-[12px] font-semibold text-black/45">
                        {getPaymentStatusLabel(option.winner ?? null)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3">
                        <p className="text-[11px] font-medium text-black/35">
                          가격
                        </p>
                        <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                          {formatWonAmount(getHighestBidAmount(option))}
                        </p>
                      </div>
                      <div className="rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3">
                        <p className="text-[11px] font-medium text-black/35">
                          {isClosed ? "참여" : "참여 예정"}
                        </p>
                        <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                          {winnerCount}명
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-black/10 pt-4">
                      {isClosed ? (
                        <>
                          {shouldShowPaymentReport ? (
                            <div className="rounded-[0.85rem] bg-[#f7f7f7] px-3 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium text-black/35">
                                    입금 신고
                                  </p>
                                  <div className="mt-2 space-y-1">
                                    <p className="text-[13px] font-semibold text-black/55">
                                      <span className="mr-2 text-black/35">
                                        이름
                                      </span>
                                      {option.winner?.depositorName ?? "-"}
                                    </p>
                                    <p className="text-[13px] font-semibold text-black/55">
                                      <span className="mr-2 text-black/35">
                                        금액
                                      </span>
                                      {formatWonAmount(winnerBidAmount)}
                                    </p>
                                    <p className="text-[13px] font-semibold text-black/55">
                                      <span className="mr-2 text-black/35">
                                        일시
                                      </span>
                                      {paymentReportedAt
                                        ? formatKoreaDateTime(paymentReportedAt)
                                        : "-"}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  className="h-10 shrink-0 rounded-full bg-black px-4 text-[13px] font-semibold text-white disabled:bg-black/10 disabled:text-black/30"
                                  disabled={
                                    !option.winner?.participationId ||
                                    isPaymentConfirmed ||
                                    isConfirming
                                  }
                                  onClick={() => void confirmPayment(option)}
                                  type="button"
                                >
                                  {option.winner?.paymentConfirmedAt
                                    ? "확인 완료"
                                    : isConfirming
                                      ? "확인 중"
                                      : "입금 확인"}
                                </button>
                              </div>
                              {option.winner?.paymentConfirmedAt ? (
                                <p className="mt-2 text-[12px] font-medium text-black/40">
                                  확인 시각{" "}
                                  {formatKoreaDateTime(
                                    option.winner.paymentConfirmedAt,
                                  )}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <div className="rounded-[0.85rem] bg-[#f7f7f7] px-3 py-3">
                              <p className="text-[11px] font-medium text-black/35">
                                입금 신고
                              </p>
                              <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em] text-black/55">
                                {isPaymentDuePassed
                                  ? "구매자가 입금하지 않았어요."
                                  : "구매자 입금 신고를 기다리고 있어요."}
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

                          {canShowExpireAction ? (
                            <div className="mt-3">
                              <button
                                className="h-10 w-full rounded-full border border-black/10 bg-white text-[13px] font-semibold tracking-[-0.04em] text-black/55 disabled:bg-black/5 disabled:text-black/25"
                                disabled={!isExpirable || isExpiring}
                                onClick={() => void expirePayment(option)}
                                type="button"
                              >
                                {!hasNextWinnerCandidate
                                  ? "차순위 참여자 없음"
                                  : isExpiring
                                    ? "승계 중"
                                    : "차순위 참여자로 승계"}
                              </button>
                              {hasNextWinnerCandidate && !isExpirable ? (
                                <p className="mt-2 text-center text-[11px] font-medium text-black/35">
                                  입금 기한이 지난 미입금 참여자만 승계할 수 있어요.
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          {shouldShowPaymentReport ? (
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
                                    입금 확인 후 배송지가 표시돼요.
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
                                      : "운송장 등록 API 대기"
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
                                {isRegisteringTracking
                                  ? "등록 중"
                                  : "운송장 입력 완료"}
                              </button>
                            </>
                          ) : null}
                        </>
                      ) : (
                        <div className="relative overflow-hidden rounded-[0.95rem]">
                          <div className="pointer-events-none select-none opacity-35">
                            <div className="rounded-[0.85rem] bg-[#f7f7f7] px-3 py-3">
                              <p className="text-[11px] font-medium text-black/35">
                                참여자 배송지
                              </p>
                              <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em] text-black/55">
                                마감 후 참여자 배송지가 표시돼요.
                              </p>
                            </div>

                            <label className="mt-3 block">
                              <span className="text-[12px] font-semibold text-black/45">
                                운송장 번호
                              </span>
                              <input
                                className="mt-2 h-12 w-full rounded-[0.85rem] border border-black/10 bg-white px-4 text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25"
                                disabled
                                placeholder="운송장 번호 입력"
                              />
                            </label>

                            <button
                              className="mt-3 h-12 w-full rounded-full bg-black/15 text-[15px] font-semibold tracking-[-0.04em] text-black/35"
                              disabled
                              type="button"
                            >
                              운송장 입력 완료
                            </button>
                          </div>

                          <div className="absolute inset-0 flex items-center justify-center rounded-[0.95rem] bg-white/30 backdrop-blur-[1px]">
                            <span className="inline-flex h-9 items-center justify-center rounded-full bg-black px-4 text-[13px] font-semibold tracking-[-0.04em] text-white shadow-[0_6px_16px_rgba(0,0,0,0.14)]">
                              마감 전이에요
                            </span>
                          </div>
                        </div>
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
    </main>
  );
}
