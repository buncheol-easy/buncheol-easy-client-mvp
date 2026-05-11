import {
  initialDefaultDeliveryAddressIds,
  initialDeliveryAddresses,
  type ConvenienceStoreType,
  type DeliveryAddress,
} from "@/lib/mock-delivery-addresses";

const deliveryAddressStoreKey = "buncheol-delivery-addresses";
const deliveryAddressStoreEvent = "buncheol-delivery-addresses-change";

export type StoredDeliveryAddressState = {
  addresses: DeliveryAddress[];
  defaultAddressIds: Record<ConvenienceStoreType, string | null>;
};

const initialDeliveryAddressState: StoredDeliveryAddressState = {
  addresses: initialDeliveryAddresses,
  defaultAddressIds: initialDefaultDeliveryAddressIds,
};

let cachedRawValue: string | null = null;
let cachedAddressState: StoredDeliveryAddressState = initialDeliveryAddressState;

export function getInitialDeliveryAddressState(): StoredDeliveryAddressState {
  return initialDeliveryAddressState;
}

export function readDeliveryAddressState(): StoredDeliveryAddressState {
  if (typeof window === "undefined") {
    return initialDeliveryAddressState;
  }

  let rawValue: string | null;

  try {
    rawValue = window.localStorage.getItem(deliveryAddressStoreKey);
  } catch {
    return cachedAddressState;
  }

  if (rawValue === cachedRawValue) {
    return cachedAddressState;
  }

  cachedRawValue = rawValue;

  if (!rawValue) {
    cachedAddressState = initialDeliveryAddressState;
    return cachedAddressState;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredDeliveryAddressState>;

    if (!Array.isArray(parsed.addresses) || !parsed.defaultAddressIds) {
      cachedAddressState = initialDeliveryAddressState;
      return cachedAddressState;
    }

    cachedAddressState = {
      addresses: parsed.addresses,
      defaultAddressIds: {
        gs25: parsed.defaultAddressIds.gs25 ?? null,
        cu: parsed.defaultAddressIds.cu ?? null,
      },
    };

    return cachedAddressState;
  } catch {
    cachedAddressState = initialDeliveryAddressState;
    return cachedAddressState;
  }
}

export function writeDeliveryAddressState(state: StoredDeliveryAddressState) {
  if (typeof window === "undefined") {
    return;
  }

  cachedAddressState = state;
  cachedRawValue = JSON.stringify(state);

  try {
    window.localStorage.setItem(deliveryAddressStoreKey, cachedRawValue);
  } catch {
    cachedRawValue = null;
  }

  window.dispatchEvent(new Event(deliveryAddressStoreEvent));
}

export function subscribeDeliveryAddressState(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(deliveryAddressStoreEvent, onStoreChange);
  window.addEventListener("focus", onStoreChange);
  window.addEventListener("pageshow", onStoreChange);

  return () => {
    window.removeEventListener(deliveryAddressStoreEvent, onStoreChange);
    window.removeEventListener("focus", onStoreChange);
    window.removeEventListener("pageshow", onStoreChange);
  };
}
