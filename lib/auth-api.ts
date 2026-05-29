import type {
  ConvenienceStoreType,
  DeliveryAddress,
} from "@/lib/mock-delivery-addresses";
import type { ProductCardItem } from "@/components/ProductCard";
import type { ProductDetailItem, ProductOption } from "@/lib/mock-products";

const defaultApiBaseUrl = "https://buncheoleasy.com";
const legacyApiBaseUrlPattern = /^https?:\/\/13\.124\.248\.60(?:\/v1)?$/;
const thumbnailDetailFetchConcurrency = 4;
const thumbnailDetailFetchLimit = 24;

type AccessTokenResponse = {
  accessToken: string;
};

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

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

export type BuncheolStatus = string;

export type BuncheolListSort = "LATEST" | "DEADLINE";

export type BuncheolListParams = {
  cursor?: string;
  groupId?: string | number;
  hideClosed?: boolean;
  keyword?: string;
  memberId?: string | number;
  onlyFavoriteGroups?: boolean;
  size?: string | number;
  sort?: BuncheolListSort;
  status?: string;
};

export type BuncheolMemberRequest = {
  bidMinPrice: number;
  memberId: number;
};

export type CreateBuncheolRequest = {
  buncheolMembers: BuncheolMemberRequest[];
  cuShippingFee?: number;
  deadline: string;
  description?: string;
  groupId: number;
  gs25ShippingFee?: number;
  purchaseSite: string;
  title: string;
};

export type UpdateBuncheolRequest = {
  description?: string;
  keepImageIds?: number[];
  title: string;
};

export type ParticipateBuncheolRequest = {
  bidAmount: number;
  buncheolMemberId: number;
  shippingAddressId: number;
};

export type ParticipationCheckoutResponse = {
  bidAmount: number;
  participationId: string;
  participationStatus: string;
};

export type ApiGroup = {
  favorited?: boolean;
  id: string;
  imageUrl?: string;
  name: string;
};

export type ApiGroupMember = {
  id: string;
  imageUrl?: string;
  name: string;
};

export type BuncheolSummary = {
  activeParticipationCount?: number;
  bookmarkId?: string;
  bookmarked?: boolean;
  createdAt?: string;
  deadline: string;
  groupName: string;
  id: string;
  isHostedByMe?: boolean;
  memberNames: string[];
  memberSlotCount?: number;
  status: BuncheolStatus;
  thumbnailUrl?: string;
  title: string;
};

export type BuncheolMember = {
  bidMinPrice: number;
  currentBidAmount: number;
  id: string;
  imageUrl?: string;
  memberId?: string;
  myBidAmount?: number;
  myParticipationId?: string;
  name: string;
  participantCount: number;
  topBidAmounts: number[];
};

export type BuncheolShippingOption = {
  fee: number;
  method: string;
};

export type BuncheolDetail = BuncheolSummary & {
  cuShippingFee?: number;
  description?: string;
  gs25ShippingFee?: number;
  imageUrls: string[];
  isHostedByMe?: boolean;
  members: BuncheolMember[];
  purchaseSite?: string;
  shippingOptions: BuncheolShippingOption[];
};

export type MyParticipation = {
  bidAmount: number;
  buncheolDeadline: string;
  buncheolId: string;
  buncheolMemberCount: number;
  buncheolStatus: string;
  buncheolTitle: string;
  closedRank?: number | null;
  memberName: string;
  participationId: string;
  participationStatus: string;
  paymentDueAt?: string | null;
};

export type MyHostedBuncheol = BuncheolSummary & {
  activeParticipationCount: number;
  createdAt: string;
  memberSlotCount: number;
};

export type PaymentOrderResponse = {
  amount: number;
  clientKey: string;
  failUrl: string;
  paymentOrderId: string;
  paymentOrderName: string;
  successUrl: string;
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
  if (typeof window !== "undefined") {
    return "/api/backend/v1";
  }

  const baseUrl = getConfiguredApiBaseUrl();

  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

export function getKakaoAuthorizationUrl() {
  return `${getApiRootUrl()}/oauth2/authorization/kakao`;
}

function getAuthHeaders(accessToken?: string): Record<string, string> {
  return accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
      }
    : {};
}

function getJsonHeaders(accessToken: string) {
  return {
    ...getAuthHeaders(accessToken),
    "Content-Type": "application/json",
  };
}

async function parseErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as {
      detail?: unknown;
      message?: unknown;
      title?: unknown;
    };

    if (typeof body.message === "string") {
      return body.message;
    }

    if (typeof body.detail === "string") {
      return body.detail;
    }

    if (typeof body.title === "string") {
      return body.title;
    }

    return response.statusText;
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

