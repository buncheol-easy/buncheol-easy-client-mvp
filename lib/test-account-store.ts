import type { QueryClient } from "@tanstack/react-query";
import { writeAuthTokens } from "@/lib/auth-store";
import { storeBidHistoryMode } from "@/lib/bid-history-view-state";
import { clearUserSessionState } from "@/lib/user-session";

export type TestAccountRole = "participant" | "host";

export type TestAccount = {
  id: string;
  label: string;
  primary: boolean;
  role: TestAccountRole;
  userId: string;
};

type TestAccountState = {
  accounts: TestAccount[];
  activeAccountId: string | null;
  isSheetOpen: boolean;
  isWelcomeRequested: boolean;
  status: "idle" | "loading" | "ready";
};

const welcomeDismissedKey = "buncheol-test-account-welcome-dismissed";
const tipSeenKey = "buncheol-test-account-tip-seen";
const pendingToastKey = "buncheol-test-account-toast";
const storeEvent = "buncheol-test-account-change";

export const testAccountRoleNames: Record<TestAccountRole, string> = {
  host: "개최자",
  participant: "참여자",
};

// 역할마다 바꾼 직후 바로 해 볼 수 있는 일. staging 체험 데이터가 이 일을 할 수 있게 깔려 있어야 한다.
export const testAccountFirstTodos: Record<TestAccountRole, string[]> = {
  host: [
    "들어온 입금을 확인합니다",
    "운송장 번호를 넣습니다",
    "판매 페이지 주소로 AI 개최글을 만듭니다",
  ],
  participant: [
    "모집 중인 분철에 신청합니다",
    "입금 안내의 보냈어요를 누릅니다",
    "개최자로 바꿔 입금을 확인합니다",
  ],
};

const initialState: TestAccountState = {
  accounts: [],
  activeAccountId: null,
  isSheetOpen: false,
  isWelcomeRequested: false,
  status: "idle",
};

let state = initialState;
let activeTokenChecked: string | null = null;

function setState(patch: Partial<TestAccountState>) {
  state = { ...state, ...patch };
  window.dispatchEvent(new Event(storeEvent));
}

export function readTestAccountState() {
  return state;
}

export function getInitialTestAccountState() {
  return initialState;
}

export function subscribeTestAccountState(onStoreChange: () => void) {
  window.addEventListener(storeEvent, onStoreChange);

  return () => window.removeEventListener(storeEvent, onStoreChange);
}

export function loadTestAccounts() {
  if (state.status !== "idle") {
    return;
  }

  setState({ status: "loading" });

  fetch("/api/test-accounts", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { accounts?: TestAccount[]; enabled?: boolean } | null) => {
      setState({
        accounts: data?.enabled === true ? (data.accounts ?? []) : [],
        status: "ready",
      });
    })
    .catch(() => {
      setState({ accounts: [], status: "ready" });
    });
}

export function syncActiveTestAccount(accessToken: string | null) {
  if (accessToken === activeTokenChecked) {
    return;
  }

  activeTokenChecked = accessToken;

  if (!accessToken) {
    setState({ activeAccountId: null });
    return;
  }

  fetch("/api/test-accounts/active", {
    cache: "no-store",
    headers: { authorization: `Bearer ${accessToken}` },
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { accountId?: string | null } | null) => {
      if (activeTokenChecked === accessToken) {
        setState({ activeAccountId: data?.accountId ?? null });
      }
    })
    .catch(() => {
      if (activeTokenChecked === accessToken) {
        setState({ activeAccountId: null });
      }
    });
}

export function getPrimaryTestAccount(
  accounts: TestAccount[],
  role: TestAccountRole,
) {
  return (
    accounts.find((account) => account.primary && account.role === role) ??
    accounts.find((account) => account.role === role) ??
    null
  );
}

export function getTestAccountHome(role: TestAccountRole) {
  return role === "host" ? "/profile/bids" : "/";
}

// 첫 화면이 덮은 화면이 홈이 아니면(상세 링크, QR 등) 역할을 고른 뒤 그 화면으로 돌아간다.
export function getWelcomeReturnHref() {
  const { pathname, search } = window.location;

  return pathname === "/" ? undefined : `${pathname}${search}`;
}

export function openTestAccountSheet() {
  setState({ isSheetOpen: true });
}

export function closeTestAccountSheet() {
  setState({ isSheetOpen: false });
}

export function requestTestAccountWelcome() {
  writeFlag(welcomeDismissedKey, false);
  setState({ isSheetOpen: false, isWelcomeRequested: true });
}

export function dismissTestAccountWelcome() {
  writeFlag(welcomeDismissedKey, true);
  setState({ isWelcomeRequested: false });
}

export function isTestAccountWelcomeDismissed() {
  return readFlag(welcomeDismissedKey);
}

export function isTestAccountTipSeen() {
  return readFlag(tipSeenKey);
}

export function markTestAccountTipSeen() {
  writeFlag(tipSeenKey, true);
}

export function takePendingTestAccountToast() {
  try {
    const message = window.sessionStorage.getItem(pendingToastKey);

    window.sessionStorage.removeItem(pendingToastKey);

    return message;
  } catch {
    return null;
  }
}

// 계정을 바꾼 뒤 화면을 새로 연다. 이전 계정의 화면 상태와 캐시가 섞이지 않게 하려는 것이다.
export async function switchTestAccount(
  account: TestAccount,
  queryClient: QueryClient,
  target = getTestAccountHome(account.role),
) {
  const response = await fetch("/api/test-accounts", {
    body: JSON.stringify({ accountId: account.id }),
    cache: "no-store",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const data = response.ok
    ? ((await response.json()) as { accessToken?: string })
    : null;

  if (!data?.accessToken) {
    throw new Error("체험 계정으로 바꾸지 못했습니다.");
  }

  clearUserSessionState(queryClient);
  writeAuthTokens({ accessToken: data.accessToken });
  writeFlag(welcomeDismissedKey, true);

  if (target === "/profile/bids") {
    storeBidHistoryMode(account.role === "host" ? "hosted" : "joined");
  }

  try {
    window.sessionStorage.setItem(
      pendingToastKey,
      `${testAccountRoleNames[account.role]} ${account.label} 계정으로 바꿨습니다`,
    );
  } catch {
    // 알림만 빠진다.
  }

  window.location.assign(target);
}

export function leaveTestAccount(queryClient: QueryClient) {
  clearUserSessionState(queryClient);
  requestTestAccountWelcome();
}

function readFlag(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    if (value) {
      window.localStorage.setItem(key, "1");
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // 저장소가 막혀 있으면 이번 방문에서만 기억한다.
  }
}
