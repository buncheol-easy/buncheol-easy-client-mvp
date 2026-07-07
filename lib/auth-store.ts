import { identifyAnalyticsUser, resetAnalyticsUser } from "@/lib/analytics";

const authStoreKey = "buncheol-auth-state";
const authStoreEvent = "buncheol-auth-state-change";
const refreshTokenCookieNames = ["refreshToken", "refresh_token"];
export const authReturnHrefStorageKey = "buncheol-auth-return-href";
export const authProfileSetupReturnHrefStorageKey =
  "buncheol-auth-profile-setup-return-href";

type AuthState = {
  accessToken: string | null;
  isLoggedIn: boolean;
};

const initialAuthState: AuthState = {
  accessToken: null,
  isLoggedIn: false,
};

let cachedRawValue: string | null = null;
let cachedAuthState: AuthState = initialAuthState;

export function getInitialAuthState() {
  return initialAuthState;
}

export function readAuthState() {
  if (typeof window === "undefined") {
    return initialAuthState;
  }

  let rawValue: string | null;

  try {
    rawValue = window.localStorage.getItem(authStoreKey);
  } catch {
    return cachedAuthState;
  }

  if (rawValue === cachedRawValue) {
    return cachedAuthState;
  }

  cachedRawValue = rawValue;

  if (!rawValue) {
    cachedAuthState = initialAuthState;
    return cachedAuthState;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AuthState>;
    const accessToken =
      typeof parsed.accessToken === "string" ? parsed.accessToken : null;

    cachedAuthState = {
      accessToken,
      isLoggedIn: parsed.isLoggedIn === true || Boolean(accessToken),
    };
  } catch {
    cachedAuthState = initialAuthState;
  }

  return cachedAuthState;
}

export function writeAuthState(state: AuthState) {
  if (typeof window === "undefined") {
    return;
  }

  cachedAuthState = state;
  cachedRawValue = JSON.stringify(state);

  try {
    window.localStorage.setItem(authStoreKey, cachedRawValue);
  } catch {
    cachedRawValue = null;
  }

  window.dispatchEvent(new Event(authStoreEvent));
}

export function clearAuthState() {
  resetAnalyticsUser();
  writeAuthState(initialAuthState);
}

export function clearAuthCookies() {
  if (typeof document === "undefined") {
    return;
  }

  refreshTokenCookieNames.forEach((cookieName) => {
    document.cookie = `${cookieName}=; Max-Age=0; path=/`;
  });
}

export function writeAuthTokens(tokens: {
  accessToken: string;
}) {
  identifyAnalyticsUser(tokens.accessToken);
  writeAuthState({
    accessToken: tokens.accessToken,
    isLoggedIn: true,
  });
}

export function subscribeAuthState(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(authStoreEvent, onStoreChange);
  window.addEventListener("focus", onStoreChange);
  window.addEventListener("pageshow", onStoreChange);

  return () => {
    window.removeEventListener(authStoreEvent, onStoreChange);
    window.removeEventListener("focus", onStoreChange);
    window.removeEventListener("pageshow", onStoreChange);
  };
}