function getNumberValue(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsedValue = Number(value.replace(/[^0-9.-]/g, ""));

      if (Number.isFinite(parsedValue)) {
        return parsedValue;
      }
    }
  }

  return null;
}

function getDeepNumberValue(
  body: Record<string, unknown>,
  keys: string[],
  visited = new Set<unknown>(),
): number | null {
  const directValue = getNumberValue(body, keys);

  if (directValue !== null) {
    return directValue;
  }

  if (visited.has(body)) {
    return null;
  }

  visited.add(body);

  for (const value of Object.values(body)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (!isRecord(item)) {
          continue;
        }

        const nestedValue = getDeepNumberValue(item, keys, visited);

        if (nestedValue !== null) {
          return nestedValue;
        }
      }

      continue;
    }

    if (isRecord(value)) {
      const nestedValue = getDeepNumberValue(value, keys, visited);

      if (nestedValue !== null) {
        return nestedValue;
      }
    }
  }

  return null;
}

function getOptionalNumberValue(
  body: Record<string, unknown>,
  keys: string[],
) {
  const value = getNumberValue(body, keys);

  return value === null ? undefined : value;
}

function getOptionalStringValue(body: Record<string, unknown>, keys: string[]) {
  const value = getStringValue(body, keys).trim();

  return value.length > 0 ? value : undefined;
}

function getStringListValue(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === "string" || typeof item === "number") {
            return String(item);
          }

          if (isRecord(item)) {
            return getStringValue(item, ["name", "memberName", "label"]);
          }

          return "";
        })
        .filter((item) => item.trim().length > 0);
    }
  }

  return [];
}

function getRecordListValue(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }

  return [];
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
    throw new ApiRequestError(await parseErrorMessage(response), response.status);
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

