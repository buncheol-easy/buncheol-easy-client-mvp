"use client";

import type { CSSProperties } from "react";
import { SwapIcon } from "@/components/icons";
import { TestAccountAvatar } from "@/components/test-account/TestAccountAvatar";
import {
  testAccountRoleNames,
  type TestAccount,
} from "@/lib/test-account-store";

export type TestAccountChipPlacement = {
  compact: boolean;
  style: CSSProperties;
  tone: "dark" | "light";
};

const chipTop = "calc(env(safe-area-inset-top, 0px) + 9px)";

// 머리말 오른쪽이 비어 있는 화면은 오른쪽 위에 둔다. 홈은 종 왼쪽, 상세와 관리는 오른쪽이 버튼으로 차 있어
// 뒤로 가기 버튼 옆에 아바타만 둔다.
export function getTestAccountChipPlacement(
  pathname: string,
): TestAccountChipPlacement | null {
  if (/^\/(admin|try|login|signup|search)(\/|$)/.test(pathname)) {
    return null;
  }

  if (pathname === "/") {
    return { compact: false, style: { right: 62, top: chipTop }, tone: "dark" };
  }

  if (/^\/products\/[^/]+\/manage(\/|$)/.test(pathname)) {
    return { compact: true, style: { left: 68, top: chipTop }, tone: "light" };
  }

  if (/^\/products\/[^/]+$/.test(pathname)) {
    return { compact: true, style: { left: 64, top: chipTop }, tone: "light" };
  }

  return { compact: false, style: { right: 16, top: chipTop }, tone: "light" };
}

type TestAccountChipProps = {
  activeAccount: TestAccount | null;
  isIntro: boolean;
  isLoggedIn: boolean;
  onClick: () => void;
  placement: TestAccountChipPlacement;
};

export function TestAccountChip({
  activeAccount,
  isIntro,
  isLoggedIn,
  onClick,
  placement,
}: TestAccountChipProps) {
  const isDark = placement.tone === "dark";
  const caption = activeAccount ? "체험 중" : "체험 계정";
  const title = activeAccount
    ? testAccountRoleNames[activeAccount.role]
    : isLoggedIn
      ? "바꾸기"
      : "시작하기";

  return (
    <button
      aria-label={
        activeAccount
          ? `${title}로 체험 중입니다. 역할을 바꿉니다`
          : `체험 계정 ${title}`
      }
      className="test-account-chip fixed z-[35] flex items-center gap-2.5 rounded-full outline-none transition-transform duration-150 ease-out active:scale-95 focus-visible:ring-2 focus-visible:ring-[#9bd40a] focus-visible:ring-offset-2"
      onClick={onClick}
      style={placement.style}
      type="button"
    >
      {placement.compact ? null : (
        <span className="text-right leading-[1.15]">
          <span
            className={`block text-[11px] font-medium ${
              isDark ? "text-white/55" : "text-black/50"
            }`}
          >
            {caption}
          </span>
          <span
            className={`block text-[14px] font-bold tracking-[-0.03em] ${
              isDark ? "text-white" : "text-[#111111]"
            }`}
          >
            {title}
          </span>
        </span>
      )}
      <span
        className={`test-account-chip__ring relative inline-flex rounded-full p-[2px] ${
          isIntro ? "test-account-chip__ring--intro" : ""
        }`}
      >
        <span
          className={`inline-flex rounded-full p-[2px] ${
            isDark ? "bg-black" : "bg-white"
          }`}
        >
          <TestAccountAvatar role={activeAccount?.role ?? null} size={34} />
        </span>
        <span
          className={`absolute -bottom-[3px] -right-[3px] inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#111111] text-[#d7ff5f] ${
            isDark ? "ring-2 ring-black" : "ring-2 ring-white"
          }`}
        >
          <SwapIcon className="h-[10px] w-[10px]" />
        </span>
      </span>
    </button>
  );
}

type TestAccountTipProps = {
  onClose: () => void;
  placement: TestAccountChipPlacement;
};

export function TestAccountTip({ onClose, placement }: TestAccountTipProps) {
  const horizontal =
    "right" in placement.style
      ? { right: Number(placement.style.right) - 8 }
      : { left: Number(placement.style.left) - 8 };

  return (
    <button
      className="test-account-tip fixed z-[35] rounded-xl bg-white px-3 py-2 text-[13px] font-medium tracking-[-0.03em] text-[#111111] shadow-[0_0_0_1px_rgba(17,17,17,0.06),0_12px_28px_-10px_rgba(17,17,17,0.35)]"
      onClick={onClose}
      style={{
        ...horizontal,
        top: "calc(env(safe-area-inset-top, 0px) + 60px)",
      }}
      type="button"
    >
      <span
        aria-hidden="true"
        className={`absolute -top-[5px] h-2.5 w-2.5 rotate-45 bg-white ${
          "right" in placement.style ? "right-[26px]" : "left-[26px]"
        }`}
      />
      역할은 여기서 언제든 바꿀 수 있습니다
    </button>
  );
}
