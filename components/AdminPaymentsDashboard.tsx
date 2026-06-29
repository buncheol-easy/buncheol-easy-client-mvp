"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  requestBuncheolManagement,
  requestDeliveryTrackingRegistration,
  requestMyHostedBuncheols,
  requestPaymentConfirmation,
  type BankAccountInfo,
  type BuncheolManagementDelivery,
  type BuncheolManagementDetail,
  type BuncheolManagementOption,
} from "@/lib/auth-api";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
  writeAuthTokens,
} from "@/lib/auth-store";
import { getFreshAccessToken } from "@/lib/auth-session";

type AdminPaymentStatus =
  | "AWAITING_CONFIRMATION"
  | "CANCELLED"
  | "CONFIRMED"
  | "OTHER"
  | "REFUND_REQUIRED";
type VerificationKey = "amount" | "participant";
type VerificationState = Record<VerificationKey, boolean>;

type ActiveTestAccountResponse = {
  accountId?: string | null;
};

type SwitchTestAccountResponse = {
  accessToken?: string;
};

const adminHostTestAccountId = "user1";

type AdminPaymentRecord = {
  amount: number;
  buncheolId: string;
  buncheolStatus: string;
  buncheolTitle: string;
  confirmedAt?: string | null;
  delivery?: BuncheolManagementDelivery | null;
  deliveries: BuncheolManagementDelivery[];
  groupName: string;
  memberName: string;
  memberNames: string[];
  participantNickname: string;
  participationId: string;
  participationIds: string[];
  paymentDueAt?: string | null;
  rawStatus: string;
  refundAccount?: BankAccountInfo | null;
  status: AdminPaymentStatus;
};

