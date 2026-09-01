import type {
  ConvenienceStoreType,
  DeliveryAddress,
} from "@/lib/mock-delivery-addresses";
import type { ProductCardItem } from "@/components/ProductCard";
import {
  clearBrowserApiCacheByPrefix,
  readBrowserApiCache,
  writeBrowserApiCache,
} from "@/lib/browser-api-cache";
import type { ProductDetailItem, ProductOption } from "@/lib/mock-products";
import { FEATURES } from "@/lib/feature-flags";
import {
  getBuncheolStatusBadgeLabel,
  isBuncheolDeletedStatus,
} from "@/lib/buncheol-states";
import type { ShippingFeePaybackStatus } from "@/lib/shipping-fee-payback";

const defaultApiBaseUrl = "https://staging.buncheoleasy.com";
const legacyApiBaseUrlPattern = /^https?:\/\/13\.124\.248\.60(?:\/v1)?$/;
const publicBannerCacheKey = "banners:v1";
const publicBannerCacheTtlMs = 15 * 60 * 1000;
const publicNoticeListCachePrefix = "inbox-notices:v1";
const publicNoticeDetailCachePrefix = "inbox-notice-detail:v1";
const publicNoticeCacheTtlMs = 5 * 60 * 1000;

type AccessTokenResponse = {
  accessToken: string;
};

