"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { BackIcon } from "@/components/icons";
import {
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

function getBuncheolStatusLabel(detail: BuncheolManagementDetail) {
  if (detail.status === "CONFIRMED") {
    return "\uc9c4\ud589 \ud655\uc815";
  }

  if (detail.status === "CANCELLED" || detail.status === "CANCELED") {
    return "\ucde8\uc18c\ub428";
  }

  if (detail.status === "CLOSED") {
    return "\ubaa8\uc9d1 \uc885\ub8cc";
  }

  if (detail.status === "RECRUITING") {
    return "\ubaa8\uc9d1\uc911";
  }

  return detail.status;
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
    return "배송 완료";
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
    return "참여 없음";
  }

  if (winner.paymentConfirmedAt || isPaymentConfirmedStatus(winner.paymentStatus)) {
    return "입금 확인 완료";
  }

  if (isPaymentAwaitingStatus(winner.paymentStatus)) {
    return "입금 대기";
  }

  if (isPaymentReportedStatus(winner.paymentStatus)) {
    return "입금 확인 대기";
  }

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
  const [registeringTrackingId, setRegisteringTrackingId] = useState<
    string | null
  >(null);
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
      isPaymentConfirmedStatus(participant.status),
    ).length ??
    detail?.options.filter((option) =>
      isPaymentConfirmedStatus(option.winner?.paymentStatus),
    ).length ??
    0;
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
      isPaymentAwaitingStatus(option.winner?.paymentStatus),
    ).length ?? 0;
  const deliveryReadyCount =
    detail?.options.filter((option) => {
      const isPaymentConfirmed =
        isPaymentConfirmedStatus(option.winner?.paymentStatus) ||
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
                공동구매 운영
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

          <section className="overflow-hidden rounded-[1.05rem] border border-black/10 bg-white shadow-[0_14px_34px_rgba(0,0,0,0.045)]">
            <div className="bg-black px-4 py-4 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Group Buy
                  </p>
                  <p className="mt-1 truncate text-[20px] font-semibold tracking-[-0.06em]">
                    {detail.purchaseSite || "구매처 미입력"}
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-white/55">
                    {detail.groupName}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold ${
                    detail.status === "CONFIRMED"
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
                <p className="text-[11px] font-medium text-black/35">{"\uc635\uc158"}</p>
                <p className="mt-1 text-[15px] font-semibold">
                  {`${memberCount}\uac1c`}
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
                  {`${awaitingPaymentCount}\uba85`}
                </p>
              </div>
              <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  운송장 대기
                </p>
                <p className="mt-1 text-[15px] font-semibold">
                  {`${deliveryReadyCount}건`}
                </p>
              </div>
              <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  운송장 완료
                </p>
                <p className="mt-1 text-[15px] font-semibold">
                  {`${trackingCompletedCount}건`}
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

          <section className="mt-6">
            <div className="mb-3">
              <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                옵션별 주문 관리
              </h2>
              <p className="mt-1 text-[13px] font-medium text-black/40">
                공동구매 옵션별로 입금 확인과 운송장 등록을 이어서 처리해요.
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
                const isPaymentAwaiting = isPaymentAwaitingStatus(
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
                const isPaymentDuePassed = isPastDateTime(
                  option.winner?.paymentDueAt,
                );
                const shouldShowPaymentRecord =
                  Boolean(option.winner) &&
                  (isPaymentAwaiting ||
                    isPaymentConfirmed ||
                    hasPaymentReport(option));
                const optionPurchaseAmount = getHighestBidAmount(option);
                const paymentAmount = getWinnerBidAmount(option);
                const hasOrder = Boolean(option.winner);
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
                          {option.memberName || `옵션 ${option.memberId ?? optionId}`}
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
                      <div className="rounded-[0.9rem] bg-black px-3 py-3 text-white">
                        <p className="text-[11px] font-medium text-white/45">
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
                        주문
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
                                        주문자
                                      </span>
                                      {option.winner?.depositorName ?? "-"}
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
                                입금 확인
                              </p>
                              <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em] text-black/55">
                                {option.winner
                                  ? isPaymentDuePassed
                                    ? "입금 기한이 지났어요."
                                    : "주문자 입금을 기다리고 있어요."
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
                                      : "배송 ID 확인 중"
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
    </main>
  );
}
