"use client";

import { useMemo, useState } from "react";
import {
  adminPaymentRecords,
  type AdminPaymentRecord,
  type AdminPaymentStatus,
} from "@/lib/admin-payment-records";

type AdminPaymentFilter = "pending" | "confirmed" | "all";
type VerificationKey = "amount" | "depositor";

type VerificationState = Record<VerificationKey, boolean>;

const filterLabels: Record<AdminPaymentFilter, string> = {
  all: "전체",
  confirmed: "완료",
  pending: "확인 대기",
};

function formatPrice(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatFullDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getStatusLabel(status: AdminPaymentStatus) {
  return status === "CONFIRMED" ? "결제 완료" : "입금 확인 대기";
}

function getTotalAmount(record: AdminPaymentRecord) {
  return record.bidAmount + record.shippingFee;
}

function getNowIsoString() {
  return new Date().toISOString();
}

function getEmptyVerificationState(): VerificationState {
  return {
    amount: false,
    depositor: false,
  };
}

function StatusBadge({
  compact = false,
  status,
}: {
  compact?: boolean;
  status: AdminPaymentStatus;
}) {
  const label = compact
    ? status === "CONFIRMED"
      ? "완료"
      : "대기"
    : getStatusLabel(status);

  return (
    <span
      className={`inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 text-[12px] font-semibold ${
        status === "CONFIRMED"
          ? "bg-[#e8f5ef] text-[#237152]"
          : "bg-black text-white"
      }`}
    >
      {label}
    </span>
  );
}

export function AdminPaymentsDashboard() {
  const [records, setRecords] = useState(() => adminPaymentRecords);
  const [filter, setFilter] = useState<AdminPaymentFilter>("pending");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(
    () => adminPaymentRecords[0]?.orderId ?? "",
  );
  const [verificationByOrder, setVerificationByOrder] = useState<
    Record<string, VerificationState>
  >({});

  const filteredRecords = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return records
      .filter((record) => {
        if (filter === "pending") {
          return record.status === "AWAITING_CONFIRMATION";
        }

        if (filter === "confirmed") {
          return record.status === "CONFIRMED";
        }

        return true;
      })
      .filter((record) => {
        if (!keyword) {
          return true;
        }

        return [
          record.orderId,
          record.buncheolTitle,
          record.memberName,
          record.participantNickname,
          record.depositorName,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort(
        (left, right) =>
          new Date(right.paymentRequestedAt).getTime() -
          new Date(left.paymentRequestedAt).getTime(),
      );
  }, [filter, records, searchKeyword]);

  const selectedRecord =
    records.find((record) => record.orderId === selectedOrderId) ??
    filteredRecords[0] ??
    records[0] ??
    null;
  const pendingRecords = records.filter(
    (record) => record.status === "AWAITING_CONFIRMATION",
  );
  const confirmedRecords = records.filter(
    (record) => record.status === "CONFIRMED",
  );
  const pendingAmount = pendingRecords.reduce(
    (sum, record) => sum + getTotalAmount(record),
    0,
  );
  const selectedVerification =
    selectedRecord && verificationByOrder[selectedRecord.orderId]
      ? verificationByOrder[selectedRecord.orderId]
      : getEmptyVerificationState();
  const canConfirmSelectedPayment =
    Boolean(selectedRecord) &&
    selectedRecord?.status === "AWAITING_CONFIRMATION" &&
    Object.values(selectedVerification).every(Boolean);
  const verificationItems: Array<{
    key: VerificationKey;
    label: string;
    value: string;
  }> = selectedRecord
    ? [
        {
          key: "depositor",
          label: "입금자명",
          value: selectedRecord.depositorName,
        },
        {
          key: "amount",
          label: "입금 금액",
          value: formatPrice(getTotalAmount(selectedRecord)),
        },
      ]
    : [];

  function toggleVerification(orderId: string, key: VerificationKey) {
    setVerificationByOrder((current) => {
      const currentState = current[orderId] ?? getEmptyVerificationState();

      return {
        ...current,
        [orderId]: {
          ...currentState,
          [key]: !currentState[key],
        },
      };
    });
  }

  function confirmPayment(orderId: string) {
    const confirmedAt = getNowIsoString();

    setRecords((current) =>
      current.map((record) =>
        record.orderId === orderId
          ? { ...record, confirmedAt, status: "CONFIRMED" }
          : record,
      ),
    );
    setSelectedOrderId(orderId);
    setFilter("confirmed");
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] px-6 py-4 text-[#111111]">
      <div className="mx-auto flex max-w-[1380px] flex-col gap-4">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-black/35">
              Admin
            </p>
            <h1 className="mt-1 text-[32px] font-semibold tracking-[-0.06em]">
              결제 확인 대시보드
            </h1>
            <p className="mt-1.5 text-[14px] font-medium text-black/45">
              입금 요청 내역을 확인하고 결제 완료 상태로 처리해요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 rounded-[1rem] bg-black px-5 py-3 text-white">
            <div>
              <p className="text-[12px] font-semibold text-white/45">
                확인 대기 금액
              </p>
              <p className="mt-1 text-[24px] font-semibold tracking-[-0.05em]">
                {formatPrice(pendingAmount)}
              </p>
            </div>
            <div className="h-9 w-px bg-white/15" />
            <div className="flex gap-4 text-[13px] font-semibold text-white/45">
              <span className="whitespace-nowrap">
                대기 <strong className="ml-1 text-white">{pendingRecords.length}</strong>
              </span>
              <span className="whitespace-nowrap">
                완료{" "}
                <strong className="ml-1 text-white">{confirmedRecords.length}</strong>
              </span>
              <span className="whitespace-nowrap">
                전체 <strong className="ml-1 text-white">{records.length}</strong>
              </span>
            </div>
          </div>
        </header>

        <section className="grid min-h-[640px] gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="rounded-[1.15rem] bg-white p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex rounded-full bg-[#f4f6f8] p-1">
                {(Object.keys(filterLabels) as AdminPaymentFilter[]).map(
                  (nextFilter) => (
                    <button
                      className={`h-9 rounded-full px-4 text-[13px] font-semibold ${
                        filter === nextFilter
                          ? "bg-black text-white"
                          : "text-black/45"
                      }`}
                      key={nextFilter}
                      onClick={() => setFilter(nextFilter)}
                      type="button"
                    >
                      {filterLabels[nextFilter]}
                    </button>
                  ),
                )}
              </div>
              <input
                className="h-10 w-full rounded-full border border-black/10 bg-white px-4 text-[14px] font-semibold outline-none placeholder:text-black/25 focus:border-black md:w-[18rem]"
                onChange={(event) => setSearchKeyword(event.currentTarget.value)}
                placeholder="분철명, 주문번호, 입금자 검색"
                value={searchKeyword}
              />
            </div>

            <div className="mt-3 overflow-hidden rounded-[0.9rem] border border-black/10">
              <table className="w-full table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[34%]" />
                  <col className="w-[18%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead className="bg-[#f8f9fa] text-[12px] font-semibold text-black/45">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3">
                      요청 시각
                    </th>
                    <th className="whitespace-nowrap px-4 py-3">
                      입금자
                    </th>
                    <th className="whitespace-nowrap px-4 py-3">
                      참여자
                    </th>
                    <th className="whitespace-nowrap px-4 py-3">
                      분철 / 옵션
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">
                      확인 금액
                    </th>
                    <th className="whitespace-nowrap px-4 py-3">
                      상태
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {filteredRecords.map((record) => {
                    const isSelected = selectedRecord?.orderId === record.orderId;

                    return (
                      <tr
                        className={`cursor-pointer align-top text-[14px] ${
                          isSelected ? "bg-[#f7f7f7]" : "bg-white"
                        }`}
                        key={record.orderId}
                        onClick={() => setSelectedOrderId(record.orderId)}
                      >
                        <td className="whitespace-nowrap px-4 py-4">
                          <p className="font-semibold tracking-[-0.03em]">
                            {formatDateTime(record.paymentRequestedAt)}
                          </p>
                          <p className="mt-1 whitespace-nowrap text-[12px] font-medium text-black/35">
                            기한 {formatDateTime(record.paymentDueAt)}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <p className="truncate text-[16px] font-semibold tracking-[-0.04em]">
                            {record.depositorName}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <p className="truncate font-semibold">
                            {record.participantNickname}
                          </p>
                        </td>
                        <td className="min-w-0 px-4 py-4">
                          <p className="truncate whitespace-nowrap font-semibold tracking-[-0.04em]">
                            {record.buncheolTitle}
                          </p>
                          <p className="mt-1 whitespace-nowrap text-[12px] font-medium text-black/40">
                            분철 #{record.buncheolId} · 옵션 {record.memberName}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <p className="text-[18px] font-semibold tracking-[-0.04em]">
                            {formatPrice(getTotalAmount(record))}
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
                  표시할 결제 요청이 없어요.
                </div>
              ) : null}
            </div>
          </div>

          <aside className="sticky top-4 self-start rounded-[1.15rem] bg-white p-4 shadow-[0_18px_50px_rgba(0,0,0,0.08)]">
            {selectedRecord ? (
              <div className="flex min-h-0 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-black/35">
                      Payment
                    </p>
                    <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.06em]">
                      입금 확인
                    </h2>
                  </div>
                  <StatusBadge status={selectedRecord.status} />
                </div>

                <section className="mt-3 rounded-[1rem] bg-black px-4 py-3.5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold text-white/45">
                        확인 금액
                      </p>
                      <p className="mt-0.5 text-[30px] font-semibold tracking-[-0.06em]">
                        {formatPrice(getTotalAmount(selectedRecord))}
                      </p>
                    </div>
                    <p className="whitespace-nowrap text-right font-mono text-[11px] font-semibold text-white/45">
                      {selectedRecord.orderId}
                    </p>
                  </div>
                  <div className="mt-2 grid gap-1 text-[12px] font-semibold text-white/55">
                    <div className="flex justify-between">
                      <span>낙찰가</span>
                      <span>{formatPrice(selectedRecord.bidAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>배송비</span>
                      <span>{formatPrice(selectedRecord.shippingFee)}</span>
                    </div>
                  </div>
                </section>

                {selectedRecord.status === "AWAITING_CONFIRMATION" ? (
                  <section className="mt-2.5 rounded-[1rem] border border-black/10 p-3">
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-[15px] font-semibold tracking-[-0.04em]">
                          거래내역 대조
                        </p>
                      </div>
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
                              toggleVerification(selectedRecord.orderId, key)
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
                              <span className="mt-0.5 block truncate text-[15px] font-semibold tracking-[-0.04em]">
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
                  </section>
                ) : (
                  <section className="mt-2.5 rounded-[1rem] bg-[#e8f5ef] px-4 py-2.5">
                    <p className="text-[15px] font-semibold text-[#237152]">
                      결제 완료로 처리된 요청이에요.
                    </p>
                    <p className="mt-1 text-[12px] font-semibold text-[#237152]/65">
                      완료 시각 {formatFullDateTime(selectedRecord.confirmedAt ?? "")}
                    </p>
                  </section>
                )}

                <section className="mt-2.5 rounded-[1rem] border border-black/10">
                  <p className="border-b border-black/10 px-3 py-2 text-[13px] font-semibold text-black/40">
                    요청 정보
                  </p>
                  <dl className="divide-y divide-black/10 text-[13px]">
                    {[
                      ["분철", `${selectedRecord.buncheolTitle} · ${selectedRecord.memberName}`],
                      ["요청", formatFullDateTime(selectedRecord.paymentRequestedAt)],
                      ["기한", formatFullDateTime(selectedRecord.paymentDueAt)],
                    ].map(([label, value]) => (
                      <div
                        className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 px-3 py-2"
                        key={label}
                      >
                        <dt className="font-semibold text-black/35">{label}</dt>
                        <dd className="truncate font-semibold tracking-[-0.04em]">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>

                {selectedRecord.status === "AWAITING_CONFIRMATION" ? (
                  <div className="mt-2.5 rounded-[0.9rem] bg-[#fff7e6] px-3 py-2 text-[12px] font-semibold leading-5 text-[#7a4b00]">
                    체크한 항목이 실제 거래내역과 다르면 완료 처리하지 마세요.
                  </div>
                ) : null}

                <button
                  className="mt-3 h-11 w-full rounded-full bg-black text-[15px] font-semibold text-white disabled:bg-black/20"
                  disabled={!canConfirmSelectedPayment}
                  onClick={() => confirmPayment(selectedRecord.orderId)}
                  type="button"
                >
                  {selectedRecord.status === "CONFIRMED"
                    ? "이미 완료됐어요"
                    : canConfirmSelectedPayment
                      ? "결제 완료 처리"
                      : "대조 체크를 완료해 주세요"}
                </button>
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