export class ApiRequestError extends Error {
  status: number;
  // 서버 에러 코드(BCH-xxx·USR-xxx). 메시지 문자열 매칭 없이 분기해야 하는 곳에서만 채운다.
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

// 마이페이지 정산 계좌 미등록. 서버가 참여 요청에서 금액과 무관하게 계좌를 요구한다(서버 PR #151).
export const USER_BANK_ACCOUNT_NOT_REGISTERED_CODE = "USR-025";

export type UserProfileStatus = {
  isProfileComplete: boolean;
};

// 개최 자격 사전 조회 사유. 개최 폼 진입 전 차단 안내를 사유별로 분기한다 (docs/53 Q-07).
export const hostingEligibilityReasons = [
  // 회원 개최 오픈 전 — 사용자가 무엇을 해도 해소되지 않는 유일한 사유다 (서버 USR-035).
  // 배열 순서는 isHostingEligibilityReason 의 includes 에만 쓰여 동작에 영향이 없다.
  "NOT_OPEN_YET",
  // 가입 미완료(전화번호 미등록) — 서버 USR-018
  "PHONE_REQUIRED",
  // 연령대 미확인 — 카카오 재로그인 동의로 회복 가능 (서버 USR-032)
  "AGE_UNVERIFIED",
  // 미성년 확정 — 개최 불가 (서버 USR-033)
  "NOT_ADULT",
  // 활성 개최 수 상한 초과 — 서버 BCH-089
  "LIMIT_EXCEEDED",
  // 정산 계좌 미등록 — 서버 USR-025
  "BANK_ACCOUNT_REQUIRED",
] as const;

// null 은 "사유를 모른다"는 뜻 — 서버가 사유를 추가해도 화면이 깨지지 않게 알 수 없는 값은 여기로 떨어뜨린다.
export type HostingEligibilityReason =
  | (typeof hostingEligibilityReasons)[number]
  | null;

export type HostingEligibility = {
  eligible: boolean;
  reason: HostingEligibilityReason;
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
  // 실명 (입금 대조·배송 연락 참조). 기존 회원 미입력 시 빈 문자열.
  name: string;
  phoneNumber: string;
  bankAccount: BankAccountInfo | null;
  // 백엔드 개최 권한 제한 반영 전 응답에는 없는 필드라 undefined를 허용한다.
  // 서버 게이트 위임(client#85) 이후 FE 미사용 — 선차단 재도입 금지, 서버 계약 문서화용으로만 유지.
  canHost?: boolean;
};

export function isUserProfileComplete(
  profile: Pick<UserProfile, "nickname" | "phoneNumber"> | null | undefined,
) {
  const phoneNumber = profile?.phoneNumber.replace(/\D/g, "") ?? "";

  return (
    /^[가-힣A-Za-z0-9]{1,20}$/.test(profile?.nickname.trim() ?? "") &&
    /^01\d{8,9}$/.test(phoneNumber)
  );
}

export type UpdateUserProfileRequest = {
  nickname: string;
  phoneNumber: string;
  // 실명 (1~30자 한글/영문). 생략하면 서버가 기존 값을 유지한다.
  name?: string;
  // 마케팅 정보 수신 동의 여부. 생략하면 서버가 기존 동의 상태를 유지한다.
  marketingAgreed?: boolean;
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
  storeCode?: string;
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
  /** C2C 참여자 소통 채널(카카오 오픈채팅) — 선택, 최대 200자 (docs/46 §7.1-10). */
  openChatUrl?: string;
  purchaseSite: string;
  /** 대표사진으로 쓸 images 파트 내 인덱스(0-base, 필수). 이미지 순서는 업로드 순서 그대로 저장된다. */
  thumbnailIndex: number;
  title: string;
};

// 대표사진 지정은 필수 — thumbnailImageId(유지 이미지)와 thumbnailIndex(신규 이미지) 중 정확히 하나를 보내야 한다.
export type UpdateBuncheolRequest = {
  description?: string;
  keepImageIds?: number[];
  /** 유지하는 기존 이미지 중 대표사진으로 지정할 이미지 id (keepImageIds에 포함돼야 함) */
  thumbnailImageId?: number;
  /** 신규 업로드 images 파트 중 대표사진으로 쓸 인덱스(0-base) */
  thumbnailIndex?: number;
  title: string;
};

export type ParticipateBuncheolRequest = {
  buncheolMemberId: number;
  shippingAddressId: number;
  participationCode?: string | null;
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
  /**
   * 그룹의 대체 표기(한글/영문 표기·팬덤 축약어). 서버는 이름뿐 아니라 별칭으로도 매칭해 내려주므로,
   * `rankGroupSearchResults` 가 이 값을 함께 봐야 별칭으로 걸린 그룹을 랭킹에서 탈락시키지 않는다.
   */
  aliases?: string[];
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

export type ApiGroupDetail = ApiGroupWithMembers & {
  recruitingBuncheolCount: number;
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
  // 배송비 0원 이벤트 대상(운영진 개최 + 이용 가능한 배송수단이 모두 0원) 여부. 목록 카드엔 배송비가
  // 없어 상세에 들어가야 알 수 있던 정보라 서버가 판정해 내려준다. 구 응답이면 undefined → 배지 미노출.
  freeShippingEventTarget?: boolean;
  // 분철 flow_type. 필드가 없는 구 응답은 null 이고 getFlowType 이 LEGACY 로 떨어뜨린다.
  flowType?: string | null;
  groupName: string;
  id: string;
  isHostedByMe?: boolean;
  memberNames: string[];
  memberSlotCount?: number;
  minHeadcount?: number | null;
  // 오픈 이벤트 배송비 돌려받기 대상 분철(전 슬롯 0원 + 이벤트 활성) 여부.
  // 서버가 판정해 내려주며, 필드가 없는 응답이면 undefined → 배지를 노출하지 않는다 (안전 폴백).
  shippingFeePaybackTarget?: boolean;
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
  participatedByMe?: boolean;
  purchasePaymentConfirmedAt?: string;
  purchasePaymentDueAt?: string;
  purchasePaymentStatus?: string;
  purchaseParticipationId?: string;
  requiresCode?: boolean;
  saleStatus?: string;
  topBidAmounts: number[];
};

export type BuncheolShippingOption = {
  fee: number;
  method: string;
};

/** 분철 이미지 1장 — id·URL·대표 여부를 한 객체로 묶어 배열 인덱스 정렬 계약 없이 식별한다. */
export type BuncheolImageInfo = {
  id?: number;
  thumbnail?: boolean;
  url: string;
};

export type BuncheolDetail = BuncheolSummary & {
  cuShippingFee?: number;
  description?: string;
  // 분철 flow_type — 필드가 없는 구 응답은 LEGACY 로 취급한다 (getFlowType).
  flowType?: string | null;
  gs25ShippingFee?: number;
  hostBankAccount?: BankAccountInfo | null;
  /** 등록 순(업로드 순) 이미지 목록. 이미지가 있으면 정확히 1장이 thumbnail=true */
  images: BuncheolImageInfo[];
  minHeadcount?: number | null;
  isHostedByMe?: boolean;
  members: BuncheolMember[];
  // C2C 개최자 소통 채널(카카오 오픈채팅) — 없으면 null.
  openChatUrl?: string | null;
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
  // amount 는 배송비를 포함한 입금 총액, shippingFee 는 그중 배송비.
  // 다슬롯은 배송비가 묶음 첫 슬롯에만 붙어 같은 사람의 두 참여 금액이 달라진다 (docs/53 Q-22).
  amount: number;
  shippingFee?: number | null;
  buncheolMemberId?: string;
  confirmedAt?: string | null;
  delivery?: BuncheolManagementDelivery | null;
  // 입금자명(= 환불 계좌 예금주). 서버가 평시에 계좌 대신 이것만 내린다 (docs/70 결정 21).
  // refundAccount 는 개최자가 실제로 환불해야 하는 건에만 채워지므로 대조 키는 이쪽을 봐야 한다.
  depositorName?: string | null;
  dueAt?: string | null;
  memberName: string;
  participantNickname: string;
  participationId: string;
  // C2C "보냈어요" 마킹 시각 — 개최자가 통장 대조 우선순위를 잡는 근거 (docs/46 §4.6).
  paymentSentAt?: string | null;
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
  // 취소된 참여(환불 계좌 확인용). participants 와 분리해 받는다 —
  // 슬롯을 점유하지 않아 참여 수·정원 집계에 섞이면 안 된다.
  cancelledParticipants: BuncheolManagementParticipant[];
  confirmedCount?: number;
  deadline: string;
  // 분철 flow_type — 없으면 LEGACY 취급 (getFlowType).
  flowType?: string | null;
  groupName: string;
  id: string;
  memberCount?: number;
  minHeadcount?: number;
  // 참여자 소통용 오픈채팅 링크 — 등록하지 않았으면 null. 개최 관리 화면에서 바로 수정한다.
  openChatUrl?: string | null;
  optionCount: number;
  options: BuncheolManagementOption[];
  participants: BuncheolManagementParticipant[];
  // C2C 일괄 입금 기한 — 성사 확정 시 산정 (docs/46 §4.1).
  paymentDueAt?: string | null;
  purchaseSite?: string;
  status: BuncheolStatus;
  title: string;
  totalParticipationCount: number;
};
// 오픈 이벤트 배송비 돌려받기 상태. status 는 서버가 이벤트 대상·배송 완료·신청 마감을 종합해 파생한 값이라
// 프론트는 슬롯 0원 여부를 재판정하지 않고 이 값을 그대로 신뢰한다 (비대상이면 NONE).
export type ShippingFeePaybackInfo = {
  status: ShippingFeePaybackStatus;
  // 신청 마감 시각 (배송 완료 시각 + 신청 가능 일수, ISO). 이벤트 비대상이거나 마감 미적용이면 null.
  submitDeadline?: string | null;
  tweetUrl?: string | null;
  requestedAt?: string | null;
  completedAt?: string | null;
  rejectReason?: string | null;
  amount?: number | null;
  // 환급을 입금받을 계좌 (참여 시 등록한 환불계좌). 돌려받기 시트에 표시한다.
  refundAccount?: BankAccountInfo | null;
};

export type MyParticipation = {
  bidAmount: number;
  // 소속 묶음 = 이체 1회 · 택배 1개의 단위. 「보냈어요」·입금확인·「제외」가 전부 이 단위로 돈다.
  // 같은 분철에서 자리를 여러 개 잡으면 한 묶음이고, 성사 확정 뒤 추가로 잡으면 별개 묶음이다.
  bundleId?: string | null;
  buncheolDeadline: string;
  buncheolId: string;
  buncheolMemberId?: string | null;
  buncheolMemberCount: number;
  buncheolStatus: string;
  buncheolTitle: string;
  cancelReason?: string | null;
  // 서버가 취소 API 게이트와 같은 판정으로 내려주는 취소 가능 여부·사유 (docs/56 S-1).
  // CANCELLABLE | BLOCKED_BY_STATUS | FLOW_NOT_SUPPORTED | BLOCKED_BY_HOST_CONFIRM.
  // 필드가 없는 구 응답이면 null — 화면은 취소 버튼을 남기는 쪽으로 폴백한다.
  cancellability?: string | null;
  closedRank?: number | null;
  deliveryId?: string | null;
  deliveryStatus?: string | null;
  thumbnailUrl?: string;
  // 분철 flow_type — 필드가 없는 구 응답은 LEGACY 로 취급한다 (getFlowType).
  flowType?: string | null;
  memberName: string;
  // C2C 개최자 소통 채널(카카오 오픈채팅) — 없으면 null.
  openChatUrl?: string | null;
  participationId: string;
  participationStatus: string;
  payback?: ShippingFeePaybackInfo | null;
  paymentAmount?: number | null;
  paymentDueAt?: string | null;
  // C2C "보냈어요" 마킹 시각 — 마킹 안 했으면 null.
  paymentSentAt?: string | null;
  // 개최자가 "입금 못 찾음"으로 되돌린 시각. 서버가 입금 대기 구간에서만 값을 채워 주므로
  // 값이 있으면 곧 "재확인이 필요한 상태"다 (docs/53 Q-03).
  paymentRejectedAt?: string | null;
  createdAt?: string | null;
  hostBankAccount?: BankAccountInfo | null;
  // 참여 시 등록한 환불계좌 예금주 = 입금자명. 입금 안내 시트에만 있고 결제 정보 시트엔 빠져 있어
  // 나중에 계좌를 다시 열어본 사용자가 다른 이름으로 송금할 위험이 있었다 (docs/53 Q-17).
  // 이름은 서버 응답 키(refundHolder) 그대로 둔다 — depositorName 은 이 코드베이스에서
  // "환불계좌 예금주"(HostedBuncheolManage:1128)와 "참여자 닉네임"(auth-api:2914, HostedBuncheolManage:213)
  // 두 의미로 이미 쓰이고 있어, 여기 합류시키면 어느 쪽인지 읽어봐야 알 수 있다.
  refundHolder?: string | null;
  shippingAddress?: DeliveryAddress | null;
  shippingFee?: number | null;
  shippingOptions?: BuncheolShippingOption[];
  trackingNumber?: string | null;
};

export type MyHostedBuncheol = BuncheolSummary & {
  activeParticipationCount: number;
  // 서버가 취소 API 게이트·CAS 와 같은 판정으로 내려주는 개최자 취소 가능 여부·사유 (docs/56 S-2).
  // CANCELLABLE | BLOCKED_BY_STATUS | BLOCKED_BY_CONFIRMED_PAYMENT.
  // 필드가 없는 구 응답이면 null — 화면은 삭제 버튼을 남기는 쪽으로 폴백한다.
  cancellability?: string | null;
  createdAt: string;
  memberSlotCount: number;
};

export type ParticipationPaymentDetail = {
  bidAmount: number;
  // 참여 목록과 같은 서버 취소 판정 (docs/56 S-1). paymentStatus 와 같은 응답에서 나오므로
  // 상세로 상태를 보강할 때 판정도 함께 갱신해 둘이 어긋나지 않게 한다.
  cancellability?: string | null;
  deliveryId?: string | null;
  deliveryStatus?: string | null;
  flowType?: string | null;
  hostBankAccount: BankAccountInfo | null;
  openChatUrl?: string | null;
  participationId: string;
  paymentAmount: number | null;
  paymentDueAt?: string | null;
  paymentSentAt?: string | null;
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

// accessToken 은 선택 — 비로그인도 허용하는 API(의견 보내기)가 있어 미로그인 시 Authorization 헤더를 생략한다.
function getJsonHeaders(accessToken?: string) {
  return {
    ...getAuthHeaders(accessToken),
    "Content-Type": "application/json",
  };
}

/*
 * 이 값은 대부분 그대로 사용자 화면에 뿌려진다. 빈 문자열이 나오면 안내가 통째로
 * 사라지고, "메시지가 없으면 로딩 중"으로 분기하는 화면(개최 관리)에서는 끝나지 않는
 * 로딩으로 보인다. statusText 는 HTTP/2 응답에서 항상 비어 있으므로 특히 위험하다.
 * 어떤 경로로도 빈 문자열을 내보내지 않는다.
 */
const DEFAULT_ERROR_MESSAGE = "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";

function getFirstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return "";
}

async function parseErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as {
      detail?: unknown;
      message?: unknown;
      title?: unknown;
    };

    return (
      getFirstNonEmptyString(
        body.message,
        body.detail,
        body.title,
        response.statusText,
      ) || DEFAULT_ERROR_MESSAGE
    );
  } catch {
    return (
      getFirstNonEmptyString(response.statusText) || DEFAULT_ERROR_MESSAGE
    );
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

function getStringArrayValue(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];

    if (!Array.isArray(value)) {
      continue;
    }

    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
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
    // 주소 객체가 따로 없고 delivery 에 storeName/shippingMethod 가
    // 평평하게 실려오는 응답은 delivery 자체를 주소 레코드로 쓴다.
    deliveryRecord,
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
      name: "",
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
    name: getStringValue(data, ["name", "realName"]),
    nickname: getStringValue(data, ["nickname", "displayName"]),
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
    cancellability: getOptionalStringValue(data, ["cancellability"]) ?? null,
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
    flowType: getOptionalStringValue(data, ["flowType"]) ?? null,
    openChatUrl: getOptionalStringValue(data, ["openChatUrl"]) ?? null,
    paymentSentAt: getOptionalStringValue(data, ["paymentSentAt"]) ?? null,
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
    storeCode:
      getOptionalStringValue(data, ["storeCode", "code"]) ?? undefined,
    isDefault: getBooleanValue(data, ["isDefault", "default"]) ?? undefined,
  };
}

