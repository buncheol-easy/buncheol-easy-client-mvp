"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTestAccountView } from "@/components/test-account/use-test-account-view";
import {
  getPrimaryTestAccount,
  switchTestAccount,
  testAccountRoleNames,
  testAccountStartHref,
  type TestAccountRole,
} from "@/lib/test-account-store";

type TestAccountTryEntryProps = {
  next?: string;
  role: TestAccountRole | null;
};

export function TestAccountTryEntry({ next, role }: TestAccountTryEntryProps) {
  const view = useTestAccountView();
  const queryClient = useQueryClient();
  const [isFailed, setIsFailed] = useState(false);
  const hasStartedRef = useRef(false);
  const isReady = view.isEnabled || view.isLoaded;

  useEffect(() => {
    if (!isReady || hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    const account = role ? getPrimaryTestAccount(view.accounts, role) : null;

    if (!account) {
      window.location.replace(view.isEnabled ? testAccountStartHref : "/");
      return;
    }

    switchTestAccount(account, queryClient, next).catch(() => {
      setIsFailed(true);
    });
  }, [isReady, next, queryClient, role, view.accounts, view.isEnabled]);

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <Image
        alt=""
        aria-hidden="true"
        className="h-[120px] w-auto"
        height={240}
        priority
        src="/mascot/songni-wave.png"
        width={176}
      />
      {isFailed ? (
        <>
          <p className="mt-6 text-[18px] font-bold tracking-[-0.04em]">
            체험 계정을 불러오지 못했습니다
          </p>
          <p className="mt-2 text-[14px] text-black/55">
            잠시 뒤 다시 열거나 역할 고르기에서 다시 골라 주십시오.
          </p>
          <Link
            className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#111111] px-5 text-[14px] font-semibold text-white"
            href={testAccountStartHref}
          >
            역할 고르기로 가기
          </Link>
        </>
      ) : (
        <p className="mt-6 text-[16px] font-semibold tracking-[-0.03em] text-black/70" role="status">
          {role
            ? `${testAccountRoleNames[role]} 체험 계정으로 들어가는 중입니다`
            : "역할 고르기로 이동합니다"}
        </p>
      )}
    </div>
  );
}
