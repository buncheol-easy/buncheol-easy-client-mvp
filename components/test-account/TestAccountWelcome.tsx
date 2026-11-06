"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { BrandSparkleIcon, ForwardIcon } from "@/components/icons";
import { TestAccountAvatar } from "@/components/test-account/TestAccountAvatar";
import type { TestAccountRole } from "@/lib/test-account-store";

const roleRows: {
  description: string;
  role: TestAccountRole;
  title: string;
}[] = [
  {
    description: "멤버 자리를 신청하고 입금부터 수령까지 확인합니다",
    role: "participant",
    title: "참여자로 체험",
  },
  {
    description: "AI로 개최글을 만들고 입금 확인과 발송을 처리합니다",
    role: "host",
    title: "개최자로 체험",
  },
];

type TestAccountWelcomeProps = {
  availableRoles: TestAccountRole[];
  onBrowse: () => void;
  onPick: (role: TestAccountRole) => void;
  switchingRole: TestAccountRole | null;
};

export function TestAccountWelcome({
  availableRoles,
  onBrowse,
  onPick,
  switchingRole,
}: TestAccountWelcomeProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const rows = roleRows.filter((row) => availableRoles.includes(row.role));

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="test-account-welcome-title"
      aria-modal="true"
      className="test-account-welcome fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-[#f6f6f3] px-5 pb-[calc(1.75rem+env(safe-area-inset-bottom))] pt-[calc(1.1rem+env(safe-area-inset-top))]"
      role="dialog"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-[7px] text-[16px] font-bold tracking-[-0.03em] text-[#111111]">
          <BrandSparkleIcon className="h-[15px] w-[15px]" />
          분철이지
        </span>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white px-2.5 text-[12px] font-semibold text-black/70 shadow-[0_0_0_1px_rgba(17,17,17,0.08)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#9bd40a] shadow-[0_0_0_3px_rgba(155,212,10,0.18)]" />
          체험 환경
        </span>
      </div>

      <h1
        className="mt-14 text-[30px] font-bold leading-[1.25] tracking-[-0.045em] text-[#111111] outline-none"
        id="test-account-welcome-title"
        ref={headingRef}
        tabIndex={-1}
      >
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
          className="test-account-welcome__mascot pointer-events-none absolute -top-[108px] right-3 h-[120px] w-auto"
          height={240}
          priority
          src="/mascot/songni-wave.png"
          width={176}
        />
        <div className="relative overflow-hidden rounded-[22px] bg-white shadow-[0_0_0_1px_rgba(17,17,17,0.06),0_1px_2px_rgba(17,17,17,0.04),0_16px_40px_-16px_rgba(17,17,17,0.18)]">
          {rows.map((row, index) => (
            <button
              className={`flex w-full items-center gap-3.5 p-4 text-left outline-none transition-colors hover:bg-black/[0.02] focus-visible:bg-[#f3f7e6] active:bg-black/[0.04] disabled:opacity-60 ${
                index < rows.length - 1 ? "border-b border-black/[0.07]" : ""
              }`}
              disabled={switchingRole !== null}
              key={row.role}
              onClick={() => onPick(row.role)}
              type="button"
            >
              <TestAccountAvatar role={row.role} size={48} />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold tracking-[-0.03em] text-[#111111]">
                  {row.title}
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

      <button
        className="mx-auto mt-auto pt-10 text-[13px] font-medium text-black/50 underline-offset-[3px] outline-none hover:underline focus-visible:underline"
        onClick={onBrowse}
        type="button"
      >
        로그인 없이 둘러보기
      </button>
    </section>
  );
}
