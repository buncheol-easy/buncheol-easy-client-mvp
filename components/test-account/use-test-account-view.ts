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
  loadTestAccounts,
  readTestAccountState,
  subscribeTestAccountState,
  syncActiveTestAccount,
  testAccountStartHref,
} from "@/lib/test-account-store";

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

  return {
    accounts: testAccountState.accounts,
    activeAccount,
    isEnabled,
    isLoaded: testAccountState.status === "ready",
    isLoggedIn,
    isSheetOpen: testAccountState.isSheetOpen,
    isStartPage: pathname === testAccountStartHref,
    pathname,
  };
}
