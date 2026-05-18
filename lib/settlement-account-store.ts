const settlementAccountStoreKey = "buncheol-settlement-account";
const settlementAccountStoreEvent = "buncheol-settlement-account-change";

export type SettlementAccountState = {
  accountHolder: string;
  accountNumber: string;
  bankName: string;
};

const initialSettlementAccountState: SettlementAccountState = {
  accountHolder: "",
  accountNumber: "",
  bankName: "",
};

let cachedRawValue: string | null = null;
let cachedSettlementAccountState = initialSettlementAccountState;

export function getInitialSettlementAccountState() {
  return initialSettlementAccountState;
}

export function readSettlementAccountState() {
  if (typeof window === "undefined") {
    return initialSettlementAccountState;
  }

  let rawValue: string | null;

  try {
    rawValue = window.localStorage.getItem(settlementAccountStoreKey);
  } catch {
    return cachedSettlementAccountState;
  }

  if (rawValue === cachedRawValue) {
    return cachedSettlementAccountState;
  }

  cachedRawValue = rawValue;

  if (!rawValue) {
    cachedSettlementAccountState = initialSettlementAccountState;
    return cachedSettlementAccountState;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<SettlementAccountState>;

    cachedSettlementAccountState = {
      accountHolder:
        typeof parsed.accountHolder === "string" ? parsed.accountHolder : "",
      accountNumber:
        typeof parsed.accountNumber === "string" ? parsed.accountNumber : "",
      bankName: typeof parsed.bankName === "string" ? parsed.bankName : "",
    };
  } catch {
    cachedSettlementAccountState = initialSettlementAccountState;
  }

  return cachedSettlementAccountState;
}

export function writeSettlementAccountState(state: SettlementAccountState) {
  if (typeof window === "undefined") {
    return;
  }

  cachedSettlementAccountState = state;
  cachedRawValue = JSON.stringify(state);

  try {
    window.localStorage.setItem(settlementAccountStoreKey, cachedRawValue);
  } catch {
    cachedRawValue = null;
  }

  window.dispatchEvent(new Event(settlementAccountStoreEvent));
}

export function clearSettlementAccountState() {
  writeSettlementAccountState(initialSettlementAccountState);
}

export function subscribeSettlementAccountState(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(settlementAccountStoreEvent, onStoreChange);
  window.addEventListener("focus", onStoreChange);
  window.addEventListener("pageshow", onStoreChange);

  return () => {
    window.removeEventListener(settlementAccountStoreEvent, onStoreChange);
    window.removeEventListener("focus", onStoreChange);
    window.removeEventListener("pageshow", onStoreChange);
  };
}
