"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiRequestError,
  requestAdminBuncheolSlots,
  requestAdminParticipationCodeIssue,
  requestAdminParticipationCodeRevoke,
  requestAdminParticipationCodes,
  requestAdminSlotAccessTypeChange,
  type AdminBuncheolSlotItem,
  type AdminParticipationCodeItem,
} from "@/lib/auth-api";
import { readAdminAuthState } from "@/lib/admin-auth-store";

const DEFAULT_VALID_HOURS = 48;

function formatPrice(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function isAdminSessionError(error: unknown) {
  return error instanceof ApiRequestError && [401, 403].includes(error.status);
}

function getCodeStatusLabel(status: AdminParticipationCodeItem["status"]) {
  switch (status) {
    case "USED":
      return "사용됨";
    case "REVOKED":
      return "폐기됨";
    case "EXPIRED":
      return "기한 만료";
    default:
      return "사용 가능";
  }
}

function CodeStatusBadge({
  status,
}: {
  status: AdminParticipationCodeItem["status"];
}) {
  return (
    <span
      className={`inline-flex h-7 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold ${
        status === "USED"
          ? "bg-[#e8f5ef] text-[#237152]"
          : status === "REVOKED"
            ? "bg-[#f3f3f3] text-black/45"
            : status === "EXPIRED"
              ? "bg-[#fff1f0] text-[#c03131]"
              : "bg-black text-white"
      }`}
    >
      {getCodeStatusLabel(status)}
    </span>
  );
}

type AdminParticipationCodeSectionProps = {
  onSessionExpired: () => void;
};

export function AdminParticipationCodeSection({
  onSessionExpired,
}: AdminParticipationCodeSectionProps) {
  const [buncheolIdInput, setBuncheolIdInput] = useState("");
  const [loadedBuncheolId, setLoadedBuncheolId] = useState("");
  const [slots, setSlots] = useState<AdminBuncheolSlotItem[]>([]);
  const [codes, setCodes] = useState<AdminParticipationCodeItem[]>([]);
  const [message, setMessage] = useState(
    "분철 ID를 입력하면 슬롯과 발급 이력을 불러와요.",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [issuedToBySlot, setIssuedToBySlot] = useState<Record<string, string>>(
    {},
  );
  const [validHoursBySlot, setValidHoursBySlot] = useState<
    Record<string, string>
  >({});
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const load = useCallback(
    async (buncheolId: string, successMessage?: string) => {
      const accessToken = readAdminAuthState().accessToken;

      if (!accessToken || !buncheolId) {
        return;
      }

      setIsLoading(true);

      try {
        const [nextSlots, nextCodes] = await Promise.all([
          requestAdminBuncheolSlots(accessToken, buncheolId),
          requestAdminParticipationCodes(accessToken, buncheolId),
        ]);

        setSlots(nextSlots);
        setCodes(nextCodes);
        setLoadedBuncheolId(buncheolId);

        if (successMessage) {
          setMessage(successMessage);
        } else if (nextSlots.every((slot) => slot.accessType === "OPEN")) {
          setMessage(
            "아직 코드 참여 슬롯이 없어요. 아래에서 배정할 슬롯을 코드 참여로 전환해 주세요.",
          );
        } else {
          setMessage("");
        }
      } catch (error: unknown) {
        if (isAdminSessionError(error)) {
          onSessionExpired();
          return;
        }

        setSlots([]);
        setCodes([]);
        setMessage(
          error instanceof Error
            ? error.message
            : "슬롯 목록을 불러오지 못했어요.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [onSessionExpired],
  );

  useEffect(() => {
    if (copiedCodeId === null) {
      return;
    }

    const timer = window.setTimeout(() => setCopiedCodeId(null), 1600);

    return () => window.clearTimeout(timer);
  }, [copiedCodeId]);

  async function handleIssue(slot: AdminBuncheolSlotItem, reissue: boolean) {
    const accessToken = readAdminAuthState().accessToken;

    if (!accessToken || pendingSlotId) {
      return;
    }

    const memberId = Number(slot.buncheolMemberId);

    if (!Number.isFinite(memberId)) {
      setMessage("슬롯 정보를 확인하지 못했어요.");
      return;
    }

    setPendingSlotId(slot.buncheolMemberId);

    try {
      const issued = await requestAdminParticipationCodeIssue(
        accessToken,
        loadedBuncheolId,
        {
          buncheolMemberId: memberId,
          issuedTo: issuedToBySlot[slot.buncheolMemberId]?.trim() || null,
          validHours:
            Number(validHoursBySlot[slot.buncheolMemberId]) ||
            DEFAULT_VALID_HOURS,
          reissue,
        },
      );

      await load(
        loadedBuncheolId,
        `${slot.memberName ?? "슬롯"} 코드를 ${
          reissue ? "재발급" : "발급"
        }했어요 — ${issued.code}`,
      );
    } catch (error: unknown) {
      if (isAdminSessionError(error)) {
        onSessionExpired();
        return;
      }

      setMessage(
        error instanceof Error ? error.message : "코드를 발급하지 못했어요.",
      );
    } finally {
      setPendingSlotId(null);
    }
  }

  async function handleAccessTypeChange(
    slot: AdminBuncheolSlotItem,
    accessType: "OPEN" | "CODE_ONLY",
  ) {
    const accessToken = readAdminAuthState().accessToken;

    if (!accessToken) {
      return;
    }

    try {
      await requestAdminSlotAccessTypeChange(
        accessToken,
        loadedBuncheolId,
        slot.buncheolMemberId,
        accessType,
      );
      await load(
        loadedBuncheolId,
        `${slot.memberName ?? "슬롯"}을 ${
          accessType === "CODE_ONLY" ? "코드 참여" : "선착순"
        }으로 바꿨어요.`,
      );
    } catch (error: unknown) {
      if (isAdminSessionError(error)) {
        onSessionExpired();
        return;
      }

      setMessage(
        error instanceof Error ? error.message : "슬롯을 전환하지 못했어요.",
      );
    }
  }

  async function handleRevoke(code: AdminParticipationCodeItem) {
    const accessToken = readAdminAuthState().accessToken;

    if (!accessToken) {
      return;
    }

    try {
      await requestAdminParticipationCodeRevoke(accessToken, code.codeId);
      await load(loadedBuncheolId, `코드 ${code.code}를 폐기했어요.`);
    } catch (error: unknown) {
      if (isAdminSessionError(error)) {
        onSessionExpired();
        return;
      }

      setMessage(
        error instanceof Error ? error.message : "코드를 폐기하지 못했어요.",
      );
    }
  }

  // DM 문안의 "코드 / 유효 기간" 자리를 그대로 채운 텍스트.
  async function handleCopy(code: AdminParticipationCodeItem) {
    const text = [
      `코드: ${code.code}`,
      code.issuedAtText && code.expiresAtText
        ? `유효 기간: ${code.issuedAtText} ~ ${code.expiresAtText}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopiedCodeId(code.codeId);
    } catch {
      setMessage("복사에 실패했어요. 코드를 직접 선택해 복사해 주세요.");
    }
  }

  const codeSlots = slots.filter((slot) => slot.accessType === "CODE_ONLY");
  const openSlots = slots.filter((slot) => slot.accessType === "OPEN");

  return (
    <div className="space-y-4">
      <div className="rounded-[1rem] border border-black/10 bg-white p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-black/45">
              분철 ID
            </span>
            <input
              className="h-11 w-40 rounded-[0.7rem] border border-black/10 px-3 text-[15px] font-semibold outline-none focus:border-black/30"
              inputMode="numeric"
              onChange={(event) => setBuncheolIdInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void load(buncheolIdInput.trim());
                }
              }}
              placeholder="예: 23"
              value={buncheolIdInput}
            />
          </label>
          <button
            className="h-11 rounded-full bg-black px-5 text-[14px] font-semibold text-white disabled:bg-black/25"
            disabled={isLoading || buncheolIdInput.trim().length === 0}
            onClick={() => void load(buncheolIdInput.trim())}
            type="button"
          >
            {isLoading ? "불러오는 중" : "불러오기"}
          </button>
        </div>
        {message ? (
          <p className="mt-3 text-[13px] font-medium leading-5 text-black/55">
            {message}
          </p>
        ) : null}
      </div>

      {codeSlots.length > 0 ? (
        <div className="space-y-2">
          {codeSlots.map((slot) => {
            const activeCode = slot.activeCode;
            const isPending = pendingSlotId === slot.buncheolMemberId;

            return (
              <div
                className="rounded-[1rem] border border-black/10 bg-white p-4"
                key={slot.buncheolMemberId}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[16px] font-semibold tracking-[-0.03em]">
                      {slot.memberName ?? `슬롯 #${slot.buncheolMemberId}`}
                    </p>
                    <p className="mt-0.5 text-[12px] font-medium text-black/45">
                      {formatPrice(slot.price)} · 슬롯 #{slot.buncheolMemberId}
                      {slot.taken ? " · 참여 확정됨 (발급 불가)" : ""}
                    </p>
                  </div>
                  {activeCode ? <CodeStatusBadge status={activeCode.status} /> : null}
                </div>

                {activeCode ? (
                  <div className="mt-3 rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[18px] font-semibold uppercase tracking-[0.14em]">
                        {activeCode.code}
                      </p>
                      <button
                        className="h-9 rounded-full bg-white px-3 text-[12px] font-semibold text-black/60 ring-1 ring-black/10"
                        onClick={() => void handleCopy(activeCode)}
                        type="button"
                      >
                        {copiedCodeId === activeCode.codeId
                          ? "복사됨"
                          : "DM용 복사"}
                      </button>
                    </div>
                    <p className="mt-2 text-[12px] font-medium leading-5 text-black/50">
                      {activeCode.issuedAtText && activeCode.expiresAtText
                        ? `${activeCode.issuedAtText} ~ ${activeCode.expiresAtText}`
                        : "유효 기간 정보 없음"}
                      {activeCode.issuedTo ? ` · ${activeCode.issuedTo}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-[13px] font-medium text-black/45">
                    아직 발급된 코드가 없어요.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="flex min-w-[180px] flex-1 flex-col gap-1">
                    <span className="text-[12px] font-semibold text-black/45">
                      발급 계정
                    </span>
                    <input
                      className="h-11 w-full rounded-[0.7rem] border border-black/10 px-3 text-[14px] outline-none focus:border-black/30"
                      onChange={(event) =>
                        setIssuedToBySlot((current) => ({
                          ...current,
                          [slot.buncheolMemberId]: event.target.value,
                        }))
                      }
                      placeholder="X_핸들 / N_블로그아이디"
                      value={issuedToBySlot[slot.buncheolMemberId] ?? ""}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-semibold text-black/45">
                      유효 시간
                    </span>
                    <input
                      className="h-11 w-24 rounded-[0.7rem] border border-black/10 px-3 text-[14px] font-semibold outline-none focus:border-black/30"
                      inputMode="numeric"
                      onChange={(event) =>
                        setValidHoursBySlot((current) => ({
                          ...current,
                          [slot.buncheolMemberId]: event.target.value,
                        }))
                      }
                      placeholder={String(DEFAULT_VALID_HOURS)}
                      value={validHoursBySlot[slot.buncheolMemberId] ?? ""}
                    />
                  </label>
                  {activeCode ? (
                    <>
                      <button
                        className="h-11 rounded-full bg-black px-4 text-[14px] font-semibold text-white disabled:bg-black/25"
                        disabled={isPending || slot.taken}
                        onClick={() => void handleIssue(slot, true)}
                        type="button"
                      >
                        {isPending ? "재발급 중" : "재발급"}
                      </button>
                      <button
                        className="h-11 rounded-full bg-[#fff1f0] px-4 text-[14px] font-semibold text-[#c03131]"
                        onClick={() => void handleRevoke(activeCode)}
                        type="button"
                      >
                        폐기
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="h-11 rounded-full bg-black px-4 text-[14px] font-semibold text-white disabled:bg-black/25"
                        disabled={isPending || slot.taken}
                        onClick={() => void handleIssue(slot, false)}
                        type="button"
                      >
                        {isPending ? "발급 중" : "코드 발급"}
                      </button>
                      <button
                        className="h-11 rounded-full bg-white px-4 text-[14px] font-semibold text-black/55 ring-1 ring-black/10 disabled:text-black/25"
                        disabled={slot.taken}
                        onClick={() => void handleAccessTypeChange(slot, "OPEN")}
                        type="button"
                      >
                        선착순으로 되돌리기
                      </button>
                    </>
                  )}
                </div>
                <p className="mt-2 text-[12px] font-medium leading-5 text-black/40">
                  발급 계정은 코드를 보낼 곳을 남기는 운영 메모예요 (예: X_buncheoleasy,
                  N_blogid). 유효 시간을 비우면 {DEFAULT_VALID_HOURS}시간이 적용돼요.
                  {activeCode ? " 재발급하면 위 코드는 즉시 무효가 돼요." : ""}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}

      {openSlots.length > 0 ? (
        <div className="rounded-[1rem] border border-black/10 bg-white p-4">
          <p className="text-[14px] font-semibold">선착순 슬롯</p>
          <p className="mt-1 text-[12px] font-medium leading-5 text-black/45">
            서포터즈에게 배정할 슬롯을 코드 참여로 바꿔요. 참여자가 있는 슬롯은
            바꿀 수 없어요.
          </p>
          <div className="mt-3 space-y-2">
            {openSlots.map((slot) => (
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-[0.8rem] bg-[#fafafa] px-3 py-2"
                key={slot.buncheolMemberId}
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold tracking-[-0.03em]">
                    {slot.memberName ?? `슬롯 #${slot.buncheolMemberId}`}
                  </p>
                  <p className="mt-0.5 text-[12px] font-medium text-black/45">
                    {formatPrice(slot.price)}
                    {slot.taken ? " · 참여자 있음" : ""}
                  </p>
                </div>
                <button
                  className="h-9 rounded-full bg-white px-3 text-[12px] font-semibold text-black/60 ring-1 ring-black/10 disabled:text-black/25"
                  disabled={slot.taken}
                  onClick={() => void handleAccessTypeChange(slot, "CODE_ONLY")}
                  type="button"
                >
                  코드 참여로 전환
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {codes.length > 0 ? (
        <div className="rounded-[1rem] border border-black/10 bg-white p-4">
          <p className="text-[14px] font-semibold">발급 이력</p>
          <div className="mt-3 space-y-2">
            {codes.map((code) => (
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-[0.8rem] bg-[#fafafa] px-3 py-2"
                key={code.codeId}
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold uppercase tracking-[0.1em]">
                    {code.code}
                  </p>
                  <p className="mt-0.5 text-[12px] font-medium text-black/45">
                    {code.memberName ?? "-"}
                    {code.issuedTo ? ` · ${code.issuedTo}` : ""}
                    {code.expiresAtText ? ` · ~${code.expiresAtText}` : ""}
                  </p>
                </div>
                <CodeStatusBadge status={code.status} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
