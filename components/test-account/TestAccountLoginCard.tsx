"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ForwardIcon } from "@/components/icons";
import { useAppToast } from "@/components/Toast";
import { TestAccountAvatar } from "@/components/test-account/TestAccountAvatar";
import {
  getPrimaryTestAccount,
  getTestAccountHome,
  switchTestAccount,
  testAccountRoleNames,
  type TestAccount,
} from "@/lib/test-account-store";

type TestAccountLoginCardProps = {
  accounts: TestAccount[];
  returnHref: string;
};

// 로그인 화면의 기본 돌아갈 곳(/profile)이면 역할의 첫 화면으로, 신청하다 들어왔으면 그 화면으로 돌려보낸다.
export function TestAccountLoginCard({
  accounts,
  returnHref,
}: TestAccountLoginCardProps) {
  const queryClient = useQueryClient();
  const showToast = useAppToast();
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(
    null,
  );
  const primaryAccounts = (["participant", "host"] as const).flatMap(
    (role) => {
      const account = getPrimaryTestAccount(accounts, role);

      return account ? [account] : [];
    },
  );

  async function handleSwitch(account: TestAccount) {
    setSwitchingAccountId(account.id);

    try {
      await switchTestAccount(
        account,
        queryClient,
        returnHref === "/profile" ? getTestAccountHome(account.role) : returnHref,
      );
    } catch {
      setSwitchingAccountId(null);
      showToast(
        "체험 계정으로 바꾸지 못했습니다. 잠시 뒤 다시 시도해 주십시오.",
        "error",
      );
    }
  }

  return (
    <div className="mt-6">
      <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(17,17,17,0.08),0_12px_30px_-16px_rgba(17,17,17,0.2)]">
        <div className="flex items-center justify-between border-b border-black/[0.07] px-3.5 py-2.5">
          <span className="text-[13px] font-semibold text-[#111111]">
            체험 계정으로 바로 시작
          </span>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-black/50">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9bd40a]" />
            카카오 로그인 없이
          </span>
        </div>
        {primaryAccounts.map((account, index) => (
          <button
            className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left outline-none transition-colors hover:bg-black/[0.02] focus-visible:bg-[#f3f7e6] active:bg-black/[0.04] disabled:opacity-60 ${
              index < primaryAccounts.length - 1
                ? "border-b border-black/[0.07]"
                : ""
            }`}
            disabled={switchingAccountId !== null}
            key={account.id}
            onClick={() => void handleSwitch(account)}
            type="button"
          >
            <TestAccountAvatar role={account.role} size={36} />
            <span className="flex-1 text-[15px] font-semibold tracking-[-0.03em] text-[#111111]">
              {switchingAccountId === account.id
                ? "체험 계정으로 들어가는 중입니다"
                : `${testAccountRoleNames[account.role]}로 체험`}
            </span>
            <span className="text-black/35">
              <ForwardIcon className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[12px] text-black/40">
        카카오 계정으로 가입해 사용할 수도 있습니다
      </p>
    </div>
  );
}
