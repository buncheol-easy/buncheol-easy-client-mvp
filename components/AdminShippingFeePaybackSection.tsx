"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiRequestError,
  requestAdminShippingFeePaybackAction,
  requestAllAdminShippingFeePaybacks,
  type AdminShippingFeePaybackItem,
} from "@/lib/auth-api";
import { readAdminAuthState } from "@/lib/admin-auth-store";
import type { ShippingFeePaybackStatus } from "@/lib/shipping-fee-payback";

type PaybackStatusFilter = "ALL" | "REQUESTED" | "COMPLETED" | "REJECTED";

const statusFilters: { key: PaybackStatusFilter; label: string }[] = [
  { key: "REQUESTED", label: "확인 대기" },
  { key: "COMPLETED", label: "입금 완료" },
  { key: "REJECTED", label: "반려" },
  { key: "ALL", label: "전체" },
];

function formatPrice(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

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
  }).format(date);
}

function getStatusLabel(status: ShippingFeePaybackStatus) {
  switch (status) {
    case "COMPLETED":
      return "입금 완료";
    case "REJECTED":
      return "반려";
    default:
      return "확인 대기";
  }
}

function PaybackStatusBadge({ status }: { status: ShippingFeePaybackStatus }) {
  return (
    <span
      className={`inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 text-[12px] font-semibold ${
        status === "COMPLETED"
          ? "bg-[#e8f5ef] text-[#237152]"
          : status === "REJECTED"
            ? "bg-[#fff1f0] text-[#c03131]"
            : "bg-black text-white"
      }`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

function isAdminSessionError(error: unknown) {
  return (
    error instanceof ApiRequestError && [401, 403].includes(error.status)
  );
}

type AdminShippingFeePaybackSectionProps = {
  onSessionExpired: () => void;
};

// 오픈 이벤트 배송비 돌려받기 검수 섹션. 결제 확인 대시보드의 모드 탭에서 렌더되며,
// 목록 로드·필터·검수 처리(입금 완료/반려)를 자체적으로 관리한다.
export function AdminShippingFeePaybackSection({
  onSessionExpired,
}: AdminShippingFeePaybackSectionProps) {
  const [items, setItems] = useState<AdminShippingFeePaybackItem[]>([]);
  const [statusFilter, setStatusFilter] =
    useState<PaybackStatusFilter>("REQUESTED");
  const [selectedParticipationId, setSelectedParticipationId] = useState("");
  const [message, setMessage] = useState("돌려받기 신청을 불러오고 있어요.");
  const [isLoading, setIsLoading] = useState(true);
  const [processingParticipationId, setProcessingParticipationId] = useState<
    string | null
  >(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejectFormOpen, setIsRejectFormOpen] = useState(false);

  const loadItems = useCallback(
    async (successMessage?: string) => {
      const accessToken = readAdminAuthState().accessToken;

      if (!accessToken) {
        return;
      }

      setIsLoading(true);

      try {
        const result = await requestAllAdminShippingFeePaybacks(accessToken);

        setItems(result.items);
        setSelectedParticipationId((current) =>
          result.items.some((item) => item.participationId === current)
            ? current
            : result.items[0]?.participationId ?? "",
        );

        if (successMessage) {
          setMessage(successMessage);
        } else if (result.items.length === 0) {
          setMessage("아직 배송비 돌려받기 신청이 없어요.");
        } else {
          setMessage("");
        }
      } catch (error: unknown) {
        if (isAdminSessionError(error)) {
          onSessionExpired();
          return;
        }

        setItems([]);
        setMessage(
          error instanceof Error
            ? error.message
            : "돌려받기 신청 목록을 불러오지 못했어요.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [onSessionExpired],
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  // 반려 폼은 선택 건이 바뀌면 초기화한다.
  useEffect(() => {
    setIsRejectFormOpen(false);
    setRejectReason("");
  }, [selectedParticipationId]);

  const filteredItems =
    statusFilter === "ALL"
      ? items
      : items.filter((item) => item.status === statusFilter);
  const selectedItem =
    filteredItems.find(
      (item) => item.participationId === selectedParticipationId,
    ) ??
    items.find((item) => item.participationId === selectedParticipationId) ??
    null;

  async function processPayback(
    item: AdminShippingFeePaybackItem,
    action: "COMPLETE" | "REJECT",
  ) {
    const accessToken = readAdminAuthState().accessToken;

    if (!accessToken || processingParticipationId) {
      return;
    }

    if (
      action === "COMPLETE" &&
      !window.confirm(
        `${item.participantNickname ?? "신청자"}님에게 ${
          item.paybackAmount !== null ? formatPrice(item.paybackAmount) : "배송비"
        } 입금을 완료했나요?`,
      )
    ) {
      return;
    }

    setProcessingParticipationId(item.participationId);

    try {
      await requestAdminShippingFeePaybackAction(
        accessToken,
        item.participationId,
        action,
        action === "REJECT" ? rejectReason.trim() : undefined,
      );
      await loadItems(
        action === "COMPLETE"
          ? "입금 완료로 처리했어요."
          : "반려 처리했어요. 신청자는 후기를 수정해 다시 신청할 수 있어요.",
      );
      setIsRejectFormOpen(false);
      setRejectReason("");
    } catch (error: unknown) {
      if (isAdminSessionError(error)) {
        onSessionExpired();
        return;
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "돌려받기 처리에 실패했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setProcessingParticipationId(null);
    }
  }

  const statusCounts = statusFilters.map((filter) => ({
    ...filter,
    count:
      filter.key === "ALL"
        ? items.length
        : items.filter((item) => item.status === filter.key).length,
  }));

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-4">
        {statusCounts.map((card) => {
          const isActive = statusFilter === card.key;

          return (
            <button
              aria-pressed={isActive}
              className={`rounded-[1.15rem] px-5 py-4 text-left transition-colors ${
                isActive
                  ? "bg-black text-white"
                  : "bg-white text-black hover:bg-[#fafafa]"
              }`}
              key={card.key}
              onClick={() => setStatusFilter(card.key)}
              type="button"
            >
              <p
                className={`text-[12px] font-semibold ${
                  isActive ? "text-white/45" : "text-black/40"
                }`}
              >
                {card.label}
              </p>
              <p className="mt-1.5 text-[24px] font-semibold leading-none">
                {card.count}
              </p>
            </button>
          );
        })}
      </section>

      {message ? (
        <p className="rounded-[0.9rem] bg-white px-4 py-3 text-[13px] font-semibold text-black/45">
          {message}
        </p>
      ) : null}

      <section className="grid min-h-[640px] gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-[1.15rem] bg-white p-3.5">
          <div className="px-1 pt-1">
            <p className="text-[16px] font-semibold">배송비 돌려받기 신청</p>
            <p className="mt-0.5 text-[12px] font-semibold text-black/40">
              {statusFilters.find((filter) => filter.key === statusFilter)?.label}{" "}
              {filteredItems.length}건 표시
            </p>
          </div>
          <div className="mt-3 overflow-x-auto rounded-[0.9rem] border border-black/10">
            <table className="w-full min-w-[860px] table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[26%]" />
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-[#f8f9fa] text-[12px] font-semibold text-black/45">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">신청자</th>
                  <th className="whitespace-nowrap px-4 py-3">분철 / 멤버</th>
                  <th className="whitespace-nowrap px-4 py-3">환불 계좌</th>
                  <th className="whitespace-nowrap px-4 py-3">후기</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">환급액</th>
                  <th className="whitespace-nowrap px-4 py-3">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {isLoading && filteredItems.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-[13px] font-semibold text-black/35"
                      colSpan={6}
                    >
                      신청 내역을 불러오고 있어요.
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-[13px] font-semibold text-black/35"
                      colSpan={6}
                    >
                      표시할 신청이 없어요.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isSelected =
                      item.participationId === selectedParticipationId;

                    return (
                      <tr
                        className={`cursor-pointer text-[13px] font-semibold transition-colors ${
                          isSelected ? "bg-[#F7FAEE]" : "hover:bg-[#fafafa]"
                        }`}
                        key={item.participationId}
                        onClick={() =>
                          setSelectedParticipationId(item.participationId)
                        }
                      >
                        <td className="truncate px-4 py-3.5">
                          {item.participantNickname ?? "-"}
                          {item.participantName ? (
                            <span className="text-black/40">
                              ({item.participantName})
                            </span>
                          ) : null}
                        </td>
                        <td className="truncate px-4 py-3.5">
                          {item.buncheolTitle}
                          {item.memberName ? (
                            <span className="text-black/40">
                              {" "}
                              · {item.memberName}
                            </span>
                          ) : null}
                        </td>
                        <td className="truncate px-4 py-3.5 text-black/55">
                          {item.refundAccount
                            ? `${item.refundAccount.bank} ${item.refundAccount.account}`
                            : "-"}
                        </td>
                        <td className="px-4 py-3.5">
                          {item.tweetUrl ? (
                            <a
                              className="text-[#1d4ed8] underline underline-offset-2"
                              href={item.tweetUrl}
                              onClick={(event) => event.stopPropagation()}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              트윗 보기
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {item.paybackAmount !== null
                            ? formatPrice(item.paybackAmount)
                            : "-"}
                        </td>
                        <td className="px-4 py-3.5">
                          <PaybackStatusBadge status={item.status} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-[1.15rem] bg-white p-5">
          {selectedItem ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-black/40">
                    신청 #{selectedItem.participationId}
                  </p>
                  <p className="mt-1 truncate text-[18px] font-semibold">
                    {selectedItem.buncheolTitle}
                  </p>
                  <p className="mt-0.5 text-[13px] font-semibold text-black/45">
                    {selectedItem.participantNickname ?? "-"}
                    {selectedItem.participantName
                      ? ` (${selectedItem.participantName})`
                      : ""}
                    {selectedItem.memberName ? ` · ${selectedItem.memberName}` : ""}
                  </p>
                </div>
                <PaybackStatusBadge status={selectedItem.status} />
              </div>

              <div className="rounded-[0.9rem] bg-[#f8f9fa] px-4 py-3 text-[13px] font-semibold">
                <div className="flex items-center justify-between">
                  <span className="text-black/40">환급액</span>
                  <span>
                    {selectedItem.paybackAmount !== null
                      ? formatPrice(selectedItem.paybackAmount)
                      : "-"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="shrink-0 text-black/40">환불 계좌</span>
                  <span className="truncate text-right">
                    {selectedItem.refundAccount
                      ? `${selectedItem.refundAccount.bank} ${selectedItem.refundAccount.account} (${selectedItem.refundAccount.holder})`
                      : "-"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-black/40">신청 시각</span>
                  <span>{formatDateTime(selectedItem.requestedAt)}</span>
                </div>
                {selectedItem.completedAt ? (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-black/40">입금 완료</span>
                    <span>{formatDateTime(selectedItem.completedAt)}</span>
                  </div>
                ) : null}
              </div>

              {selectedItem.tweetUrl ? (
                <a
                  className="block rounded-[0.9rem] border border-black/10 px-4 py-3 text-[13px] font-semibold text-[#1d4ed8] underline underline-offset-2"
                  href={selectedItem.tweetUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  후기 트윗 새 탭에서 확인하기
                </a>
              ) : null}

              {selectedItem.status === "REJECTED" && selectedItem.rejectReason ? (
                <div className="rounded-[0.9rem] bg-[#fff1f0] px-4 py-3">
                  <p className="text-[12px] font-semibold text-[#c03131]">
                    반려 사유
                  </p>
                  <p className="mt-1 text-[13px] font-semibold leading-5 text-black/60">
                    {selectedItem.rejectReason}
                  </p>
                </div>
              ) : null}

              {selectedItem.status === "REQUESTED" ? (
                <div className="space-y-2 border-t border-black/10 pt-4">
                  <button
                    className="h-12 w-full rounded-full bg-black text-[14px] font-semibold text-[#D7FF5F] disabled:bg-black/20 disabled:text-white/70"
                    disabled={processingParticipationId !== null}
                    onClick={() => void processPayback(selectedItem, "COMPLETE")}
                    type="button"
                  >
                    {processingParticipationId === selectedItem.participationId
                      ? "처리 중..."
                      : "입금 완료 처리"}
                  </button>
                  {isRejectFormOpen ? (
                    <div className="rounded-[0.9rem] border border-black/10 px-4 py-3">
                      <p className="text-[12px] font-semibold text-black/40">
                        반려 사유 (신청자에게 그대로 보여요)
                      </p>
                      <textarea
                        className="mt-2 h-20 w-full resize-none rounded-[0.7rem] border border-black/10 px-3 py-2 text-[13px] font-medium outline-none focus:border-black/40"
                        maxLength={200}
                        onChange={(event) => setRejectReason(event.target.value)}
                        placeholder="예: 비공개 계정이라 후기를 확인할 수 없어요."
                        value={rejectReason}
                      />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          className="h-11 rounded-full bg-[#f3f3f3] text-[13px] font-semibold text-black/55"
                          onClick={() => {
                            setIsRejectFormOpen(false);
                            setRejectReason("");
                          }}
                          type="button"
                        >
                          취소
                        </button>
                        <button
                          className="h-11 rounded-full bg-[#c03131] text-[13px] font-semibold text-white disabled:bg-black/20 disabled:text-white/70"
                          disabled={
                            processingParticipationId !== null ||
                            rejectReason.trim().length === 0
                          }
                          onClick={() => void processPayback(selectedItem, "REJECT")}
                          type="button"
                        >
                          반려 확정
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="h-12 w-full rounded-full border border-[#e5b3b3] bg-white text-[14px] font-semibold text-[#c03131]"
                      disabled={processingParticipationId !== null}
                      onClick={() => setIsRejectFormOpen(true)}
                      type="button"
                    >
                      반려하기
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="py-10 text-center text-[13px] font-semibold text-black/35">
              왼쪽 목록에서 신청 건을 선택해 주세요.
            </p>
          )}
        </aside>
      </section>
    </>
  );
}