async function readJsonBody(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function appendJsonFormPart(formData: FormData, body: unknown) {
  formData.append(
    "request",
    new Blob([JSON.stringify(body)], { type: "application/json" }),
  );
}

function appendImageFormParts(formData: FormData, images: Blob[] = []) {
  images.forEach((image, index) => {
    const file =
      image instanceof File
        ? image
        : new File([image], `buncheol-image-${index + 1}.jpg`, {
            type: image.type || "image/jpeg",
          });

    formData.append("images", file);
  });
}

function getBuncheolList(body: unknown) {
  const data = getNestedData(body);

  if (Array.isArray(data)) {
    return data;
  }

  if (!isRecord(data)) {
    return [];
  }

  const candidates = [
    data.buncheols,
    data.favoriteGroups,
    data.groups,
    data.items,
    data.content,
    data.list,
    data.members,
    data.results,
  ];

  return candidates.find(Array.isArray) ?? [];
}

function getBuncheolListPageInfo(body: unknown) {
  const data = getNestedData(body);

  if (!isRecord(data)) {
    return {
      hasNext: false,
      nextCursor: null,
    };
  }

  const nextCursor =
    getOptionalStringValue(data, ["nextCursor", "cursor"]) ?? null;
  const hasNext =
    getBooleanValue(data, ["hasNext", "hasMore", "next"]) ??
    Boolean(nextCursor);

  return {
    hasNext,
    nextCursor,
  };
}

function getImageUrl(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (!isRecord(value)) {
    return "";
  }

  return getStringValue(value, [
    "imageUrl",
    "thumbnailUrl",
    "url",
    "path",
    "src",
  ]);
}

function getImageUrls(data: Record<string, unknown>) {
  const images = getRecordListValue(data, ["images", "imageList"])
    .map(getImageUrl)
    .filter((imageUrl) => imageUrl.trim().length > 0);
  const stringImages = getStringListValue(data, [
    "imageUrls",
    "images",
    "imageList",
  ]);
  const thumbnailUrl = getOptionalStringValue(data, [
    "thumbnailUrl",
    "thumbnail",
    "imageUrl",
  ]);

  return [thumbnailUrl, ...stringImages, ...images].filter(
    (imageUrl, index, imageUrls): imageUrl is string =>
      Boolean(imageUrl) && imageUrls.indexOf(imageUrl) === index,
  );
}

function getBuncheolSummaryFromRecord(
  record: Record<string, unknown>,
): BuncheolSummary | null {
  const id = getStringValue(record, ["buncheolId", "id"]).trim();
  const title = getStringValue(record, ["title", "buncheolTitle"]).trim();

  if (!id || !title) {
    return null;
  }

  const memberNames = getStringListValue(record, [
    "memberNames",
    "members",
    "buncheolMembers",
  ]);
  const singleMemberName = getOptionalStringValue(record, [
    "memberName",
    "representativeMemberName",
  ]);
  const imageUrls = getImageUrls(record);

  return {
    id,
    title,
    groupName:
      getOptionalStringValue(record, ["groupName", "group", "idolGroupName"]) ??
      "분철",
    status:
      getOptionalStringValue(record, ["status", "buncheolStatus"]) ??
      "RECRUITING",
    isHostedByMe:
      getBooleanValue(record, ["isHostedByMe", "hostedByMe", "owner"]) ??
      undefined,
    deadline:
      getOptionalStringValue(record, ["deadline", "buncheolDeadline"]) ??
      "",
    thumbnailUrl: imageUrls[0],
    memberNames:
      memberNames.length > 0
        ? memberNames
        : singleMemberName
        ? [singleMemberName]
        : [],
    activeParticipationCount: getOptionalNumberValue(record, [
      "activeParticipationCount",
      "participantCount",
      "participationCount",
    ]),
    bookmarkId: getOptionalStringValue(record, ["bookmarkId"]),
    bookmarked: getBooleanValue(record, [
      "bookmarked",
      "isBookmarked",
      "liked",
    ]) ?? undefined,
    createdAt: getOptionalStringValue(record, ["createdAt", "uploadedAt"]),
    memberSlotCount: getOptionalNumberValue(record, [
      "memberSlotCount",
      "buncheolMemberCount",
      "memberCount",
    ]),
  };
}

function getBuncheolMemberFromRecord(
  record: Record<string, unknown>,
): BuncheolMember | null {
  const id = getStringValue(record, [
    "buncheolMemberId",
    "id",
    "slotId",
  ]).trim();
  const name = getStringValue(record, ["memberName", "name", "label"]).trim();

  if (!id || !name) {
    return null;
  }

  const bidMinPrice =
    getDeepNumberValue(record, [
      "bidMinPrice",
      "bidMinimumPrice",
      "baseAmount",
      "basePrice",
      "bidFloor",
      "bidFloorAmount",
      "bidPrice",
      "initialBid",
      "initialBidAmount",
      "initialPrice",
      "minBid",
      "minBidAmount",
      "minBidPrice",
      "minimumBid",
      "minimumBidAmount",
      "minimumBidPrice",
      "minimumPrice",
      "minPrice",
      "requiredBidAmount",
      "startingBid",
      "startingBidAmount",
      "startPrice",
      "price",
    ]) ?? 0;
  const currentBidAmount =
    getDeepNumberValue(record, [
      "currentBidAmount",
      "highestBidAmount",
      "maxBidAmount",
      "currentBid",
      "bidAmount",
    ]) ?? bidMinPrice;
  const topBidAmounts = getStringListValue(record, [
    "topBids",
    "topBidAmounts",
    "highestBidAmounts",
  ])
    .map((value) => Number(value.replace(/[^0-9]/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);

  return {
    id,
    name,
    bidMinPrice,
    currentBidAmount,
    topBidAmounts,
    memberId: getOptionalStringValue(record, ["memberId"]),
    imageUrl: getOptionalStringValue(record, [
      "memberImage",
      "memberImageUrl",
      "image",
      "imageUrl",
      "profileImageUrl",
    ]),
    myBidAmount: getOptionalNumberValue(record, [
      "myBidAmount",
      "myParticipationBidAmount",
    ]),
    myParticipationId: getOptionalStringValue(record, [
      "myParticipationId",
      "participationId",
    ]),
    participantCount:
      getNumberValue(record, [
        "participantCount",
        "participationCount",
        "activeParticipationCount",
        "activeParticipantCount",
      ]) ?? 0,
  };
}

function getBuncheolShippingOptionFromRecord(
  record: Record<string, unknown>,
): BuncheolShippingOption | null {
  const method = getStringValue(record, [
    "method",
    "shippingMethod",
    "deliveryMethod",
    "type",
  ]).trim();
  const fee = getNumberValue(record, [
    "fee",
    "shippingFee",
    "deliveryFee",
    "price",
    "amount",
  ]);

  if (!method || fee === null) {
    return null;
  }

  return { fee, method };
}

function getBuncheolDetailFromBody(body: unknown) {
  const data = getNestedData(body);

  if (!isRecord(data)) {
    return null;
  }

  const summary = getBuncheolSummaryFromRecord(data);

  if (!summary) {
    return null;
  }

  const members = getRecordListValue(data, [
    "buncheolMembers",
    "members",
    "memberSlots",
    "options",
  ])
    .map(getBuncheolMemberFromRecord)
    .filter((member): member is BuncheolMember => member !== null);
  const shippingOptions = getRecordListValue(data, [
    "shippingOptions",
    "shippingMethods",
    "deliveryOptions",
    "deliveryMethods",
  ])
    .map(getBuncheolShippingOptionFromRecord)
    .filter(
      (option): option is BuncheolShippingOption => option !== null,
    );
  const shippingFeeRecord = [
    data.shippingFees,
    data.shippingFee,
    data.deliveryFees,
    data.deliveryFee,
    data.shipping,
  ]
    .map(getNestedData)
    .find(isRecord);

  return {
    ...summary,
    cuShippingFee:
      getOptionalNumberValue(data, [
        "cuShippingFee",
        "cuHalfShippingFee",
        "cuDeliveryFee",
        "cuFee",
      ]) ??
      (shippingFeeRecord
        ? getOptionalNumberValue(shippingFeeRecord, [
            "cuShippingFee",
            "cuHalfShippingFee",
            "cuDeliveryFee",
            "cuFee",
            "cu",
          ])
        : undefined),
    description: getOptionalStringValue(data, ["description", "content"]),
    gs25ShippingFee:
      getOptionalNumberValue(data, [
        "gs25ShippingFee",
        "gsShippingFee",
        "gsHalfShippingFee",
        "gs25DeliveryFee",
        "gs25Fee",
      ]) ??
      (shippingFeeRecord
        ? getOptionalNumberValue(shippingFeeRecord, [
            "gs25ShippingFee",
            "gsShippingFee",
            "gsHalfShippingFee",
            "gs25DeliveryFee",
            "gs25Fee",
            "gs25",
            "gs",
          ])
        : undefined),
    imageUrls: getImageUrls(data),
    isHostedByMe:
      getBooleanValue(data, ["isHostedByMe", "hostedByMe", "owner"]) ??
      undefined,
    members,
    purchaseSite: getOptionalStringValue(data, [
      "purchaseSite",
      "purchaseSource",
      "source",
    ]),
    shippingOptions,
  } satisfies BuncheolDetail;
}

function getRequestQuery(params: BuncheolListParams) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

function formatKoreaDateTime(value: string | undefined) {
  if (!value) {
    return "일정 미정";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(date);
  const partMap = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${partMap.year}년 ${partMap.month}월 ${partMap.day}일 ${partMap.hour}시`;
}

function formatWonAmount(amount: number) {
  return amount > 0 ? `${amount.toLocaleString("ko-KR")}원` : "-";
}

function getMemberLabel(memberNames: string[]) {
  const [firstMember] = memberNames;

  if (!firstMember) {
    return "멤버 미정";
  }

  return memberNames.length > 1
    ? `${firstMember} 외 ${memberNames.length - 1}명`
    : firstMember;
}

function getStatusBadge(status: string) {
  const statusLabels: Record<string, string> = {
    CANCELLED: "취소",
    CLOSED: "마감",
    FINISHED: "완료",
    PAID: "결제중",
    RECRUITING: "모집중",
    SETTLING: "정산중",
  };

  return statusLabels[status] ?? status;
}

function isDeletedBuncheolStatus(status: string | undefined) {
  return status === "CANCELLED" || status === "DELETED";
}

function getToneFromId(id: string) {
  const tones = [
    "from-black via-zinc-800 to-zinc-500",
    "from-zinc-700 via-zinc-500 to-zinc-100",
    "from-zinc-900 via-zinc-700 to-zinc-300",
    "from-zinc-300 via-zinc-100 to-neutral-400",
    "from-zinc-950 via-zinc-700 to-stone-300",
    "from-neutral-300 via-zinc-100 to-zinc-500",
  ];
  const hash = [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0);

  return tones[hash % tones.length];
}

function getShippingMethodLabel(method: string) {
  const normalizedMethod = method.toUpperCase();

  if (normalizedMethod.includes("GS25") || normalizedMethod.includes("GS")) {
    return "GS25 반값택배";
  }

  if (normalizedMethod.includes("CU")) {
    return "CU 알뜰택배";
  }

  return method;
}

function getShippingMethodsFromDetail(detail: BuncheolDetail) {
  if (detail.shippingOptions.length > 0) {
    return detail.shippingOptions.map((option) => ({
      name: getShippingMethodLabel(option.method),
      price: formatWonAmount(option.fee),
    }));
  }

  return [
    detail.gs25ShippingFee
      ? { name: "GS25 반값택배", price: formatWonAmount(detail.gs25ShippingFee) }
      : null,
    detail.cuShippingFee
      ? { name: "CU 알뜰택배", price: formatWonAmount(detail.cuShippingFee) }
      : null,
  ].filter(
    (method): method is { name: string; price: string } => method !== null,
  );
}

export function toProductCardItem(summary: BuncheolSummary): ProductCardItem {
  return {
    id: summary.id,
    productId: summary.id,
    title: summary.title,
    member: getMemberLabel(summary.memberNames),
    targetMembers: summary.memberNames,
    uploadedAt: formatKoreaDateTime(summary.createdAt),
    era: summary.groupName,
    price: undefined,
    deadline: formatKoreaDateTime(summary.deadline),
    rating: "0.0",
    reviews: String(summary.activeParticipationCount ?? 0),
    badge: getStatusBadge(summary.status),
    imageUrl: summary.thumbnailUrl,
    isHostedByMe: summary.isHostedByMe,
    liked: summary.bookmarked,
    status: summary.status,
    tone: getToneFromId(summary.id),
  };
}

export function toProductDetailItem(
  detail: BuncheolDetail,
): ProductDetailItem {
  const fallbackMembers: BuncheolMember[] =
    detail.members.length > 0
      ? detail.members
      : detail.memberNames.map((memberName, index) => ({
          bidMinPrice: 0,
          currentBidAmount: 0,
          id: `${detail.id}-member-${index}`,
          name: memberName,
          participantCount: 0,
          topBidAmounts: [],
        }));
  const optionMembers =
    fallbackMembers.length > 0
      ? fallbackMembers
      : [
          {
            bidMinPrice: 0,
            currentBidAmount: 0,
            id: `${detail.id}-member`,
            name: "옵션",
            participantCount: 0,
            topBidAmounts: [],
          },
        ];
  const options = optionMembers.map((member) => {
    const baselineAmount = Math.max(
      member.bidMinPrice,
      member.currentBidAmount,
      member.myBidAmount ?? 0,
    );
    const formattedBaseline = formatWonAmount(baselineAmount);
    const topBids =
      member.topBidAmounts.length > 0
        ? member.topBidAmounts.slice(0, 3).map(formatWonAmount)
        : [];

    return {
      id: member.id,
      buncheolMemberId: member.id,
      currentBid: formattedBaseline,
      imageUrl: member.imageUrl,
      label: member.name,
      myBidAmount: member.myBidAmount,
      myParticipationId: member.myParticipationId,
      participantCount: member.participantCount,
      price: formattedBaseline,
      startingBid: formatWonAmount(member.bidMinPrice),
      topBids: [
        topBids[0] ?? "-",
        topBids[1] ?? "-",
        topBids[2] ?? "-",
      ] as [string, string, string],
    } satisfies ProductOption;
  }) as unknown as [ProductOption, ...ProductOption[]];
  const memberNames = detail.memberNames.length
    ? detail.memberNames
    : optionMembers.map((member) => member.name);
  const shippingMethods = getShippingMethodsFromDetail(detail);

  return {
    ...toProductCardItem(detail),
    buncheolId: detail.id,
    courier: shippingMethods[0]?.name ?? "배송 방법 확인 필요",
    description:
      detail.description ?? "판매자가 아직 상품 설명을 작성하지 않았습니다.",
    imageUrl: detail.imageUrls[0],
    imageUrls: detail.imageUrls,
    isApiProduct: true,
    isHostedByMe: detail.isHostedByMe,
    member: getMemberLabel(memberNames),
    options,
    purchaseSource: detail.purchaseSite ?? "공식 판매처",
    shippingMethods: shippingMethods.length > 0 ? shippingMethods : undefined,
    status: detail.status,
    targetMembers: memberNames,
  };
}

async function enrichBuncheolSummariesWithThumbnails<T extends BuncheolSummary>(
  accessToken: string | undefined,
  summaries: T[],
) {
  if (summaries.every((summary) => summary.thumbnailUrl)) {
    return summaries;
  }

  const enrichedSummaries = [...summaries];
  const missingThumbnailIndexes = summaries
    .map((summary, index) => (summary.thumbnailUrl ? null : index))
    .filter((index): index is number => index !== null)
    .slice(0, thumbnailDetailFetchLimit);

  for (
    let index = 0;
    index < missingThumbnailIndexes.length;
    index += thumbnailDetailFetchConcurrency
  ) {
    const batchIndexes = missingThumbnailIndexes.slice(
      index,
      index + thumbnailDetailFetchConcurrency,
    );
    const batchSummaries = await Promise.all(
      batchIndexes.map(async (summaryIndex) => {
        const summary = summaries[summaryIndex];

        try {
          const url = `${getVersionedApiBaseUrl()}/buncheols/${summary.id}`;
          let response = await fetch(url, {
            credentials: "omit",
            headers: getAuthHeaders(accessToken),
            method: "GET",
          });

          if (response.status === 401 && accessToken) {
            response = await fetch(url, {
              credentials: "omit",
              method: "GET",
            });
          }

          if (!response.ok) {
            return summary;
          }

          const detail = getBuncheolDetailFromBody(await readJsonBody(response));
          const thumbnailUrl = detail?.imageUrls[0];

          return thumbnailUrl ? { ...summary, thumbnailUrl } : summary;
        } catch {
          return summary;
        }
      }),
    );

    batchSummaries.forEach((summary, batchIndex) => {
      enrichedSummaries[batchIndexes[batchIndex]] = summary;
    });
  }

  return enrichedSummaries;
}

export async function requestBuncheols(
  accessToken?: string,
  params: BuncheolListParams = {},
) {
  const url = `${getVersionedApiBaseUrl()}/buncheols${getRequestQuery(
    params,
  )}`;
  let response = await fetch(url, {
    credentials: "omit",
    headers: getAuthHeaders(accessToken),
    method: "GET",
  });

  if (response.status === 401 && accessToken) {
    response = await fetch(url, {
      credentials: "omit",
      method: "GET",
    });
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const body = await readJsonBody(response);

  const summaries = getBuncheolList(body)
    .filter(isRecord)
    .map(getBuncheolSummaryFromRecord)
    .filter((item): item is BuncheolSummary => item !== null);

  return enrichBuncheolSummariesWithThumbnails(accessToken, summaries);
}

export async function requestAllBuncheols(
  accessToken?: string,
  params: BuncheolListParams = {},
) {
  const allSummaries: BuncheolSummary[] = [];
  let cursor = params.cursor;
  let pageCount = 0;

  while (pageCount < 20) {
    const pageParams: BuncheolListParams = {
      ...params,
      cursor,
      size: params.size ?? 50,
    };
    const url = `${getVersionedApiBaseUrl()}/buncheols${getRequestQuery(
      pageParams,
    )}`;
    let response = await fetch(url, {
      credentials: "omit",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    });

    if (response.status === 401 && accessToken) {
      response = await fetch(url, {
        credentials: "omit",
        method: "GET",
      });
    }

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    const body = await readJsonBody(response);
    const pageSummaries = getBuncheolList(body)
      .filter(isRecord)
      .map(getBuncheolSummaryFromRecord)
      .filter((item): item is BuncheolSummary => item !== null);

    allSummaries.push(...pageSummaries);

    const pageInfo = getBuncheolListPageInfo(body);

    if (!pageInfo.hasNext || !pageInfo.nextCursor) {
      break;
    }

    cursor = pageInfo.nextCursor;
    pageCount += 1;
  }

  return enrichBuncheolSummariesWithThumbnails(accessToken, allSummaries);
}

export async function requestBuncheolDetail(
  accessToken: string | undefined,
  buncheolId: string,
) {
  const url = `${getVersionedApiBaseUrl()}/buncheols/${buncheolId}`;
  let response = await fetch(url, {
    credentials: "omit",
    headers: getAuthHeaders(accessToken),
    method: "GET",
  });

  if (response.status === 401 && accessToken) {
    response = await fetch(url, {
      credentials: "omit",
      method: "GET",
    });
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const detail = getBuncheolDetailFromBody(await readJsonBody(response));

  if (!detail) {
    throw new Error("분철 상세 정보를 확인할 수 없어요.");
  }

  return detail;
}

export async function createBuncheol(
  accessToken: string,
  body: CreateBuncheolRequest,
  images: Blob[] = [],
) {
  const formData = new FormData();
  appendJsonFormPart(formData, body);
  appendImageFormParts(formData, images);

  const response = await fetch(`${getVersionedApiBaseUrl()}/buncheols`, {
    body: formData,
    credentials: "include",
    headers: getAuthHeaders(accessToken),
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const responseBody = await readJsonBody(response);
  const data = getNestedData(responseBody);

  if (typeof data === "string" || typeof data === "number") {
    return String(data);
  }

  if (isRecord(data)) {
    return getStringValue(data, ["buncheolId", "id"]);
  }

  return "";
}

export async function updateBuncheol(
  accessToken: string,
  buncheolId: string,
  body: UpdateBuncheolRequest,
  images: Blob[] = [],
) {
  const formData = new FormData();
  appendJsonFormPart(formData, body);
  appendImageFormParts(formData, images);

  const url = `${getVersionedApiBaseUrl()}/buncheols/${buncheolId}`;
  let response = await fetch(url, {
    body: formData,
    credentials: "include",
    headers: getAuthHeaders(accessToken),
    method: "PATCH",
  });

  if (response.status === 405) {
    response = await fetch(
      url,
      {
        body: formData,
        credentials: "include",
        headers: getAuthHeaders(accessToken),
        method: "PUT",
      },
    );
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function deleteBuncheol(
  accessToken: string,
  buncheolId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/buncheols/${buncheolId}`,
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

export async function participateBuncheol(
  accessToken: string,
  buncheolId: string,
  body: ParticipateBuncheolRequest,
) {
  const requestInit: RequestInit = {
    body: JSON.stringify(body),
    credentials: "include",
    headers: getJsonHeaders(accessToken),
    method: "POST",
  };
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/buncheols/${buncheolId}/participations`,
    requestInit,
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = getNestedData(await readJsonBody(response));

  if (!isRecord(data)) {
    throw new Error("참여 결과를 확인할 수 없어요.");
  }

  return {
    bidAmount: getNumberValue(data, ["bidAmount"]) ?? body.bidAmount,
    participationId: getStringValue(data, ["participationId", "id"]),
    participationStatus:
      getOptionalStringValue(data, ["participationStatus", "status"]) ??
      "ACTIVE_BID",
  } satisfies ParticipationCheckoutResponse;
}

export async function cancelBuncheolParticipation(
  accessToken: string,
  participationId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/participations/${participationId}`,
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

export async function requestMyParticipations(accessToken: string) {
  const response = await fetch(`${getVersionedApiBaseUrl()}/participations/me`, {
    credentials: "include",
    headers: getAuthHeaders(accessToken),
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return getBuncheolList(await readJsonBody(response))
    .filter(isRecord)
    .map((record): MyParticipation | null => {
      const participationId = getStringValue(record, [
        "participationId",
        "id",
      ]);
      const buncheolId = getStringValue(record, ["buncheolId"]);

      if (!participationId || !buncheolId) {
        return null;
      }

      return {
        bidAmount: getNumberValue(record, ["bidAmount"]) ?? 0,
        buncheolDeadline: getStringValue(record, [
          "buncheolDeadline",
          "deadline",
        ]),
        buncheolId,
        buncheolMemberCount:
          getNumberValue(record, [
            "buncheolMemberCount",
            "memberSlotCount",
            "memberCount",
          ]) ?? 0,
        buncheolStatus:
          getOptionalStringValue(record, ["buncheolStatus", "status"]) ??
          "RECRUITING",
        buncheolTitle: getStringValue(record, [
          "buncheolTitle",
          "title",
        ]),
        closedRank: getOptionalNumberValue(record, ["closedRank", "rank"]) ?? null,
        memberName: getStringValue(record, ["memberName", "optionLabel"]),
        participationId,
        participationStatus:
          getOptionalStringValue(record, [
            "participationStatus",
            "status",
          ]) ?? "ACTIVE_BID",
        paymentDueAt:
          getOptionalStringValue(record, ["paymentDueAt", "paymentDeadline"]) ??
          null,
      };
    })
    .filter(
      (participation): participation is MyParticipation =>
        participation !== null,
    );
}

export async function requestMyHostedBuncheols(accessToken: string) {
  const response = await fetch(`${getVersionedApiBaseUrl()}/buncheols/me`, {
    credentials: "include",
    headers: getAuthHeaders(accessToken),
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const buncheols = getBuncheolList(await readJsonBody(response))
    .filter(isRecord)
    .map((record): MyHostedBuncheol | null => {
      const summary = getBuncheolSummaryFromRecord(record);

      if (!summary) {
        return null;
      }

      return {
        ...summary,
        activeParticipationCount:
          summary.activeParticipationCount ??
          getNumberValue(record, ["activeParticipationCount"]) ??
          0,
        createdAt: summary.createdAt ?? "",
        memberSlotCount:
          summary.memberSlotCount ??
          getNumberValue(record, ["memberSlotCount"]) ??
          0,
      };
    })
    .filter(
      (buncheol): buncheol is MyHostedBuncheol => buncheol !== null,
    );

  return enrichBuncheolSummariesWithThumbnails(
    accessToken,
    buncheols.filter((buncheol) => !isDeletedBuncheolStatus(buncheol.status)),
  );
}

export async function requestBookmarkedBuncheols(
  accessToken: string,
  params: Pick<
    BuncheolListParams,
    "hideClosed" | "onlyFavoriteGroups" | "sort"
  > = {},
): Promise<BuncheolSummary[]> {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/buncheols/bookmarks/me${getRequestQuery(
      params,
    )}`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const summaries = getBuncheolList(await readJsonBody(response))
    .filter(isRecord)
    .reduce<BuncheolSummary[]>((summaries, record) => {
      const summary = getBuncheolSummaryFromRecord(record);

      if (summary) {
        summaries.push({ ...summary, bookmarked: true });
      }

      return summaries;
    }, []);

  return enrichBuncheolSummariesWithThumbnails(
    accessToken,
    summaries.filter((summary) => !isDeletedBuncheolStatus(summary.status)),
  );
}

export async function addBuncheolBookmark(
  accessToken: string,
  buncheolId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/buncheols/${buncheolId}/bookmark`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "POST",
    },
  );

  if (!response.ok && response.status !== 409) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function removeBuncheolBookmark(
  accessToken: string,
  buncheolId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/buncheols/${buncheolId}/bookmark`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "DELETE",
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function requestPaymentCheckout(
  accessToken: string,
  participationId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/participations/${participationId}/payment/checkout`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return getNestedData(await readJsonBody(response)) as PaymentOrderResponse;
}

function getApiGroupFromRecord(record: Record<string, unknown>): ApiGroup | null {
  const nestedGroup = getNestedData(record.group);
  const groupRecord = isRecord(nestedGroup) ? nestedGroup : record;
  const id = getStringValue(groupRecord, ["id", "groupId"]);
  const name = getStringValue(groupRecord, ["name", "groupName"]);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    favorited:
      getBooleanValue(record, [
        "favorited",
        "favorite",
        "isFavorite",
        "isFavorited",
      ]) ??
      getBooleanValue(groupRecord, [
        "favorited",
        "favorite",
        "isFavorite",
        "isFavorited",
      ]) ??
      undefined,
    imageUrl: getOptionalStringValue(groupRecord, [
      "image",
      "imageUrl",
      "thumbnailUrl",
      "profileImageUrl",
    ]),
  } satisfies ApiGroup;
}

export async function requestGroups(
  keyword = "",
  accessToken?: string,
): Promise<ApiGroup[]> {
  const searchParams = keyword
    ? `?${new URLSearchParams({ keyword }).toString()}`
    : "";
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/groups${searchParams}`,
    {
      credentials: "omit",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return getBuncheolList(await readJsonBody(response))
    .filter(isRecord)
    .map(getApiGroupFromRecord)
    .filter((group): group is ApiGroup => group !== null);
}

export async function requestFavoriteGroups(
  accessToken: string,
): Promise<ApiGroup[]> {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/groups/favorites/me`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return getBuncheolList(await readJsonBody(response))
    .filter(isRecord)
    .map(getApiGroupFromRecord)
    .filter((group): group is ApiGroup => group !== null)
    .map((group) => ({ ...group, favorited: true }));
}

export async function addFavoriteGroup(accessToken: string, groupId: string) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/groups/${groupId}/favorite`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "POST",
    },
  );

  if (response.status === 409) {
    return { alreadyExists: true };
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return { alreadyExists: false };
}

export async function removeFavoriteGroup(
  accessToken: string,
  groupId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/groups/${groupId}/favorite`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "DELETE",
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function requestGroupMembers(groupId: string) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/groups/${groupId}/members`,
    {
      credentials: "include",
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return getBuncheolList(await readJsonBody(response))
    .filter(isRecord)
    .map((record): ApiGroupMember | null => {
      const nestedMember = getNestedData(record.member);
      const memberRecord = isRecord(nestedMember) ? nestedMember : record;
      const id = getStringValue(memberRecord, ["id", "memberId"]);
      const name = getStringValue(memberRecord, ["name", "memberName"]);

      if (!id || !name) {
        return null;
      }

      return {
        id,
        name,
        imageUrl: getOptionalStringValue(memberRecord, [
          "image",
          "imageUrl",
          "thumbnailUrl",
          "profileImageUrl",
        ]),
      };
    })
    .filter((member): member is ApiGroupMember => member !== null);
}
