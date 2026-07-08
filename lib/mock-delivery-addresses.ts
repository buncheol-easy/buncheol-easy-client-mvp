export type ConvenienceStoreType = "gs25" | "cu";

export const convenienceStoreTypes = ["gs25", "cu"] as const;

export const maxDeliveryAddressCount = 5;

export type DeliveryAddress = {
  id: string;
  storeType: ConvenienceStoreType;
  alias?: string;
  branchName: string;
  address: string;
};

export const convenienceStoreTypeLabels: Record<ConvenienceStoreType, string> = {
  gs25: "GS25",
  cu: "CU",
};

export const initialDeliveryAddresses: DeliveryAddress[] = [
  {
    id: "cu-default",
    storeType: "cu",
    alias: "집",
    branchName: "CU 성수서울숲점",
    address: "서울특별시 성동구 서울숲2길 32 인근",
  },
];

export const initialDefaultDeliveryAddressIds: Record<
  ConvenienceStoreType,
  string | null
> = {
  gs25: null,
  cu: "cu-default",
};

export function getConvenienceStoreLabel(storeType: ConvenienceStoreType) {
  return convenienceStoreTypeLabels[storeType];
}

function cleanBrokenDeliveryAddressText(value: string | undefined) {
  const trimmedValue = value?.trim() ?? "";
  const withoutBrokenPrefix = trimmedValue.replace(/^[?\uFFFD\s]+/, "").trim();

  if (!withoutBrokenPrefix || /^[?\uFFFD]+$/.test(withoutBrokenPrefix)) {
    return "";
  }

  return withoutBrokenPrefix;
}

export function getDeliveryAddressDisplayAlias(address: DeliveryAddress) {
  return cleanBrokenDeliveryAddressText(address.alias);
}

export function getDeliveryAddressDisplayBranchName(address: DeliveryAddress) {
  return cleanBrokenDeliveryAddressText(address.branchName) || address.branchName;
}

export function getConvenienceStoreTypeFromShippingName(
  shippingName: string,
): ConvenienceStoreType | null {
  const normalized = shippingName.toUpperCase();

  if (normalized.includes("GS")) {
    return "gs25";
  }

  if (normalized.includes("CU")) {
    return "cu";
  }

  return null;
}

export function getAvailableConvenienceStoreTypes(
  shippingMethods?: Array<{ name: string }> | null,
  courier?: string | null,
): ConvenienceStoreType[] {
  const matchedTypes = (shippingMethods ?? [])
    .map((method) => getConvenienceStoreTypeFromShippingName(method.name))
    .filter(
      (storeType): storeType is ConvenienceStoreType => storeType !== null,
    );

  if (matchedTypes.length > 0) {
    return convenienceStoreTypes.filter((storeType) =>
      matchedTypes.includes(storeType),
    );
  }

  const fallbackType = courier
    ? getConvenienceStoreTypeFromShippingName(courier)
    : null;

  return fallbackType ? [fallbackType] : [];
}

export function getDefaultDeliveryAddressesByType(
  deliveryAddresses: DeliveryAddress[],
  defaultAddressIds: Record<ConvenienceStoreType, string | null>,
) {
  return {
    cu:
      deliveryAddresses.find((address) => address.id === defaultAddressIds.cu) ??
      null,
    gs25:
      deliveryAddresses.find((address) => address.id === defaultAddressIds.gs25) ??
      null,
  };
}

export function getPrioritizedDeliveryAddresses(
  deliveryAddresses: DeliveryAddress[],
  defaultAddressIds: Record<ConvenienceStoreType, string | null>,
) {
  const prioritizedIds = convenienceStoreTypes
    .map((storeType) => defaultAddressIds[storeType])
    .filter((addressId): addressId is string => addressId !== null);

  return [
    ...prioritizedIds
      .map((addressId) =>
        deliveryAddresses.find((address) => address.id === addressId) ?? null,
      )
      .filter((address): address is DeliveryAddress => address !== null),
    ...deliveryAddresses.filter(
      (address) => !prioritizedIds.includes(address.id),
    ),
  ];
}
