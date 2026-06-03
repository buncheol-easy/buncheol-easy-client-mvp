"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { BackIcon } from "@/components/icons";
import {
  requestBuncheolManagement,
  requestPaymentConfirmation,
  type BuncheolManagementDetail,
  type BuncheolManagementOption,
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

function formatWonAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "-";
  }

  return `${value.toLocaleString("ko-KR")}원`;
}

function formatKoreaDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${getPart("year")}년 ${getPart("month")}월 ${getPart(
    "day",
  )}일 ${getPart("hour")}시`;
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

function isPaymentConfirmedStatus(status: string | undefined) {
  return status === "CONFIRMED" || status === "PAYMENT_CONFIRMED";
}

function isPaymentReportedStatus(status: string | undefined) {
  return (
    status === "PAYMENT_REPORTED" ||
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

function isPaymentConfirmable(option: BuncheolManagementOption) {
  const paymentStatus = option.winner?.paymentStatus;

  return Boolean(
    option.winner?.participationId &&
      !option.winner.paymentConfirmedAt &&
      !isPaymentConfirmedStatus(paymentStatus) &&
      hasPaymentReport(option),
  );
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
  const [message, setMessage] = useState("개최 분철 정보를 불러오고 있어요.");
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(
    null,
  );
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

    requestBuncheolManagement(accessToken, id)
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
            : "개최 분철 정보를 불러오지 못했어요.",
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

  function updateTrackingNumber(memberId: string, trackingNumber: string) {
    setDeliveryStates((current) => ({
      ...current,
      [memberId]: {
        isShipped: current[memberId]?.isShipped ?? false,
        trackingNumber,
      },
    }));
  }

  function completeShipping(memberId: string) {
    setDeliveryStates((current) => ({
      ...current,
      [memberId]: {
        isShipped: true,
        trackingNumber: current[memberId]?.trackingNumber ?? "",
      },
    }));
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

      const confirmedAt = new Date().toISOString();

      setDetail((current) =>
        current
          ? {
              ...current,
              options: current.options.map((currentOption) =>
                currentOption.buncheolMemberId === option.buncheolMemberId
                  ? {
                      ...currentOption,
                      winner: currentOption.winner
                        ? {
                            ...currentOption.winner,
                            paymentConfirmedAt: confirmedAt,
                          }
                        : currentOption.winner,
                    }
                  : currentOption,
              ),
            }
          : current,
      );
      setMessage("입금 확인을 완료했어요.");
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
                  {detail.purchaseSite ?? "구매처 미입력"}
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
          </section>

          <section className="mt-6">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                  옵션별 입찰 현황
                </h2>
                <p className="mt-1 text-[13px] font-medium text-black/40">
                  현 최고가와 낙찰 인원을 확인해요.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {detail.options.map((option) => {
                const optionId = option.buncheolMemberId;
                const deliveryState = deliveryStates[optionId] ?? {
                  isShipped: false,
                  trackingNumber: option.winner?.trackingNumber ?? "",
                };
                const winnerCount = getWinnerCount(option);
                const paymentReportedAt = option.winner?.paymentReportedAt;
                const hasPaymentReportValue = hasPaymentReport(option);
                const isConfirmable = isPaymentConfirmable(option);
                const isConfirming =
                  confirmingPaymentId === option.winner?.participationId;

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
                          {option.memberName}
                        </p>
                        <p className="mt-1 text-[12px] font-medium text-black/40">
                          참여 {option.participationCount}명
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3">
                        <p className="text-[11px] font-medium text-black/35">
                          현 최고가
                        </p>
                        <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                          {formatWonAmount(getHighestBidAmount(option))}
                        </p>
                      </div>
                      <div className="rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3">
                        <p className="text-[11px] font-medium text-black/35">
                          {isClosed ? "낙찰" : "낙찰 예정"}
                        </p>
                        <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                          {winnerCount}명
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-black/10 pt-4">
                      {isClosed ? (
                        <>
                        <div className="rounded-[0.85rem] bg-[#f7f7f7] px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-black/35">
                                입금 요청
                              </p>
                              <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em] text-black">
                                {paymentReportedAt
                                  ? formatKoreaDateTime(paymentReportedAt)
                                  : hasPaymentReportValue
                                    ? "입금 완료 요청됨"
                                    : "입금 완료 요청 없음"}
                              </p>
                              {option.winner?.paymentAmount ? (
                                <p className="mt-1 text-[12px] font-semibold text-black/40">
                                  {formatWonAmount(option.winner.paymentAmount)}
                                </p>
                              ) : null}
                            </div>
                            <button
                              className="h-10 shrink-0 rounded-full bg-black px-4 text-[13px] font-semibold text-white disabled:bg-black/10 disabled:text-black/30"
                              disabled={!isConfirmable || isConfirming}
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

                        <div className="mt-3 rounded-[0.85rem] bg-[#f7f7f7] px-3 py-3">
                          <p className="text-[11px] font-medium text-black/35">
                            낙찰자 배송지
                          </p>
                          <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em] text-black/55">
                            배송지 정보는 API 연결 후 표시돼요.
                          </p>
                        </div>

                        <label className="mt-3 block">
                          <span className="text-[12px] font-semibold text-black/45">
                            운송장 번호
                          </span>
                          <input
                            className="mt-2 h-12 w-full rounded-[0.85rem] border border-black/10 bg-white px-4 text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                            disabled={deliveryState.isShipped}
                            inputMode="numeric"
                            onChange={(event) =>
                              updateTrackingNumber(
                                optionId,
                                event.currentTarget.value,
                              )
                            }
                            placeholder="운송장 번호 입력"
                            value={deliveryState.trackingNumber}
                          />
                        </label>

                        <button
                          type="button"
                          className="mt-3 h-12 w-full rounded-full bg-black text-[15px] font-semibold tracking-[-0.04em] text-white disabled:bg-black/15 disabled:text-black/35"
                          disabled={
                            deliveryState.isShipped ||
                            deliveryState.trackingNumber.trim().length === 0
                          }
                          onClick={() => completeShipping(optionId)}
                        >
                          {deliveryState.isShipped ? "발송 완료됨" : "발송 완료"}
                        </button>
                        </>
                      ) : (
                        <div className="relative overflow-hidden rounded-[0.95rem]">
                          <div className="pointer-events-none select-none opacity-35">
                            <div className="rounded-[0.85rem] bg-[#f7f7f7] px-3 py-3">
                              <p className="text-[11px] font-medium text-black/35">
                                낙찰자 배송지
                              </p>
                              <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em] text-black/55">
                                배송지 정보는 API 연결 후 표시돼요.
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
                              발송 완료
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
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