function formatPrice(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

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

function getStatusLabel(status: AdminPaymentStatus) {
  if (status === "REFUND_REQUIRED") return "환불 필요";
  if (status === "CONFIRMED") return "결제 확인 완료";
  if (status === "AWAITING_CONFIRMATION") return "결제 확인 필요";
  if (status === "CANCELLED") return "취소됨";
  return "확인 제외";
}

function isAwaitingPaymentStatus(status: string) {
  return [
    "AWAITING_CONFIRMATION",
    "AWAITING_PAYMENT",
    "PENDING_PAYMENT",
    "PAYMENT_PENDING",
    "PENDING_CONFIRMATION",
    "WAITING_PAYMENT",
    "WAITING_CONFIRMATION",
  ].includes(status);
}

function isConfirmedPaymentStatus(status: string) {
  return ["CONFIRMED", "PAYMENT_CONFIRMED"].includes(status);
}

function isCancelledStatus(status: string) {
  return status === "CANCELLED" || status === "CANCELED";
}

function normalizePaymentStatus(
  status: string,
  buncheolStatus = "",
): AdminPaymentStatus {
  const normalizedStatus = status.trim().toUpperCase();
  const normalizedBuncheolStatus = buncheolStatus.trim().toUpperCase();

  if (
    isCancelledStatus(normalizedBuncheolStatus) &&
    isConfirmedPaymentStatus(normalizedStatus)
  ) {
    return "REFUND_REQUIRED";
  }

  if (isConfirmedPaymentStatus(normalizedStatus)) return "CONFIRMED";
  if (isAwaitingPaymentStatus(normalizedStatus)) return "AWAITING_CONFIRMATION";
  if (isCancelledStatus(normalizedStatus)) return "CANCELLED";
  return "OTHER";
}

function getBuncheolStatusLabel(status: string) {
  const normalizedStatus = status.trim().toUpperCase();
  const labels: Record<string, string> = {
    CANCELLED: "취소",
    CANCELED: "취소",
    CONFIRMED: "진행확정",
    FINISHED: "진행확정",
    RECRUITING: "모집중",
  };

  return labels[normalizedStatus] ?? (status || "-");
}

function getShippingMethodLabel(method: string | undefined) {
  if (method === "GS25_HALF") return "GS25 반값택배";
  if (method === "CU_HALF") return "CU 알뜰택배";
  return method || "배송 방식 미정";
}

function getDeliveryStatusLabel(status: string | undefined) {
  if (!status || status === "SNAPSHOTTED") return "운송장 입력 전";
  if (status === "SHIPPING") return "배송 중";
  if (status === "DELIVERED") return "배송 완료";
  if (status === "RECEIVED") return "배송 완료";
  return status;
}

function getRefundAccountLabel(refundAccount: BankAccountInfo | null | undefined) {
  if (!refundAccount?.account) return "-";

  return [refundAccount.bank, refundAccount.account, refundAccount.holder]
    .filter(Boolean)
    .join(" ");
}

function getUniqueValues(values: Array<string | undefined | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function getMemberSummary(memberNames: string[]) {
  if (memberNames.length === 0) return "-";
  if (memberNames.length === 1) return memberNames[0];

  return `${memberNames[0]} 외 ${memberNames.length - 1}개`;
}

function getSearchText(record: AdminPaymentRecord) {
  return [
    record.participationId,
    ...record.participationIds,
    record.buncheolId,
    record.buncheolTitle,
    record.groupName,
    record.memberName,
    ...record.memberNames,
    record.participantNickname,
    record.refundAccount?.account,
    record.refundAccount?.bank,
    record.refundAccount?.holder,
    record.delivery?.storeName,
    record.delivery?.trackingNumber,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getEmptyVerificationState(): VerificationState {
  return { amount: false, participant: false };
}

function getRecordSortTime(record: AdminPaymentRecord) {
  const source = record.confirmedAt ?? record.paymentDueAt;
  const time = source ? new Date(source).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function getPaymentGroupKey(record: AdminPaymentRecord) {
  return [
    record.buncheolId,
    record.participantNickname,
    record.refundAccount?.account ?? "",
    record.refundAccount?.holder ?? "",
    record.paymentDueAt ?? "",
    record.status,
  ].join("|");
}

function getDeliveryKey(delivery: BuncheolManagementDelivery) {
  return [
    delivery.deliveryId ?? "",
    delivery.shippingMethod ?? "",
    delivery.storeName ?? "",
    delivery.receiverNickname ?? "",
    delivery.receiverPhoneNumber ?? "",
  ].join("|");
}

function mergeDeliveries(records: AdminPaymentRecord[]) {
  const deliveries = records
    .flatMap((record) =>
      record.deliveries.length > 0
        ? record.deliveries
        : record.delivery
          ? [record.delivery]
          : [],
    )
    .filter((delivery): delivery is BuncheolManagementDelivery => Boolean(delivery));
  const deliveriesByKey = new Map<string, BuncheolManagementDelivery>();

  deliveries.forEach((delivery) => {
    deliveriesByKey.set(getDeliveryKey(delivery), delivery);
  });

  return [...deliveriesByKey.values()];
}

function mergeRawStatuses(records: AdminPaymentRecord[]) {
  const rawStatuses = getUniqueValues(records.map((record) => record.rawStatus));

  return rawStatuses.join(" / ");
}

function getRecordDeliveryIds(record: AdminPaymentRecord) {
  return getUniqueValues(record.deliveries.map((delivery) => delivery.deliveryId));
}

function getRecordTrackingTargetIds(record: AdminPaymentRecord) {
  return getRecordDeliveryIds(record);
}

function getTrackingBatchId(record: AdminPaymentRecord) {
  return getRecordTrackingTargetIds(record).join("|") || record.participationId;
}

function groupPaymentRecords(records: AdminPaymentRecord[]) {
  const recordsByGroup = new Map<string, AdminPaymentRecord[]>();

  records.forEach((record) => {
    const key = getPaymentGroupKey(record);
    const groupRecords = recordsByGroup.get(key) ?? [];

    groupRecords.push(record);
    recordsByGroup.set(key, groupRecords);
  });

  return [...recordsByGroup.values()].flatMap((groupRecords) => {
    const primaryRecord = groupRecords[0];

    if (!primaryRecord) {
      return [];
    }

    const memberNames = getUniqueValues(
      groupRecords.flatMap((record) => record.memberNames),
    );
    const participationIds = getUniqueValues(
      groupRecords.flatMap((record) => record.participationIds),
    );
    const deliveries = mergeDeliveries(groupRecords);

    return [
      {
        ...primaryRecord,
        amount: groupRecords.reduce((sum, record) => sum + record.amount, 0),
        confirmedAt: groupRecords.find((record) => record.confirmedAt)?.confirmedAt,
        deliveries,
        delivery: deliveries[0] ?? null,
        memberName: getMemberSummary(memberNames),
        memberNames,
        participationId: participationIds[0] ?? primaryRecord.participationId,
        participationIds,
        rawStatus: mergeRawStatuses(groupRecords),
      } satisfies AdminPaymentRecord,
    ];
  });
}

async function readAdminJsonResponse<T>(
  response: Response,
  fallbackMessage: string,
) {
  if (!response.ok) {
    throw new Error(fallbackMessage);
  }

  return (await response.json()) as T;
}

async function getActiveTestAccountId(accessToken: string) {
  const response = await fetch("/api/test-accounts/active", {
    cache: "no-store",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await readAdminJsonResponse<ActiveTestAccountResponse>(
    response,
    "테스트 계정 상태를 확인할 수 없어요.",
  );

  return data.accountId ?? null;
}

async function switchToAdminHostTestAccount() {
  const response = await fetch("/api/test-accounts", {
    body: JSON.stringify({ accountId: adminHostTestAccountId }),
    cache: "no-store",
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const data = await readAdminJsonResponse<SwitchTestAccountResponse>(
    response,
    "김판매 계정으로 전환할 수 없어요.",
  );

  if (!data.accessToken) {
    throw new Error("김판매 계정 토큰을 확인할 수 없어요.");
  }

  writeAuthTokens({ accessToken: data.accessToken });

  return data.accessToken;
}

async function getAdminDashboardAccessToken() {
  const accessToken = await getFreshAccessToken();

  if (!accessToken) {
    return null;
  }

  try {
    const activeAccountId = await getActiveTestAccountId(accessToken);

    if (activeAccountId === adminHostTestAccountId) {
      return accessToken;
    }

    return await switchToAdminHostTestAccount();
  } catch {
    return accessToken;
  }
}

function toDeliveryFromWinner(
  option: BuncheolManagementOption,
): BuncheolManagementDelivery | null {
  const winner = option.winner;

  if (!winner) return null;

  if (
    !winner.deliveryId &&
    !winner.shippingMethod &&
    !winner.storeName &&
    !winner.trackingNumber &&
    !winner.deliveryStatus
  ) {
    return null;
  }

  return {
    deliveryId: winner.deliveryId,
    receiverNickname: winner.receiverNickname,
    receiverPhoneNumber: winner.receiverPhoneNumber,
    shippingMethod: winner.shippingMethod,
    status: winner.deliveryStatus,
    storeName: winner.storeName,
    trackingNumber: winner.trackingNumber ?? null,
  };
}

function getRecordsFromManagementDetail(detail: BuncheolManagementDetail) {
  const participantRecords = detail.participants.map(
    (participant): AdminPaymentRecord => ({
      amount: participant.amount,
      buncheolId: detail.id,
      buncheolStatus: detail.status,
      buncheolTitle: detail.title,
      confirmedAt: participant.confirmedAt,
      delivery: participant.delivery,
      deliveries: participant.delivery ? [participant.delivery] : [],
      groupName: detail.groupName,
      memberName: participant.memberName,
      memberNames: [participant.memberName],
      participantNickname: participant.participantNickname,
      participationId: participant.participationId,
      participationIds: [participant.participationId],
      paymentDueAt: participant.dueAt,
      rawStatus: participant.status,
      refundAccount: participant.refundAccount,
      status: normalizePaymentStatus(participant.status, detail.status),
    }),
  );

  if (participantRecords.length > 0) return participantRecords;

  return detail.options.reduce<AdminPaymentRecord[]>((records, option) => {
    const winner = option.winner;

    if (!winner?.participationId) return records;

    const rawStatus =
      winner.paymentStatus ||
      (winner.paymentConfirmedAt ? "CONFIRMED" : "AWAITING_PAYMENT");
    const delivery = toDeliveryFromWinner(option);

    records.push({
      amount: winner.paymentAmount ?? winner.bidAmount ?? 0,
      buncheolId: detail.id,
      buncheolStatus: detail.status,
      buncheolTitle: detail.title,
      confirmedAt: winner.paymentConfirmedAt,
      delivery,
      deliveries: delivery ? [delivery] : [],
      groupName: detail.groupName,
      memberName: option.memberName,
      memberNames: [option.memberName],
      participantNickname:
        winner.depositorName ?? winner.receiverNickname ?? "참여자",
      participationId: winner.participationId,
      participationIds: [winner.participationId],
      paymentDueAt: winner.paymentDueAt,
      rawStatus,
      refundAccount: null,
      status: normalizePaymentStatus(rawStatus, detail.status),
    });

    return records;
  }, []);
}

function StatusBadge({
  compact = false,
  status,
}: {
  compact?: boolean;
  status: AdminPaymentStatus;
}) {
  const label = compact
    ? status === "REFUND_REQUIRED"
      ? "환불"
      : status === "CONFIRMED"
        ? "완료"
        : status === "AWAITING_CONFIRMATION"
          ? "대기"
          : status === "CANCELLED"
            ? "취소"
            : "기타"
    : getStatusLabel(status);

  return (
    <span
      className={`inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 text-[12px] font-semibold ${
        status === "REFUND_REQUIRED"
          ? "bg-[#fff1f0] text-[#c03131]"
          : status === "CONFIRMED"
          ? "bg-[#e8f5ef] text-[#237152]"
          : status === "AWAITING_CONFIRMATION"
            ? "bg-black text-white"
            : status === "CANCELLED"
              ? "bg-[#f1f1f1] text-black/55"
            : "bg-[#f1f1f1] text-black/45"
      }`}
    >
      {label}
    </span>
  );
}
export function AdminPaymentsDashboard() {
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const [records, setRecords] = useState<AdminPaymentRecord[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedParticipationId, setSelectedParticipationId] = useState("");
  const [verificationByParticipation, setVerificationByParticipation] =
    useState<Record<string, VerificationState>>({});
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("결제 건을 불러오고 있어요.");
  const [isLoading, setIsLoading] = useState(true);
  const [confirmingParticipationId, setConfirmingParticipationId] = useState<
    string | null
  >(null);
  const [registeringDeliveryId, setRegisteringDeliveryId] = useState<
    string | null
  >(null);

  const loadRecords = useCallback(async (successMessage?: string) => {
    setIsLoading(true);

    try {
      const accessToken = await getAdminDashboardAccessToken();

      if (!accessToken) {
        setRecords([]);
        setMessage("로그인 후 관리자 결제 건을 확인할 수 있어요.");
        return;
      }

      const hostedBuncheols = await requestMyHostedBuncheols(accessToken);

      if (hostedBuncheols.length === 0) {
        setRecords([]);
        setMessage(successMessage ?? "개최한 분철이 아직 없어요.");
        return;
      }

      const managementResults = await Promise.allSettled(
        hostedBuncheols.map((buncheol) =>
          requestBuncheolManagement(accessToken, buncheol.id),
        ),
      );
      const details = managementResults.reduce<BuncheolManagementDetail[]>(
        (nextDetails, result) => {
          if (result.status === "fulfilled") nextDetails.push(result.value);
          return nextDetails;
        },
        [],
      );
      const nextRecords = groupPaymentRecords(
        details.flatMap(getRecordsFromManagementDetail),
      );
      const failedCount = managementResults.filter(
        (result) => result.status === "rejected",
      ).length;

      setRecords(nextRecords);
      setSelectedParticipationId((current) =>
        nextRecords.some((record) => record.participationId === current)
          ? current
          : nextRecords[0]?.participationId ?? "",
      );

      if (failedCount > 0 && nextRecords.length > 0) {
        setMessage(`${failedCount}개 분철 관리 정보를 불러오지 못했어요.`);
      } else if (failedCount > 0) {
        setMessage("분철 관리 정보를 불러오지 못했어요.");
      } else if (nextRecords.length === 0) {
        setMessage(successMessage ?? "확인할 결제 건이 없어요.");
      } else {
        setMessage(successMessage ?? "");
      }
    } catch (error: unknown) {
      setRecords([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "결제 건을 불러오지 못했어요.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authState.isLoggedIn) {
      setIsLoading(false);
      setRecords([]);
      setMessage("로그인 후 관리자 결제 건을 확인할 수 있어요.");
      return;
    }

    void loadRecords();
  }, [authState.accessToken, authState.isLoggedIn, loadRecords]);

  const filteredRecords = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return records
      .filter((record) => !keyword || getSearchText(record).includes(keyword))
      .sort((left, right) => getRecordSortTime(right) - getRecordSortTime(left));
  }, [records, searchKeyword]);

  const selectedRecord =
    records.find(
      (record) => record.participationId === selectedParticipationId,
    ) ??
    filteredRecords[0] ??
    records[0] ??
    null;
  const pendingRecords = records.filter(
    (record) => record.status === "AWAITING_CONFIRMATION",
  );
  const confirmedRecords = records.filter(
    (record) => record.status === "CONFIRMED",
  );
  const refundRecords = records.filter(
    (record) => record.status === "REFUND_REQUIRED",
  );
  const pendingAmount = pendingRecords.reduce(
    (sum, record) => sum + record.amount,
    0,
  );
  const selectedVerification =
    selectedRecord && verificationByParticipation[selectedRecord.participationId]
      ? verificationByParticipation[selectedRecord.participationId]
      : getEmptyVerificationState();
  const selectedTrackingValue = selectedRecord
    ? (trackingInputs[selectedRecord.participationId] ??
      selectedRecord.delivery?.trackingNumber ??
      "")
    : "";
  const selectedTrackingTargetIds = selectedRecord
    ? getRecordTrackingTargetIds(selectedRecord)
    : [];
  const selectedTrackingBatchId = selectedRecord
    ? getTrackingBatchId(selectedRecord)
    : "";
  const selectedHasTrackingNumber = Boolean(
    selectedRecord?.deliveries.some((delivery) => delivery.trackingNumber),
  );
  const isSelectedPaymentConfirmed = selectedRecord?.status === "CONFIRMED";
  const shouldShowShippingSection =
    selectedRecord?.status === "AWAITING_CONFIRMATION" ||
    selectedRecord?.status === "CONFIRMED";
  const canConfirmSelectedPayment =
    Boolean(selectedRecord) &&
    selectedRecord?.status === "AWAITING_CONFIRMATION" &&
    Object.values(selectedVerification).every(Boolean) &&
    confirmingParticipationId !== selectedRecord?.participationId;
  const canRegisterTracking = Boolean(
    selectedTrackingTargetIds.length > 0 &&
      selectedTrackingValue.trim() &&
      registeringDeliveryId !== selectedTrackingBatchId,
  );
  const verificationItems: Array<{
    key: VerificationKey;
    label: string;
    value: string;
  }> = selectedRecord
    ? [
        {
          key: "participant",
          label: "참여자",
          value: selectedRecord.participantNickname,
        },
        {
          key: "amount",
          label: "입금 금액",
          value: formatPrice(selectedRecord.amount),
        },
      ]
    : [];

  function toggleVerification(participationId: string, key: VerificationKey) {
    setVerificationByParticipation((current) => {
      const currentState = current[participationId] ?? getEmptyVerificationState();

      return {
        ...current,
        [participationId]: {
          ...currentState,
          [key]: !currentState[key],
        },
      };
    });
  }

  async function confirmPayment(record: AdminPaymentRecord) {
    if (record.status !== "AWAITING_CONFIRMATION" || confirmingParticipationId) {
      return;
    }

    setConfirmingParticipationId(record.participationId);

    try {
      const accessToken = await getAdminDashboardAccessToken();

      if (!accessToken) {
        setMessage("로그인 후 입금 확인을 처리할 수 있어요.");
        return;
      }

      await Promise.all(
        record.participationIds.map((participationId) =>
          requestPaymentConfirmation(accessToken, participationId, {
            ignoreConflict: true,
          }),
        ),
      );
      await loadRecords("입금 확인이 완료됐어요.");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "입금 확인을 처리하지 못했어요.",
      );
    } finally {
      setConfirmingParticipationId(null);
    }
  }

  async function registerTrackingNumber(record: AdminPaymentRecord) {
    const trackingTargetIds = getRecordTrackingTargetIds(record);
    const trackingBatchId = getTrackingBatchId(record);
    const trackingNumber = (
      trackingInputs[record.participationId] ??
      record.delivery?.trackingNumber ??
      ""
    ).trim();

    if (trackingTargetIds.length === 0) {
      setMessage("운송장을 등록할 배송 ID가 없어요.");
      return;
    }

    if (!trackingNumber) {
      setMessage("운송장 번호를 입력해 주세요.");
      return;
    }

    setRegisteringDeliveryId(trackingBatchId);

    try {
      const accessToken = await getAdminDashboardAccessToken();

      if (!accessToken) {
        setMessage("로그인 후 운송장 번호를 등록할 수 있어요.");
        return;
      }

      for (const deliveryId of trackingTargetIds) {
        try {
          await requestDeliveryTrackingRegistration(
            accessToken,
            deliveryId,
            trackingNumber,
          );
        } catch (error: unknown) {
          throw new Error(
            error instanceof Error
              ? `배송 ID ${deliveryId}: ${error.message}`
              : `배송 ID ${deliveryId}: 운송장 번호를 등록하지 못했어요.`,
          );
        }
      }

      await loadRecords("운송장 번호를 등록했어요.");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "운송장 번호를 등록하지 못했어요.",
      );
    } finally {
      setRegisteringDeliveryId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] px-6 py-4 text-[#111111]">
      <div className="mx-auto flex max-w-[1380px] flex-col gap-4">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase text-black/35">
              Admin
            </p>
            <h1 className="mt-1 text-[32px] font-semibold">
              결제 확인 대시보드
            </h1>
            <p className="mt-1.5 text-[14px] font-medium text-black/45">
              개최한 분철의 입금 확인과 운송장 등록을 처리해요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="h-10 rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-black disabled:text-black/25"
              disabled={isLoading || !authState.isLoggedIn}
              onClick={() => void loadRecords("새로고침했어요.")}
              type="button"
            >
              새로고침
            </button>
            <div className="flex flex-wrap items-center gap-5 rounded-[1rem] bg-black px-5 py-3 text-white">
              <div>
                <p className="text-[12px] font-semibold text-white/45">
                  확인 대기 금액
                </p>
                <p className="mt-1 text-[24px] font-semibold">
                  {formatPrice(pendingAmount)}
                </p>
              </div>
              <div className="h-9 w-px bg-white/15" />
              <div className="flex gap-4 text-[13px] font-semibold text-white/45">
                <span className="whitespace-nowrap">
                  대기 <strong className="ml-1 text-white">{pendingRecords.length}</strong>
                </span>
                <span className="whitespace-nowrap">
                  완료 <strong className="ml-1 text-white">{confirmedRecords.length}</strong>
                </span>
                <span className="whitespace-nowrap">
                  환불 <strong className="ml-1 text-white">{refundRecords.length}</strong>
                </span>
                <span className="whitespace-nowrap">
                  전체 <strong className="ml-1 text-white">{records.length}</strong>
                </span>
              </div>
            </div>
          </div>
        </header>

        {message ? (
          <p className="rounded-[0.9rem] bg-white px-4 py-3 text-[13px] font-semibold text-black/45">
            {message}
          </p>
        ) : null}

        <section className="grid min-h-[640px] gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-[1.15rem] bg-white p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="rounded-full bg-[#f4f6f8] px-4 py-2 text-[13px] font-semibold text-black/45">
                결제 건 전체 표시
              </div>
              <input
                className="h-10 w-full rounded-full border border-black/10 bg-white px-4 text-[14px] font-semibold outline-none placeholder:text-black/25 focus:border-black md:w-[20rem]"
                onChange={(event) => setSearchKeyword(event.currentTarget.value)}
                placeholder="분철명, 참여자, 운송장 검색"
                value={searchKeyword}
              />
            </div>
            <div className="mt-3 overflow-x-auto rounded-[0.9rem] border border-black/10">
              <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                  <col className="w-[18%]" />
                  <col className="w-[30%]" />
                  <col className="w-[14%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead className="bg-[#f8f9fa] text-[12px] font-semibold text-black/45">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3">기한 / 확인</th>
                    <th className="whitespace-nowrap px-4 py-3">참여자</th>
                    <th className="whitespace-nowrap px-4 py-3">환불 계좌</th>
                    <th className="whitespace-nowrap px-4 py-3">분철 / 옵션</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">금액</th>
                    <th className="whitespace-nowrap px-4 py-3">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {filteredRecords.map((record) => {
                    const isSelected =
                      selectedRecord?.participationId === record.participationId;

                    return (
                      <tr
                        className={`cursor-pointer align-top text-[14px] ${
                          isSelected ? "bg-[#f7f7f7]" : "bg-white"
                        }`}
                        key={record.participationId}
                        onClick={() =>
                          setSelectedParticipationId(record.participationId)
                        }
                      >
                        <td className="px-4 py-4">
                          <p className="font-semibold">
                            {record.status === "CONFIRMED" ? "확인" : "기한"}
                          </p>
                          <p className="mt-1 text-[12px] font-medium text-black/40">
                            {formatDateTime(
                              record.status === "CONFIRMED"
                                ? record.confirmedAt
                                : record.paymentDueAt,
                            )}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <p className="truncate text-[16px] font-semibold">
                            {record.participantNickname}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="truncate text-[13px] font-semibold text-black/55">
                            {getRefundAccountLabel(record.refundAccount)}
                          </p>
                        </td>
                        <td className="min-w-0 px-4 py-4">
                          <p className="truncate whitespace-nowrap font-semibold">
                            {record.buncheolTitle}
                          </p>
                          <p className="mt-1 whitespace-nowrap text-[12px] font-medium text-black/40">
                            #{record.buncheolId} · {record.groupName} · {record.memberName}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <p className="text-[18px] font-semibold">
                            {formatPrice(record.amount)}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <StatusBadge compact status={record.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredRecords.length === 0 ? (
                <div className="flex h-44 items-center justify-center text-[14px] font-semibold text-black/35">
                  {isLoading ? "결제 건을 불러오고 있어요." : "표시할 결제 건이 없어요."}
                </div>
              ) : null}
            </div>
          </div>

          <aside className="sticky top-4 self-start rounded-[1.15rem] bg-white p-4 shadow-[0_18px_50px_rgba(0,0,0,0.08)]">
            {selectedRecord ? (
              <div className="flex min-h-0 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold uppercase text-black/35">
                      Payment
                    </p>
                    <h2 className="mt-1 text-[22px] font-semibold">결제 건 확인</h2>
                  </div>
                  <StatusBadge status={selectedRecord.status} />
                </div>

                <section className="mt-3 rounded-[1rem] bg-black px-4 py-3.5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold text-white/45">
                        입금 금액
                      </p>
                      <p className="mt-0.5 text-[30px] font-semibold">
                        {formatPrice(selectedRecord.amount)}
                      </p>
                    </div>
                    <p className="max-w-[10rem] truncate text-right font-mono text-[11px] font-semibold text-white/45">
                      {selectedRecord.participationIds.join(", ")}
                    </p>
                  </div>
                  <div className="mt-2 grid gap-1 text-[12px] font-semibold text-white/55">
                    <div className="flex justify-between gap-3">
                      <span>참여자</span>
                      <span className="truncate text-right">
                        {selectedRecord.participantNickname}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>옵션</span>
                      <span className="truncate text-right">
                        {selectedRecord.memberName}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>참여</span>
                      <span className="truncate text-right">
                        {selectedRecord.participationIds.length}건 묶음
                      </span>
                    </div>
                  </div>
                </section>
                {selectedRecord.status === "AWAITING_CONFIRMATION" ? (
                  <section className="mt-2.5 rounded-[1rem] border border-black/10 p-3">
                    <div className="flex items-end justify-between gap-2">
                      <p className="text-[15px] font-semibold">거래내역 대조</p>
                      <p className="text-[12px] font-semibold text-black/35">
                        {Object.values(selectedVerification).filter(Boolean).length}
                        /2
                      </p>
                    </div>
                    <div className="mt-2 grid gap-1.5">
                      {verificationItems.map(({ key, label, value }) => {
                        const isChecked = selectedVerification[key];

                        return (
                          <button
                            className={`flex w-full items-center justify-between gap-3 rounded-[0.75rem] border px-3 py-2 text-left ${
                              isChecked
                                ? "border-black bg-black text-white"
                                : "border-black/10 bg-white text-black"
                            }`}
                            key={key}
                            onClick={() =>
                              toggleVerification(
                                selectedRecord.participationId,
                                key,
                              )
                            }
                            type="button"
                          >
                            <span className="min-w-0">
                              <span
                                className={`block text-[12px] font-semibold ${
                                  isChecked ? "text-white/45" : "text-black/40"
                                }`}
                              >
                                {label}
                              </span>
                              <span className="mt-0.5 block truncate text-[15px] font-semibold">
                                {value}
                              </span>
                            </span>
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                                isChecked
                                  ? "bg-white text-black"
                                  : "bg-[#f4f6f8] text-black/35"
                              }`}
                            >
                              {isChecked ? "확인" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      className="mt-3 h-11 w-full rounded-full bg-black text-[15px] font-semibold text-white disabled:bg-black/20"
                      disabled={!canConfirmSelectedPayment}
                      onClick={() => confirmPayment(selectedRecord)}
                      type="button"
                    >
                      {confirmingParticipationId === selectedRecord.participationId
                        ? "처리 중"
                        : canConfirmSelectedPayment
                          ? "입금 확인 처리"
                          : "대조 체크를 완료해 주세요"}
                    </button>
                    <p className="mt-2 text-[12px] font-semibold leading-5 text-black/40">
                      입금 확인을 완료하면 이 화면에서 운송장 번호를 이어서 등록해요.
                    </p>
                  </section>
                ) : null}

                <section className="mt-2.5 rounded-[1rem] border border-black/10">
                  <p className="border-b border-black/10 px-3 py-2 text-[13px] font-semibold text-black/40">
                    요청 정보
                  </p>
                  <dl className="divide-y divide-black/10 text-[13px]">
                    {[
                      ["분철", selectedRecord.buncheolTitle],
                      ["옵션", selectedRecord.memberName],
                      ["참여 수", `${selectedRecord.participationIds.length}건`],
                      ["참여 ID", selectedRecord.participationIds.join(", ")],
                      ["운영 상태", getStatusLabel(selectedRecord.status)],
                      ["분철 상태", getBuncheolStatusLabel(selectedRecord.buncheolStatus)],
                      ["결제 상태", selectedRecord.rawStatus || "-"],
                      ["기한", formatDateTime(selectedRecord.paymentDueAt)],
                      ["확인", formatDateTime(selectedRecord.confirmedAt)],
                      ["환불", getRefundAccountLabel(selectedRecord.refundAccount)],
                    ].map(([label, value]) => (
                      <div
                        className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 px-3 py-2"
                        key={label}
                      >
                        <dt className="font-semibold text-black/35">{label}</dt>
                        <dd className="truncate font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                {selectedRecord.status === "REFUND_REQUIRED" ? (
                  <section className="mt-2.5 rounded-[1rem] border border-[#ffd4d0] bg-[#fff8f7] p-3">
                    <p className="text-[15px] font-semibold text-[#c03131]">
                      환불 확인 필요
                    </p>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-[#c03131]/70">
                      취소된 분철에 결제 확인이 완료된 건이에요. 환불 계좌를 확인해
                      반환 처리를 진행해 주세요.
                    </p>
                    <div className="mt-3 rounded-[0.8rem] bg-white px-3 py-2 text-[13px] font-semibold">
                      <p className="text-[12px] text-black/40">환불 계좌</p>
                      <p className="mt-0.5 truncate">
                        {getRefundAccountLabel(selectedRecord.refundAccount)}
                      </p>
                    </div>
                  </section>
                ) : null}

                {shouldShowShippingSection ? (
                  <section className="mt-2.5 rounded-[1rem] border border-black/10 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-semibold">배송 정보</p>
                        <p className="mt-1 text-[12px] font-semibold text-black/40">
                          {selectedRecord.delivery
                            ? isSelectedPaymentConfirmed
                              ? getDeliveryStatusLabel(selectedRecord.delivery.status)
                              : "결제 요청 배송지"
                            : isSelectedPaymentConfirmed
                              ? "운송장 입력 대기"
                              : "결제 요청 배송지 확인 필요"}
                        </p>
                      </div>
                      {selectedRecord.delivery?.shippingMethod ? (
                        <span className="rounded-full bg-black px-3 py-1 text-[12px] font-semibold text-white">
                          {getShippingMethodLabel(selectedRecord.delivery.shippingMethod)}
                        </span>
                      ) : null}
                    </div>

                    {selectedRecord.delivery ? (
                      <div className="mt-3 grid gap-2 text-[13px] font-semibold">
                        <div className="rounded-[0.8rem] bg-[#f7f7f7] px-3 py-2">
                          <p className="text-[12px] text-black/40">배송지</p>
                          <p className="mt-0.5 truncate">
                            {selectedRecord.delivery.storeName || "배송지 미확인"}
                          </p>
                        </div>
                        <div className="rounded-[0.8rem] bg-[#f7f7f7] px-3 py-2">
                          <p className="text-[12px] text-black/40">연락처</p>
                          <p className="mt-0.5 truncate">
                            {[
                              selectedRecord.delivery.receiverNickname,
                              selectedRecord.delivery.receiverPhoneNumber,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "-"}
                          </p>
                        </div>
                        {isSelectedPaymentConfirmed ? (
                          <>
                            <label className="grid gap-1.5">
                              <span className="text-[12px] font-semibold text-black/40">
                                운송장 번호
                              </span>
                              <input
                                className="h-11 rounded-[0.8rem] border border-black/10 px-3 text-[15px] font-semibold outline-none placeholder:text-black/25 focus:border-black"
                                onChange={(event) => {
                                  const nextTrackingNumber =
                                    event.currentTarget.value;

                                  setTrackingInputs((current) => ({
                                    ...current,
                                    [selectedRecord.participationId]:
                                      nextTrackingNumber,
                                  }));
                                }}
                                placeholder="운송장 번호 입력"
                                value={selectedTrackingValue}
                              />
                            </label>
                            <button
                              className="h-11 rounded-full bg-black text-[15px] font-semibold text-white disabled:bg-black/20"
                              disabled={!canRegisterTracking}
                              onClick={() => registerTrackingNumber(selectedRecord)}
                              type="button"
                            >
                              {registeringDeliveryId === selectedTrackingBatchId
                                ? "등록 중"
                                : selectedHasTrackingNumber
                                  ? "운송장 수정"
                                  : "운송장 등록"}
                            </button>
                          </>
                        ) : (
                          <p className="rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3 text-[12px] font-semibold leading-5 text-black/45">
                            배송지는 결제 요청 시 고정됐어요. 입금 확인 후 이
                            화면에서 운송장 번호를 등록해요.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3 text-[13px] font-semibold leading-5 text-black/45">
                        {isSelectedPaymentConfirmed
                          ? "입금 확인은 완료됐지만 운송장 등록에 필요한 배송 정보가 응답에 없어 지금은 등록할 수 없어요."
                          : "결제 요청 배송지가 응답에 없어 확인할 수 없어요. 입금 확인 전에도 배송지가 필요해요."}
                      </p>
                    )}
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-[20rem] items-center justify-center text-center text-[14px] font-semibold text-black/35">
                결제 건을 선택해 주세요.
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
