export type ConvenienceStoreType = "gs25" | "cu";

export const convenienceStoreTypes = ["gs25", "cu"] as const;

export const maxDeliveryAddressCount = 5;

export type DeliveryAddress = {
  id: string;
  storeType: ConvenienceStoreType;
  alias?: string;
  branchName: string;
  address: string;
  // 접수처 검색으로 등록된 배송지의 원천 점포 코드 (자유입력 시절 등록분은 없음)
  storeCode?: string;
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

export function stripLeadingConvenienceStoreLabel(
  storeType: ConvenienceStoreType,
  value: string,
) {
  const label = convenienceStoreTypeLabels[storeType];
  // "CUBE점"처럼 지점명 자체가 라벨 철자로 시작하는 경우는 남긴다.
  const labelPrefixPattern = new RegExp(`^${label}(?![A-Za-z0-9])[\\s-]*`, "i");
  let result = value.trim();

  while (true) {
    const next = result.replace(labelPrefixPattern, "").trim();

    if (next === result) {
      break;
    }

    result = next;
  }

  return result;
}

// 🔴 인자를 DeliveryAddress 전체로 받지 않는다. 서버가 표시용으로만 내려주는 묶음 배송지
// (server#178: {storeType, storeName})에는 id·address 가 없고, 그 값을 억지로 DeliveryAddress 로
// 만들면 「배송지 고정 · 변경 불가」 자리에서 유저 주소 목록과 섞일 길이 생긴다. 이 함수가 실제로
// 읽는 두 칸만 요구하면 그 위험 없이 양쪽을 같은 표기 규칙으로 그린다.
export function getDeliveryAddressDisplayBranchName(
  address: Pick<DeliveryAddress, "branchName" | "storeType">,
) {
  const cleanedBranchName =
    cleanBrokenDeliveryAddressText(address.branchName) || address.branchName;

  return (
    stripLeadingConvenienceStoreLabel(address.storeType, cleanedBranchName) ||
    cleanedBranchName
  );
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
