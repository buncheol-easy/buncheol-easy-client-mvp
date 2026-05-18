import type {
  ConvenienceStoreType,
  DeliveryAddress,
} from "@/lib/mock-delivery-addresses";

const defaultApiBaseUrl = "https://buncheoleasy.com";
const legacyApiBaseUrlPattern = /^https?:\/\/13\.124\.248\.60(?:\/v1)?$/;

type AccessTokenResponse = {
  accessToken: string;
};

export type UserProfileStatus = {
  isProfileComplete: boolean;
};

export type UserProfile = {
  provider: string;
  email: string;
  nickname: string;
  phoneNumber: string;
  bankAccount: {
    bank: string;
    account: string;
    holder: string;
  } | null;
};

export type UpdateUserProfileRequest = {
  nickname: string;
  phoneNumber: string;
};

export type BankAccountRequest = {
  account: string;
  bank: string;
  holder: string;
};

export type NicknameDuplicateResponse = {
  isDuplicate: boolean;
};

export type UserShippingAddress = DeliveryAddress & {
  isDefault?: boolean;
};

export type ShippingAddressRequest = {
  alias?: string;
  branchName: string;
  isDefault?: boolean;
  storeType: ConvenienceStoreType;
};

function getConfiguredApiBaseUrl() {
  const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(
    /\/+$/,
    "",
  );

  if (
    !configuredApiBaseUrl ||
    legacyApiBaseUrlPattern.test(configuredApiBaseUrl)
  ) {
    return defaultApiBaseUrl;
  }

  return configuredApiBaseUrl;
}

function getApiRootUrl() {
  return getConfiguredApiBaseUrl().replace(/\/v1$/, "");
}

function getVersionedApiBaseUrl() {
  const baseUrl = getConfiguredApiBaseUrl();

  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

export function getKakaoAuthorizationUrl() {
  return `${getApiRootUrl()}/oauth2/authorization/kakao`;
}

function getAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function getJsonHeaders(accessToken: string) {
  return {
    ...getAuthHeaders(accessToken),
    "Content-Type": "application/json",
  };
}

async function parseErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: unknown };

    return typeof body.message === "string" ? body.message : response.statusText;
  } catch {
    return response.statusText;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNestedData(body: unknown): unknown {
  if (!isRecord(body)) {
    return body;
  }

  return body.data ?? body.result ?? body;
}

function getStringValue(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

function getOptionalStringValue(body: Record<string, unknown>, keys: string[]) {
  const value = getStringValue(body, keys).trim();

  return value.length > 0 ? value : undefined;
}

function getBooleanValue(body: unknown, keys: string[]): boolean | null {
  if (typeof body === "boolean") {
    return body;
  }

  if (!isRecord(body)) {
    return null;
  }

  for (const key of keys) {
    const value = body[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      if (value === 1) {
        return true;
      }

      if (value === 0) {
        return false;
      }
    }

    if (typeof value === "string") {
      const normalizedValue = value.trim().toLowerCase();

      if (["true", "1", "y", "yes"].includes(normalizedValue)) {
        return true;
      }

      if (["false", "0", "n", "no"].includes(normalizedValue)) {
        return false;
      }
    }
  }

  const nestedBody = getNestedData(body);

  return nestedBody === body ? null : getBooleanValue(nestedBody, keys);
}

function getConvenienceStoreType(value: unknown): ConvenienceStoreType | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue.includes("gs")) {
    return "gs25";
  }

  if (normalizedValue.includes("cu")) {
    return "cu";
  }

  return null;
}

function getShippingMethod(storeType: ConvenienceStoreType) {
  return storeType === "gs25" ? "GS25_HALF" : "CU_HALF";
}

function getShippingAddressList(body: unknown): unknown[] {
  const data = getNestedData(body);

  if (Array.isArray(data)) {
    return data;
  }

  if (!isRecord(data)) {
    return [];
  }

  const candidates = [
    data.shippingAddresses,
    data.addresses,
    data.items,
    data.content,
  ];

  return candidates.find(Array.isArray) ?? [];
}

function getUserShippingAddress(body: unknown): UserShippingAddress | null {
  const data = getNestedData(body);

  if (!isRecord(data)) {
    return null;
  }

  const storeType =
    getConvenienceStoreType(data.storeType) ??
    getConvenienceStoreType(data.convenienceStoreType) ??
    getConvenienceStoreType(data.shippingMethod) ??
    getConvenienceStoreType(data.shipping_method) ??
    getConvenienceStoreType(data.type) ??
    getConvenienceStoreType(data.storeName) ??
    getConvenienceStoreType(data.branchName);

  const id = getStringValue(data, ["id", "shippingAddressId", "addressId"]);
  const branchName = getStringValue(data, [
    "branchName",
    "storeName",
    "name",
  ]).trim();

  if (!id || !storeType || !branchName) {
    return null;
  }

  return {
    id,
    storeType,
    alias: getOptionalStringValue(data, ["alias", "label", "memo"]),
    branchName,
    address: getStringValue(data, [
      "address",
      "roadAddress",
      "jibunAddress",
    ]),
    isDefault: getBooleanValue(data, ["isDefault", "default"]) ?? undefined,
  };
}