function getShippingAddressBody(body: ShippingAddressRequest) {
  return {
    alias: body.alias,
    isDefault: body.isDefault,
    shippingMethod: getShippingMethod(body.storeType),
    storeCode: body.storeCode,
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

// 개최 자격 사전 조회 (server: GET /v1/buncheols/hosting-eligibility). 부적격이어도 200 + 사유로 내려온다.
export async function requestHostingEligibility(
  accessToken: string,
): Promise<HostingEligibility> {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/buncheols/hosting-eligibility`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new ApiRequestError(
      await parseErrorMessage(response),
      response.status,
    );
  }

  const data = getNestedData((await response.json()) as unknown);
  const eligible = getBooleanValue(data, [
    "eligible",
    "isEligible",
    "hostingEligible",
  ]);

  if (eligible === null) {
    throw new Error("개최 자격을 확인할 수 없어요.");
  }

  return { eligible, reason: getHostingEligibilityReason(data) };
}

function getHostingEligibilityReason(data: unknown): HostingEligibilityReason {
  if (!isRecord(data)) {
    return null;
  }

  const reason = getStringValue(data, ["reason", "reasonCode", "code"]);

  return isHostingEligibilityReason(reason) ? reason : null;
}

function isHostingEligibilityReason(
  value: string,
): value is NonNullable<HostingEligibilityReason> {
  return (hostingEligibilityReasons as readonly string[]).includes(value);
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

export type CvsStoreBrand = "GS25" | "CU";

export type CvsStore = {
  id: string;
  brand: CvsStoreBrand;
  storeCode: string;
  name: string;
  tel: string;
  address: string;
  postNo: string;
  latitude: number | null;
  longitude: number | null;
};

export type CvsStoreSearchParams = {
  brand?: CvsStoreBrand | null;
  cursor?: string | null;
  keyword?: string;
  size?: number;
};

export type CvsStoreSearchPage = {
  hasNext: boolean;
  items: CvsStore[];
  nextCursor: string | null;
};

function getCvsStoreBrand(value: string): CvsStoreBrand | null {
  const normalized = value.trim().toUpperCase();

  if (normalized.includes("CU")) {
    return "CU";
  }

  if (normalized.includes("GS")) {
    return "GS25";
  }

  return null;
}

function getCvsStore(body: unknown): CvsStore | null {
  if (!isRecord(body)) {
    return null;
  }

  const name = getStringValue(body, ["name", "storeName"]).trim();
  // storeCode 는 브랜드 간 충돌 가능성이 있어 id fallback 으로 쓰지 않는다.
  const id = getStringValue(body, ["id", "storeId"]);
  const brand = getCvsStoreBrand(getStringValue(body, ["brand", "storeBrand"]));

  // id 는 목록 key·중복 제거·선택 매칭의 기준, brand 는 배송 방식(storeType)의 근거라 없으면 항목을 버린다.
  if (!name || !id || !brand) {
    return null;
  }

  return {
    id,
    brand,
    storeCode: getStringValue(body, ["storeCode", "code"]),
    name,
    tel: getStringValue(body, ["tel", "storeTel", "phoneNumber"]).trim(),
    address: getStringValue(body, ["address", "roadAddress", "storeAddress"]).trim(),
    postNo: getStringValue(body, ["postNo", "postCode", "zipCode"]).trim(),
    latitude: getNumberValue(body, ["latitude", "lat", "mapY"]),
    longitude: getNumberValue(body, ["longitude", "lng", "mapX"]),
  };
}

// 배송지 등록용 편의점 접수처 검색. 공개 API 라 토큰 없이 호출한다.
export async function requestCvsStores(
  params: CvsStoreSearchParams = {},
): Promise<CvsStoreSearchPage> {
  const searchParams = new URLSearchParams();

  if (params.brand) {
    searchParams.set("brand", params.brand);
  }

  if (params.keyword?.trim()) {
    searchParams.set("keyword", params.keyword.trim());
  }

  if (params.cursor) {
    searchParams.set("cursor", params.cursor);
  }

  if (typeof params.size === "number") {
    searchParams.set("size", String(params.size));
  }

  const query = searchParams.toString();
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/cvs-stores${query ? `?${query}` : ""}`,
    {
      headers: {
        Accept: "application/json",
      },
      method: "GET",
    },
    "지점 검색이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const body: unknown = await response.json();
  const items = getBuncheolList(body)
    .map((item) => getCvsStore(item))
    .filter((item): item is CvsStore => item !== null);
  const { hasNext, nextCursor } = getBuncheolListPageInfo(body);

  return {
    hasNext,
    items,
    nextCursor,
  };
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

// 상세 응답의 images(객체 배열: id·url·thumbnail)를 파싱한다.
// images 키가 없는 구형 응답/로컬 캐시는 imageUrls·imageIds 병렬 배열을 객체로 묶어 폴백한다.
function getBuncheolImageInfos(
  data: Record<string, unknown>,
): BuncheolImageInfo[] {
  const parsed = getRecordListValue(data, ["images"])
    .map((record): BuncheolImageInfo | null => {
      const url = getImageUrl(record);

      if (!url) {
        return null;
      }

      return {
        id: getImageId(record) ?? undefined,
        thumbnail:
          getBooleanValue(record, ["thumbnail", "isThumbnail"]) ?? undefined,
        url,
      };
    })
    .filter((image): image is BuncheolImageInfo => image !== null);

  if (parsed.length > 0) {
    return parsed;
  }

  const imageUrls = getImageUrls(data);
  const imageIds = getImageIds(data);
  const thumbnailImageId = getOptionalNumberValue(data, ["thumbnailImageId"]);

  return imageUrls.map((url, index) => ({
    id: imageIds[index],
    thumbnail:
      typeof thumbnailImageId === "number"
        ? imageIds[index] === thumbnailImageId
        : index === 0,
    url,
  }));
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
    flowType: getOptionalStringValue(record, ["flowType"]) ?? null,
    memberSlotCount: getOptionalNumberValue(record, [
      "memberSlotCount",
      "buncheolMemberCount",
      "memberCount",
    ]),
    minHeadcount: getOptionalNumberValue(record, ["minHeadcount"]),
    freeShippingEventTarget:
      getBooleanValue(record, [
        "freeShippingEventTarget",
        "isFreeShippingEventTarget",
      ]) ?? undefined,
    shippingFeePaybackTarget:
      getBooleanValue(record, [
        "shippingFeePaybackTarget",
        "isShippingFeePaybackTarget",
      ]) ?? undefined,
  };
}

const shippingFeePaybackStatuses: ShippingFeePaybackStatus[] = [
  "NONE",
  "ELIGIBLE",
  "REQUESTED",
  "APPROVED",
  "COMPLETED",
  "REJECTED",
  "EXPIRED",
];

// 참여 응답의 payback 블록 파싱. 서버 미배포 등으로 필드가 없으면 null 을 돌려주고
// 화면은 이벤트 UI를 그리지 않는다 (안전 폴백).
function getShippingFeePaybackFromRecord(
  value: unknown,
): ShippingFeePaybackInfo | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawStatus = getOptionalStringValue(value, [
    "status",
    "paybackStatus",
  ])?.toUpperCase();
  const status = shippingFeePaybackStatuses.find(
    (candidate) => candidate === rawStatus,
  );

  if (!status) {
    return null;
  }

  return {
    status,
    submitDeadline: getOptionalStringValue(value, ["submitDeadline"]) ?? null,
    tweetUrl:
      getOptionalStringValue(value, ["tweetUrl", "paybackTweetUrl"]) ?? null,
    requestedAt:
      getOptionalStringValue(value, ["requestedAt", "paybackRequestedAt"]) ??
      null,
    completedAt:
      getOptionalStringValue(value, ["completedAt", "paybackCompletedAt"]) ??
      null,
    rejectReason:
      getOptionalStringValue(value, ["rejectReason", "paybackRejectReason"]) ??
      null,
    amount:
      getOptionalNumberValue(value, ["amount", "paybackAmount"]) ?? null,
    refundAccount: getNestedBankAccountInfo(value, ["refundAccount"]),
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
  const recordSaleStatus = getOptionalStringValue(record, [
    "saleStatus",
  ])?.toUpperCase();
  // saleStatus는 점유 상태(SOLD/AWAITING_PAYMENT)일 때만 구매 상태 근거로 삼는다.
  // AVAILABLE 레코드까지 열어두면 멤버 자체 필드(id 등)를 구매 정보로 오인할 수 있다.
  const hasOccupiedSaleStatus =
    recordSaleStatus === "SOLD" || recordSaleStatus === "AWAITING_PAYMENT";
  const hasDirectPaymentState = Boolean(
    hasOccupiedSaleStatus ||
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
    (recordSaleStatus === "SOLD"
      ? "CONFIRMED"
      : recordSaleStatus === "AWAITING_PAYMENT"
        ? "AWAITING_PAYMENT"
        : undefined) ??
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
  const saleStatus = getOptionalStringValue(record, ["saleStatus"]);

  const normalizedSaleStatus = saleStatus?.toUpperCase();

  return {
    // CODE_ONLY 는 공석이라 선택 가능으로 둔다 — 자격은 체크아웃의 코드 입력이 가른다.
    available: normalizedSaleStatus
      ? normalizedSaleStatus === "AVAILABLE" || normalizedSaleStatus === "CODE_ONLY"
      : getBooleanValue(record, ["available", "isAvailable"]) ?? undefined,
    requiresCode: normalizedSaleStatus === "CODE_ONLY",
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
    participatedByMe:
      getBooleanValue(record, ["participatedByMe", "isParticipatedByMe"]) ??
      undefined,
    saleStatus,
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
      // 활성 참여만 "내 참여"로 취급한다 — 서버가 비활성(취소·만료) 참여를 목록에 포함하게 되더라도
      // 취소된 참여가 재참여를 막지 않도록 memberIds 쪽과 동일하게 필터한다.
      const status = getOptionalStringValue(record, [
        "status",
        "participationStatus",
      ]);

      if (
        buncheolMemberId &&
        participationId &&
        bidAmount !== null &&
        !isInactiveBuncheolPaymentStatus(status)
      ) {
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

function getMyParticipationMemberIdsFromRecord(
  data: Record<string, unknown>,
): Set<string> {
  const myParticipation = getNestedData(data.myParticipation);

  if (!isRecord(myParticipation)) {
    return new Set();
  }

  return getRecordListValue(myParticipation, ["bids", "participations"]).reduce(
    (memberIds, record) => {
      const buncheolMemberId = getStringValue(record, [
        "buncheolMemberId",
        "memberSlotId",
        "optionId",
      ]);
      const status = getOptionalStringValue(record, [
        "status",
        "participationStatus",
      ]);

      if (buncheolMemberId && !isInactiveBuncheolPaymentStatus(status)) {
        memberIds.add(buncheolMemberId);
      }

      return memberIds;
    },
    new Set<string>(),
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
  const myParticipationMemberIds = getMyParticipationMemberIdsFromRecord(data);
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
        // 멤버 응답에 participatedByMe 가 없으면 myParticipation 목록으로 보완한다.
        const participatedByMe =
          member.participatedByMe ??
          (myParticipationMemberIds.has(member.id) ? true : undefined);
        const myBid = myParticipationBids.get(member.id);

        if (!myBid) {
          return participatedByMe === member.participatedByMe
            ? member
            : { ...member, participatedByMe };
        }

        return {
          ...member,
          myBidAmount: myBid.bidAmount,
          myParticipationId: myBid.participationId,
          myRank: myBid.rank,
          participatedByMe,
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
  const images = getBuncheolImageInfos(data);
  // 상세 images는 등록 순이라 첫 장이 대표사진이 아닐 수 있다 — thumbnail 플래그로 썸네일 URL을 찾아 요약 필드를 보정한다.
  const thumbnailUrl =
    images.find((image) => image.thumbnail)?.url ??
    images[0]?.url ??
    summary.thumbnailUrl;

  return {
    ...summary,
    thumbnailUrl,
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
    flowType: getOptionalStringValue(data, ["flowType"]) ?? null,
    openChatUrl: getOptionalStringValue(data, ["openChatUrl"]) ?? null,
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
    images,
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
    shippingFee: getOptionalNumberValue(record, ["shippingFee", "deliveryFee"]),
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
      "멤버",
    depositorName:
      getOptionalStringValue(record, ["depositorName", "depositor"]) ??
      // 구버전 서버 폴백 — 계좌를 통째로 내리던 시절엔 예금주가 대조 키였다.
      refundAccount?.holder ??
      null,
    participantNickname,
    participationId,
    paymentSentAt: getOptionalStringValue(record, ["paymentSentAt"]) ?? null,
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
  // 취소분은 참여 수 집계에 쓰이는 participants 와 절대 합치지 않는다.
  // participants 와 같은 규칙으로 participationId 중복을 접는다 — sourceRecords 가 둘일 때 같은 배열을 두 번 집을 수 있다.
  const cancelledById = new Map<string, BuncheolManagementParticipant>();

  sourceRecords
    .flatMap((sourceRecord) =>
      // 서버가 새로 정의한 필드라 구 응답 alias 가 없다 — participants 계열과 달리 단일 키만 본다.
      getNestedRecordListValue(sourceRecord, ["cancelledParticipants"]),
    )
    .map((participantRecord) =>
      getBuncheolManagementParticipantFromRecord(participantRecord),
    )
    .filter(
      (participant): participant is BuncheolManagementParticipant =>
        participant !== null,
    )
    .forEach((participant) => {
      cancelledById.set(participant.participationId, participant);
    });

  const cancelledParticipants = [...cancelledById.values()];
  const memberCount = getNumberValue(data, ["memberCount", "memberSlotCount"]);

  return {
    cancelledParticipants,
    confirmedCount: getNumberValue(data, ["confirmedCount"]) ?? undefined,
    deadline:
      getStringValue(data, ["deadline", "buncheolDeadline"]) ||
      getStringValue(responseData, ["deadline", "buncheolDeadline"]),
    flowType: getOptionalStringValue(data, ["flowType"]) ?? null,
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
    openChatUrl: getOptionalStringValue(data, ["openChatUrl"]) ?? null,
    participants,
    paymentDueAt: getOptionalStringValue(data, ["paymentDueAt"]) ?? null,
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

// 배송비는 0원(무료 배송)도 유효한 값이라 "-" 로 표기하지 않는다. 수정 화면이 이 문자열을
// 역파싱해 입력값을 복원하므로 "무료" 같은 워딩 대신 숫자 표기를 유지해야 한다.
function formatShippingFeeAmount(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
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

export function getShippingMethodsFromOptions(
  shippingOptions: BuncheolShippingOption[],
) {
  return shippingOptions.map((option) => ({
    name: getShippingMethodLabel(option.method),
    price: formatShippingFeeAmount(option.fee),
  }));
}

function getShippingMethodsFromDetail(detail: BuncheolDetail) {
  if (detail.shippingOptions.length > 0) {
    return getShippingMethodsFromOptions(detail.shippingOptions);
  }

  return [
    detail.gs25ShippingFee != null
      ? {
          name: "GS25 반값택배",
          price: formatShippingFeeAmount(detail.gs25ShippingFee),
        }
      : null,
    detail.cuShippingFee != null
      ? {
          name: "CU 알뜰택배",
          price: formatShippingFeeAmount(detail.cuShippingFee),
        }
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
    createdAt: summary.createdAt,
    era: summary.groupName,
    price: undefined,
    deadline: formatKoreaDateTime(summary.deadline),
    rating: "0.0",
    reviews: String(summary.activeParticipationCount ?? 0),
    badge: getBuncheolStatusBadgeLabel(summary.status),
    imageUrl: summary.thumbnailUrl,
    isHostedByMe: summary.isHostedByMe,
    liked: summary.bookmarked,
    status: summary.status,
    tone: getToneFromId(summary.id),
    isShippingFeePaybackEvent:
      FEATURES.shippingFeePayback &&
      summary.shippingFeePaybackTarget === true,
    isFreeShippingEvent: summary.freeShippingEventTarget === true,
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
            name: "멤버",
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
      participatedByMe: member.participatedByMe,
      price: formattedPrice,
      purchasePaymentConfirmedAt: member.purchasePaymentConfirmedAt,
      purchasePaymentDueAt: member.purchasePaymentDueAt,
      purchasePaymentStatus: member.purchasePaymentStatus,
      purchaseParticipationId: member.purchaseParticipationId,
      requiresCode: member.requiresCode,
      saleStatus: member.saleStatus,
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
    flowType: detail.flowType ?? null,
    openChatUrl: detail.openChatUrl ?? null,
    // imageUrl 은 카드·미리보기용 대표사진. 캐러셀 순서는 images(등록 순)를 그대로 쓴다.
    imageUrl: detail.thumbnailUrl ?? detail.images[0]?.url,
    imageUrls: detail.images.map((image) => image.url),
    images: detail.images,
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
        item !== null && !isBuncheolDeletedStatus(item.status),
    );

  // 목록 API 가 각 분철의 첫 이미지를 thumbnailUrl 로 항상 내려주므로 별도 보강이 필요 없다.
  // (썸네일이 없는 분철 = 이미지 자체가 없는 분철이라 상세를 조회해도 채울 수 없음)
  return summaries;
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
          item !== null && !isBuncheolDeletedStatus(item.status),
      );

    allSummaries.push(...pageSummaries);

    const pageInfo = getBuncheolListPageInfo(body);

    if (!pageInfo.hasNext || !pageInfo.nextCursor) {
      break;
    }

    cursor = pageInfo.nextCursor;
    pageCount += 1;
  }

  return allSummaries;
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
    // 삭제·비공개(404)를 서버 렌더링에서 구분할 수 있도록 status 를 보존해 던진다.
    throw new ApiRequestError(await parseErrorMessage(response), response.status);
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

/**
 * 오픈채팅 링크만 수정한다. 전체 수정(updateBuncheol)은 모집중에만 통하지만 이 경로는 입금 수집중·진행확정에서도 열린다.
 * 빈 문자열을 보내면 링크가 제거된다.
 */
export async function updateBuncheolOpenChatUrl(
  accessToken: string,
  buncheolId: string,
  openChatUrl: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/buncheols/${buncheolId}/open-chat-url`,
    {
      body: JSON.stringify({ openChatUrl }),
      credentials: "include",
      headers: {
        ...getAuthHeaders(accessToken),
        "Content-Type": "application/json",
      },
      method: "PATCH",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
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

    // parseErrorMessage 와 같은 규칙 — 빈 문자열이 화면에 그대로 나가면 안 된다.
    const errorMessage =
      getFirstNonEmptyString(
        errorBody?.message,
        errorBody?.detail,
        errorBody?.title,
        response.statusText,
      ) || DEFAULT_ERROR_MESSAGE;

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
  if (!Number.isFinite(body.buncheolMemberId)) {
    throw new Error("구매할 멤버 정보를 확인하지 못했어요.");
  }

  // 참여 1건 = 멤버 슬롯 1개(단일 선택 정책). 서버도 buncheolMemberId(단수)만 받는다.
  const requestBody = {
    buncheolMemberId: body.buncheolMemberId,
    shippingAddressId: body.shippingAddressId,
    ...(body.participationCode
      ? { participationCode: body.participationCode }
      : {}),
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
    // 코드를 버리면(parseErrorMessage) 계좌 미등록을 메시지 문자열로만 식별하게 된다 — 서버 문구가
    // 바뀌는 순간 조용히 깨지고, 그 자리에 서버 원문이 그대로 노출된다.
    const parsedErrorBody: unknown = await readJsonBody(response);
    const errorBody = isRecord(parsedErrorBody) ? parsedErrorBody : null;

    // ⚠️ parseErrorMessage 와 같은 규칙 — 빈 문자열은 건너뛰고 다음 후보로 간다. getStringValue 계열은
    // 빈 문자열에서 멈추므로 message:"" + detail:"..." 이면 detail 을 잃는다. 호출부(ProductDetail)의
    // 개최자 참여 차단 안내가 이 메시지 문자열 매칭에 걸려 있어, 좁히면 그 분기가 통째로 죽는다.
    const errorMessage =
      getFirstNonEmptyString(
        errorBody?.message,
        errorBody?.detail,
        errorBody?.title,
        response.statusText,
      ) || DEFAULT_ERROR_MESSAGE;
    const errorCode = errorBody
      ? getOptionalStringValue(errorBody, ["code"])
      : undefined;

    throw new ApiRequestError(errorMessage, response.status, errorCode);
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
      // alias 폭은 인접 파서(getBuncheolManagementParticipantFromRecord·프로필 파서)와 맞춘다.
      const refundAccountRecord = getNestedData(
        record.refundAccount ??
          record.refundBankAccount ??
          record.refundBankAccountInfo,
      );
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
        cancelReason:
          getOptionalStringValue(record, ["cancelReason"]) ?? null,
        cancellability:
          getOptionalStringValue(record, ["cancellability"]) ?? null,
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
        payback: getShippingFeePaybackFromRecord(record.payback),
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
        flowType:
          getOptionalStringValue(record, ["flowType"]) ??
          (buncheol ? getOptionalStringValue(buncheol, ["flowType"]) : null) ??
          null,
        openChatUrl:
          getOptionalStringValue(record, ["openChatUrl"]) ??
          (buncheol
            ? getOptionalStringValue(buncheol, ["openChatUrl"])
            : null) ??
          null,
        bundleId: getOptionalStringValue(record, ["bundleId"]) ?? null,
        paymentSentAt:
          getOptionalStringValue(record, ["paymentSentAt"]) ?? null,
        paymentRejectedAt:
          getOptionalStringValue(record, ["paymentRejectedAt"]) ?? null,
        // 서버는 refundHolder 로 내려주지만, 환불계좌 객체째 실려오는 응답도 대비한다.
        // ⚠️ getNestedBankAccountInfo 를 쓰면 안 된다 — 키에서 못 찾을 때 최상위 record 를 스캔하고,
        // 그 후보 키에 hostAccountHolder·sellerAccountHolder 가 있어 개최자 예금주를 입금자명으로
        // 집어올 수 있다. 입금자명이 어긋나면 자동 입금확인·개최자 대조가 실패해, 값이 없어 안 보이는
        // 것보다 나쁘다. 환불계좌 객체 안에서만 좁게 읽는다.
        refundHolder:
          getOptionalStringValue(record, [
            "refundHolder",
            "refundAccountHolder",
          ]) ??
          (isRecord(refundAccountRecord)
            ? // 이미 환불계좌 객체 안으로 스코프가 좁혀졌으므로 인접 파서(getBankAccountInfoFromRecord)와
              // 같은 폭으로 본다. 단 host*/seller* 접두 키는 넣지 않는다 — 환불계좌 객체 안에 있을 이유가
              // 없고, 있다면 그건 개최자 계좌가 잘못 실린 응답이다.
              getOptionalStringValue(refundAccountRecord, [
                "holder",
                "holderName",
                "accountHolder",
                "accountOwner",
                "accountOwnerName",
                "depositor",
                "depositorName",
                "name",
              ])
            : undefined) ??
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
        shippingOptions: getRecordListValue(record, [
          "shippingOptions",
          "shippingMethods",
          "deliveryOptions",
          "deliveryMethods",
        ])
          .map(getBuncheolShippingOptionFromRecord)
          .filter(
            (option): option is BuncheolShippingOption => option !== null,
          ),
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

  return participations;
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
        cancellability:
          getOptionalStringValue(record, ["cancellability"]) ?? null,
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

  return buncheols.filter(
    (buncheol) => !isBuncheolDeletedStatus(buncheol.status),
  );
}

// 분철 상세 응답에는 bookmarked 필드가 없어, 상세 화면의 찜 상태는
// 찜 목록에서 해당 분철 포함 여부로 판별한다 (썸네일 보강 없이 가볍게 조회).
export async function requestBuncheolBookmarkStatus(
  accessToken: string,
  buncheolId: string,
): Promise<boolean> {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/buncheols/bookmarks/me`,
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
    .some(
      (record) =>
        getStringValue(record, ["buncheolId", "id"]).trim() ===
        String(buncheolId),
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

  return summaries.filter(
    (summary) => !isBuncheolDeletedStatus(summary.status),
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

// C2C 개최자 성사 확정 — 신청(APPLIED) 전원을 일괄 입금 기한(24h)과 함께 입금 대기로
// 전이하고 입금 안내 알림톡이 발송된다 (docs/46 §4.1). 정원 미달 재량·조기 확정 허용.
export async function confirmBuncheolRecruitment(
  accessToken: string,
  buncheolId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/buncheols/${buncheolId}/confirm`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = getNestedData(await readJsonBody(response));

  return {
    awaitingCount: isRecord(data)
      ? getOptionalNumberValue(data, ["awaitingCount"]) ?? null
      : null,
    paymentDueAt: isRecord(data)
      ? getOptionalStringValue(data, ["paymentDueAt"]) ?? null
      : null,
  };
}

// C2C 입금 수집 종료(부분 확정) — 기한 경과로 미입금 슬롯이 정리된 뒤 확정 참여만으로
// 진행을 확정한다. 미입금 활성 참여가 남아 있으면 서버가 거부한다 (docs/46 §7.1-6).
export async function finalizeBuncheolCollected(
  accessToken: string,
  buncheolId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/buncheols/${buncheolId}/finalize-collected`,
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

// C2C 개최자 미입금 반려 — 입금 내역을 찾지 못한 "보냈어요"를 입금 대기로 되돌리고
// 기한을 +24h 연장하며 참여자에게 재확인 안내가 발송된다 (docs/46 §4.5).
export async function rejectParticipationPaymentSent(
  accessToken: string,
  participationId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/participations/${participationId}/reject-payment`,
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

// C2C "보냈어요" 마킹 — 입금 후 참여자가 표시(AWAITING_PAYMENT → PAYMENT_SENT).
// 서버가 멱등 처리하므로(docs/46 §4.2) 이미 마킹된 참여에 다시 호출해도 성공한다.
// 「보냈어요」 묶음 마킹 — 이체 1회에 요청 1회다. 슬롯마다 부르면 한 번 보낸 돈을 여러 번 신고하게
// 되고, 중간에 실패하면 묶음 안 슬롯 상태가 갈려 개최자 입금확인(all-or-nothing)이 막힌다.
// 재요청은 서버가 멱등 처리하고 기한 경과 검사도 없다.
export async function requestBundlePaymentSent(
  accessToken: string,
  bundleId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/participation-bundles/${bundleId}/payment-sent`,
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

// 묶음이 없는 참여(배포선 창에서 생긴 행)용 폴백. 신규 참여는 전부 묶음을 갖는다.
export async function requestParticipationPaymentSent(
  accessToken: string,
  participationId: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/participations/${participationId}/payment-sent`,
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

// C2C "보냈어요" 마킹 철회 — 오마킹 셀프 수정(PAYMENT_SENT → AWAITING_PAYMENT 복귀).

// C2C 참여자 자발 취소 — APPLIED(자유)·AWAITING_PAYMENT(허용)에서만 성공한다.
// PAYMENT_SENT·CONFIRMED 는 서버가 거부(BCH-087)하며 FE 는 문의 안내로 유도한다 (docs/46 §4.4).
export async function cancelParticipation(
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

// 배송비 돌려받기 신청 (재신청 포함). 검증 실패는 서버가 400(URL 형식)·409(대상 아님/이미 신청/트윗 중복)로
// 구분해 내려주므로 status 를 보존한 ApiRequestError 로 던진다.
export async function requestShippingFeePayback(
  accessToken: string,
  participationId: string,
  tweetUrl: string,
) {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/participations/${participationId}/shipping-fee-payback`,
    {
      body: JSON.stringify({ tweetUrl }),
      credentials: "include",
      headers: getJsonHeaders(accessToken),
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new ApiRequestError(await parseErrorMessage(response), response.status);
  }
}

/**
 * 의견 보내기. 비로그인도 허용되므로 accessToken 이 없으면 익명 제출로 나간다
 * (로그인이 안 돼서 남기는 의견이 가장 받고 싶은 종류라 로그인을 요구하지 않는다).
 */
export async function submitFeedback(
  accessToken: string | null,
  content: string,
  screenPath?: string,
) {
  const response = await fetch(`${getVersionedApiBaseUrl()}/feedbacks`, {
    body: JSON.stringify(screenPath ? { content, screenPath } : { content }),
    credentials: "include",
    headers: getJsonHeaders(accessToken ?? undefined),
    method: "POST",
  });

  if (!response.ok) {
    throw new ApiRequestError(await parseErrorMessage(response), response.status);
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

  clearPublicNoticeBrowserCaches();

  return {
    location,
    noticeId,
  };
}

export function clearPublicNoticeBrowserCaches() {
  clearBrowserApiCacheByPrefix(publicBannerCacheKey);
  clearBrowserApiCacheByPrefix(publicNoticeListCachePrefix);
  clearBrowserApiCacheByPrefix(publicNoticeDetailCachePrefix);
}

export async function requestBanners(): Promise<ApiBanner[]> {
  const response = await fetch(`${getVersionedApiBaseUrl()}/banners`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const banners = getBannerList(await readJsonBody(response))
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

  // 새로고침 후에도 첫 페인트부터 실제 배너를 그릴 수 있도록 localStorage 에 남긴다
  // (홈에서 readCachedBanners 로 읽어 폴백 배너 → API 배너 교체 깜빡임을 막는다).
  writeBrowserApiCache(
    publicBannerCacheKey,
    banners,
    publicBannerCacheTtlMs,
  );

  return banners;
}

export function readCachedBanners() {
  return readBrowserApiCache<ApiBanner[]>(publicBannerCacheKey);
}

export async function requestCachedBanners() {
  return readCachedBanners() ?? requestBanners();
}

function getPublicNoticeListCacheKey(params: InboxMessagesParams = {}) {
  if (params.type !== "NOTICE" || params.cursor) {
    return null;
  }

  return `${publicNoticeListCachePrefix}:size:${params.size ?? "default"}`;
}

export function readCachedNoticeInboxMessages(
  params: InboxMessagesParams = {},
) {
  const cacheKey = getPublicNoticeListCacheKey(params);

  return cacheKey
    ? readBrowserApiCache<InboxMessagesResponse>(cacheKey)
    : null;
}

export async function requestCachedNoticeInboxMessages(
  params: InboxMessagesParams = {},
) {
  const cacheKey = getPublicNoticeListCacheKey(params);

  if (!cacheKey) {
    return requestInboxMessages(undefined, params);
  }

  const cachedMessages = readBrowserApiCache<InboxMessagesResponse>(cacheKey);

  if (cachedMessages) {
    return cachedMessages;
  }

  const messages = await requestInboxMessages(undefined, params);

  writeBrowserApiCache(cacheKey, messages, publicNoticeCacheTtlMs);

  return messages;
}

function getPublicNoticeDetailCacheKey(messageId: string) {
  return `${publicNoticeDetailCachePrefix}:${messageId}`;
}

export function readCachedNoticeInboxMessageDetail(messageId: string) {
  return readBrowserApiCache<InboxMessageDetail>(
    getPublicNoticeDetailCacheKey(messageId),
  );
}

export function writeCachedNoticeInboxMessageDetail(
  message: InboxMessageDetail,
) {
  if (message.type !== "NOTICE") {
    return;
  }

  writeBrowserApiCache(
    getPublicNoticeDetailCacheKey(message.id),
    message,
    publicNoticeCacheTtlMs,
  );
}

export async function requestCachedNoticeInboxMessageDetail(messageId: string) {
  const cacheKey = getPublicNoticeDetailCacheKey(messageId);
  const cachedMessage = readBrowserApiCache<InboxMessageDetail>(cacheKey);

  if (cachedMessage) {
    return cachedMessage;
  }

  const message = await requestInboxMessageDetail(undefined, messageId);

  writeCachedNoticeInboxMessageDetail(message);

  return message;
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
    aliases: getStringArrayValue(groupRecord, ["aliases", "alias"]),
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

// 최애 등록이 409 로 실패하는 경우는 두 가지이고 처리가 정반대다.
//   GRP-003 이미 등록됨 → 원하는 상태가 이미 만족됐으니 성공으로 접는다 (UI 는 등록됨으로 수렴).
//   GRP-005 5개 한도 초과 → 등록되지 않았으므로 롤백하고 사용자에게 이유를 보여줘야 한다.
// 둘을 구분하지 않으면 한도 초과인데 하트가 켜졌다가 새로고침하면 풀린다.
const FAVORITE_GROUP_ALREADY_EXISTS_CODE = "GRP-003";

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
    const errorBody = await readJsonBody(response);
    const code = isRecord(errorBody)
      ? getOptionalStringValue(errorBody, ["code"])
      : undefined;

    if (code === FAVORITE_GROUP_ALREADY_EXISTS_CODE) {
      return { alreadyExists: true };
    }

    const detail = isRecord(errorBody)
      ? getOptionalStringValue(errorBody, ["message", "detail", "title"])
      : undefined;

    throw new Error(detail ?? "최애 그룹을 등록하지 못했어요.");
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

/**
 * 그룹 단위 브라우즈(아티스트) 화면용 상세. 그룹 본문 + 전 멤버 + 모집중 분철 수를 한 번에 받는다.
 * 상태 코드를 구분해야 하는 호출 측을 위해 `ApiRequestError` 를 그대로 던진다 —
 * `/artists/[groupId]` 는 404(없는 그룹)와 400(id 형태 불일치)을 모두 `notFound()` 로 접는다.
 * 서버 선배포 전이거나 롤백되면 이 엔드포인트가 404 라 아티스트 페이지 전체가 404 가 된다(폴백 없음).
 */
export async function requestGroupDetail(
  groupId: string,
): Promise<ApiGroupDetail> {
  const response = await fetch(
    `${getVersionedApiBaseUrl()}/groups/${encodeURIComponent(groupId)}`,
    {
      credentials: "omit",
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new ApiRequestError(await parseErrorMessage(response), response.status);
  }

  const body = await readJsonBody(response);
  const record = isRecord(getNestedData(body)) ? getNestedData(body) : body;

  if (!isRecord(record)) {
    throw new ApiRequestError("그룹 정보를 불러오지 못했어요.", response.status);
  }

  const group = getApiGroupWithMembersFromRecord(record);

  if (!group) {
    throw new ApiRequestError("그룹 정보를 불러오지 못했어요.", response.status);
  }

  return {
    ...group,
    recruitingBuncheolCount:
      getNumberValue(record, ["recruitingBuncheolCount"]) ?? 0,
  };
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

export type AdminRequestedShippingAddress = {
  shippingMethod?: string;
  storeName?: string;
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
  // 참여가 선택한 배송지의 현재 원본. 입금 확인 전(배송 스냅샷 생성 전)에도 배송지를 보여주기 위한 필드.
  requestedShippingAddress: AdminRequestedShippingAddress | null;
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

function getAdminRequestedShippingAddressFromRecord(
  value: unknown,
): AdminRequestedShippingAddress | null {
  if (!isRecord(value)) {
    return null;
  }

  const shippingMethod =
    typeof value.shippingMethod === "string" ? value.shippingMethod : undefined;
  const storeName =
    typeof value.storeName === "string" ? value.storeName : undefined;

  if (!shippingMethod && !storeName) {
    return null;
  }

  return { shippingMethod, storeName };
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
    requestedShippingAddress: getAdminRequestedShippingAddressFromRecord(
      value.requestedShippingAddress,
    ),
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

export type AdminShippingFeePaybackItem = {
  participationId: string;
  participantNickname: string | null;
  participantName: string | null;
  buncheolId: string | null;
  buncheolTitle: string;
  memberName: string | null;
  paybackAmount: number | null;
  refundAccount: BankAccountInfo | null;
  tweetUrl: string | null;
  status: ShippingFeePaybackStatus;
  requestedAt: string | null;
  completedAt: string | null;
  rejectReason: string | null;
};

export type AdminShippingFeePaybacksPage = {
  items: AdminShippingFeePaybackItem[];
  nextCursor: string | null;
  hasNext: boolean;
};

function getAdminShippingFeePaybackItem(
  value: unknown,
): AdminShippingFeePaybackItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const participationId = getOptionalIdString(value.participationId);

  if (!participationId) {
    return null;
  }

  const rawStatus =
    typeof value.status === "string" ? value.status.toUpperCase() : "";

  return {
    participationId,
    participantNickname:
      typeof value.participantNickname === "string"
        ? value.participantNickname
        : null,
    participantName:
      typeof value.participantName === "string" ? value.participantName : null,
    buncheolId: getOptionalIdString(value.buncheolId) ?? null,
    buncheolTitle:
      typeof value.buncheolTitle === "string" ? value.buncheolTitle : "",
    memberName: typeof value.memberName === "string" ? value.memberName : null,
    paybackAmount:
      typeof value.paybackAmount === "number" ? value.paybackAmount : null,
    refundAccount: getAdminRefundAccountFromRecord(value.refundAccount),
    tweetUrl: typeof value.tweetUrl === "string" ? value.tweetUrl : null,
    status:
      rawStatus === "COMPLETED" || rawStatus === "REJECTED"
        ? rawStatus
        : "REQUESTED",
    requestedAt:
      typeof value.requestedAt === "string" ? value.requestedAt : null,
    completedAt:
      typeof value.completedAt === "string" ? value.completedAt : null,
    rejectReason:
      typeof value.rejectReason === "string" ? value.rejectReason : null,
  };
}

export async function requestAdminShippingFeePaybacks(
  accessToken: string,
  options: { status?: string; cursor?: string; size?: number } = {},
): Promise<AdminShippingFeePaybacksPage> {
  const searchParams = new URLSearchParams();

  if (options.status) {
    searchParams.set("status", options.status);
  }

  if (options.cursor) {
    searchParams.set("cursor", options.cursor);
  }

  if (options.size) {
    searchParams.set("size", String(options.size));
  }

  const query = searchParams.toString();
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/admin/shipping-fee-paybacks${
      query ? `?${query}` : ""
    }`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    },
    "배송비 돌려받기 신청 목록을 불러오지 못했어요.",
  );
  const body = await parseAdminResponse<{
    items?: unknown;
    nextCursor?: unknown;
    hasNext?: unknown;
  }>(response);
  const items = Array.isArray(body.items)
    ? body.items
        .map(getAdminShippingFeePaybackItem)
        .filter((item): item is AdminShippingFeePaybackItem => item !== null)
    : [];

  return {
    hasNext: body.hasNext === true,
    items,
    nextCursor: typeof body.nextCursor === "string" ? body.nextCursor : null,
  };
}

// 커서 페이지를 끝까지(최대 20페이지) 모아 온다 — 결제 목록(requestAllAdminPayments)과 동일한
// 클라이언트 필터 구조. 이벤트 한정 저볼륨이라 사실상 1페이지에 끝난다.
export async function requestAllAdminShippingFeePaybacks(
  accessToken: string,
  options: { status?: string } = {},
) {
  const items: AdminShippingFeePaybackItem[] = [];
  let cursor: string | undefined;
  let pageCount = 0;

  while (pageCount < 20) {
    const page = await requestAdminShippingFeePaybacks(accessToken, {
      cursor,
      size: 100,
      status: options.status,
    });

    items.push(...page.items);
    pageCount += 1;

    if (!page.hasNext || !page.nextCursor) {
      return { items, truncated: false };
    }

    cursor = page.nextCursor;
  }

  return { items, truncated: true };
}

// 배송비 돌려받기 검수 처리. COMPLETE = 입금 완료(승인·입금 한 번에), REJECT = 반려(사유 필수).
export async function requestAdminShippingFeePaybackAction(
  accessToken: string,
  participationId: string,
  action: "COMPLETE" | "REJECT",
  rejectReason?: string,
) {
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/admin/shipping-fee-paybacks/${participationId}`,
    {
      body: JSON.stringify(
        action === "REJECT" ? { action, rejectReason } : { action },
      ),
      credentials: "include",
      headers: getJsonHeaders(accessToken),
      method: "PATCH",
    },
    "배송비 돌려받기 처리 요청이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
  );

  if (!response.ok) {
    throw new ApiRequestError(await parseErrorMessage(response), response.status);
  }
}

// --- 참여 코드 (서포터즈 배정 슬롯) ---

export type AdminParticipationCodeItem = {
  codeId: string;
  code: string;
  buncheolId: string;
  buncheolMemberId: string | null;
  memberName: string | null;
  issuedTo: string | null;
  status: "ACTIVE" | "EXPIRED" | "USED" | "REVOKED";
  issuedAt: string | null;
  expiresAt: string | null;
  // DM 문안에 그대로 옮겨 적는 KST 표기 (서버 포맷을 그대로 쓴다).
  issuedAtText: string | null;
  expiresAtText: string | null;
  usedAt: string | null;
  usedParticipationId: string | null;
  revokedAt: string | null;
};

export type AdminBuncheolMemberItem = {
  buncheolMemberId: string;
  memberName: string | null;
  price: number;
  accessType: "OPEN" | "CODE_ONLY";
  taken: boolean;
  activeCode: AdminParticipationCodeItem | null;
};

function getAdminParticipationCodeItem(
  value: unknown,
): AdminParticipationCodeItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const codeId = getOptionalStringValue(value, ["codeId", "id"]);
  const code = getOptionalStringValue(value, ["code"]);

  if (!codeId || !code) {
    return null;
  }

  const status = getOptionalStringValue(value, ["status"])?.toUpperCase();

  return {
    codeId,
    code,
    buncheolId: getOptionalStringValue(value, ["buncheolId"]) ?? "",
    buncheolMemberId: getOptionalStringValue(value, ["buncheolMemberId"]) ?? null,
    memberName: getOptionalStringValue(value, ["memberName"]) ?? null,
    issuedTo: getOptionalStringValue(value, ["issuedTo"]) ?? null,
    status:
      status === "EXPIRED" || status === "USED" || status === "REVOKED"
        ? status
        : "ACTIVE",
    issuedAt: getOptionalStringValue(value, ["issuedAt"]) ?? null,
    expiresAt: getOptionalStringValue(value, ["expiresAt"]) ?? null,
    issuedAtText: getOptionalStringValue(value, ["issuedAtText"]) ?? null,
    expiresAtText: getOptionalStringValue(value, ["expiresAtText"]) ?? null,
    usedAt: getOptionalStringValue(value, ["usedAt"]) ?? null,
    usedParticipationId:
      getOptionalStringValue(value, ["usedParticipationId"]) ?? null,
    revokedAt: getOptionalStringValue(value, ["revokedAt"]) ?? null,
  };
}

function getAdminBuncheolMemberItem(value: unknown): AdminBuncheolMemberItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const buncheolMemberId = getOptionalStringValue(value, ["buncheolMemberId"]);

  if (!buncheolMemberId) {
    return null;
  }

  return {
    buncheolMemberId,
    memberName: getOptionalStringValue(value, ["memberName"]) ?? null,
    price: getNumberValue(value, ["price"]) ?? 0,
    accessType:
      getOptionalStringValue(value, ["accessType"])?.toUpperCase() === "CODE_ONLY"
        ? "CODE_ONLY"
        : "OPEN",
    taken: getBooleanValue(value, ["taken"]) === true,
    activeCode: getAdminParticipationCodeItem(
      isRecord(value) ? value.activeCode : null,
    ),
  };
}

export async function requestAdminBuncheolMembers(
  accessToken: string,
  buncheolId: string,
): Promise<AdminBuncheolMemberItem[]> {
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/admin/buncheols/${encodeURIComponent(buncheolId)}/members`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    },
    "슬롯 목록을 불러오지 못했어요.",
  );
  const body = await parseAdminResponse<unknown>(response);
  const rows = Array.isArray(body)
    ? body
    : isRecord(body)
      ? getNestedRecordListValue(body, ["items", "content", "list", "data"])
      : [];

  return rows
    .map(getAdminBuncheolMemberItem)
    .filter((item): item is AdminBuncheolMemberItem => item !== null);
}

export async function requestAdminParticipationCodes(
  accessToken: string,
  buncheolId: string,
): Promise<AdminParticipationCodeItem[]> {
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/admin/buncheols/${encodeURIComponent(buncheolId)}/participation-codes`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "GET",
    },
    "발급 이력을 불러오지 못했어요.",
  );
  const body = await parseAdminResponse<unknown>(response);
  const rows = Array.isArray(body)
    ? body
    : isRecord(body)
      ? getNestedRecordListValue(body, ["items", "content", "list", "data"])
      : [];

  return rows
    .map(getAdminParticipationCodeItem)
    .filter((item): item is AdminParticipationCodeItem => item !== null);
}

export async function requestAdminParticipationCodeIssue(
  accessToken: string,
  buncheolId: string,
  body: {
    buncheolMemberId: number;
    issuedTo?: string | null;
    validHours: number;
    reissue?: boolean;
  },
): Promise<AdminParticipationCodeItem> {
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/admin/buncheols/${encodeURIComponent(buncheolId)}/participation-codes`,
    {
      body: JSON.stringify({
        buncheolMemberId: body.buncheolMemberId,
        ...(body.issuedTo ? { issuedTo: body.issuedTo } : {}),
        validHours: body.validHours,
        reissue: body.reissue === true,
      }),
      credentials: "include",
      headers: getJsonHeaders(accessToken),
      method: "POST",
    },
    "코드 발급 요청이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
  );
  const item = getAdminParticipationCodeItem(
    await parseAdminResponse<unknown>(response),
  );

  if (!item) {
    throw new Error("발급 결과를 확인할 수 없어요.");
  }

  return item;
}

/** 활성 참여가 있는 슬롯은 서버가 거부한다. */
export async function requestAdminMemberAccessTypeChange(
  accessToken: string,
  buncheolId: string,
  buncheolMemberId: string,
  accessType: "OPEN" | "CODE_ONLY",
) {
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/admin/buncheols/${encodeURIComponent(buncheolId)}/members/${encodeURIComponent(buncheolMemberId)}`,
    {
      body: JSON.stringify({ accessType }),
      credentials: "include",
      headers: getJsonHeaders(accessToken),
      method: "PATCH",
    },
    "슬롯 전환 요청이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
  );

  if (!response.ok) {
    throw new ApiRequestError(await parseErrorMessage(response), response.status);
  }
}

export async function requestAdminParticipationCodeRevoke(
  accessToken: string,
  codeId: string,
) {
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/admin/participation-codes/${encodeURIComponent(codeId)}`,
    {
      credentials: "include",
      headers: getAuthHeaders(accessToken),
      method: "DELETE",
    },
    "코드 폐기 요청이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
  );

  if (!response.ok) {
    throw new ApiRequestError(await parseErrorMessage(response), response.status);
  }
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

export type AdminImpersonationToken = {
  targetUserId: string;
  accessToken: string;
  expiresInSeconds: number;
};

// 관리자가 문의 재현용으로 대상 유저의 짧은 수명 유저 토큰(ROLE_USER)을 발급받는다.
// 반환 토큰은 유저 auth-store 에 넣으면 그 유저 세션이 재현된다. 사유(reason)는 서버 감사 로그에 남는다.
export async function requestAdminImpersonationToken(
  accessToken: string,
  userId: string,
  reason: string,
): Promise<AdminImpersonationToken> {
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/admin/users/${userId}/impersonation-token`,
    {
      body: JSON.stringify({ reason }),
      credentials: "include",
      headers: getJsonHeaders(accessToken),
      method: "POST",
    },
    "재현용 토큰 발급이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
  );
  const body = await parseAdminResponse<{
    targetUserId?: unknown;
    accessToken?: unknown;
    expiresInSeconds?: unknown;
  }>(response);

  if (typeof body.accessToken !== "string") {
    throw new Error("재현용 토큰을 확인할 수 없어요.");
  }

  return {
    accessToken: body.accessToken,
    expiresInSeconds:
      typeof body.expiresInSeconds === "number" ? body.expiresInSeconds : 0,
    targetUserId: getOptionalIdString(body.targetUserId) ?? userId,
  };
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

export async function requestAdminReceiptConfirmation(
  accessToken: string,
  deliveryIds: string[],
) {
  const response = await fetchWithTimeout(
    `${getVersionedApiBaseUrl()}/admin/deliveries/receipt`,
    {
      body: JSON.stringify({
        deliveryIds: deliveryIds.map(Number),
      }),
      credentials: "include",
      headers: getJsonHeaders(accessToken),
      method: "POST",
    },
    "수령완료 요청이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
  );
  const body = await parseAdminResponse<{
    succeededIds?: unknown;
    failures?: unknown;
  }>(response);

  return getAdminBulkResult(body);
}
