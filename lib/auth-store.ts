const authStoreKey = "buncheol-auth-state";
const authStoreEvent = "buncheol-auth-state-change";

type AuthState = {
  isLoggedIn: boolean;
};

const initialAuthState: AuthState = {
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
    cachedAuthState = {
      isLoggedIn: parsed.isLoggedIn === true,
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
