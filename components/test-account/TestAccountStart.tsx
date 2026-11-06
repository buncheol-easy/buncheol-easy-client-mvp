"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BrandSparkleIcon, ForwardIcon } from "@/components/icons";
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

const roleRows: {
  description: string;
  role: TestAccountRole;
}[] = [
  {
    description: "멤버 자리를 신청하고 입금부터 수령까지 확인합니다",
    role: "participant",
  },
  {
    description: "AI로 개최글을 만들고 입금 확인과 발송을 처리합니다",
    role: "host",
  },
];

type TestAccountStartProps = {
  next?: string;
};

// 평가위원에게 주는 체험 입구(/try). 역할을 고르면 그 역할의 체험 계정으로 로그인한다.
export function TestAccountStart({ next }: TestAccountStartProps) {
  const view = useTestAccountView();
  const queryClient = useQueryClient();
  const showToast = useAppToast();
  const [switchingRole, setSwitchingRole] = useState<TestAccountRole | null>(
    null,
  );
  const rows = roleRows.filter((row) =>
    view.accounts.some((account) => account.role === row.role),
  );

  async function handlePick(role: TestAccountRole) {
    const account = getPrimaryTestAccount(view.accounts, role);

    if (!account) {
      return;
    }

    setSwitchingRole(role);

    try {
      await switchTestAccount(account, queryClient, next);
    } catch {
      setSwitchingRole(null);
      showToast(
        "체험 계정으로 바꾸지 못했습니다. 잠시 뒤 다시 시도해 주십시오.",
        "error",
      );
    }
  }

  if (view.isLoaded && !view.isEnabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-[18px] font-bold tracking-[-0.04em]">
          이 환경에서는 체험 계정을 쓸 수 없습니다
        </p>
        <Link
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#111111] px-5 text-[14px] font-semibold text-white"
          href="/"
        >
          첫 화면으로 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="test-account-start flex min-h-full flex-col px-5 pb-[calc(1.75rem+env(safe-area-inset-bottom))] pt-[calc(1.1rem+env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-[7px] text-[16px] font-bold tracking-[-0.03em] text-[#111111]">
            <BrandSparkleIcon className="h-[15px] w-[15px]" />
            분철이지
          </span>
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white px-2.5 text-[12px] font-semibold text-black/70 shadow-[0_0_0_1px_rgba(17,17,17,0.08)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9bd40a] shadow-[0_0_0_3px_rgba(155,212,10,0.18)]" />
            체험 환경
          </span>
        </div>
        <Link
          className="-mr-2 inline-flex h-9 items-center rounded-lg px-2 text-[13px] font-medium text-black/55 outline-none transition-colors hover:bg-black/[0.04] hover:text-[#111111] focus-visible:ring-2 focus-visible:ring-[#9bd40a]"
          href="/"
        >
          로그인 없이 둘러보기
        </Link>
      </div>

      <h1 className="mt-14 text-[30px] font-bold leading-[1.25] tracking-[-0.045em] text-[#111111]">
        역할을 고르면
        <br />
        바로 시작됩니다
      </h1>
      <p className="mt-3 text-[14px] leading-[1.6] text-black/55 [word-break:keep-all]">
        로그인 없이 체험 계정으로 들어갑니다.
        <br />
        체험 중 입금과 알림은 실제로 오가지 않습니다.
      </p>

      <div className="relative mt-[132px]">
        <Image
          alt=""
          aria-hidden="true"
          className="test-account-start__mascot pointer-events-none absolute -top-[108px] right-3 h-[120px] w-auto"
          height={240}
          priority
          src="/mascot/songni-wave.png"
          width={176}
        />
        <div className="relative overflow-hidden rounded-[22px] bg-white shadow-[0_0_0_1px_rgba(17,17,17,0.06),0_1px_2px_rgba(17,17,17,0.04),0_16px_40px_-16px_rgba(17,17,17,0.18)]">
          {rows.length === 0 ? (
            <div className="p-4">
              <div className="skeleton-surface h-12 rounded-xl" />
              <div className="skeleton-surface mt-3 h-12 rounded-xl" />
            </div>
          ) : null}
          {rows.map((row, index) => (
            <button
              className={`flex w-full items-center gap-3.5 p-4 text-left outline-none transition-colors hover:bg-black/[0.02] focus-visible:bg-[#f3f7e6] active:bg-black/[0.04] disabled:opacity-60 ${
                index < rows.length - 1 ? "border-b border-black/[0.07]" : ""
              }`}
              disabled={switchingRole !== null}
              key={row.role}
              onClick={() => void handlePick(row.role)}
              type="button"
            >
              <TestAccountAvatar role={row.role} size={48} />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold tracking-[-0.03em] text-[#111111]">
                  {testAccountRoleNames[row.role]}로 체험
                </span>
                <span className="mt-0.5 block text-[13px] leading-[1.5] text-black/55 [word-break:keep-all]">
                  {switchingRole === row.role
                    ? "체험 계정으로 들어가는 중입니다"
                    : row.description}
                </span>
              </span>
              <span className="text-black/35">
                <ForwardIcon className="h-[18px] w-[18px]" />
              </span>
            </button>
          ))}
        </div>
      </div>

      <section aria-labelledby="test-account-start-guide" className="mt-8">
        <h2
          className="px-1 text-[15px] font-bold tracking-[-0.03em] text-[#111111]"
          id="test-account-start-guide"
        >
          역할마다 먼저 해 볼 일
        </h2>
        <div className="mt-3 grid gap-2.5">
          {rows.map((row) => (
            <div
              className="rounded-[18px] bg-white p-4 shadow-[0_0_0_1px_rgba(17,17,17,0.06)]"
              key={row.role}
            >
              <div className="flex items-center gap-2">
                <TestAccountAvatar role={row.role} size={24} />
                <p className="text-[14px] font-semibold text-[#111111]">
                  {testAccountRoleNames[row.role]}
                </p>
              </div>
              <ol className="mt-2">
                {testAccountFirstTodos[row.role].map((todo, index) => (
                  <li
                    className="flex items-start gap-2.5 py-1.5 text-[13.5px] leading-[1.5] text-[#111111] [word-break:keep-all]"
                    key={todo}
                  >
                    <span className="mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-black/[0.06] text-[11px] font-bold text-black/60">
                      {index + 1}
                    </span>
                    {todo}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <p className="mt-3 px-1 text-[12.5px] leading-[1.6] text-black/45 [word-break:keep-all]">
          체험 계정은 여러 분이 함께 씁니다. 다른 분이 먼저 바꾼 내용이 보일 수
          있습니다. 역할은 화면 오른쪽 위에서 언제든 바꿀 수 있습니다.
        </p>
      </section>

    </div>
  );
}