function getShippingAddressBody(body: ShippingAddressRequest) {
  return {
    alias: body.alias,
    isDefault: body.isDefault,
    shippingMethod: getShippingMethod(body.storeType),
    storeName: body.branchName,
  };
}

function parseProfileStatusText(value: string) {
  const normalizedValue = value.trim().toLowerCase();

  if (
    normalizedValue === "true" ||
    normalizedValue === "complete" ||
    normalizedValue === "completed"
  ) {
    return true;
  }

  if (
    normalizedValue === "false" ||
    normalizedValue === "incomplete" ||
    normalizedValue === "not_completed"
  ) {
    return false;
  }

  return null;
}

function getProfileCompleteValue(body: unknown): boolean | null {
  if (typeof body === "boolean") {
    return body;
  }

  if (typeof body === "string") {
    return parseProfileStatusText(body);
  }

  if (!isRecord(body)) {
    return null;
  }

  const profileStatusKeys = [
    "isProfileComplete",
    "isProfileCompleted",
    "profileComplete",
    "profileCompleted",
    "profileStatus",
    "isCompleted",
    "completed",
    "complete",
    "status",
  ];

  for (const key of profileStatusKeys) {
    const value = body[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const parsedValue = parseProfileStatusText(value);

      if (parsedValue !== null) {
        return parsedValue;
      }
    }
  }

  return getProfileCompleteValue(body.data);
}

export async function requestLogout(accessToken: string) {
  const response = await fetch(`${getVersionedApiBaseUrl()}/auth/logout`, {
    credentials: "include",
    headers: getAuthHeaders(accessToken),
    method: "POST",
  });

  if (!response.ok && response.status !== 401) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function requestTokenReissue() {
  const response = await fetch(`${getVersionedApiBaseUrl()}/auth/reissue-token`, {
    credentials: "include",
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as AccessTokenResponse;
}

export async function requestUserProfileStatus(accessToken: string) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/users/me/profile/status`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const body = (await response.json()) as unknown;
  const isProfileComplete = getProfileCompleteValue(body);

  if (isProfileComplete === null) {
    throw new Error("프로필 완료 여부를 확인할 수 없어요.");
  }

  return { isProfileComplete } satisfies UserProfileStatus;
}

export async function requestUserProfile(accessToken: string) {
  const response = await fetch(`${getVersionedApiBaseUrl()}/users/me`, {
    credentials: "include",
    headers: getAuthHeaders(accessToken),
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as UserProfile;
}

export async function requestNicknameDuplicate(
  accessToken: string,
  nickname: string,
) {
  const searchParams = new URLSearchParams({
    nickname,
  });
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/users/nickname/duplicate?${searchParams}`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const body = (await response.json()) as unknown;
  const isDuplicate = getBooleanValue(body, [
    "isDuplicate",
    "duplicate",
    "duplicated",
  ]);
  const isAvailable = getBooleanValue(body, ["isAvailable", "available"]);

  if (isDuplicate !== null) {
    return { isDuplicate } satisfies NicknameDuplicateResponse;
  }

  if (isAvailable !== null) {
    return { isDuplicate: !isAvailable } satisfies NicknameDuplicateResponse;
  }

  throw new Error("닉네임 중복 여부를 확인할 수 없어요.");
}

export async function updateUserProfile(
  accessToken: string,
  body: UpdateUserProfileRequest,
) {
  const response = await fetch(`${getVersionedApiBaseUrl()}/users/me`, {
    body: JSON.stringify(body),
    credentials: "include",
    headers: getJsonHeaders(accessToken),
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function deleteUserProfile(accessToken: string) {
  const response = await fetch(`${getVersionedApiBaseUrl()}/users/me`, {
    credentials: "include",
    headers: getAuthHeaders(accessToken),
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function updateBankAccount(
  accessToken: string,
  body: BankAccountRequest,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/users/me/bank-account`,
    {
      body: JSON.stringify(body),
      credentials: "include",
      headers: getJsonHeaders(accessToken),
      method: "PUT",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function requestShippingAddresses(accessToken: string) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/users/me/shipping-addresses`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const body = (await response.json()) as unknown;

  return getShippingAddressList(body)
    .map(getUserShippingAddress)
    .filter(
      (address): address is UserShippingAddress => address !== null,
    );
}

export async function createShippingAddress(
  accessToken: string,
  body: ShippingAddressRequest,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/users/me/shipping-addresses`,
    {
      body: JSON.stringify(getShippingAddressBody(body)),
      credentials: "include",
      headers: getJsonHeaders(accessToken),
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function updateShippingAddress(
  accessToken: string,
  addressId: string,
  body: ShippingAddressRequest,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/users/me/shipping-addresses/${addressId}`,
    {
      body: JSON.stringify(getShippingAddressBody(body)),
      credentials: "include",
      headers: getJsonHeaders(accessToken),
      method: "PUT",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function deleteShippingAddress(
  accessToken: string,
  addressId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/users/me/shipping-addresses/${addressId}`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}
