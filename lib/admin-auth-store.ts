// 관리자 세션 저장소. 유저 세션(auth-store)과 완전히 분리된 토큰을 관리한다 —
// 관리자 토큰은 refresh 없이 12시간 만료라 재발급 로직이 없고, 만료되면 다시 로그인한다.
const adminAuthStoreKey = "buncheol-admin-auth-state";
const adminAuthStoreEvent = "buncheol-admin-auth-state-change";

type AdminAuthState = {
  accessToken: string | null;
};

const initialAdminAuthState: AdminAuthState = {
  accessToken: null,
};

let cachedRawValue: string | null = null;
let cachedAdminAuthState: AdminAuthState = initialAdminAuthState;

export function getInitialAdminAuthState() {
  return initialAdminAuthState;
}

export function readAdminAuthState() {
  if (typeof window === "undefined") {
    return initialAdminAuthState;
  }

  let rawValue: string | null;

  try {
    rawValue = window.localStorage.getItem(adminAuthStoreKey);
  } catch {
    return cachedAdminAuthState;
  }

  if (rawValue === cachedRawValue) {
    return cachedAdminAuthState;
  }

  cachedRawValue = rawValue;

  if (!rawValue) {
    cachedAdminAuthState = initialAdminAuthState;
    return cachedAdminAuthState;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AdminAuthState>;

    cachedAdminAuthState = {
      accessToken:
        typeof parsed.accessToken === "string" ? parsed.accessToken : null,
    };
  } catch {
    cachedAdminAuthState = initialAdminAuthState;
  }

  return cachedAdminAuthState;
}

function writeAdminAuthState(state: AdminAuthState) {
  if (typeof window === "undefined") {
    return;
  }

  cachedAdminAuthState = state;
  cachedRawValue = JSON.stringify(state);

  try {
    window.localStorage.setItem(adminAuthStoreKey, cachedRawValue);
  } catch {
    cachedRawValue = null;
  }

  window.dispatchEvent(new Event(adminAuthStoreEvent));
}

export function writeAdminAccessToken(accessToken: string) {
  writeAdminAuthState({ accessToken });
}

export function clearAdminAuthState() {
  writeAdminAuthState(initialAdminAuthState);
}

export function subscribeAdminAuthState(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(adminAuthStoreEvent, onStoreChange);
  window.addEventListener("focus", onStoreChange);
  window.addEventListener("pageshow", onStoreChange);

  return () => {
    window.removeEventListener(adminAuthStoreEvent, onStoreChange);
    window.removeEventListener("focus", onStoreChange);
    window.removeEventListener("pageshow", onStoreChange);
  };
}
