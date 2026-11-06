"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/components/Toast";
import {
  getTestAccountChipPlacement,
  TestAccountChip,
  TestAccountTip,
} from "@/components/test-account/TestAccountChip";
import { TestAccountSheet } from "@/components/test-account/TestAccountSheet";
import { useTestAccountView } from "@/components/test-account/use-test-account-view";
import {
  closeTestAccountSheet,
  getTestAccountStartHrefWithReturn,
  isTestAccountTipSeen,
  leaveTestAccount,
  markTestAccountTipSeen,
  openTestAccountSheet,
  switchTestAccount,
  takePendingTestAccountToast,
  type TestAccount,
} from "@/lib/test-account-store";

const tipDurationMs = 6000;

// 데스크톱에서는 main 이 앱 틀이고 그 안의 fixed 가 틀 기준으로 바뀐다(globals.css). 그래서 main 안에 그린다.
function subscribeFrame(onChange: () => void) {
  const observer = new MutationObserver(onChange);

  observer.observe(document.body, { childList: true });

  return () => observer.disconnect();
}

function getFrame() {
  return document.querySelector<HTMLElement>("body > main");
}

export function TestAccountLayer() {
  const view = useTestAccountView();
  const frame = useSyncExternalStore(subscribeFrame, getFrame, () => null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const showToast = useAppToast();
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(
    null,
  );
  const [isTipClosed, setIsTipClosed] = useState(false);
  const placement = getTestAccountChipPlacement(view.pathname);
  const isTipVisible =
    view.activeAccount !== null &&
    placement !== null &&
    !view.isSheetOpen &&
    !isTipClosed &&
    !isTestAccountTipSeen();

  useEffect(() => {
    if (!view.isEnabled) {
      return;
    }

    const message = takePendingTestAccountToast();

    if (message) {
      showToast(message, "success");
    }
  }, [showToast, view.isEnabled]);

  useEffect(() => {
    if (!isTipVisible) {
      return;
    }

    const timer = window.setTimeout(() => {
      markTestAccountTipSeen();
      setIsTipClosed(true);
    }, tipDurationMs);

    return () => window.clearTimeout(timer);
  }, [isTipVisible]);

  if (!view.isEnabled || !frame) {
    return null;
  }

  function closeTip() {
    markTestAccountTipSeen();
    setIsTipClosed(true);
  }

  async function handleSwitch(account: TestAccount) {
    setSwitchingAccountId(account.id);

    try {
      await switchTestAccount(account, queryClient);
    } catch {
      setSwitchingAccountId(null);
      showToast(
        "체험 계정으로 바꾸지 못했습니다. 잠시 뒤 다시 시도해 주십시오.",
        "error",
      );
    }
  }

  function handleChipClick() {
    closeTip();

    if (view.isLoggedIn) {
      openTestAccountSheet();
    } else {
      router.push(getTestAccountStartHrefWithReturn());
    }
  }

  return createPortal(
    <>
      {placement ? (
        <TestAccountChip
          activeAccount={view.activeAccount}
          isIntro={isTipVisible}
          isLoggedIn={view.isLoggedIn}
          onClick={handleChipClick}
          placement={placement}
        />
      ) : null}
      {placement && isTipVisible ? (
        <TestAccountTip onClose={closeTip} placement={placement} />
      ) : null}
      {view.isSheetOpen ? (
        <TestAccountSheet
          accounts={view.accounts}
          activeAccount={view.activeAccount}
          onClose={closeTestAccountSheet}
          onLeave={() => leaveTestAccount(queryClient)}
          onSwitch={(account) => void handleSwitch(account)}
          switchingAccountId={switchingAccountId}
        />
      ) : null}
    </>,
    frame,
  );
}
