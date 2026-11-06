"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/components/Toast";
import { TestAccountAvatar } from "@/components/test-account/TestAccountAvatar";
import { useTestAccountView } from "@/components/test-account/use-test-account-view";
import {
  getPrimaryTestAccount,
  switchTestAccount,
  testAccountFirstTodos,
  testAccountRoleNames,
  type TestAccountRole,
} from "@/lib/test-account-store";

type TestAccountDeskPanelProps = {
  renderQr: (url: string) => ReactNode;
};

const roles: TestAccountRole[] = ["participant", "host"];

// 데스크톱 오른쪽 패널. 평가위원은 PC에서 볼 가능성이 높아 앱 밖에서도 역할과 할 일을 보여 준다.
export function TestAccountDeskPanel({ renderQr }: TestAccountDeskPanelProps) {
  const view = useTestAccountView();
  const queryClient = useQueryClient();
  const showToast = useAppToast();
  const [switchingRole, setSwitchingRole] = useState<TestAccountRole | null>(
    null,
  );
  const activeRole = view.activeAccount?.role ?? null;
  const origin = window.location.origin;
  const qrUrl = activeRole
    ? `${origin}/try/${activeRole}?next=${encodeURIComponent(view.pathname)}`
    : `${origin}${view.pathname}`;

  async function handlePick(role: TestAccountRole) {
    const account = getPrimaryTestAccount(view.accounts, role);

    if (!account || role === activeRole) {
      return;
    }

    setSwitchingRole(role);

    try {
      await switchTestAccount(account, queryClient);
    } catch {
      setSwitchingRole(null);
      showToast(
        "체험 계정으로 바꾸지 못했습니다. 잠시 뒤 다시 시도해 주십시오.",
        "error",
      );
    }
  }

  return (
    <div className="test-account-desk relative w-full">
      <Image
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -top-[80px] right-5 h-24 w-auto"
        height={240}
        src="/mascot/songni-wave.png"
        width={176}
      />
      <div className="relative rounded-[22px] bg-white p-5 text-[#111111] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_30px_60px_-20px_rgba(0,0,0,0.6)]">
        <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-[#f5f5f3] px-2.5 text-[12px] font-semibold text-black/70 shadow-[0_0_0_1px_rgba(17,17,17,0.06)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#9bd40a] shadow-[0_0_0_3px_rgba(155,212,10,0.18)]" />
          체험 환경
        </span>

        {activeRole ? (
          <>
            <p className="mt-4 text-[12.5px] font-semibold text-black/50">
              지금 역할
            </p>
            <p className="mt-0.5 text-[22px] font-bold tracking-[-0.045em]">
              {testAccountRoleNames[activeRole]}로 체험 중입니다
            </p>
          </>
        ) : (
          <p className="mt-4 text-[22px] font-bold leading-[1.35] tracking-[-0.045em] [word-break:keep-all]">
            {view.isWelcomeVisible
              ? "가운데 화면에서 역할을 고르십시오"
              : "역할을 고르면 바로 시작됩니다"}
          </p>
        )}

        <div
          aria-label="체험 역할"
          className="mt-4 grid grid-cols-2 rounded-xl bg-black/[0.06] p-[3px]"
          role="group"
        >
          {roles.map((role) => {
            const isActive = role === activeRole;

            return (
              <button
                aria-pressed={isActive}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] text-[13.5px] outline-none transition focus-visible:ring-2 focus-visible:ring-[#9bd40a] disabled:opacity-60 ${
                  isActive
                    ? "bg-white font-semibold text-[#111111] shadow-[0_1px_2px_rgba(17,17,17,0.12),0_0_0_1px_rgba(17,17,17,0.04)]"
                    : "font-medium text-black/60 hover:text-[#111111] active:scale-[0.97]"
                }`}
                disabled={switchingRole !== null}
                key={role}
                onClick={() => void handlePick(role)}
                type="button"
              >
                <TestAccountAvatar role={role} size={20} />
                {switchingRole === role
                  ? "바꾸는 중"
                  : testAccountRoleNames[role]}
              </button>
            );
          })}
        </div>

        {activeRole ? (
          <>
            <p className="mt-5 text-[12.5px] font-semibold text-black/50">
              먼저 해 볼 일
            </p>
            <ol className="mt-1">
              {testAccountFirstTodos[activeRole].map((todo, index, list) => (
                <li
                  className={`flex items-start gap-2.5 py-2 ${
                    index < list.length - 1 ? "border-b border-black/[0.06]" : ""
                  }`}
                  key={todo}
                >
                  <span className="mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-black/[0.06] text-[11px] font-bold text-black/60">
                    {index + 1}
                  </span>
                  <span className="text-[13.5px] leading-[1.5] [word-break:keep-all]">
                    {todo}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : null}

        <div className="mt-5 flex items-center gap-3 border-t border-black/[0.07] pt-4">
          {renderQr(qrUrl)}
          <div>
            <p className="text-[13.5px] font-semibold">폰으로 이어 보기</p>
            <p className="mt-0.5 text-[12px] leading-[1.5] text-black/50">
              카메라로 찍으면
              <br />
              {activeRole ? "같은 역할로 이어집니다" : "이 화면이 폰에서 열립니다"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
