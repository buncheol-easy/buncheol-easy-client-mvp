import type {
  ConvenienceStoreType,
  DeliveryAddress,
} from "@/lib/mock-delivery-addresses";
import type { ProductCardItem } from "@/components/ProductCard";
import type { ProductDetailItem, ProductOption } from "@/lib/mock-products";

const defaultApiBaseUrl = "https://staging.buncheoleasy.com";
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

export type BankAccountInfo = {
  account: string;
  bank: string;
  holder: string;
};

export type UserProfile = {
  provider: string;
  email: string;
  nickname: string;
  phoneNumber: string;
  bankAccount: BankAccountInfo | null;
  // 백엔드 개최 권한 제한 반영 전 응답에는 없는 필드라 undefined를 허용한다.
  canHost?: boolean;
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
  memberId: number;
  price: number;
};

export type CreateBuncheolRequest = {
  buncheolMembers: BuncheolMemberRequest[];
  cuShippingFee?: number;
  deadline: string;
  minHeadcount: number;
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
  buncheolMemberId?: number;
  buncheolMemberIds?: number[];
  refundAccount: BankAccountInfo;
  shippingAddressId: number;
};

export type ParticipationCheckoutResponse = {
  bidAmount: number;
  hostBankAccount?: BankAccountInfo | null;
  paymentAmount?: number | null;
  paymentDueAt?: string | null;
  participationId: string;
  participationIds: string[];
  participationStatus: string;
  shippingFee?: number | null;
};

export type InboxMessageType = "NOTICE" | "NOTIFICATION" | string;

export type InboxMessageSummary = {
  createdAt: string;
  id: string;
  pinned: boolean;
  title: string;
  type: InboxMessageType;
};

export type InboxMessageDetail = InboxMessageSummary & {
  description: string;
  linkPath?: string;
  reference?: string;
};

export type CreateNoticeRequest = {
  banner?: {
    title: string;
  };
  description: string;
  linkPath?: string;
  pinned: boolean;
  reference?: string;
  title: string;
};

export type CreateNoticeFiles = {
  bannerImage?: Blob | null;
  image?: Blob | null;
};

export type CreateNoticeResponse = {
  location: string | null;
  noticeId: string | null;
};

export type ApiBanner = {
  bannerImageUrl: string;
  bannerTitle: string;
  noticeId: string;
};

export type InboxFeed = {
  hasNext: boolean;
  items: InboxMessageSummary[];
  nextCursor: string | null;
};

export type InboxMessagesResponse = {
  feed: InboxFeed;
  pinned: InboxMessageSummary[];
};

export type InboxMessagesParams = {
  cursor?: string | null;
  size?: number;
  type?: "NOTICE" | "NOTIFICATION";
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

export type ApiGroupWithMembers = ApiGroup & {
  members: ApiGroupMember[];
};

export type RecentSearchKeyword = {
  id: string;
  keyword: string;
};

export type BuncheolSummary = {
  activeParticipationCount?: number;
  availableMemberNames?: string[];
  bookmarkId?: string;
  bookmarked?: boolean;
  createdAt?: string;
  deadline: string;
  groupName: string;
  id: string;
  isHostedByMe?: boolean;
  memberNames: string[];
  memberSlotCount?: number;
  minHeadcount?: number | null;
  status: BuncheolStatus;
  thumbnailUrl?: string;
  title: string;
};

export type BuncheolMember = {
  available?: boolean;
  bidMinPrice: number;
  currentBidAmount: number;
  id: string;
  imageUrl?: string;
  memberId?: string;
  myBidAmount?: number;
  myParticipationId?: string;
  myRank?: number;
  name: string;
  participantCount: number;
  purchasePaymentConfirmedAt?: string;
  purchasePaymentDueAt?: string;
  purchasePaymentStatus?: string;
  purchaseParticipationId?: string;
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
  hostBankAccount?: BankAccountInfo | null;
  imageUrls: string[];
  imageIds: number[];
  minHeadcount?: number | null;
  isHostedByMe?: boolean;
  members: BuncheolMember[];
  purchaseSite?: string;
  shippingOptions: BuncheolShippingOption[];
};

export type BuncheolManagementWinner = {
  bidAmount?: number | null;
  depositorName?: string;
  deliveryId?: string;
  deliveryStatus?: string;
  paymentAmount?: number | null;
  paymentConfirmedAt?: string;
  paymentDueAt?: string;
  paymentReportedAt?: string;
  paymentStatus?: string;
  participationId?: string;
  receiverNickname?: string;
  receiverPhoneNumber?: string;
  shippingAddressSnapshotId?: string;
  shippingMethod?: string;
  storeName?: string;
  trackingNumber?: string | null;
};

export type BuncheolManagementDelivery = {
  deliveryId?: string;
  receiverNickname?: string;
  receiverPhoneNumber?: string;
  shippingMethod?: string;
  status?: string;
  storeName?: string;
  trackingNumber?: string | null;
};

export type BuncheolManagementParticipant = {
  amount: number;
  buncheolMemberId?: string;
  confirmedAt?: string | null;
  delivery?: BuncheolManagementDelivery | null;
  dueAt?: string | null;
  memberName: string;
  participantNickname: string;
  participationId: string;
  refundAccount?: BankAccountInfo | null;
  status: string;
};

export type BuncheolManagementOption = {
  buncheolMemberId: string;
  currentHighestBid?: number | null;
  memberId?: string;
  memberImage?: string;
  memberName: string;
  participants?: BuncheolManagementParticipant[];
  participationCount: number;
  winner?: BuncheolManagementWinner | null;
};

export type BuncheolManagementDetail = {
  confirmedCount?: number;
  deadline: string;
  groupName: string;
  id: string;
  memberCount?: number;
  minHeadcount?: number;
  optionCount: number;
  options: BuncheolManagementOption[];
  participants: BuncheolManagementParticipant[];
  purchaseSite?: string;
  status: BuncheolStatus;
  title: string;
  totalParticipationCount: number;
};
export type MyParticipation = {
  bidAmount: number;
  buncheolDeadline: string;
  buncheolId: string;
  buncheolMemberId?: string | null;
  buncheolMemberCount: number;
  buncheolStatus: string;
  buncheolTitle: string;
  closedRank?: number | null;
  deliveryId?: string | null;
  deliveryStatus?: string | null;
  thumbnailUrl?: string;
  memberName: string;
  participationId: string;
  participationStatus: string;
  paymentAmount?: number | null;
  paymentDueAt?: string | null;
  createdAt?: string | null;
  hostBankAccount?: BankAccountInfo | null;
  shippingAddress?: DeliveryAddress | null;
  shippingFee?: number | null;
  trackingNumber?: string | null;
};

export type MyHostedBuncheol = BuncheolSummary & {
  activeParticipationCount: number;
  createdAt: string;
  memberSlotCount: number;
};

export type ParticipationPaymentDetail = {
  bidAmount: number;
  deliveryId?: string | null;
  deliveryStatus?: string | null;
  hostBankAccount: BankAccountInfo | null;
  participationId: string;
  paymentAmount: number | null;
  paymentDueAt?: string | null;
  paymentStatus: string;
  shippingAddress?: DeliveryAddress | null;
  shippingFee: number | null;
  trackingNumber?: string | null;
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

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMessage: string,
) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, 20000);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(timeoutMessage);
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
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

function getDeepStringValue(
  body: Record<string, unknown>,
  keys: string[],
  visited = new Set<unknown>(),
): string {
  const directValue = getStringValue(body, keys).trim();

  if (directValue) {
    return directValue;
  }

  if (visited.has(body)) {
    return "";
  }

  visited.add(body);

  for (const value of Object.values(body)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (!isRecord(item)) {
          continue;
        }

        const nestedValue = getDeepStringValue(item, keys, visited);

        if (nestedValue) {
          return nestedValue;
        }
      }

      continue;
    }

    if (isRecord(value)) {
      const nestedValue = getDeepStringValue(value, keys, visited);

      if (nestedValue) {
        return nestedValue;
      }
    }
  }

  return "";
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

const participationDeliveryIdKeys = [
  "deliveryId",
  "deliverySnapshotId",
  "trackingDeliveryId",
  "shipmentId",
  "shippingId",
];

const participationDeliveryStatusKeys = [
  "deliveryStatus",
  "shippingStatus",
  "trackingStatus",
  "shipmentStatus",
];

const participationNestedDeliveryStatusKeys = [
  ...participationDeliveryStatusKeys,
  "status",
];

const participationTrackingNumberKeys = [
  "trackingNumber",
  "invoiceNumber",
  "waybillNumber",
  "trackingNo",
  "trackingCode",
];

