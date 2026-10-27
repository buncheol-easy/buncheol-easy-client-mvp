"use client";

import { useRef, useState } from "react";
import {
  ConfirmSheet,
  type ConfirmSheetRequest,
} from "@/components/ConfirmSheet";
import {
  ApiRequestError,
  cancelBuncheolByStaff,
  requestBuncheolDetail,
} from "@/lib/auth-api";
import { readAdminAuthState } from "@/lib/admin-auth-store";
import {
  getBuncheolStatusBadgeLabel,
  getFlowType,
  isBuncheolPaymentCollectingStatus,
} from "@/lib/buncheol-states";

type LoadedBuncheol = {
  activeSlotCount: number;
  confirmedSlotCount: number;
  id: string;
  isCancellable: boolean;
  statusLabel: string;
  title: string;
};

type AdminBuncheolCancelSectionProps = {
  onSessionExpired: () => void;
};

function isAdminSessionError(error: unknown) {
  return error instanceof ApiRequestError && [401, 403].includes(error.status);
}

// 공개 상세의 자리 상태로 센다. 입금 수집 중이면 빈 자리는 CLOSED 로 내려와 세지 않는다.
function countSlots(saleStatuses: (string | undefined)[]) {
  const normalized = saleStatuses.map((status) => status?.toUpperCase() ?? "");

  return {
    activeSlotCount: normalized.filter((status) =>
      ["APPLIED", "AWAITING_PAYMENT", "SOLD"].includes(status),
    ).length,
    confirmedSlotCount: normalized.filter((status) => status === "SOLD").length,
  };
}

