"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, CloseIcon } from "@/components/icons";
import { TestAccountAvatar } from "@/components/test-account/TestAccountAvatar";
import {
  getPrimaryTestAccount,
  testAccountFirstTodos,
  testAccountRoleNames,
  type TestAccount,
  type TestAccountRole,
} from "@/lib/test-account-store";

type TestAccountSheetProps = {
  accounts: TestAccount[];
  activeAccount: TestAccount | null;
  onClose: () => void;
  onLeave: () => void;
  onSwitch: (account: TestAccount) => void;
  switchingAccountId: string | null;
};

const roles: TestAccountRole[] = ["participant", "host"];

export function TestAccountSheet({
  accounts,
  activeAccount,
  onClose,
  onLeave,
  onSwitch,
  switchingAccountId,
}: TestAccountSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const primaryAccounts = roles.flatMap((role) => {
    const account = getPrimaryTestAccount(accounts, role);

    return account ? [account] : [];
  });
  const otherAccounts = accounts.filter(
    (account) => !primaryAccounts.includes(account),
  );
  const [isOthersOpen, setIsOthersOpen] = useState(
    Boolean(activeAccount && otherAccounts.includes(activeAccount)),
  );
  const isBusy = switchingAccountId !== null;

  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="test-account-sheet-backdrop fixed inset-0 z-[70] flex items-end bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-labelledby="test-account-sheet-title"
        aria-modal="true"
        className="test-account-sheet max-h-[92%] w-full overflow-y-auto rounded-t-[28px] bg-[#fafaf8] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_-20px_50px_rgba(0,0,0,0.18)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="mx-auto h-[5px] w-9 rounded-full bg-black/15" />
        <div className="mt-4 flex items-center justify-between px-1">
          <h2
            className="text-[21px] font-bold tracking-[-0.045em] text-[#111111]"
            id="test-account-sheet-title"
          >
            역할 바꾸기
          </h2>
          <button
            aria-label="닫기"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.06] text-black/60 outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-[#9bd40a]"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-0.5 px-1 text-[13px] text-black/50">
          바꾸면 그 역할의 첫 화면으로 이동합니다
        </p>

        <div className="mt-4 grid gap-2.5">
          {primaryAccounts.map((account) => {
            const isActive = activeAccount?.id === account.id;

            return (
              <div
                className={`rounded-[18px] bg-white p-3.5 ${
                  isActive
                    ? "shadow-[0_0_0_1.5px_#111111,0_0_0_5px_rgba(215,255,95,0.55)]"
                    : "shadow-[0_0_0_1px_rgba(17,17,17,0.09)]"
                }`}
                key={account.id}
              >
                <div className="flex items-center gap-3">
                  <TestAccountAvatar role={account.role} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold tracking-[-0.03em] text-[#111111]">
                      {testAccountRoleNames[account.role]}
                    </p>
                    <p className="text-[12.5px] text-black/50">
                      {account.label} 계정
                    </p>
                  </div>
                  {isActive ? (
                    <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-[#f3f7e6] px-2.5 text-[12px] font-semibold text-[#4d6117]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#8cc20a]" />
                      사용 중
                    </span>
                  ) : (
                    <button
                      className="inline-flex h-[34px] items-center rounded-[11px] bg-[#111111] px-3.5 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-[#9bd40a] disabled:opacity-60"
                      disabled={isBusy}
                      onClick={() => onSwitch(account)}
                      type="button"
                    >
                      {switchingAccountId === account.id ? "바꾸는 중" : "바꾸기"}
                    </button>
                  )}
                </div>
                <div className="mt-3 border-t border-dashed border-black/10 pt-2.5">
                  <p className="text-[12px] font-semibold text-black/45">
                    먼저 해 볼 일
                  </p>
                  <p className="mt-0.5 text-[14px] text-[#111111]">
                    {testAccountFirstTodos[account.role][0]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {otherAccounts.length > 0 ? (
          <div className="mt-3.5 border-t border-black/[0.07]">
            <button
              aria-expanded={isOthersOpen}
              className="flex w-full items-center justify-between px-1 py-3 text-[14px] font-medium text-black/70 outline-none focus-visible:ring-2 focus-visible:ring-[#9bd40a]"
              onClick={() => setIsOthersOpen((value) => !value)}
              type="button"
            >
              다른 체험 계정 {otherAccounts.length}개
              <span
                className={`text-black/40 transition-transform duration-200 ${
                  isOthersOpen ? "rotate-180" : ""
                }`}
              >
                <ChevronDownIcon className="h-4 w-4" />
              </span>
            </button>
            {isOthersOpen ? (
              <div className="mb-2 overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgba(17,17,17,0.07)]">
                {otherAccounts.map((account, index) => {
                  const isActive = activeAccount?.id === account.id;

                  return (
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 ${
                        index < otherAccounts.length - 1
                          ? "border-b border-black/[0.06]"
                          : ""
                      }`}
                      key={account.id}
                    >
                      <TestAccountAvatar role={account.role} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-[#111111]">
                          {account.label}
                        </p>
                        <p className="text-[12px] text-black/50">
                          {testAccountRoleNames[account.role]}, userId{" "}
                          {account.userId}
                        </p>
                      </div>
                      {isActive ? (
                        <span className="text-[12px] font-semibold text-[#4d6117]">
                          사용 중
                        </span>
                      ) : (
                        <button
                          className="inline-flex h-[30px] items-center rounded-[9px] bg-black/[0.06] px-3 text-[12.5px] font-semibold text-[#111111] outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-[#9bd40a] disabled:opacity-60"
                          disabled={isBusy}
                          onClick={() => onSwitch(account)}
                          type="button"
                        >
                          {switchingAccountId === account.id
                            ? "바꾸는 중"
                            : "바꾸기"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          className="mt-1 w-full py-2 text-center text-[13px] text-black/45 underline-offset-[3px] outline-none hover:underline focus-visible:underline disabled:opacity-60"
          disabled={isBusy}
          onClick={onLeave}
          type="button"
        >
          처음 화면으로 돌아가기
        </button>
      </section>
    </div>
  );
}