function getOptionalStringValueFromRecords(
  records: (Record<string, unknown> | null | undefined)[],
  keys: string[],
) {
  for (const record of records) {
    if (!record) {
      continue;
    }

    const value = getOptionalStringValue(record, keys);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function getOptionalNumberValueFromRecords(
  records: (Record<string, unknown> | null | undefined)[],
  keys: string[],
) {
  for (const record of records) {
    if (!record) {
      continue;
    }

    const value = getOptionalNumberValue(record, keys);

    if (typeof value === "number") {
      return value;
    }
  }

  return undefined;
}

function getParticipationRelatedRecords(record: Record<string, unknown>) {
  return [
    record.paymentRequest,
    record.paymentReport,
    record.pendingPayment,
    record.pendingWinner,
    record.payment,
    record.participation,
    record.participant,
    record.winner,
    record.order,
    record.orderInfo,
    record.checkout,
    record.checkoutRequest,
  ]
    .map(getNestedData)
    .filter(isRecord);
}

function getParticipationDeliveryRecord(record: Record<string, unknown>) {
  const relatedRecords = getParticipationRelatedRecords(record);
  const deliveryCandidates = [
    record.delivery,
    record.deliverySnapshot,
    record.deliveryInfo,
    record.deliveryRequest,
    record.shipment,
    record.shipmentInfo,
    record.shippingDelivery,
    record.shippingSnapshot,
    record.shipping,
    record.shippingInfo,
    ...relatedRecords.flatMap((relatedRecord) => [
      relatedRecord.delivery,
      relatedRecord.deliverySnapshot,
      relatedRecord.deliveryInfo,
      relatedRecord.deliveryRequest,
      relatedRecord.shipment,
      relatedRecord.shipmentInfo,
      relatedRecord.shippingDelivery,
      relatedRecord.shippingSnapshot,
      relatedRecord.shipping,
      relatedRecord.shippingInfo,
    ]),
  ];

  return deliveryCandidates.map(getNestedData).find(isRecord) ?? null;
}

function getParticipationShippingAddressRecord(
  record: Record<string, unknown>,
) {
  const relatedRecords = getParticipationRelatedRecords(record);
  const deliveryRecord = getParticipationDeliveryRecord(record);
  const addressCandidates = [
    record.shippingAddressSnapshot,
    record.shippingAddress,
    record.shippingAddressInfo,
    record.selectedShippingAddress,
    record.selectedAddress,
    record.deliveryAddress,
    record.deliveryAddressSnapshot,
    record.recipientAddress,
    record.recipient,
    record.receiver,
    record.receiverInfo,
    record.pickupStore,
    record.store,
    record.storeInfo,
    record.addressSnapshot,
    record.address,
    record.shipping,
    record.shippingInfo,
    deliveryRecord?.shippingAddressSnapshot,
    deliveryRecord?.shippingAddress,
    deliveryRecord?.shippingAddressInfo,
    deliveryRecord?.selectedShippingAddress,
    deliveryRecord?.selectedAddress,
    deliveryRecord?.recipientAddress,
    deliveryRecord?.recipient,
    deliveryRecord?.receiver,
    deliveryRecord?.receiverInfo,
    deliveryRecord?.pickupStore,
    deliveryRecord?.store,
    deliveryRecord?.storeInfo,
    deliveryRecord?.addressSnapshot,
    deliveryRecord?.address,
    ...relatedRecords.flatMap((relatedRecord) => [
      relatedRecord.shippingAddressSnapshot,
      relatedRecord.shippingAddress,
      relatedRecord.shippingAddressInfo,
      relatedRecord.selectedShippingAddress,
      relatedRecord.selectedAddress,
      relatedRecord.deliveryAddress,
      relatedRecord.deliveryAddressSnapshot,
      relatedRecord.recipientAddress,
      relatedRecord.recipient,
      relatedRecord.receiver,
      relatedRecord.receiverInfo,
      relatedRecord.pickupStore,
      relatedRecord.store,
      relatedRecord.storeInfo,
      relatedRecord.addressSnapshot,
      relatedRecord.address,
      relatedRecord.shipping,
      relatedRecord.shippingInfo,
    ]),
  ];

  return addressCandidates.map(getNestedData).find(isRecord) ?? null;
}

function getBankAccountInfoFromRecord(
  body: Record<string, unknown>,
): BankAccountInfo | null {
  const bank = getStringValue(body, [
    "bank",
    "bankName",
    "bankCode",
    "hostBank",
    "hostBankName",
    "sellerBank",
    "sellerBankName",
  ]).trim();
  const account = getStringValue(body, [
    "account",
    "accountNumber",
    "accountNo",
    "accountNum",
    "bankAccount",
    "bankAccountNumber",
    "number",
    "hostAccount",
    "hostAccountNumber",
    "sellerAccount",
    "sellerAccountNumber",
  ]).trim();
  const holder = getStringValue(body, [
    "holder",
    "holderName",
    "accountHolder",
    "accountOwner",
    "accountOwnerName",
    "depositor",
    "depositorName",
    "name",
    "hostHolder",
    "hostAccountHolder",
    "sellerHolder",
    "sellerAccountHolder",
  ]).trim();

  if (!account) {
    return null;
  }

  return {
    account,
    bank,
    holder,
  };
}

function getBankAccountInfoFromNestedRecord(
  body: Record<string, unknown>,
  visited = new Set<unknown>(),
): BankAccountInfo | null {
  const directBankAccount = getBankAccountInfoFromRecord(body);

  if (directBankAccount) {
    return directBankAccount;
  }

  if (visited.has(body)) {
    return null;
  }

  visited.add(body);

  for (const value of Object.values(body)) {
    const nestedValue = getNestedData(value);

    if (!isRecord(nestedValue)) {
      continue;
    }

    const nestedBankAccount = getBankAccountInfoFromNestedRecord(
      nestedValue,
      visited,
    );

    if (nestedBankAccount) {
      return nestedBankAccount;
    }
  }

  return null;
}

function getNestedBankAccountInfo(
  body: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = getNestedData(body[key]);

    if (!isRecord(value)) {
      continue;
    }

    const bankAccount = getBankAccountInfoFromNestedRecord(value);

    if (bankAccount) {
      return bankAccount;
    }
  }

  return getBankAccountInfoFromRecord(body);
}

function getUserProfileFromBody(body: unknown): UserProfile {
  const data = getNestedData(body);

  if (!isRecord(data)) {
    return {
      bankAccount: null,
      email: "",
      nickname: "",
      phoneNumber: "",
      provider: "",
    };
  }

  return {
    bankAccount: getNestedBankAccountInfo(data, [
      "bankAccount",
      "refundAccount",
      "refundBankAccount",
      "refundBankAccountInfo",
      "settlementAccount",
      "settlementBankAccount",
      "settlementBankAccountInfo",
      "paymentAccount",
      "paymentBankAccount",
      "userBankAccount",
      "account",
    ]),
    canHost: getBooleanValue(data, ["canHost"]) ?? undefined,
    email: getStringValue(data, ["email", "emailAddress"]),
    nickname: getStringValue(data, ["nickname", "name", "displayName"]),
    phoneNumber: getStringValue(data, [
      "phoneNumber",
      "phone",
      "mobilePhone",
      "phoneNo",
    ]),
    provider: getStringValue(data, [
      "provider",
      "oauthProvider",
      "socialProvider",
    ]),
  };
}

function getParticipationPaymentDetailFromBody(
  body: unknown,
  fallbackParticipationId: string,
): ParticipationPaymentDetail | null {
  const data = getNestedData(body);

  if (!isRecord(data)) {
    return null;
  }

  const participationId =
    getStringValue(data, ["participationId", "id"]) || fallbackParticipationId;

  if (!participationId) {
    return null;
  }

  const deliveryRecord = getParticipationDeliveryRecord(data);
  const shippingAddressRecord = getParticipationShippingAddressRecord(data);
  const lookupRecords = [data, deliveryRecord];

  return {
    bidAmount:
      getNumberValue(data, [
        "bidAmount",
        "productAmount",
        "itemAmount",
        "price",
        "amount",
        "paymentAmount",
      ]) ?? 0,
    deliveryId:
      getOptionalStringValueFromRecords(
        lookupRecords,
        participationDeliveryIdKeys,
      ) ?? null,
    deliveryStatus:
      (deliveryRecord
        ? getOptionalStringValue(
            deliveryRecord,
            participationNestedDeliveryStatusKeys,
          )
        : undefined) ??
      getOptionalStringValue(data, participationDeliveryStatusKeys) ??
      null,
    hostBankAccount: getNestedBankAccountInfo(data, [
      "hostAccount",
      "hostBankAccount",
      "host",
      "hostProfile",
      "sellerBankAccount",
      "seller",
      "sellerProfile",
      "creatorBankAccount",
      "creator",
      "creatorProfile",
      "ownerBankAccount",
      "owner",
      "ownerProfile",
      "paymentBankAccount",
      "transferBankAccount",
      "settlementBankAccount",
      "organizer",
      "organizerProfile",
      "sellerAccount",
      "bankAccount",
    ]),
    participationId,
    paymentAmount:
      getNumberValue(data, ["totalAmount", "paymentAmount", "amount"]) ??
      null,
    paymentDueAt:
      getOptionalStringValue(data, [
        "paymentDueAt",
        "paymentDeadline",
        "dueAt",
      ]) ?? null,
    paymentStatus:
      getOptionalStringValue(data, [
        "paymentStatus",
        "participationStatus",
        "status",
      ]) ??
      "",
    shippingAddress: shippingAddressRecord
      ? getUserShippingAddress(shippingAddressRecord)
      : null,
    shippingFee:
      getOptionalNumberValueFromRecords(lookupRecords, [
        "shippingFee",
        "deliveryFee",
      ]) ?? null,
    trackingNumber:
      getOptionalStringValueFromRecords(
        lookupRecords,
        participationTrackingNumberKeys,
      ) ?? null,
  };
}

function getOptionalDeepStringValue(
  body: Record<string, unknown>,
  keys: string[],
) {
  const value = getDeepStringValue(body, keys).trim();

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

function getNestedRecordListValue(
  body: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = body[key];

    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }

    const nestedValue = getNestedData(value);

    if (Array.isArray(nestedValue)) {
      return nestedValue.filter(isRecord);
    }

    if (isRecord(nestedValue)) {
      const nestedList = [
        nestedValue.items,
        nestedValue.content,
        nestedValue.list,
        nestedValue.records,
        nestedValue.results,
      ].find(Array.isArray);

      if (nestedList) {
        return nestedList.filter(isRecord);
      }
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

  const id = getStringValue(data, [
    "id",
    "shippingAddressId",
    "addressId",
    "shippingAddressSnapshotId",
    "addressSnapshotId",
    "deliveryId",
    "deliverySnapshotId",
  ]);
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

  return getUserProfileFromBody(await response.json());
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
    throw new ApiRequestError(await parseErrorMessage(response), response.status);
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
    "request.json",
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

function appendNamedFileFormPart(
  formData: FormData,
  name: string,
  file: Blob | null | undefined,
  fallbackFilename: string,
) {
  if (!file) {
    return;
  }

  formData.append(
    name,
    file instanceof File
      ? file
      : new File([file], fallbackFilename, {
          type: file.type || "image/jpeg",
        }),
  );
}

function getBannerList(body: unknown) {
  const data = getNestedData(body);

  if (Array.isArray(data)) {
    return data;
  }

  if (!isRecord(data)) {
    return [];
  }

  const candidates = [data.banners, data.items, data.content, data.list];

  return candidates.find(Array.isArray) ?? [];
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

function normalizeImageUrl(imageUrl: string) {
  const trimmedImageUrl = imageUrl.trim();

  if (!trimmedImageUrl) {
    return "";
  }

  if (
    trimmedImageUrl.startsWith("http://") ||
    trimmedImageUrl.startsWith("https://") ||
    trimmedImageUrl.startsWith("data:") ||
    trimmedImageUrl.startsWith("blob:")
  ) {
    return trimmedImageUrl;
  }

  if (trimmedImageUrl.startsWith("//")) {
    return `https:${trimmedImageUrl}`;
  }

  if (trimmedImageUrl.startsWith("/")) {
    return `${getApiRootUrl()}${trimmedImageUrl}`;
  }

  return trimmedImageUrl;
}

const proxiedGroupImageHosts = new Set([
  "buncheol-easy-bucket.s3.ap-northeast-2.amazonaws.com",
  "buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
  "staging-buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
]);
const groupImagePathPrefix = "/idol-groups/";

function getProxiedGroupImageUrl(imageUrl: string | undefined) {
  if (!imageUrl) {
    return undefined;
  }

  const normalizedImageUrl = normalizeImageUrl(imageUrl);

  try {
    const parsedImageUrl = new URL(normalizedImageUrl);

    if (
      proxiedGroupImageHosts.has(parsedImageUrl.hostname) &&
      parsedImageUrl.pathname.startsWith(groupImagePathPrefix)
    ) {
      return `/api/group-image?url=${encodeURIComponent(normalizedImageUrl)}`;
    }
  } catch {
    return normalizedImageUrl;
  }

  return normalizedImageUrl;
}

function getImageUrl(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return normalizeImageUrl(String(value));
  }

  if (!isRecord(value)) {
    return "";
  }

  return normalizeImageUrl(
    getStringValue(value, [
      "imageUrl",
      "thumbnailUrl",
      "representativeImageUrl",
      "mainImageUrl",
      "coverImageUrl",
      "fileUrl",
      "cdnUrl",
      "s3Url",
      "storedUrl",
      "url",
      "image",
      "path",
      "src",
    ]),
  );
}

function getImageUrls(data: Record<string, unknown>) {
  const imageKeys = [
    "imageUrls",
    "images",
    "imageList",
    "buncheolImages",
    "photos",
    "files",
    "attachments",
  ];
  const images = imageKeys.flatMap((key) => {
    const value = data[key];

    if (!Array.isArray(value)) {
      return [];
    }

    return value.map(getImageUrl);
  });
  const thumbnailUrl = getImageUrl(
    getOptionalStringValue(data, [
      "thumbnailUrl",
      "thumbnail",
      "imageUrl",
      "representativeImageUrl",
      "mainImageUrl",
      "coverImageUrl",
      "image",
    ]),
  );

  return [thumbnailUrl, ...images].filter(
    (imageUrl, index, imageUrls): imageUrl is string =>
      Boolean(imageUrl) && imageUrls.indexOf(imageUrl) === index,
  );
}

function getImageId(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  return getOptionalNumberValue(value, [
    "imageId",
    "buncheolImageId",
    "fileId",
    "attachmentId",
    "id",
  ]);
}

function getImageIds(data: Record<string, unknown>) {
  const directImageIds = getStringListValue(data, ["imageIds", "keepImageIds"])
    .map((imageId) => Number(imageId))
    .filter((imageId) => Number.isFinite(imageId));
  const imageKeys = [
    "imageUrls",
    "images",
    "imageList",
    "buncheolImages",
    "photos",
    "files",
    "attachments",
  ];
  const nestedImageIds = imageKeys.flatMap((key) => {
    const value = data[key];

    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(getImageId)
      .filter((imageId): imageId is number => imageId !== null);
  });

  return [...directImageIds, ...nestedImageIds].filter(
    (imageId, index, imageIds) => imageIds.indexOf(imageId) === index,
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
  const availableMemberNameKeys = [
    "availableMemberNames",
    "availableMembers",
    "availableBuncheolMembers",
  ];
  const hasAvailableMemberNames = availableMemberNameKeys.some((key) =>
    Array.isArray(record[key]),
  );
  const availableMemberNames = hasAvailableMemberNames
    ? getStringListValue(record, availableMemberNameKeys)
    : undefined;
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
    availableMemberNames,
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
    minHeadcount: getOptionalNumberValue(record, ["minHeadcount"]),
  };
}

function getBuncheolMemberPurchaseStateFromRecord(
  record: Record<string, unknown>,
) {
  const nestedCandidates = [
    record.winner,
    record.paymentRequest,
    record.paymentReport,
    record.pendingPayment,
    record.pendingWinner,
    record.payment,
    record.currentParticipation,
    record.participation,
  ]
    .map(getNestedData)
    .filter(isRecord);
  const participantCandidate = getNestedRecordListValue(record, [
    "participants",
    "participations",
    "paymentParticipants",
    "paymentRequests",
    "payments",
  ]).find((candidate) => {
    const status = getOptionalStringValue(candidate, [
      "paymentStatus",
      "participationStatus",
      "status",
    ]);

    return Boolean(
      status ||
        getOptionalStringValue(candidate, ["paymentConfirmedAt"]) ||
        getOptionalStringValue(candidate, [
          "paymentDueAt",
          "paymentDeadline",
          "dueAt",
        ]) ||
        getOptionalStringValue(candidate, [
          "participationId",
          "winnerParticipationId",
          "paymentParticipationId",
          "id",
        ]),
    );
  });
  const hasDirectPaymentState = Boolean(
    getOptionalStringValue(record, [
      "paymentStatus",
      "participationStatus",
      "paymentConfirmedAt",
      "paymentDueAt",
      "paymentDeadline",
      "dueAt",
      "participationId",
      "winnerParticipationId",
      "paymentParticipationId",
    ]),
  );
  const source =
    nestedCandidates[0] ?? participantCandidate ?? (hasDirectPaymentState ? record : null);

  if (!source) {
    return {};
  }

  const purchasePaymentConfirmedAt = getOptionalStringValue(source, [
    "paymentConfirmedAt",
    "confirmedAt",
  ]);
  const purchasePaymentDueAt = getOptionalStringValue(source, [
    "paymentDueAt",
    "paymentDeadline",
    "dueAt",
  ]);
  const purchaseParticipationId = getOptionalStringValue(source, [
    "participationId",
    "winnerParticipationId",
    "paymentParticipationId",
    "id",
  ]);
  const purchasePaymentStatus =
    getOptionalStringValue(source, [
      "paymentStatus",
      "participationStatus",
      "status",
    ]) ??
    (purchasePaymentConfirmedAt
      ? "CONFIRMED"
      : purchasePaymentDueAt || purchaseParticipationId
        ? "AWAITING_PAYMENT"
        : undefined);

  return {
    purchasePaymentConfirmedAt,
    purchasePaymentDueAt,
    purchasePaymentStatus,
    purchaseParticipationId,
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
  const purchaseState = getBuncheolMemberPurchaseStateFromRecord(record);

  return {
    available: getBooleanValue(record, ["available", "isAvailable"]) ?? undefined,
    id,
    name,
    bidMinPrice,
    currentBidAmount,
    topBidAmounts,
    memberId: getOptionalStringValue(record, ["memberId"]),
    imageUrl: getOptionalDeepStringValue(record, [
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
    ...purchaseState,
  };
}

function isInactiveBuncheolPaymentStatus(status: string | undefined) {
  return [
    "CANCELLED",
    "CANCELED",
    "EXPIRED",
    "FAILED",
    "REFUNDED",
    "REJECTED",
  ].includes(status?.toUpperCase() ?? "");
}

function getBuncheolParticipantOptionIdentity(record: Record<string, unknown>) {
  const nestedMemberRecord = [
    record.buncheolMember,
    record.member,
    record.option,
    record.memberSlot,
    record.buncheolMemberSlot,
  ]
    .map(getNestedData)
    .find(isRecord);
  const memberRecord = isRecord(nestedMemberRecord) ? nestedMemberRecord : null;

  return {
    id:
      getOptionalStringValue(record, [
        "buncheolMemberId",
        "buncheolMemberSlotId",
        "memberId",
        "memberSlotId",
        "optionId",
        "slotId",
      ]) ??
      (memberRecord
        ? getOptionalStringValue(memberRecord, [
            "buncheolMemberId",
            "buncheolMemberSlotId",
            "id",
            "memberId",
            "memberSlotId",
            "optionId",
            "slotId",
          ])
        : undefined),
    name:
      getStringValue(record, [
        "memberName",
        "optionLabel",
        "name",
        "label",
        "memberLabel",
      ]) ||
      (memberRecord
        ? getStringValue(memberRecord, [
            "memberName",
            "name",
            "label",
            "optionLabel",
            "memberLabel",
          ])
        : ""),
  };
}

function mergeBuncheolMemberPurchaseStates(
  members: BuncheolMember[],
  data: Record<string, unknown>,
) {
  const participantRecords = getNestedRecordListValue(data, [
    "activeParticipations",
    "activeParticipants",
    "activePayments",
    "activePurchases",
    "orders",
    "participants",
    "participations",
    "paymentParticipants",
    "paymentRequests",
    "payments",
    "purchaseParticipants",
    "purchaseRequests",
    "purchases",
    "winners",
  ]).filter((record) => {
    const status = getOptionalStringValue(record, [
      "paymentStatus",
      "participationStatus",
      "status",
    ]);

    return !isInactiveBuncheolPaymentStatus(status);
  });

  if (participantRecords.length === 0) {
    return members;
  }

  const participantById = new Map<string, Record<string, unknown>>();
  const participantByName = new Map<string, Record<string, unknown>>();

  participantRecords.forEach((record) => {
    const identity = getBuncheolParticipantOptionIdentity(record);

    if (identity.id && !participantById.has(identity.id)) {
      participantById.set(identity.id, record);
    }

    if (identity.name && !participantByName.has(identity.name)) {
      participantByName.set(identity.name, record);
    }
  });

  return members.map((member) => {
    const participantRecord =
      participantById.get(member.id) ?? participantByName.get(member.name);

    if (!participantRecord) {
      return member;
    }

    const purchaseState =
      getBuncheolMemberPurchaseStateFromRecord(participantRecord);

    return {
      ...member,
      ...purchaseState,
      participantCount: Math.max(member.participantCount, 1),
    };
  });
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

function getMyParticipationBidsFromRecord(
  data: Record<string, unknown>,
): Map<string, { bidAmount: number; participationId: string; rank?: number }> {
  const myParticipation = getNestedData(data.myParticipation);

  if (!isRecord(myParticipation)) {
    return new Map();
  }

  return getRecordListValue(myParticipation, ["bids", "participations"]).reduce(
    (bids, record) => {
      const buncheolMemberId = getStringValue(record, [
        "buncheolMemberId",
        "memberSlotId",
        "optionId",
      ]);
      const participationId = getStringValue(record, [
        "participationId",
        "id",
      ]);
      const bidAmount = getNumberValue(record, ["bidAmount", "amount"]);

      if (buncheolMemberId && participationId && bidAmount !== null) {
        bids.set(buncheolMemberId, {
          bidAmount,
          participationId,
          rank:
            getOptionalNumberValue(record, ["rank", "closedRank"]) ??
            undefined,
        });
      }

      return bids;
    },
    new Map<string, { bidAmount: number; participationId: string; rank?: number }>(),
  );
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

  const myParticipationBids = getMyParticipationBidsFromRecord(data);
  const members = mergeBuncheolMemberPurchaseStates(
    getRecordListValue(data, [
      "buncheolMembers",
      "members",
      "memberSlots",
      "options",
    ])
      .map(getBuncheolMemberFromRecord)
      .filter((member): member is BuncheolMember => member !== null)
      .map((member) => {
        const myBid = myParticipationBids.get(member.id);

        if (!myBid) {
          return member;
        }

        return {
          ...member,
          myBidAmount: myBid.bidAmount,
          myParticipationId: myBid.participationId,
          myRank: myBid.rank,
        };
      }),
    data,
  );
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
    hostBankAccount: getNestedBankAccountInfo(data, [
      "hostBankAccount",
      "host",
      "hostProfile",
      "sellerBankAccount",
      "seller",
      "sellerProfile",
      "creatorBankAccount",
      "creator",
      "creatorProfile",
      "ownerBankAccount",
      "owner",
      "ownerProfile",
      "paymentBankAccount",
      "transferBankAccount",
      "settlementBankAccount",
      "organizer",
      "organizerProfile",
      "hostAccount",
      "sellerAccount",
    ]),
    imageUrls: getImageUrls(data),
    imageIds: getImageIds(data),
    minHeadcount: getOptionalNumberValue(data, ["minHeadcount"]),
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

function getBuncheolManagementWinnerFromRecord(
  record: Record<string, unknown>,
): BuncheolManagementWinner {
  const relatedRecords = [
    record.paymentRequest,
    record.paymentReport,
    record.pendingPayment,
    record.pendingWinner,
    record.payment,
    record.participation,
    record.participant,
    record.winner,
  ]
    .map(getNestedData)
    .filter(isRecord);
  const shippingAddressRecord = [
    record.shippingAddressSnapshot,
    record.shippingAddress,
    record.shippingAddressInfo,
    record.selectedShippingAddress,
    record.selectedAddress,
    record.addressSnapshot,
    record.address,
    record.pickupStore,
    record.store,
    record.storeInfo,
    ...relatedRecords.flatMap((relatedRecord) => [
      relatedRecord.shippingAddressSnapshot,
      relatedRecord.shippingAddress,
      relatedRecord.shippingAddressInfo,
      relatedRecord.selectedShippingAddress,
      relatedRecord.selectedAddress,
      relatedRecord.addressSnapshot,
      relatedRecord.address,
      relatedRecord.pickupStore,
      relatedRecord.store,
      relatedRecord.storeInfo,
    ]),
  ]
    .map(getNestedData)
    .find(isRecord);
  const bidAmount = getOptionalNumberValue(record, [
    "bidAmount",
    "winningBidAmount",
  ]);

  return {
    bidAmount: bidAmount ?? null,
    depositorName: getOptionalStringValue(record, [
      "depositorName",
      "payerName",
      "senderName",
      "participantNickname",
    ]),
    deliveryId: getOptionalStringValue(record, [
      "deliveryId",
      "deliverySnapshotId",
    ]),
    deliveryStatus: getOptionalStringValue(record, [
      "deliveryStatus",
      "shippingStatus",
    ]),
    paymentAmount:
      getOptionalNumberValue(record, [
        "paymentAmount",
        "totalAmount",
        "amount",
        "bidAmount",
      ]) ?? null,
    paymentConfirmedAt: getOptionalStringValue(record, [
      "paymentConfirmedAt",
      "paymentConfirmationAt",
      "paymentApprovedAt",
      "sellerConfirmedAt",
      "sellerPaymentConfirmedAt",
    ]),
    paymentDueAt: getOptionalStringValue(record, [
      "paymentDueAt",
      "paymentDeadline",
      "dueAt",
    ]),
    paymentReportedAt: getOptionalStringValue(record, [
      "paymentReportedAt",
      "paymentRequestedAt",
      "paymentReportedTime",
      "paymentRequestTime",
      "confirmedAt",
      "reportedAt",
      "requestedAt",
      "paidReportedAt",
      "paidAt",
    ]),
    paymentStatus: getOptionalStringValue(record, [
      "paymentStatus",
      "participationStatus",
      "status",
    ]),
    participationId: getOptionalStringValue(record, [
      "participationId",
      "winnerParticipationId",
      "paymentParticipationId",
    ]),
    receiverNickname: getOptionalStringValue(record, [
      "receiverNickname",
      "nickname",
      "participantNickname",
    ]),
    receiverPhoneNumber: getOptionalStringValue(record, [
      "receiverPhoneNumber",
      "phoneNumber",
      "receiverPhone",
    ]),
    shippingAddressSnapshotId: getOptionalStringValue(record, [
      "shippingAddressSnapshotId",
      "addressSnapshotId",
    ]),
    shippingMethod: getOptionalStringValue(record, [
      "shippingMethod",
      "storeType",
      "deliveryMethod",
    ]) ?? (shippingAddressRecord
      ? getOptionalStringValue(shippingAddressRecord, [
          "shippingMethod",
          "storeType",
          "deliveryMethod",
        ])
      : undefined),
    storeName: getOptionalStringValue(record, [
      "storeName",
      "branchName",
      "shippingAddressName",
    ]) ?? (shippingAddressRecord
      ? getOptionalStringValue(shippingAddressRecord, [
          "storeName",
          "branchName",
          "shippingAddressName",
          "name",
        ])
      : undefined),
    trackingNumber:
      getOptionalStringValue(record, [
        "trackingNumber",
        "invoiceNumber",
        "waybillNumber",
      ]) ??
      null,
  };
}

function getBuncheolManagementDeliveryFromRecord(
  record: Record<string, unknown>,
): BuncheolManagementDelivery | null {
  const relatedRecords = [
    record.paymentRequest,
    record.paymentReport,
    record.pendingPayment,
    record.pendingWinner,
    record.payment,
    record.participation,
    record.participant,
    record.winner,
  ]
    .map(getNestedData)
    .filter(isRecord);
  const deliveryRecord = [
    record.delivery,
    record.deliverySnapshot,
    record.deliveryInfo,
    record.deliveryRequest,
    record.shipment,
    record.shipmentInfo,
    record.shippingDelivery,
    record.shippingSnapshot,
    ...relatedRecords.flatMap((relatedRecord) => [
      relatedRecord.delivery,
      relatedRecord.deliverySnapshot,
      relatedRecord.deliveryInfo,
      relatedRecord.deliveryRequest,
      relatedRecord.shipment,
      relatedRecord.shipmentInfo,
      relatedRecord.shippingDelivery,
      relatedRecord.shippingSnapshot,
    ]),
  ]
    .map(getNestedData)
    .find(isRecord);
  const addressRecord = [
    record.shippingAddressSnapshot,
    record.shippingAddress,
    record.shippingAddressInfo,
    record.selectedShippingAddress,
    record.selectedAddress,
    record.recipientAddress,
    record.recipient,
    record.receiver,
    record.receiverInfo,
    record.shipping,
    record.shippingInfo,
    record.pickupStore,
    record.store,
    record.storeInfo,
    record.addressSnapshot,
    record.address,
    ...relatedRecords.flatMap((relatedRecord) => [
      relatedRecord.shippingAddressSnapshot,
      relatedRecord.shippingAddress,
      relatedRecord.shippingAddressInfo,
      relatedRecord.selectedShippingAddress,
      relatedRecord.selectedAddress,
      relatedRecord.recipientAddress,
      relatedRecord.recipient,
      relatedRecord.receiver,
      relatedRecord.receiverInfo,
      relatedRecord.shipping,
      relatedRecord.shippingInfo,
      relatedRecord.pickupStore,
      relatedRecord.store,
      relatedRecord.storeInfo,
      relatedRecord.addressSnapshot,
      relatedRecord.address,
    ]),
  ]
    .map(getNestedData)
    .find(isRecord);
  const primaryRecord = deliveryRecord ?? addressRecord ?? null;
  const deliveryId =
    getOptionalStringValue(record, [
      "deliveryId",
      "deliverySnapshotId",
      "trackingDeliveryId",
      "shipmentId",
      "shippingId",
    ]) ??
    (deliveryRecord
      ? getOptionalStringValue(deliveryRecord, [
          "deliveryId",
          "deliverySnapshotId",
          "trackingDeliveryId",
          "shipmentId",
          "shippingId",
        ])
      : undefined);
  const receiverNickname =
    (primaryRecord
      ? getOptionalStringValue(primaryRecord, [
          "receiverNickname",
          "recipientNickname",
          "receiverName",
          "recipientName",
          "buyerName",
          "participantName",
          "recipient",
          "name",
        ])
      : undefined) ??
    getOptionalStringValue(record, [
      "receiverNickname",
      "recipientNickname",
      "receiverName",
      "recipientName",
      "buyerName",
      "participantName",
      "recipient",
    ]) ??
    (primaryRecord || deliveryId
      ? getOptionalStringValue(record, ["participantNickname", "nickname"])
      : undefined);
  const receiverPhoneNumber =
    (primaryRecord
      ? getOptionalStringValue(primaryRecord, [
          "receiverPhoneNumber",
          "recipientPhoneNumber",
          "phoneNumber",
          "receiverPhone",
          "recipientPhone",
          "contact",
          "contactNumber",
          "contactPhone",
          "phone",
          "mobile",
          "mobilePhoneNumber",
          "tel",
        ])
      : undefined) ??
    getOptionalStringValue(record, [
      "receiverPhoneNumber",
      "recipientPhoneNumber",
      "phoneNumber",
      "receiverPhone",
      "recipientPhone",
      "contact",
      "contactNumber",
      "contactPhone",
      "phone",
      "mobile",
      "mobilePhoneNumber",
      "tel",
    ]);
  const shippingMethod =
    (primaryRecord
      ? getOptionalStringValue(primaryRecord, [
          "shippingMethod",
          "storeType",
          "deliveryMethod",
          "deliveryType",
          "shippingType",
          "method",
          "courier",
          "courierType",
        ])
      : undefined) ??
    getOptionalStringValue(record, [
      "shippingMethod",
      "storeType",
      "deliveryMethod",
      "deliveryType",
      "shippingType",
      "method",
      "courier",
      "courierType",
    ]);
  const status =
    (deliveryRecord
      ? getOptionalStringValue(deliveryRecord, [
          "status",
          "deliveryStatus",
          "shippingStatus",
          "trackingStatus",
        ])
      : undefined) ??
    getOptionalStringValue(record, [
      "deliveryStatus",
      "shippingStatus",
      "trackingStatus",
    ]);
  const storeName =
    (primaryRecord
      ? getOptionalStringValue(primaryRecord, [
          "storeName",
          "branchName",
          "shippingAddressName",
          "storeBranchName",
          "convenienceStoreName",
          "pickupStoreName",
          "pickupStore",
          "pickupStoreAddress",
          "storeAddress",
          "addressName",
          "address",
          "roadAddress",
          "roadNameAddress",
          "jibunAddress",
          "detailAddress",
          "fullAddress",
          "shippingAddress",
          "recipientAddress",
          "receiverAddress",
          "name",
        ])
      : undefined) ??
    getOptionalStringValue(record, [
      "storeName",
      "branchName",
      "shippingAddressName",
      "storeBranchName",
      "convenienceStoreName",
      "pickupStoreName",
      "pickupStore",
      "pickupStoreAddress",
      "storeAddress",
      "addressName",
      "address",
      "roadAddress",
      "roadNameAddress",
      "jibunAddress",
      "detailAddress",
      "fullAddress",
      "shippingAddress",
      "recipientAddress",
      "receiverAddress",
    ]);
  const trackingNumber =
    (deliveryRecord
      ? getOptionalStringValue(deliveryRecord, [
          "trackingNumber",
          "invoiceNumber",
          "waybillNumber",
        ])
      : undefined) ??
    getOptionalStringValue(record, [
      "trackingNumber",
      "invoiceNumber",
      "waybillNumber",
    ]) ??
    null;

  if (
    !deliveryId &&
    !receiverNickname &&
    !receiverPhoneNumber &&
    !shippingMethod &&
    !status &&
    !storeName &&
    !trackingNumber
  ) {
    return null;
  }

  return {
    deliveryId,
    receiverNickname,
    receiverPhoneNumber,
    shippingMethod,
    status,
    storeName,
    trackingNumber,
  };
}

function getBuncheolManagementParticipantFromRecord(
  record: Record<string, unknown>,
  fallback: {
    buncheolMemberId?: string;
    memberName?: string;
  } = {},
): BuncheolManagementParticipant | null {
  const participationId = getStringValue(record, [
    "participationId",
    "paymentParticipationId",
    "participantId",
    "id",
  ]);

  if (!participationId) {
    return null;
  }

  const refundAccount = getNestedBankAccountInfo(record, [
    "refundAccount",
    "refundBankAccount",
    "refundBankAccountInfo",
  ]);
  const participantNickname =
    getStringValue(record, [
      "participantNickname",
      "buyerNickname",
      "nickname",
      "userNickname",
      "depositorName",
    ]) || refundAccount?.holder || `참여 ${participationId}`;

  return {
    amount:
      getNumberValue(record, [
        "amount",
        "paymentAmount",
        "totalAmount",
        "bidAmount",
        "price",
      ]) ?? 0,
    buncheolMemberId:
      getOptionalStringValue(record, [
        "buncheolMemberId",
        "memberSlotId",
        "optionId",
      ]) ?? fallback.buncheolMemberId,
    confirmedAt:
      getOptionalStringValue(record, [
        "confirmedAt",
        "paymentConfirmedAt",
        "paymentConfirmationAt",
      ]) ?? null,
    delivery: getBuncheolManagementDeliveryFromRecord(record),
    dueAt:
      getOptionalStringValue(record, ["dueAt", "paymentDueAt", "paymentDeadline"]) ??
      null,
    memberName:
      getStringValue(record, ["memberName", "name", "label"]) ||
      fallback.memberName ||
      "옵션",
    participantNickname,
    participationId,
    refundAccount,
    status:
      getOptionalStringValue(record, [
        "status",
        "paymentStatus",
        "participationStatus",
      ]) ?? "",
  };
}
function getBuncheolManagementOptionFromRecord(
  record: Record<string, unknown>,
): BuncheolManagementOption | null {
  const memberRecord = getNestedData(record.member);
  const member = isRecord(memberRecord) ? memberRecord : null;
  const buncheolMemberId = getStringValue(record, [
    "buncheolMemberId",
    "buncheolMemberSlotId",
    "memberSlotId",
    "optionId",
    "id",
    "slotId",
  ]);
  const memberName =
    getStringValue(record, ["memberName", "name", "label", "optionLabel"]) ||
    (member
      ? getStringValue(member, ["memberName", "name", "label", "optionLabel"])
      : "");
  const memberId =
    getOptionalStringValue(record, ["memberId"]) ??
    (member
      ? getOptionalStringValue(member, [
          "memberId",
          "id",
          "profileId",
          "artistMemberId",
        ])
      : undefined);

  if (!buncheolMemberId) {
    return null;
  }

  const winnerRecord = [
    record.winner,
    record.paymentRequest,
    record.paymentReport,
    record.pendingPayment,
    record.pendingWinner,
    record.payment,
    getOptionalStringValue(record, [
      "participationId",
      "winnerParticipationId",
      "paymentParticipationId",
    ])
      ? record
      : null,
  ]
    .map(getNestedData)
    .find(isRecord);
  const winner = isRecord(winnerRecord)
    ? getBuncheolManagementWinnerFromRecord(winnerRecord)
    : null;
  const fallbackWinnerFields = getBuncheolManagementWinnerFromRecord(record);
  const optionMemberName = memberName || `Option ${memberId ?? buncheolMemberId}`;
  const participants = getNestedRecordListValue(record, [
    "participants",
    "participations",
    "paymentParticipants",
    "paymentRequests",
    "payments",
  ])
    .map((participantRecord) =>
      getBuncheolManagementParticipantFromRecord(participantRecord, {
        buncheolMemberId,
        memberName: optionMemberName,
      }),
    )
    .filter(
      (participant): participant is BuncheolManagementParticipant =>
        participant !== null,
    );

  return {
    buncheolMemberId,
    currentHighestBid: getOptionalNumberValue(record, [
      "currentHighestBid",
      "currentHighestBidAmount",
      "highestBidAmount",
      "currentBidAmount",
      "baseAmount",
      "basePrice",
      "fixedPrice",
      "price",
    ]) ?? null,
    memberId,
    memberImage:
      getOptionalStringValue(record, [
        "memberImage",
        "memberImageUrl",
        "imageUrl",
      ]) ??
      (member
        ? getOptionalStringValue(member, [
            "memberImage",
            "memberImageUrl",
            "image",
            "imageUrl",
            "profileImageUrl",
          ])
        : undefined),
    memberName: optionMemberName,
    participants,
    participationCount:
      getNumberValue(record, ["participationCount", "participantCount"]) ?? 0,
    winner: winner
      ? {
          ...winner,
          bidAmount: winner.bidAmount ?? fallbackWinnerFields.bidAmount,
          depositorName:
            winner.depositorName ?? fallbackWinnerFields.depositorName,
          deliveryId: winner.deliveryId ?? fallbackWinnerFields.deliveryId,
          deliveryStatus:
            winner.deliveryStatus ?? fallbackWinnerFields.deliveryStatus,
          participationId:
            winner.participationId ?? fallbackWinnerFields.participationId,
          paymentAmount:
            winner.paymentAmount ?? fallbackWinnerFields.paymentAmount,
          paymentConfirmedAt:
            winner.paymentConfirmedAt ??
            fallbackWinnerFields.paymentConfirmedAt,
          paymentDueAt: winner.paymentDueAt ?? fallbackWinnerFields.paymentDueAt,
          paymentReportedAt:
            winner.paymentReportedAt ?? fallbackWinnerFields.paymentReportedAt,
          paymentStatus: winner.paymentStatus ?? fallbackWinnerFields.paymentStatus,
          receiverNickname:
            winner.receiverNickname ?? fallbackWinnerFields.receiverNickname,
          receiverPhoneNumber:
            winner.receiverPhoneNumber ??
            fallbackWinnerFields.receiverPhoneNumber,
          shippingAddressSnapshotId:
            winner.shippingAddressSnapshotId ??
            fallbackWinnerFields.shippingAddressSnapshotId,
          shippingMethod:
            winner.shippingMethod ?? fallbackWinnerFields.shippingMethod,
          storeName: winner.storeName ?? fallbackWinnerFields.storeName,
          trackingNumber:
            winner.trackingNumber ?? fallbackWinnerFields.trackingNumber,
        }
      : null,
  };
}

function getBuncheolManagementDetailFromBody(body: unknown) {
  const responseData = getNestedData(body);

  if (!isRecord(responseData)) {
    return null;
  }

  const nestedDetail = [
    responseData,
    responseData.buncheol,
    responseData.buncheolInfo,
    responseData.detail,
    responseData.management,
    responseData.buncheolManagement,
  ]
    .map(getNestedData)
    .find((candidate): candidate is Record<string, unknown> => {
      return (
        isRecord(candidate) &&
        Boolean(getStringValue(candidate, ["id", "buncheolId"])) &&
        Boolean(getStringValue(candidate, ["title", "buncheolTitle"]))
      );
    });
  const data = nestedDetail ?? responseData;
  const id = getStringValue(data, ["id", "buncheolId"]);
  const title = getStringValue(data, ["title", "buncheolTitle"]);

  if (!id || !title) {
    return null;
  }

  const sourceRecords =
    data === responseData ? [data] : [data, responseData];
  const directParticipants = sourceRecords
    .flatMap((sourceRecord) =>
      getNestedRecordListValue(sourceRecord, [
        "participants",
        "participations",
        "paymentParticipants",
        "paymentRequests",
        "payments",
        "records",
      ]),
    )
    .map((participantRecord) =>
      getBuncheolManagementParticipantFromRecord(participantRecord),
    )
    .filter(
      (participant): participant is BuncheolManagementParticipant =>
        participant !== null,
    );
  const options = sourceRecords
    .flatMap((sourceRecord) =>
      getNestedRecordListValue(sourceRecord, [
        "options",
        "members",
        "buncheolMembers",
        "memberSlots",
        "buncheolMemberSlots",
        "slots",
      ]),
    )
    .map(getBuncheolManagementOptionFromRecord)
    .filter(
      (option): option is BuncheolManagementOption => option !== null,
    );
  const participantsById = new Map<string, BuncheolManagementParticipant>();

  [...directParticipants, ...options.flatMap((option) => option.participants ?? [])]
    .forEach((participant) => {
      participantsById.set(participant.participationId, participant);
    });

  const participants = [...participantsById.values()];
  const memberCount = getNumberValue(data, ["memberCount", "memberSlotCount"]);

  return {
    confirmedCount: getNumberValue(data, ["confirmedCount"]) ?? undefined,
    deadline:
      getStringValue(data, ["deadline", "buncheolDeadline"]) ||
      getStringValue(responseData, ["deadline", "buncheolDeadline"]),
    groupName:
      getStringValue(data, ["groupName", "group"]) ||
      getStringValue(responseData, ["groupName", "group"]),
    id,
    memberCount: memberCount ?? undefined,
    minHeadcount: getNumberValue(data, ["minHeadcount"]) ?? undefined,
    optionCount:
      getNumberValue(data, ["optionCount", "memberSlotCount", "memberCount"]) ??
      options.length,
    options,
    participants,
    purchaseSite: getOptionalStringValue(data, [
      "purchaseSite",
      "purchaseSource",
      "source",
    ]),
    status:
      getOptionalStringValue(data, ["status", "buncheolStatus"]) ??
      "RECRUITING",
    title,
    totalParticipationCount:
      getNumberValue(data, [
        "totalParticipationCount",
        "participationCount",
        "participantCount",
      ]) ??
      (participants.length > 0
        ? participants.length
        : options.reduce((sum, option) => sum + option.participationCount, 0)),
  } satisfies BuncheolManagementDetail;
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
    CONFIRMED: "진행확정",
    CLOSED: "모집종료",
    FINISHED: "진행확정",
    PAID: "진행확정",
    RECRUITING: "모집중",
    SETTLING: "진행확정",
  };

  return statusLabels[status] ?? status;
}

function isDeletedBuncheolStatus(status: string | undefined) {
  return status === "DELETED";
}

function isRemovedBuncheolStatus(status: string | undefined) {
  return status === "DELETED";
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
    availableMemberNames: summary.availableMemberNames,
    minHeadcount: summary.minHeadcount,
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
    const priceAmount =
      member.bidMinPrice || member.currentBidAmount || member.myBidAmount || 0;
    const formattedPrice = formatWonAmount(priceAmount);

    return {
      id: member.id,
      buncheolMemberId: member.id,
      currentBid: formattedPrice,
      available: member.available,
      imageUrl: member.imageUrl,
      label: member.name,
      myBidAmount: member.myBidAmount,
      myParticipationId: member.myParticipationId,
      myRank: member.myRank,
      participantCount: member.participantCount,
      price: formattedPrice,
      purchasePaymentConfirmedAt: member.purchasePaymentConfirmedAt,
      purchasePaymentDueAt: member.purchasePaymentDueAt,
      purchasePaymentStatus: member.purchasePaymentStatus,
      purchaseParticipationId: member.purchaseParticipationId,
      startingBid: formattedPrice,
      topBids: ["-", "-", "-"] as [string, string, string],
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
      detail.description?.trim() ||
      "판매자가 상품 설명을 작성하지 않았습니다.",
    imageUrl: detail.imageUrls[0],
    imageUrls: detail.imageUrls,
    imageIds: detail.imageIds,
    isApiProduct: true,
    isHostedByMe: detail.isHostedByMe,
    member: getMemberLabel(memberNames),
    minHeadcount: detail.minHeadcount,
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
    .filter(
      (item): item is BuncheolSummary =>
        item !== null && !isDeletedBuncheolStatus(item.status),
    );

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
      .filter(
        (item): item is BuncheolSummary =>
          item !== null && !isDeletedBuncheolStatus(item.status),
      );

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

export async function requestBuncheolManagement(
  accessToken: string,
  buncheolId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/buncheols/${buncheolId}/management`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const detail = getBuncheolManagementDetailFromBody(
    await readJsonBody(response),
  );

  if (!detail) {
    throw new Error("개최 분철 관리 정보를 확인할 수 없어요.");
  }

  return detail;
}

export async function requestCloseBuncheol(
  accessToken: string,
  buncheolId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/buncheols/${buncheolId}/close`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

async function requestMyParticipationRanks(
  accessToken: string,
  buncheolId: string,
) {
  const response = await fetch(`${getVersionedApiBaseUrl()}/buncheols/${buncheolId}`, {
    credentials: "include",
    headers: getAuthHeaders(accessToken),
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = getNestedData(await readJsonBody(response));

  if (!isRecord(data)) {
    return new Map<string, number>();
  }

  const myParticipation = getNestedData(data.myParticipation);

  if (!isRecord(myParticipation)) {
    return new Map<string, number>();
  }

  return getRecordListValue(myParticipation, ["bids", "participations"]).reduce(
    (rankMap, record) => {
      const participationId = getStringValue(record, [
        "participationId",
        "id",
      ]);
      const rank = getOptionalNumberValue(record, ["rank", "closedRank"]);

      if (participationId && rank !== null && rank !== undefined) {
        rankMap.set(participationId, rank);
      }

      return rankMap;
    },
    new Map<string, number>(),
  );
}

const buncheolHostPermissionErrorCode = "USR-031";

export class BuncheolHostPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuncheolHostPermissionError";
  }
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
    let errorBody: Record<string, unknown> | null = null;

    try {
      const parsedBody: unknown = await response.json();

      errorBody = isRecord(parsedBody) ? parsedBody : null;
    } catch {
      errorBody = null;
    }

    const errorMessage =
      [errorBody?.message, errorBody?.detail, errorBody?.title].find(
        (value): value is string => typeof value === "string",
      ) ?? response.statusText;

    if (errorBody?.code === buncheolHostPermissionErrorCode) {
      throw new BuncheolHostPermissionError(errorMessage);
    }

    throw new Error(errorMessage);
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

  const response = await fetch(
    `${getVersionedApiBaseUrl()}/buncheols/${buncheolId}`,
    {
      body: formData,
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "PUT",
    },
  );

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
  const buncheolMemberIds =
    body.buncheolMemberIds && body.buncheolMemberIds.length > 0
      ? body.buncheolMemberIds
      : typeof body.buncheolMemberId === "number"
        ? [body.buncheolMemberId]
        : [];

  if (buncheolMemberIds.length === 0) {
    throw new Error("구매할 옵션을 확인하지 못했어요.");
  }

  const requestBody = {
    buncheolMemberIds,
    refundAccount: body.refundAccount,
    shippingAddressId: body.shippingAddressId,
  };
  const requestInit: RequestInit = {
    body: JSON.stringify(requestBody),
    credentials: "include",
    headers: getJsonHeaders(accessToken),
    method: "POST",
  };
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/buncheols/${buncheolId}/participations`,
    requestInit,
    "구매 요청 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
  );

  if (!response.ok) {
    throw new ApiRequestError(await parseErrorMessage(response), response.status);
  }

  const data = getNestedData(await readJsonBody(response));

  if (!isRecord(data)) {
    throw new Error("참여 결과를 확인할 수 없어요.");
  }

  const participationIds = getStringListValue(data, [
    "participationIds",
    "ids",
  ]);
  const participationId =
    getStringValue(data, ["participationId", "id"]) ||
    participationIds[0] ||
    "";

  return {
    bidAmount:
      getNumberValue(data, [
        "bidAmount",
        "productAmount",
        "itemAmount",
        "price",
      ]) ?? 0,
    hostBankAccount: getNestedBankAccountInfo(data, [
      "hostAccount",
      "hostBankAccount",
      "host",
      "hostProfile",
      "sellerBankAccount",
      "seller",
      "sellerProfile",
      "creatorBankAccount",
      "creator",
      "creatorProfile",
      "ownerBankAccount",
      "owner",
      "ownerProfile",
      "paymentBankAccount",
      "transferBankAccount",
      "settlementBankAccount",
      "organizer",
      "organizerProfile",
      "sellerAccount",
      "bankAccount",
    ]),
    paymentAmount:
      getOptionalNumberValue(data, ["totalAmount", "paymentAmount", "amount"]) ??
      null,
    paymentDueAt:
      getOptionalStringValue(data, [
        "paymentDueAt",
        "paymentDeadline",
        "dueAt",
      ]) ?? null,
    participationId,
    participationIds,
    participationStatus:
      getOptionalStringValue(data, ["participationStatus", "status"]) ??
      "AWAITING_PAYMENT",
    shippingFee: getOptionalNumberValue(data, ["shippingFee"]) ?? null,
  } satisfies ParticipationCheckoutResponse;
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

  const participations = getBuncheolList(await readJsonBody(response))
    .filter(isRecord)
    .map((record): MyParticipation | null => {
      const buncheolRecord = getNestedData(record.buncheol);
      const buncheol = isRecord(buncheolRecord) ? buncheolRecord : null;
      const buncheolMemberRecord = getNestedData(record.buncheolMember);
      const buncheolMember = isRecord(buncheolMemberRecord)
        ? buncheolMemberRecord
        : null;
      const shippingAddressRecord = getParticipationShippingAddressRecord(record);
      const shippingAddress = shippingAddressRecord
        ? getUserShippingAddress(shippingAddressRecord)
        : null;
      const delivery = getParticipationDeliveryRecord(record);
      const lookupRecords = [record, delivery];
      const participationId = getStringValue(record, [
        "participationId",
        "id",
      ]);
      const buncheolId =
        getStringValue(record, ["buncheolId"]) ||
        (buncheol ? getStringValue(buncheol, ["buncheolId", "id"]) : "");

      if (!participationId || !buncheolId) {
        return null;
      }

      return {
        bidAmount:
          getNumberValue(record, ["bidAmount", "amount", "paymentAmount"]) ??
          0,
        buncheolDeadline:
          getStringValue(record, [
            "buncheolDeadline",
            "deadline",
          ]) || (buncheol ? getStringValue(buncheol, ["deadline"]) : ""),
        buncheolId,
        buncheolMemberId:
          getOptionalStringValue(record, [
            "buncheolMemberId",
            "memberSlotId",
            "optionId",
          ]) ??
          (buncheolMember
            ? getOptionalStringValue(buncheolMember, [
                "buncheolMemberId",
                "id",
                "memberSlotId",
                "optionId",
              ])
            : null) ??
          null,
        buncheolMemberCount:
          getNumberValue(record, [
            "buncheolMemberCount",
            "memberSlotCount",
            "memberCount",
          ]) ??
          (buncheol
            ? getNumberValue(buncheol, [
                "buncheolMemberCount",
                "memberSlotCount",
                "memberCount",
              ])
            : null) ??
          0,
        buncheolStatus:
          getOptionalStringValue(record, ["buncheolStatus"]) ??
          (buncheol ? getOptionalStringValue(buncheol, ["status"]) : null) ??
          "RECRUITING",
        buncheolTitle:
          getStringValue(record, [
            "buncheolTitle",
            "title",
          ]) || (buncheol ? getStringValue(buncheol, ["title"]) : ""),
        closedRank: getOptionalNumberValue(record, ["closedRank", "rank"]) ?? null,
        deliveryId:
          getOptionalStringValueFromRecords(
            lookupRecords,
            participationDeliveryIdKeys,
          ) ?? null,
        deliveryStatus:
          (delivery
            ? getOptionalStringValue(
                delivery,
                participationNestedDeliveryStatusKeys,
              )
            : undefined) ??
          getOptionalStringValue(record, participationDeliveryStatusKeys) ??
          null,
        thumbnailUrl:
          getOptionalStringValue(record, [
            "thumbnailUrl",
            "buncheolThumbnailUrl",
            "imageUrl",
            "buncheolImageUrl",
            "representativeImageUrl",
          ]) ??
          getImageUrls(record)[0] ??
          (buncheol ? getImageUrls(buncheol)[0] : undefined),
        memberName:
          getStringValue(record, ["memberName", "optionLabel"]) ||
          (buncheolMember
            ? getStringValue(buncheolMember, ["memberName", "name", "label"])
            : ""),
        participationId,
        participationStatus:
          getOptionalStringValue(record, [
            "participationStatus",
            "status",
          ]) ?? "AWAITING_PAYMENT",
        paymentAmount:
          getOptionalNumberValue(record, ["paymentAmount", "totalAmount"]) ??
          null,
        paymentDueAt:
          getOptionalStringValue(record, [
            "paymentDueAt",
            "paymentDeadline",
            "dueAt",
          ]) ??
          null,
        createdAt:
          getOptionalStringValue(record, [
            "createdAt",
            "participationCreatedAt",
            "participatedAt",
            "requestedAt",
          ]) ?? null,
        hostBankAccount:
          getNestedBankAccountInfo(record, [
            "hostBankAccount",
            "host",
            "hostProfile",
            "sellerBankAccount",
            "seller",
            "sellerProfile",
            "creatorBankAccount",
            "creator",
            "creatorProfile",
            "ownerBankAccount",
            "owner",
            "ownerProfile",
            "paymentBankAccount",
            "transferBankAccount",
            "settlementBankAccount",
            "organizer",
            "organizerProfile",
            "hostAccount",
            "sellerAccount",
            "bankAccount",
          ]) ??
          (buncheol
            ? getNestedBankAccountInfo(buncheol, [
                "hostBankAccount",
                "host",
                "hostProfile",
                "sellerBankAccount",
                "seller",
                "sellerProfile",
                "creatorBankAccount",
                "creator",
                "creatorProfile",
                "ownerBankAccount",
                "owner",
                "ownerProfile",
                "paymentBankAccount",
                "transferBankAccount",
                "settlementBankAccount",
                "organizer",
                "organizerProfile",
                "hostAccount",
                "sellerAccount",
                "bankAccount",
              ])
            : null),
        shippingAddress,
        shippingFee:
          getOptionalNumberValueFromRecords(lookupRecords, [
            "shippingFee",
            "deliveryFee",
          ]) ?? null,
        trackingNumber:
          getOptionalStringValueFromRecords(
            lookupRecords,
            participationTrackingNumberKeys,
          ) ?? null,
      };
    })
    .filter(
      (participation): participation is MyParticipation =>
        participation !== null,
    );

  const missingRankBuncheolIds = [
    ...new Set(
      participations
        .filter((participation) => participation.closedRank === null)
        .map((participation) => participation.buncheolId),
    ),
  ];

  if (missingRankBuncheolIds.length === 0) {
    return participations;
  }

  const rankMaps = await Promise.all(
    missingRankBuncheolIds.map(async (buncheolId) => {
      try {
        return await requestMyParticipationRanks(accessToken, buncheolId);
      } catch {
        return new Map<string, number>();
      }
    }),
  );
  const rankByParticipationId = new Map<string, number>();

  rankMaps.forEach((rankMap) => {
    rankMap.forEach((rank, participationId) => {
      rankByParticipationId.set(participationId, rank);
    });
  });

  return participations.map((participation) => ({
    ...participation,
    closedRank:
      participation.closedRank ??
      rankByParticipationId.get(participation.participationId) ??
      null,
  }));
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
    buncheols.filter((buncheol) => !isRemovedBuncheolStatus(buncheol.status)),
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

export async function requestParticipationPaymentDetail(
  accessToken: string,
  participationId: string,
) {
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/participations/${participationId}`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    },
    "입금 정보를 불러오는 데 시간이 오래 걸리고 있어요.",
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const detail = getParticipationPaymentDetailFromBody(
    await readJsonBody(response),
    participationId,
  );

  if (!detail) {
    throw new Error("결제 상세 정보를 확인할 수 없어요.");
  }

  return detail;
}

export async function requestPaymentConfirmation(
  accessToken: string,
  participationId: string,
  options: { ignoreConflict?: boolean } = {},
) {
  async function sendConfirmationRequest(path: string) {
    return fetch(`${getVersionedApiBaseUrl()}${path}`, {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "POST",
    });
  }

  let response = await sendConfirmationRequest(
    `/participations/${participationId}/confirm`,
  );

  if (!response.ok && [404, 405].includes(response.status)) {
    response = await sendConfirmationRequest(
      `/participations/${participationId}/payment/confirm`,
    );
  }

  if (!response.ok) {
    if (options.ignoreConflict && response.status === 409) {
      return;
    }

    throw new Error(await parseErrorMessage(response));
  }
}
export async function requestPaymentExpiration(
  accessToken: string,
  participationId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/participations/${participationId}/payment/expire`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function requestDeliveryTrackingRegistration(
  accessToken: string,
  deliveryId: string,
  trackingNumber: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/deliveries/${deliveryId}/tracking`,
    {
      body: JSON.stringify({ trackingNumber }),
      credentials: "include",
      headers: getJsonHeaders(accessToken),
      method: "PATCH",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function requestCreateNotice(
  accessToken: string,
  request: CreateNoticeRequest,
  files: CreateNoticeFiles = {},
): Promise<CreateNoticeResponse> {
  const formData = new FormData();
  appendJsonFormPart(formData, request);
  appendNamedFileFormPart(
    formData,
    "image",
    files.image,
    "notice-image.jpg",
  );
  appendNamedFileFormPart(
    formData,
    "bannerImage",
    files.bannerImage,
    "notice-banner.jpg",
  );

  const response = await fetch(`${getVersionedApiBaseUrl()}/notices`, {
    body: formData,
    credentials: "include",
    headers: getAuthHeaders(accessToken),
    method: "POST",
  });

  if (!response.ok) {
    throw new ApiRequestError(await parseErrorMessage(response), response.status);
  }

  const location = response.headers.get("location");
  const noticeId = location?.match(/\/inbox\/([^/?#]+)/)?.[1] ?? null;

  return {
    location,
    noticeId,
  };
}

export async function requestBanners(): Promise<ApiBanner[]> {
  const response = await fetch(`${getVersionedApiBaseUrl()}/banners`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return getBannerList(await readJsonBody(response))
    .filter(isRecord)
    .map((record) => ({
      bannerImageUrl: getStringValue(record, ["bannerImageUrl", "imageUrl"]),
      bannerTitle: getStringValue(record, ["bannerTitle", "title"]),
      noticeId: getStringValue(record, ["noticeId", "id"]),
    }))
    .filter(
      (banner) =>
        Boolean(banner.noticeId) && Boolean(banner.bannerImageUrl),
    );
}

function getInboxMessageSummaryFromRecord(
  record: Record<string, unknown>,
): InboxMessageSummary | null {
  const id = getStringValue(record, [
    "id",
    "messageId",
    "noticeId",
    "notificationId",
  ]);
  const title = getStringValue(record, ["title", "subject", "name"]);

  if (!id || !title) {
    return null;
  }

  return {
    createdAt:
      getOptionalStringValue(record, ["createdAt", "sentAt", "publishedAt"]) ??
      "",
    id,
    pinned:
      getBooleanValue(record, ["pinned", "isPinned", "fixed", "isFixed"]) ??
      false,
    title,
    type:
      getOptionalStringValue(record, ["type", "messageType", "category"]) ??
      "NOTICE",
  };
}

function getInboxMessageDetailFromRecord(
  record: Record<string, unknown>,
): InboxMessageDetail | null {
  const summary = getInboxMessageSummaryFromRecord(record);

  if (!summary) {
    return null;
  }

  return {
    ...summary,
    description:
      getOptionalStringValue(record, [
        "description",
        "content",
        "body",
        "message",
      ]) ?? "",
    linkPath:
      getOptionalStringValue(record, [
        "linkPath",
        "link",
        "targetPath",
        "redirectPath",
      ]) ?? undefined,
    reference:
      getOptionalStringValue(record, [
        "reference",
        "subtitle",
        "summary",
        "descriptionSummary",
      ]) ?? undefined,
  };
}

function getInboxMessagesFromBody(body: unknown): InboxMessagesResponse | null {
  const data = getNestedData(body);

  if (!isRecord(data)) {
    return null;
  }

  const feedData = getNestedData(data.feed);
  const feed = isRecord(feedData) ? feedData : data;
  const pinned = getRecordListValue(data, [
    "pinned",
    "pinnedItems",
    "pinnedNotices",
  ])
    .map(getInboxMessageSummaryFromRecord)
    .filter((item): item is InboxMessageSummary => item !== null);
  const items = getRecordListValue(feed, ["items", "messages", "content"])
    .map(getInboxMessageSummaryFromRecord)
    .filter((item): item is InboxMessageSummary => item !== null);
  const nextCursor =
    getOptionalStringValue(feed, ["nextCursor", "cursor"]) ?? null;

  return {
    feed: {
      hasNext: getBooleanValue(feed, ["hasNext"]) ?? Boolean(nextCursor),
      items,
      nextCursor,
    },
    pinned,
  };
}

function getInboxRequestQuery(params: InboxMessagesParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.type) {
    searchParams.set("type", params.type);
  }

  if (params.cursor) {
    searchParams.set("cursor", params.cursor);
  }

  if (params.size) {
    searchParams.set("size", String(params.size));
  }

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

export async function requestInboxMessages(
  accessToken?: string,
  params: InboxMessagesParams = {},
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/inbox${getInboxRequestQuery(params)}`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const messages = getInboxMessagesFromBody(await readJsonBody(response));

  if (!messages) {
    throw new Error("공지와 알림 정보를 확인할 수 없어요.");
  }

  return messages;
}

export async function requestInboxMessageDetail(
  accessToken: string | undefined,
  messageId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/inbox/${encodeURIComponent(messageId)}`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = getNestedData(await readJsonBody(response));

  if (!isRecord(data)) {
    throw new Error("공지와 알림 상세를 확인할 수 없어요.");
  }

  const message = getInboxMessageDetailFromRecord(data);

  if (!message) {
    throw new Error("공지와 알림 상세를 확인할 수 없어요.");
  }

  return message;
}

function getApiGroupFromRecord(record: Record<string, unknown>): ApiGroup | null {
  const nestedGroup = getNestedData(record.group);
  const groupRecord = isRecord(nestedGroup) ? nestedGroup : record;
  const id = getStringValue(groupRecord, ["id", "groupId"]);
  const name = getStringValue(groupRecord, ["name", "groupName"]);
  const imageUrl = getProxiedGroupImageUrl(
    getOptionalStringValue(groupRecord, [
      "image",
      "imageUrl",
      "thumbnailUrl",
      "profileImageUrl",
    ]),
  );

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
    imageUrl,
  } satisfies ApiGroup;
}

function getApiGroupMemberFromRecord(
  record: Record<string, unknown>,
): ApiGroupMember | null {
  const nestedMember = getNestedData(record.member);
  const memberRecord = isRecord(nestedMember) ? nestedMember : record;
  const id = getStringValue(memberRecord, ["id", "memberId"]);
  const name = getStringValue(memberRecord, ["name", "memberName"]);
  const imageUrl = getProxiedGroupImageUrl(
    getOptionalStringValue(memberRecord, [
      "image",
      "imageUrl",
      "thumbnailUrl",
      "profileImageUrl",
    ]),
  );

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    imageUrl,
  };
}

function getApiGroupWithMembersFromRecord(
  record: Record<string, unknown>,
): ApiGroupWithMembers | null {
  const group = getApiGroupFromRecord(record);

  if (!group) {
    return null;
  }

  const members = getRecordListValue(record, [
    "members",
    "groupMembers",
    "idolMembers",
  ])
    .map(getApiGroupMemberFromRecord)
    .filter((member): member is ApiGroupMember => member !== null);

  return {
    ...group,
    members,
  };
}

function getRecentSearchKeywordFromRecord(
  record: Record<string, unknown>,
): RecentSearchKeyword | null {
  const keyword = getStringValue(record, ["keyword", "text", "query"]).trim();

  if (!keyword) {
    return null;
  }

  return {
    id: getStringValue(record, ["id", "searchKeywordId"]) || keyword,
    keyword,
  };
}

export async function requestGroups(keyword = ""): Promise<ApiGroup[]> {
  const searchParams = keyword
    ? `?${new URLSearchParams({ keyword }).toString()}`
    : "";
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/groups${searchParams}`,
    {
      credentials: "omit",
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

export async function requestPopularGroups(): Promise<ApiGroup[]> {
  const response = await fetch(`${getVersionedApiBaseUrl()}/groups/popular`, {
    credentials: "omit",
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const groups = getBuncheolList(await readJsonBody(response))
    .filter(isRecord)
    .map(getApiGroupFromRecord)
    .filter((group): group is ApiGroup => group !== null);

  return groups.length > 0 ? groups : requestGroups("");
}

export async function requestGroupsByMemberKeyword(
  keyword: string,
): Promise<ApiGroupWithMembers[]> {
  const searchParams = new URLSearchParams({ keyword }).toString();
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/groups/members?${searchParams}`,
    {
      credentials: "omit",
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return getBuncheolList(await readJsonBody(response))
    .filter(isRecord)
    .map(getApiGroupWithMembersFromRecord)
    .filter((group): group is ApiGroupWithMembers => group !== null);
}

export async function requestRecentSearchKeywords(
  accessToken?: string,
): Promise<RecentSearchKeyword[]> {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/search-keywords/recent`,
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
    .map(getRecentSearchKeywordFromRecord)
    .filter(
      (searchKeyword): searchKeyword is RecentSearchKeyword =>
        searchKeyword !== null,
    );
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
      credentials: "omit",
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return getBuncheolList(await readJsonBody(response))
    .filter(isRecord)
    .map(getApiGroupMemberFromRecord)
    .filter((member): member is ApiGroupMember => member !== null);
}

// ---------------------------------------------------------------------------
// 관리자(운영자) API — /v1/admin/**
// 관리자 토큰(로그인 응답의 accessToken)을 쓰며 유저 토큰과 호환되지 않는다.
// 401(만료/무효)·403(권한 없음)은 ApiRequestError.status 로 구분해 재로그인을 유도한다.
// ---------------------------------------------------------------------------

export type AdminMe = {
  loginId: string;
};

export type AdminPaymentSummary = {
  awaitingCount: number;
  confirmedCount: number;
  refundRequiredCount: number;
  cancelledCount: number;
  totalCount: number;
  awaitingAmount: number;
};

export type AdminPaymentRecordItem = {
  participationId: string;
  participantNickname: string | null;
  memberName: string | null;
  amount: number;
  paymentStatus: string;
  status: string;
  cancelReason: string | null;
  dueAt: string | null;
  confirmedAt: string | null;
  refundAccount: BankAccountInfo | null;
  delivery: BuncheolManagementDelivery | null;
  buncheolId: string;
  buncheolTitle: string;
  buncheolStatus: string;
  groupName: string;
  minHeadcount: number;
  confirmedCount: number;
};

export type AdminPaymentsPage = {
  items: AdminPaymentRecordItem[];
  nextCursor: string | null;
  hasNext: boolean;
};

export type AdminBulkFailure = {
  id: string;
  code: string;
  message: string;
};

export type AdminBulkResult = {
  succeededIds: string[];
  failures: AdminBulkFailure[];
};

async function parseAdminResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new ApiRequestError(await parseErrorMessage(response), response.status);
  }

  return (await response.json()) as T;
}

function getOptionalIdString(value: unknown) {
  return typeof value === "number" || typeof value === "string"
    ? String(value)
    : undefined;
}

function getAdminDeliveryFromRecord(
  value: unknown,
): BuncheolManagementDelivery | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    deliveryId: getOptionalIdString(value.deliveryId),
    receiverNickname:
      typeof value.receiverNickname === "string"
        ? value.receiverNickname
        : undefined,
    receiverPhoneNumber:
      typeof value.receiverPhoneNumber === "string"
        ? value.receiverPhoneNumber
        : undefined,
    shippingMethod:
      typeof value.shippingMethod === "string" ? value.shippingMethod : undefined,
    status: typeof value.status === "string" ? value.status : undefined,
    storeName: typeof value.storeName === "string" ? value.storeName : undefined,
    trackingNumber:
      typeof value.trackingNumber === "string" ? value.trackingNumber : null,
  };
}

function getAdminRefundAccountFromRecord(
  value: unknown,
): BankAccountInfo | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    account: typeof value.account === "string" ? value.account : "",
    bank: typeof value.bank === "string" ? value.bank : "",
    holder: typeof value.holder === "string" ? value.holder : "",
  };
}

function getAdminPaymentRecordItem(value: unknown): AdminPaymentRecordItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const participationId = getOptionalIdString(value.participationId);
  const buncheolId = getOptionalIdString(value.buncheolId);

  if (!participationId || !buncheolId) {
    return null;
  }

  return {
    amount: typeof value.amount === "number" ? value.amount : 0,
    buncheolId,
    buncheolStatus:
      typeof value.buncheolStatus === "string" ? value.buncheolStatus : "",
    buncheolTitle:
      typeof value.buncheolTitle === "string" ? value.buncheolTitle : "",
    cancelReason:
      typeof value.cancelReason === "string" ? value.cancelReason : null,
    confirmedAt:
      typeof value.confirmedAt === "string" ? value.confirmedAt : null,
    confirmedCount:
      typeof value.confirmedCount === "number" ? value.confirmedCount : 0,
    delivery: getAdminDeliveryFromRecord(value.delivery),
    dueAt: typeof value.dueAt === "string" ? value.dueAt : null,
    groupName: typeof value.groupName === "string" ? value.groupName : "",
    memberName: typeof value.memberName === "string" ? value.memberName : null,
    minHeadcount:
      typeof value.minHeadcount === "number" ? value.minHeadcount : 0,
    participantNickname:
      typeof value.participantNickname === "string"
        ? value.participantNickname
        : null,
    participationId,
    paymentStatus:
      typeof value.paymentStatus === "string" ? value.paymentStatus : "",
    refundAccount: getAdminRefundAccountFromRecord(value.refundAccount),
    status: typeof value.status === "string" ? value.status : "",
  };
}

export async function requestAdminLogin(loginId: string, password: string) {
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/admin/auth/login`,
    {
      body: JSON.stringify({ loginId, password }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
    "로그인 요청이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
  );
  const data = await parseAdminResponse<{ accessToken?: string }>(response);

  if (!data.accessToken) {
    throw new Error("관리자 토큰을 확인할 수 없어요.");
  }

  return data.accessToken;
}

export async function requestAdminMe(accessToken: string) {
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/admin/me`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    },
    "관리자 정보를 불러오지 못했어요.",
  );

  return parseAdminResponse<AdminMe>(response);
}

export async function requestAdminPaymentsSummary(accessToken: string) {
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/admin/payments/summary`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    },
    "결제 통계를 불러오지 못했어요.",
  );

  return parseAdminResponse<AdminPaymentSummary>(response);
}

export async function requestAdminPayments(
  accessToken: string,
  options: { cursor?: string; size?: number } = {},
): Promise<AdminPaymentsPage> {
  const searchParams = new URLSearchParams();

  if (options.cursor) {
    searchParams.set("cursor", options.cursor);
  }

  if (options.size) {
    searchParams.set("size", String(options.size));
  }

  const query = searchParams.toString();
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/admin/payments${query ? `?${query}` : ""}`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    },
    "결제 건을 불러오지 못했어요.",
  );
  const body = await parseAdminResponse<{
    items?: unknown;
    nextCursor?: unknown;
    hasNext?: unknown;
  }>(response);
  const items = Array.isArray(body.items)
    ? body.items
        .map(getAdminPaymentRecordItem)
        .filter((item): item is AdminPaymentRecordItem => item !== null)
    : [];

  return {
    hasNext: body.hasNext === true,
    items,
    nextCursor: typeof body.nextCursor === "string" ? body.nextCursor : null,
  };
}

// 커서 페이지를 끝까지(최대 20페이지 = 2,000건) 모아 온다. 대시보드가 전체 목록 위에서
// 클라이언트 검색·묶음 집계를 하는 구조라 서버 필터 대신 전량 로드를 유지한다.
export async function requestAllAdminPayments(accessToken: string) {
  const items: AdminPaymentRecordItem[] = [];
  let cursor: string | undefined;
  let pageCount = 0;
  let truncated = false;

  while (pageCount < 20) {
    const page: AdminPaymentsPage = await requestAdminPayments(accessToken, {
      cursor,
      size: 100,
    });

    items.push(...page.items);
    pageCount += 1;

    if (!page.hasNext || !page.nextCursor) {
      return { items, truncated };
    }

    cursor = page.nextCursor;
  }

  truncated = true;

  return { items, truncated };
}

function getAdminBulkResult(value: {
  succeededIds?: unknown;
  failures?: unknown;
}): AdminBulkResult {
  const succeededIds = Array.isArray(value.succeededIds)
    ? value.succeededIds
        .map(getOptionalIdString)
        .filter((id): id is string => Boolean(id))
    : [];
  const failures = Array.isArray(value.failures)
    ? value.failures.reduce<AdminBulkFailure[]>((nextFailures, failure) => {
        if (!isRecord(failure)) {
          return nextFailures;
        }

        const id = getOptionalIdString(failure.id);

        if (id) {
          nextFailures.push({
            code: typeof failure.code === "string" ? failure.code : "",
            id,
            message:
              typeof failure.message === "string"
                ? failure.message
                : "처리하지 못했어요.",
          });
        }

        return nextFailures;
      }, [])
    : [];

  return { failures, succeededIds };
}

export async function requestAdminPaymentConfirmation(
  accessToken: string,
  participationIds: string[],
) {
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/admin/payments/confirm`,
    {
      body: JSON.stringify({
        participationIds: participationIds.map(Number),
      }),
      credentials: "include",
      headers: getJsonHeaders(accessToken),
      method: "POST",
    },
    "입금 확인 요청이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
  );
  const body = await parseAdminResponse<{
    succeededIds?: unknown;
    failures?: unknown;
  }>(response);

  return getAdminBulkResult(body);
}

export async function requestAdminTrackingRegistration(
  accessToken: string,
  deliveryIds: string[],
  trackingNumber: string,
) {
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/admin/deliveries/tracking`,
    {
      body: JSON.stringify({
        deliveryIds: deliveryIds.map(Number),
        trackingNumber,
      }),
      credentials: "include",
      headers: getJsonHeaders(accessToken),
      method: "PATCH",
    },
    "운송장 등록 요청이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
  );
  const body = await parseAdminResponse<{
    succeededIds?: unknown;
    failures?: unknown;
  }>(response);

  return getAdminBulkResult(body);
}
