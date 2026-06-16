"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
  writeAuthTokens,
} from "@/lib/auth-store";

type TestAccount = {
  id: string;
  label: string;
  userId: string;
};

type TestAccountsResponse = {
  accounts?: TestAccount[];
  enabled?: boolean;
};

type SwitchAccountResponse = {
  accessToken?: string;
  label?: string;
};

async function readJsonResponse<T>(response: Response) {
  if (!response.ok) {
    throw new Error("테스트 계정 정보를 불러오지 못했어요.");
  }

  return (await response.json()) as T;
}

export function TestAccountSwitcher() {
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const [accounts, setAccounts] = useState<TestAccount[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(
    null,
  );
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const reloadTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const activeAccount =
    accounts.find((account) => account.id === activeAccountId) ?? null;

  useEffect(() => {
    let isSubscribed = true;

    fetch("/api/test-accounts", {
      cache: "no-store",
    })
      .then((response) => readJsonResponse<TestAccountsResponse>(response))
      .then((data) => {
        if (!isSubscribed) {
          return;
        }

        setAccounts(data.enabled === true ? data.accounts ?? [] : []);
        setIsLoaded(true);
      })
      .catch(() => {
        if (isSubscribed) {
          setAccounts([]);
          setIsLoaded(true);
        }
      });

    return () => {
      isSubscribed = false;

      if (reloadTimerRef.current !== null) {
        window.clearTimeout(reloadTimerRef.current);
      }

      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!authState.accessToken || accounts.length === 0) {
      setActiveAccountId(null);
      return;
    }

    fetch("/api/test-accounts/active", {
      cache: "no-store",
      headers: {
        authorization: `Bearer ${authState.accessToken}`,
      },
    })
      .then((response) => readJsonResponse<{ accountId?: string }>(response))
      .then((data) => {
        setActiveAccountId(data.accountId ?? null);
      })
      .catch(() => {
        setActiveAccountId(null);
      });
  }, [accounts.length, authState.accessToken]);

  function showToast(message: string) {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage("");
      toastTimerRef.current = null;
    }, 1800);
  }

  async function switchAccount(account: TestAccount) {
    if (switchingAccountId) {
      return;
    }

    setSwitchingAccountId(account.id);

    try {
      const response = await fetch("/api/test-accounts", {
        body: JSON.stringify({ accountId: account.id }),
        cache: "no-store",
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const data = await readJsonResponse<SwitchAccountResponse>(response);

      if (!data.accessToken) {
        throw new Error("테스트 계정 토큰을 가져오지 못했어요.");
      }

      writeAuthTokens({ accessToken: data.accessToken });
      setActiveAccountId(account.id);
      setIsOpen(false);
      showToast(`${data.label ?? account.label}로 전환했어요.`);

      reloadTimerRef.current = window.setTimeout(() => {
        window.location.reload();
      }, 450);
    } catch {
      showToast("계정 전환에 실패했어요.");
    } finally {
      setSwitchingAccountId(null);
    }
  }

  if (!isLoaded || accounts.length === 0) {
    return null;
  }

  return (
    <>
      <button
        aria-label="테스트 계정 전환"
        className="fixed right-4 z-[60] h-11 min-w-16 rounded-full bg-black px-4 text-[12px] font-bold text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] ring-1 ring-white/15"
        onClick={() => setIsOpen(true)}
        style={{
          bottom: "calc(5.25rem + env(safe-area-inset-bottom))",
        }}
        type="button"
      >
        <span className="block leading-none">TEST</span>
        <span className="mt-0.5 block max-w-12 truncate text-[9px] font-semibold text-white/65">
          {activeAccount?.label ?? "계정"}
        </span>
      </button>

      {toastMessage ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[80] flex justify-center px-5">
          <div className="rounded-full bg-black/92 px-4 py-3 text-[13px] font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
            {toastMessage}
          </div>
        </div>
      ) : null}

      {isOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end bg-black/35"
          onClick={() => setIsOpen(false)}
          role="presentation"
        >
          <section
            aria-label="테스트 계정 전환"
            className="mx-auto w-full max-w-[430px] rounded-t-[1.4rem] bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto h-1 w-12 rounded-full bg-black/15" />
            <div className="mt-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-bold text-black/35">
                  TEST REMOTE
                </p>
                <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.06em] text-black">
                  계정 전환
                </h2>
              </div>
              <button
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-[22px] font-light leading-none text-white"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-2">
              {accounts.map((account) => {
                const isActive = activeAccount?.id === account.id;
                const isSwitching = switchingAccountId === account.id;

                return (
                  <button
                    aria-pressed={isActive}
                    className={`flex h-14 items-center justify-between rounded-[1rem] px-4 text-left transition ${
                      isActive
                        ? "bg-black text-white"
                        : "bg-[#f5f5f5] text-black active:bg-black/10"
                    }`}
                    disabled={switchingAccountId !== null}
                    key={account.id}
                    onClick={() => void switchAccount(account)}
                    type="button"
                  >
                    <span>
                      <span className="block text-[16px] font-semibold tracking-[-0.04em]">
                        {account.label}
                      </span>
                      <span
                        className={`mt-0.5 block text-[12px] font-semibold ${
                          isActive ? "text-white/55" : "text-black/35"
                        }`}
                      >
                        userId {account.userId}
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-[12px] font-bold ${
                        isActive
                          ? "bg-white text-black"
                          : "bg-white text-black/45"
                      }`}
                    >
                      {isSwitching ? "전환 중" : isActive ? "사용 중" : "전환"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