// 운영진 파기. 입금 단계가 시작된 회원 개최 분철을 개최자 대신 접는다(입금 확인된 참여까지 전원 취소).
// 파기 전에 공개 상세로 제목·상태·인원을 확인하게 하고, 서버도 상태를 다시 본다(아니면 BCH-050).
export function AdminBuncheolCancelSection({
  onSessionExpired,
}: AdminBuncheolCancelSectionProps) {
  const [buncheolIdInput, setBuncheolIdInput] = useState("");
  const [loaded, setLoaded] = useState<LoadedBuncheol | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [confirmSheetRequest, setConfirmSheetRequest] =
    useState<ConfirmSheetRequest | null>(null);
  // 파기는 되돌릴 수 없어, 입력이 바뀐 뒤 늦게 온 이전 번호의 응답은 버린다.
  const requestedBuncheolIdRef = useRef("");
  const inputBuncheolId = buncheolIdInput.trim();
  const shownBuncheol =
    loaded && loaded.id === inputBuncheolId ? loaded : null;

  async function load(buncheolId: string) {
    if (!buncheolId || isLoading) {
      return;
    }

    requestedBuncheolIdRef.current = buncheolId;
    setIsLoading(true);
    setMessage("");

    try {
      const detail = await requestBuncheolDetail(undefined, buncheolId);

      if (requestedBuncheolIdRef.current !== buncheolId) {
        return;
      }

      const counts = countSlots(
        detail.members.map((member) => member.saleStatus),
      );

      setLoaded({
        ...counts,
        id: buncheolId,
        isCancellable:
          getFlowType(detail.flowType) === "C2C" &&
          isBuncheolPaymentCollectingStatus(detail.status),
        statusLabel: getBuncheolStatusBadgeLabel(detail.status),
        title: detail.title,
      });
    } catch {
      if (requestedBuncheolIdRef.current !== buncheolId) {
        return;
      }

      setLoaded(null);
      setMessage("분철을 찾을 수 없어요. 번호를 다시 확인해 주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  function requestCancel() {
    if (!shownBuncheol || !shownBuncheol.isCancellable || isCancelling) {
      return;
    }

    const target = shownBuncheol;

    setConfirmSheetRequest({
      confirmLabel: "파기",
      description:
        "남아 있는 참여가 모두 취소되고, 참여자에게 분철 취소 알림톡(취소 사유: 개최자 취소)이 가요. 분철은 목록에서 숨겨져요.",
      onConfirm: () => {
        setConfirmSheetRequest(null);
        void runCancel(target);
      },
      title: `${target.id}번 분철을 파기할까요?`,
      warnings: [
        `입금이 확인된 ${target.confirmedSlotCount}자리도 함께 취소돼요. 환불은 개최자가 하니 끝날 때까지 확인해 주세요. 되돌릴 수 없어요.`,
      ],
    });
  }

  async function runCancel(target: LoadedBuncheol) {
    const accessToken = readAdminAuthState().accessToken;

    if (!accessToken || isCancelling) {
      return;
    }

    setIsCancelling(true);

    try {
      await cancelBuncheolByStaff(accessToken, target.id);
      setLoaded(null);
      setMessage(
        `${target.id}번 분철을 파기했어요. 참여자에게 취소 안내를 보냈어요.`,
      );
    } catch (error: unknown) {
      if (isAdminSessionError(error)) {
        onSessionExpired();
        return;
      }

      setMessage(
        (error instanceof Error ? error.message.trim() : "") ||
          "파기하지 못했어요. 분철을 다시 불러와 상태를 확인해 주세요.",
      );
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[1rem] border border-black/10 bg-white p-4">
        <p className="text-[13px] font-medium leading-5 text-black/60">
          입금 단계가 시작된 회원 개최 분철을 개최자 대신 파기해요. 개최자에게
          사정을 듣고, 입금한 참여자의 환불 계획을 확인한 뒤에 진행해 주세요.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-black/45">
              분철 번호
            </span>
            <input
              className="h-11 w-40 rounded-[0.7rem] border border-black/10 px-3 text-[15px] font-semibold outline-none focus:border-black/30"
              inputMode="numeric"
              onChange={(event) => {
                requestedBuncheolIdRef.current = "";
                setBuncheolIdInput(event.target.value);
                setLoaded(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void load(inputBuncheolId);
                }
              }}
              placeholder="예: 33"
              value={buncheolIdInput}
            />
          </label>
          <button
            className="h-11 rounded-full bg-black px-5 text-[14px] font-semibold text-white disabled:bg-black/25"
            disabled={isLoading || inputBuncheolId.length === 0}
            onClick={() => void load(inputBuncheolId)}
            type="button"
          >
            {isLoading ? "불러오는 중" : "불러오기"}
          </button>
        </div>
        {message ? (
          <p className="mt-3 text-[13px] font-medium leading-5 text-black/60">
            {message}
          </p>
        ) : null}
      </div>

      {shownBuncheol ? (
        <div className="rounded-[1rem] border border-black/10 bg-white p-4">
          <p className="text-[16px] font-semibold tracking-[-0.03em]">
            {shownBuncheol.title}
          </p>
          <p className="mt-1 text-[13px] font-medium text-black/55">
            {`${shownBuncheol.statusLabel} · 입금 확인 ${shownBuncheol.confirmedSlotCount}자리 / 전체 ${shownBuncheol.activeSlotCount}자리`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              className="h-11 rounded-full bg-[#c03131] px-5 text-[14px] font-semibold text-white disabled:bg-black/15 disabled:text-black/35"
              disabled={!shownBuncheol.isCancellable || isCancelling}
              onClick={requestCancel}
              type="button"
            >
              {isCancelling ? "파기하는 중" : "파기"}
            </button>
            {shownBuncheol.isCancellable ? null : (
              <p className="text-[13px] font-medium text-black/50">
                입금 수집 중인 회원 개최 분철만 파기할 수 있어요.
              </p>
            )}
          </div>
        </div>
      ) : null}

      <ConfirmSheet
        onCancel={() => setConfirmSheetRequest(null)}
        request={confirmSheetRequest}
      />
    </div>
  );
}
