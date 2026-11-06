"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import {
  getInitialTestAccountState,
  isTestAccountWelcomeDismissed,
  loadTestAccounts,
  readTestAccountState,
  subscribeTestAccountState,
  syncActiveTestAccount,
} from "@/lib/test-account-store";

const welcomeHiddenPaths =
  /^\/(admin|try|login|signup|search|privacy|terms|refund-policy|shipping-policy|broker-notice)(\/|$)/;

export function useTestAccountView() {
  const pathname = usePathname();
  const testAccountState = useSyncExternalStore(
    subscribeTestAccountState,
    readTestAccountState,
    getInitialTestAccountState,
  );
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const isEnabled =
    testAccountState.status === "ready" && testAccountState.accounts.length > 0;
  const isLoggedIn = authState.isLoggedIn && Boolean(authState.accessToken);

  useEffect(() => {
    loadTestAccounts();
  }, []);

  useEffect(() => {
    if (isEnabled) {
      syncActiveTestAccount(isLoggedIn ? authState.accessToken : null);
    }
  }, [authState.accessToken, isEnabled, isLoggedIn]);

  const activeAccount = isLoggedIn
    ? (testAccountState.accounts.find(
        (account) => account.id === testAccountState.activeAccountId,
      ) ?? null)
    : null;
  const isWelcomeVisible =
    isEnabled &&
    !welcomeHiddenPaths.test(pathname) &&
    (testAccountState.isWelcomeRequested ||
      (!isLoggedIn && !isTestAccountWelcomeDismissed()));

  return {
    accounts: testAccountState.accounts,
    activeAccount,
    isEnabled,
    isLoaded: testAccountState.status === "ready",
    isLoggedIn,
    isSheetOpen: testAccountState.isSheetOpen,
    isWelcomeVisible,
    pathname,
  };
}
