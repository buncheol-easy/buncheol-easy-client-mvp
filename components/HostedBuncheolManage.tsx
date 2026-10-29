"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { BackIcon, PlusIcon } from "@/components/icons";
import {
  ConfirmSheet,
  type ConfirmSheetRequest,
} from "@/components/ConfirmSheet";
import { HelpText } from "@/components/HelpText";
import { StaffContactLink } from "@/components/StaffContactLink";
import { StatusTag, type StatusTagTone } from "@/components/StatusTag";
import { Switch } from "@/components/Switch";
import { useAppToast } from "@/components/Toast";
import {
  acceptBundle,
  addBuncheolMember,
  ApiRequestError,
  BUNCHEOL_CONFIRM_LIST_CHANGED_CODE,
  confirmBuncheol,
  confirmBundlePayment,
  isSyntheticParticipantName,
  rejectBundle,
  releaseBundle,
  removeBuncheolMember,
  requestBuncheolDetail,
  requestBuncheolManagement,
  requestDeliveryTrackingRegistration,
  requestGroupMembers,
  requestGroups,
  requestPaymentConfirmation,
  setExtraRecruit,
  updateBuncheolOpenChatUrl,
  type BuncheolDetail,
  type BuncheolManagementDetail,
  type BuncheolManagementOption,
  type BuncheolManagementParticipant,
  type BuncheolManagementWinner,
  type ConfirmCancelParticipation,
} from "@/lib/auth-api";
import {
  getDeliveryStatusLabel as getCentralDeliveryStatusLabel,
  getFlowType,
  getHostedBuncheolStatusBadge,
  isBuncheolCancelledStatus,
  isBuncheolConfirmedStatus,
  isBuncheolPaymentCollectingStatus,
  isBuncheolRecruitingStatus,
  isAwaitingHostAccept,
  AUTO_CONFIRM_NOTICE,
  getConfirmCheckLine,
  isConfirmCheckReady,
  isDeliveryShippingStatus,
  isParticipationAppliedStatus,
  isParticipationAwaitingPaymentStatus,
  isParticipationCancelledStatus,
  isParticipationConfirmedStatus,
  isParticipationPaymentSentStatus,
  formatMemberCount,
} from "@/lib/buncheol-states";
import { rankGroupSearchResults } from "@/lib/group-presenters";
import {
  EXTRA_ACCEPT_ANCHOR_ID,
  hasSeenExtraRecruitPrompt,
  markExtraRecruitPromptSeen,
} from "@/lib/extra-recruit";
import { normalizeOpenChatUrlInput } from "@/lib/open-chat-url";
import { buncheolsQueryKey } from "@/lib/query-keys";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import { createLoginHref } from "@/lib/auth-navigation";
import { getFreshAccessToken } from "@/lib/auth-session";

type HostedBuncheolManageProps = {
  id: string;
  onBack?: () => void;
};

type DeliveryState = {
  isShipped: boolean;
  trackingNumber: string;
};

// lib/auth-api.ts 의 같은 이름 함수와 규칙을 맞춘다 — 0원은 「0원」, 값을 모를 때(null·NaN·음수)만 "-".
function formatWonAmount(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value < 0) {
    return "-";
  }

  return `${value.toLocaleString("ko-KR")}원`;
}

// 입금자명 표기 규칙. 개최자가 통장에서 대조하는 이름이라 확인 시트 문구와 목록 행이 반드시 같은 값을
// 써야 한다 — 세 곳에 흩어져 있던 같은 식을 모았다(한쪽만 바뀌면 시트와 행의 이름이 조용히 갈린다).
function getDepositorName(participant: BuncheolManagementParticipant) {
  // 파서(lib/auth-api.ts)가 depositorName 안에서 이미 refundAccount.holder 를 흡수하므로
  // 여기서 holder 를 다시 보면 도달 불가 분기가 된다 — 닉네임 폴백만 남긴다.
  const name = participant.depositorName || participant.participantNickname;
  // 파서 합성 폴백(「참여 {id}」)은 통장 대조에 쓸 수 없다 — 입금자명 노출 지점 전부가
  // 이 함수를 거치므로 여기 한 곳에서 흡수한다.
  return isSyntheticParticipantName(name) ? "확인 필요" : name;
}

function formatKoreaDateTime(value: string | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  /*
   * 참여 내역·개최 기록과 같은 "8월 12일 17:30" 모양으로 맞춘다.
   * 같은 정보가 화면마다 "8.12 17시" / "2026년 07월 05일 14시" / "2026. 12. 22. 20:00"
   * 세 가지로 보이고 있었다. 연도는 올해가 아닐 때만 붙인다.
   */
  const parts = new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "numeric",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(date);
  const partMap = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const currentYear = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(new Date());
  const yearPrefix = currentYear.includes(partMap.year)
    ? ""
    : `${partMap.year}년 `;

  return `${yearPrefix}${partMap.month}월 ${partMap.day}일 ${partMap.hour}:${partMap.minute}`;
}

// 금액을 하나도 모르면 0 이 아니라 null — 0 은 「0원」으로 그려져 실제 0원 자리와 구분되지 않는다.
function getHighestBidAmount(option: BuncheolManagementOption) {
  return (
    option.currentHighestBid ??
    option.winner?.paymentAmount ??
    option.winner?.bidAmount ??
    null
  );
}

function getWinnerBidAmount(option: BuncheolManagementOption) {
  return option.winner?.paymentAmount ?? option.winner?.bidAmount ?? null;
}

// 개최 목록 카드와 같은 함수·같은 기준(서버 원본 마감값)으로 판정한다 — 카드 「종료」를 눌러 들어왔는데
// 머리가 「진행 확정」이면 두 화면이 갈린다.
function getManagementStatusBadge(detail: BuncheolManagementDetail) {
  return getHostedBuncheolStatusBadge({
    ended: detail.ended,
    isDeadlinePassed: isPastDateTime(detail.deadline),
    status: detail.status,
  });
}

function isPastDateTime(value: string | undefined) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

function getShippingMethodLabel(method: string | undefined) {
  if (!method) {
    return "";
  }

  if (method === "GS25_HALF") {
    return "GS25 반값택배";
  }

  if (method === "CU_HALF") {
    return "CU 알뜰택배";
  }

  return method;
}

// 운송장 입력 전(SNAPSHOTTED)에는 배송 상태를 표시하지 않는다.
function getDeliveryStatusLabel(status: string | undefined) {
  if (!status || status === "SNAPSHOTTED") {
    return "";
  }

  return getCentralDeliveryStatusLabel(status);
}

// 개최자가 운송장을 쓸 때 그대로 옮겨 적는 번호다 — 하이픈 없이 붙어 있으면 자릿수를
// 눈으로 세게 된다. 저장 값은 건드리지 않고 표시할 때만 끊어 준다.
function formatPhoneNumberForDisplay(value: string) {
  const digits = value.replace(/\D/g, "");

  // 10자리(01x-xxx-xxxx) / 11자리(01x-xxxx-xxxx). 가운데 자릿수가 다르다.
  if (/^01\d{8}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (/^01\d{9}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return value;
}

function getWinnerReceiverLabel(
  winner: BuncheolManagementWinner | null | undefined,
) {
  const phoneNumber = winner?.receiverPhoneNumber ?? "";

  return phoneNumber ? formatPhoneNumberForDisplay(phoneNumber) : "";
}

function getPaymentStatusLabel(winner: BuncheolManagementWinner | null) {
  if (!winner) {
    return "참여 없음";
  }

  if (
    winner.paymentConfirmedAt ||
    isParticipationConfirmedStatus(winner.paymentStatus)
  ) {
    return "입금 확인 완료";
  }

  if (isParticipationCancelledStatus(winner.paymentStatus)) {
    return "참여 취소";
  }

  // C2C "보냈어요" — 참여자가 입금을 마쳤다고 알린 상태라 개최자에게 확인을 재촉한다.
  if (isParticipationPaymentSentStatus(winner.paymentStatus)) {
    return "입금 확인 필요";
  }

  if (isParticipationAwaitingPaymentStatus(winner.paymentStatus)) {
    return "입금 대기";
  }

  // 알 수 없는 상태를 "입금 대기"로 접으면 개최자에게 틀린 신호가 되므로 raw 를 유지한다.
  return winner.paymentStatus ?? "입금 대기";
}

export type ManagementBundle = {
  key: string;
  bundleId: string | null;
  slots: BuncheolManagementParticipant[];
};

// 활성 참여를 묶음으로 접는다. 묶음 = 이체 1회 · 택배 1개이고, 「보냈어요」·입금확인이 그 단위로 돈다.
// 묶음이 없는 구 행은 자기 자신이 한 묶음이다.
function getParticipantBundles(
  participants: BuncheolManagementParticipant[],
): ManagementBundle[] {
  const order: string[] = [];
  const byKey = new Map<string, ManagementBundle>();

  for (const participant of participants) {
    const key = participant.bundleId ?? `p:${participant.participationId}`;
    const bundle = byKey.get(key);

    if (bundle) {
      bundle.slots.push(participant);
      continue;
    }

    order.push(key);
    byKey.set(key, {
      key,
      bundleId: participant.bundleId ?? null,
      slots: [participant],
    });
  }

  return order.map((key) => byKey.get(key)!);
}

// 파서 최종 폴백이 리터럴 "멤버" 라, 그대로 찍으면 칩에 "멤버" 가 뜬다.
function getSlotMemberLabel(slot: BuncheolManagementParticipant) {
  const name = slot.memberName?.trim();

  return !name || name === "멤버" ? "멤버 확인 필요" : name;
}

// 확인 시트에서 참여자를 부르는 이름. 닉네임이 파서 합성 폴백이면 입금자명으로 부른다.
function getParticipantLabel(participant: BuncheolManagementParticipant) {
  return isSyntheticParticipantName(participant.participantNickname)
    ? getDepositorName(participant)
    : participant.participantNickname;
}

// 수락·거절 본문에 실을 자리 — 서버가 수락 대상으로 내려 준 자리만. 옛 응답(null)이면 버튼을 그리지 않는다.
function getAcceptTargetIds(bundle: ManagementBundle) {
  return bundle.slots
    .filter((slot) => slot.acceptTarget === true)
    .map((slot) => slot.participationId);
}

// 「제외」 버튼은 기한 전(꺼짐)과 기한 지남(켜짐)에만 그린다. 판정은 묶음 단위라 자리마다 같다.
function getBundleReleasability(bundle: ManagementBundle) {
  const releasability = bundle.slots[0]?.releasability ?? null;

  return releasability === "RELEASABLE" || releasability === "BEFORE_DUE"
    ? releasability
    : null;
}

// 묶음 id 가 없으면 「입금 확인」을 서버에 보낼 수 없다. 되돌릴 수 없다고 묻는 시트를
// 통과한 뒤 실패하지 않게, 버튼을 막고 이 문구를 미리 보여 준다.
// 입금 기한이 지나면 서버 판정(confirmCheck)이 바뀌므로 그 시각에 관리 응답을 다시 받는다.
// 서버 시계가 조금 늦어도 바뀐 값을 받도록 몇 초 뒤에 부른다. setTimeout 상한(약 24.8일)을 넘으면 예약하지 않는다.
const PAYMENT_DUE_RELOAD_DELAY_MS = 5_000;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

const MISSING_BUNDLE_MESSAGE =
  "묶음 정보가 없어 이 참여를 처리할 수 없어요. 고객센터로 문의해 주세요.";

function getParticipantsByOptionId(
  participants: BuncheolManagementParticipant[],
) {
  return participants.reduce(
    (groups, participant) => {
      if (!participant.buncheolMemberId) {
        return groups;
      }

      const optionParticipants = groups[participant.buncheolMemberId] ?? [];
      optionParticipants.push(participant);
      groups[participant.buncheolMemberId] = optionParticipants;

      return groups;
    },
    {} as Record<string, BuncheolManagementParticipant[]>,
  );
}

function getCurrentParticipant(
  participants: BuncheolManagementParticipant[],
) {
  return (
    participants.find((participant) =>
      isParticipationAwaitingPaymentStatus(participant.status),
    ) ??
    participants.find((participant) =>
      isParticipationConfirmedStatus(participant.status),
    ) ??
    participants[0] ??
    null
  );
}

function getWinnerFromParticipant(
  participant: BuncheolManagementParticipant,
): BuncheolManagementWinner {
  const delivery = participant.delivery;

  return {
    bidAmount: participant.amount,
    depositorName: participant.participantNickname,
    deliveryId: delivery?.deliveryId,
    deliveryStatus: delivery?.status,
    participationId: participant.participationId,
    paymentAmount: participant.amount,
    paymentConfirmedAt: participant.confirmedAt ?? undefined,
    paymentDueAt: participant.dueAt ?? undefined,
    paymentStatus: participant.status,
    receiverNickname: delivery?.receiverNickname,
    receiverPhoneNumber: delivery?.receiverPhoneNumber,
    shippingMethod: delivery?.shippingMethod,
    storeName: delivery?.storeName,
    trackingNumber: delivery?.trackingNumber,
  };
}

function getManagementOptionsFromDetail(
  managementDetail: BuncheolManagementDetail,
  buncheolDetail: BuncheolDetail,
): BuncheolManagementOption[] {
  const participantsByOptionId = getParticipantsByOptionId(
    managementDetail.participants,
  );

  return buncheolDetail.members.map((member) => {
    const participants = participantsByOptionId[member.id] ?? [];
    const currentParticipant = getCurrentParticipant(participants);
    const highestParticipantAmount = participants.reduce(
      (highestAmount, participant) =>
        Math.max(highestAmount, participant.amount),
      0,
    );

    return {
      buncheolMemberId: member.id,
      currentHighestBid:
        highestParticipantAmount || member.currentBidAmount || member.bidMinPrice,
      memberId: member.memberId,
      memberImage: member.imageUrl,
      memberName: member.name,
      participants,
      participationCount: Math.max(member.participantCount, participants.length),
      // 상세 파서는 서버 members[].price 를 bidMinPrice 로 읽는다(그 응답에 다른 금액 키가 없다).
      price: member.bidMinPrice,
      removed: member.removed,
      saleStatus: member.saleStatus,
      winner: currentParticipant
        ? getWinnerFromParticipant(currentParticipant)
        : null,
    };
  });
}

// 진행 확정 뒤 추가 신청을 받는 중 — 서버 extraRecruiting 과 같은 식(진행 확정 + 스위치 켜짐 + 종료 전).
function isExtraRecruiting(detail: BuncheolManagementDetail) {
  return (
    getFlowType(detail.flowType) === "C2C" &&
    isBuncheolConfirmedStatus(detail.status) &&
    detail.extraRecruitOpen === true &&
    detail.ended === false
  );
}

// 서버 Buncheol.acceptsNewParticipation 과 같은 술어 — 자리 빼기·넣기는 이 구간에서만 통한다(아니면 BCH-060).
// 마감이 지난 모집 중(스케줄러가 넘기기 전)에는 서버가 빈 자리를 전부 CLOSED 로 내려 개최자가 닫은 자리와 구분할 수 없다.
function isAcceptingNewParticipation(detail: BuncheolManagementDetail) {
  if (getFlowType(detail.flowType) !== "C2C") {
    return false;
  }

  return (
    (isBuncheolRecruitingStatus(detail.status) &&
      !isPastDateTime(detail.deadline)) ||
    isExtraRecruiting(detail)
  );
}

// 「빼기」로 뺀 자리. 옛 응답에는 removed 가 없어 CLOSED 로 가른다 — 그때는 진행 확정 뒤 멤버 관리를 그리지 않으므로
// 추가 모집이 꺼져 CLOSED 로 내려오는 빈 자리와 섞이지 않는다.
function isRemovedMemberSlot(option: BuncheolManagementOption) {
  return typeof option.removed === "boolean"
    ? option.removed
    : option.saleStatus?.toUpperCase() === "CLOSED";
}

type MemberSlotState = {
  label: string;
  kind: "empty" | "occupied" | "unknown";
  tone: StatusTagTone;
  // 진행 확정 뒤 추가 신청으로 잡힌 자리 — 상태 칩 앞에 「추가 모집」을 단다.
  extra: boolean;
};

const UNKNOWN_MEMBER_SLOT_STATE: MemberSlotState = {
  extra: false,
  kind: "unknown",
  label: "확인 필요",
  tone: "grey",
};

// 빈 자리인지는 서버 saleStatus 로, 잡힌 자리의 상태는 관리 응답의 참여 상태로 가른다 — saleStatus 는 「보냈어요」를
// 입금 대기로 접고 수락 대기를 신청됨과 가르지 않는다. 모르는 값(롤백 중 CODE_ONLY 등)은 버튼 없이 둔다.
function getMemberSlotState(
  option: BuncheolManagementOption,
  participant: BuncheolManagementParticipant | undefined,
  detail: BuncheolManagementDetail,
): MemberSlotState {
  if (participant) {
    const extra = participant.extra === true;

    if (
      isParticipationConfirmedStatus(participant.status) ||
      participant.confirmedAt
    ) {
      return { extra, kind: "occupied", label: "입금 확인", tone: "black" };
    }

    if (isParticipationPaymentSentStatus(participant.status)) {
      return { extra, kind: "occupied", label: "보냈어요", tone: "lime" };
    }

    if (isParticipationAwaitingPaymentStatus(participant.status)) {
      return { extra, kind: "occupied", label: "입금 대기", tone: "grey" };
    }

    if (isParticipationAppliedStatus(participant.status)) {
      return isAwaitingHostAccept(detail.status, participant.status)
        ? { extra, kind: "occupied", label: "수락 대기", tone: "warning" }
        : { extra, kind: "occupied", label: "신청됨", tone: "grey" };
    }
  }

  switch (option.saleStatus?.toUpperCase()) {
    case "AVAILABLE":
      return isExtraRecruiting(detail)
        ? { extra: false, kind: "empty", label: "모집 중", tone: "open" }
        : { extra: false, kind: "empty", label: "빈 자리", tone: "grey" };
    // 추가 모집이 꺼진 진행 확정 분철은 빈 자리도 CLOSED 로 내려온다. 뺀 자리는 이미 removed 로 걸렀다.
    case "CLOSED":
      return isBuncheolConfirmedStatus(detail.status)
        ? { extra: false, kind: "empty", label: "빈 자리", tone: "grey" }
        : UNKNOWN_MEMBER_SLOT_STATE;
    case "APPLIED":
      return { extra: false, kind: "occupied", label: "신청됨", tone: "grey" };
    // 「보냈어요」도 서버가 AWAITING_PAYMENT 로 접어 내려준다.
    case "AWAITING_PAYMENT":
      return { extra: false, kind: "occupied", label: "입금 대기", tone: "grey" };
    case "SOLD":
      return { extra: false, kind: "occupied", label: "입금 확인", tone: "black" };
    default:
      return UNKNOWN_MEMBER_SLOT_STATE;
  }
}

function formatMemberSlotPrice(price: number | undefined) {
  return typeof price === "number" && Number.isFinite(price)
    ? `${price.toLocaleString("ko-KR")}원`
    : "-";
}

function isMemberPriceInput(rawInput: string) {
  const digits = rawInput.replace(/[^\d]/g, "");

  return digits !== "" && Number(digits) % 100 === 0;
}

type AddMemberCandidate = {
  memberId: string;
  name: string;
  // 닫힌 자리의 이전 가격. 새 멤버면 없다.
  previousPrice?: number;
};

type AddMemberSheetState = {
  closedCandidates: AddMemberCandidate[];
  groupCandidates: AddMemberCandidate[];
  isLoading: boolean;
  loadFailed: boolean;
};

// 관리·상세 응답에 그룹 id 가 없어 수정 폼(UploadProductForm)처럼 그룹 이름으로 찾는다.
// 이름이 비슷한 다른 그룹을 집지 않도록 지금 자리의 멤버가 모두 들어 있는 그룹만 쓴다.
async function requestBuncheolGroupMembers(
  groupName: string,
  slotMemberIds: string[],
) {
  if (!groupName.trim() || slotMemberIds.length === 0) {
    throw new Error("group not found");
  }

  const groups = rankGroupSearchResults(await requestGroups(groupName), groupName);

  for (const group of groups) {
    const members = await requestGroupMembers(group.id);
    const groupMemberIds = new Set(members.map((member) => member.id));

    if (slotMemberIds.every((memberId) => groupMemberIds.has(memberId))) {
      return members;
    }
  }

  throw new Error("group not found");
}

async function requestHostedBuncheolManagement(
  accessToken: string,
  id: string,
) {
  const managementDetail = await requestBuncheolManagement(accessToken, id);

  if (managementDetail.options.length > 0) {
    return managementDetail;
  }

  try {
    const buncheolDetail = await requestBuncheolDetail(accessToken, id);
    const fallbackOptions = getManagementOptionsFromDetail(
      managementDetail,
      buncheolDetail,
    );

    if (fallbackOptions.length === 0) {
      return managementDetail;
    }

    return {
      ...managementDetail,
      optionCount: managementDetail.optionCount || fallbackOptions.length,
      options: fallbackOptions,
    };
  } catch {
    return managementDetail;
  }
}

export function HostedBuncheolManage({
  id,
  onBack,
}: HostedBuncheolManageProps) {
  const router = useRouter();
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const [detail, setDetail] = useState<BuncheolManagementDetail | null>(null);
  const [loadMessage, setLoadMessage] = useState(
    "개최한 분철 정보를 불러오고 있어요.",
  );
  const showToast = useAppToast();
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(
    null,
  );
  const [registeringTrackingId, setRegisteringTrackingId] = useState<
    string | null
  >(null);
  const [deliveryStates, setDeliveryStates] = useState<
    Record<string, DeliveryState>
  >({});
  // C2C 액션(진행 확정·입금확인·운송장·자리 편집) 진행 중 식별자 — 중복 호출 방지.
  const [pendingC2CAction, setPendingC2CAction] = useState<string | null>(null);
  // 되돌리기 어려운 액션의 확인 요청 — 인앱 브라우저 confirm 억제 대응 (ConfirmSheet).
  const [confirmSheetRequest, setConfirmSheetRequest] =
    useState<ConfirmSheetRequest | null>(null);
  const [participantTrackingInputs, setParticipantTrackingInputs] = useState<
    Record<string, string>
  >({});
  const [editingTrackingOwnerId, setEditingTrackingOwnerId] = useState<
    string | null
  >(null);
  // 오픈채팅 링크 수정 시트 — null 이면 닫힘. 전체 수정(모집중 전용)과 달리 상태와 무관하게 열린다.
  const [openChatUrlDraft, setOpenChatUrlDraft] = useState<string | null>(null);
  const [openChatUrlError, setOpenChatUrlError] = useState("");
  const [isSavingOpenChatUrl, setIsSavingOpenChatUrl] = useState(false);
  const queryClient = useQueryClient();
  // 멤버 추가 시트 — null 이면 닫힘.
  const [addMemberSheet, setAddMemberSheet] =
    useState<AddMemberSheetState | null>(null);
  const [addMemberSelectedId, setAddMemberSelectedId] = useState<
    string | null
  >(null);
  const [addMemberPriceDraft, setAddMemberPriceDraft] = useState("");
  const [addMemberError, setAddMemberError] = useState("");
  // 시트를 닫았다 다시 열면 앞선 그룹 멤버 조회가 늦게 끝나 새 목록을 덮지 않게 한다.
  const addMemberLoadIdRef = useRef(0);

  useEffect(() => {
    const accessToken = authState.isLoggedIn
      ? authState.accessToken ?? undefined
      : undefined;
    let isActive = true;

    if (!authState.isLoggedIn || !accessToken) {
      const returnHref = `/products/${encodeURIComponent(id)}/manage`;
      const frame = window.requestAnimationFrame(() => {
        if (!isActive) {
          return;
        }

        setDetail(null);
        setLoadMessage("로그인 후 관리할 수 있어요.");
        router.replace(
          createLoginHref({ cancelTo: "/", returnTo: returnHref }),
        );
      });

      return () => {
        isActive = false;
        window.cancelAnimationFrame(frame);
      };
    }

    // 만료된 토큰은 요청 전에 재발급한다. 토큰이 바뀌면 이 effect 가 새 토큰으로 다시 돌고,
    // null(재발급 실패 → 로그인 정보 삭제)이면 로그인 화면 이동이 처리하므로 loadMessage 를 건드리지 않는다.
    getFreshAccessToken()
      .then((freshAccessToken) =>
        isActive && freshAccessToken === accessToken
          ? requestHostedBuncheolManagement(accessToken, id)
          : null,
      )
      .then((nextDetail) => {
        if (!isActive || !nextDetail) {
          return;
        }

        setDetail(nextDetail);
        setLoadMessage("");
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setDetail(null);
        // 아래 화면이 "메시지 없음 = 불러오는 중"으로 분기하므로 빈 문자열을 넣으면 안 된다.
        setLoadMessage(
          (error instanceof Error ? error.message.trim() : "") ||
            "개최한 분철 정보를 불러오지 못했어요.",
        );
      });

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, authState.isLoggedIn, id, router]);

  // 버튼은 계속 서버 판정(진행 확정 confirmCheck, 「제외」 releasability)만 본다. 열어 둔 채 기한이 지나도 켜지도록
  // 아직 오지 않은 기한 가운데 가장 가까운 시각에 한 번 다시 불러온다.
  const reloadDueTimesKey = [
    detail?.confirmCheck === "BEFORE_DUE" ||
    detail?.confirmCheck === "NO_CONFIRMED"
      ? detail.paymentDueAt
      : null,
    ...(detail?.participants ?? []).map((participant) =>
      participant.releasability === "BEFORE_DUE" ? participant.dueAt : null,
    ),
  ]
    .flatMap((value) => {
      const time = value ? new Date(value).getTime() : Number.NaN;

      return Number.isNaN(time) ? [] : [time];
    })
    .sort((a, b) => a - b)
    .join(",");

  useEffect(() => {
    const now = Date.now();
    const dueTime = reloadDueTimesKey
      .split(",")
      .map(Number)
      .find((time) => time > now);

    if (dueTime === undefined) {
      return;
    }

    const delay = dueTime - now + PAYMENT_DUE_RELOAD_DELAY_MS;

    if (delay > MAX_TIMER_DELAY_MS) {
      return;
    }

    let isActive = true;
    const timer = window.setTimeout(() => {
      void getFreshAccessToken()
        .then((accessToken) =>
          isActive && accessToken
            ? requestHostedBuncheolManagement(accessToken, id)
            : null,
        )
        .then((nextDetail) => {
          if (isActive && nextDetail) {
            setDetail(nextDetail);
          }
        })
        .catch(() => {
          // 다음 동작(새로고침, 다른 버튼)에서 다시 불러온다.
        });
    }, delay);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [id, reloadDueTimesKey]);

  const memberCount = detail?.optionCount ?? detail?.options.length ?? 0;
  const participantCount =
    detail?.totalParticipationCount ??
    detail?.options.reduce(
      (total, option) => total + option.participationCount,
      0,
    ) ??
    0;
  const confirmedCount =
    detail?.confirmedCount ??
    detail?.participants.filter((participant) =>
      isParticipationConfirmedStatus(participant.status),
    ).length ??
    detail?.options.filter((option) =>
      isParticipationConfirmedStatus(option.winner?.paymentStatus),
    ).length ??
    0;
  // 취소분은 서버가 participants 와 분리해 내려준다 — 슬롯을 점유하지 않아 참여 수·정원 집계에 섞이면 안 된다.
  const cancelledParticipants = detail?.cancelledParticipants ?? [];
  // 취소분 대다수는 입금 기한 만료라 돈이 오간 적이 없고, 같은 사람이 재참여해 활성으로도 있다.
  // 🔴 판정 키는 <b>입금확인 시각 하나</b>다. 서버의 needsHostRefund 와 반드시 같아야 한다 —
  // 여기만 「보냈어요」를 포함하면 목록에는 뜨는데 서버가 계좌를 안 내려 <b>계좌가 빈 행</b>이 된다.
  // 「보냈어요」는 자기신고라 개최자가 통장에서 확인한 적이 없는 돈이다.
  const refundTargetParticipants = cancelledParticipants.filter((participant) =>
    Boolean(participant.confirmedAt),
  );
  // 🔴 「보냈어요」만 하고 확인 전에 빠진 건(진행 확정 때 빠진 사람 등)을 <b>따로 센다</b>. 이걸 「금액 없음」에
  // 섞으면 개최자가 "환불할 금액이 없어요" 를 읽는데 실제로는 통장에 돈이 있을 수 있다 — 이체가 통장에
  // 늦게 찍히는 일이 흔하다. 계좌를 못 보여주는 것과 존재 자체를 부정하는 것은 다르다.
  const sentButUnconfirmedCount = cancelledParticipants.filter(
    (participant) => !participant.confirmedAt && participant.paymentSentAt,
  ).length;
  const noTraceCancelledCount =
    cancelledParticipants.length -
    refundTargetParticipants.length -
    sentButUnconfirmedCount;
  const minHeadcount = detail?.minHeadcount ?? 0;
  // 분모(minHeadcount)는 개최 폼의 「최소 진행 멤버 수」다. 서버는 분자·분모를 둘 다 멤버(자리)
  // 수로 비교하므로 분자를 사람 수로 바꾸지 않는다.
  const confirmedProgressLabel = minHeadcount
    ? `${formatMemberCount(confirmedCount)} / 최소 ${minHeadcount}명`
    : formatMemberCount(confirmedCount);
  const confirmedProgressPercent = minHeadcount
    ? Math.min(100, Math.round((confirmedCount / minHeadcount) * 100))
    : participantCount > 0
      ? 100
      : 0;
  const awaitingPaymentCount =
    detail?.options.filter((option) =>
      isParticipationAwaitingPaymentStatus(option.winner?.paymentStatus),
    ).length ?? 0;
  const deliveryReadyCount =
    detail?.options.filter((option) => {
      const isPaymentConfirmed =
        isParticipationConfirmedStatus(option.winner?.paymentStatus) ||
        Boolean(option.winner?.paymentConfirmedAt);

      return (
        isPaymentConfirmed &&
        Boolean(option.winner?.deliveryId) &&
        !option.winner?.trackingNumber
      );
    }).length ?? 0;
  const trackingCompletedCount =
    detail?.options.filter((option) =>
      Boolean(option.winner?.trackingNumber),
    ).length ?? 0;
  // ── C2C 파생값 (docs/46 §4.6 — 관리 응답은 활성 참여 전건을 내려준다) ──
  const isC2C = getFlowType(detail?.flowType) === "C2C";
  // 아래 카운트들은 전부 멤버(자리) 수다(멤버 슬롯 점유 건수). 표기는 formatMemberCount 참조.
  const activeC2CParticipants = (detail?.participants ?? []).filter(
    (participant) => !isParticipationCancelledStatus(participant.status),
  );
  // 수락을 기다리는 추가 신청을 맨 위로 올린다 — 「개최한 분철」의 「수락해 주세요」가 여기로 데려온다.
  const c2cBundles = getParticipantBundles(activeC2CParticipants).sort(
    (a, b) =>
      Number(getAcceptTargetIds(b).length > 0) -
      Number(getAcceptTargetIds(a).length > 0),
  );
  const firstPendingAcceptBundleKey = c2cBundles.find(
    (bundle) => getAcceptTargetIds(bundle).length > 0,
  )?.key;
  const hasScrolledToPendingAcceptRef = useRef(false);

  // 관리 응답이 온 뒤에야 카드가 생겨 브라우저의 주소 조각 이동이 닿지 않는다. 처음 한 번만 직접 내려 준다.
  useEffect(() => {
    if (
      !firstPendingAcceptBundleKey ||
      hasScrolledToPendingAcceptRef.current ||
      window.location.hash !== `#${EXTRA_ACCEPT_ANCHOR_ID}`
    ) {
      return;
    }

    hasScrolledToPendingAcceptRef.current = true;
    document
      .getElementById(EXTRA_ACCEPT_ANCHOR_ID)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [firstPendingAcceptBundleKey]);

  const c2cAppliedCount = activeC2CParticipants.filter((participant) =>
    isParticipationAppliedStatus(participant.status),
  ).length;
  const isUnderMinHeadcount =
    minHeadcount > 0 && c2cAppliedCount < minHeadcount;
  const c2cAwaitingCount = activeC2CParticipants.filter((participant) =>
    isParticipationAwaitingPaymentStatus(participant.status),
  ).length;
  const c2cPaymentSentCount = activeC2CParticipants.filter((participant) =>
    isParticipationPaymentSentStatus(participant.status),
  ).length;
  const c2cConfirmedCount = activeC2CParticipants.filter(
    (participant) =>
      isParticipationConfirmedStatus(participant.status) ||
      Boolean(participant.confirmedAt),
  ).length;
  // 진행 확정 버튼은 서버 판정만 본다. 옛 서버라 값이 없으면 꺼 둔다.
  const canConfirmBuncheol = isConfirmCheckReady(detail?.confirmCheck);
  const confirmCheckLine = getConfirmCheckLine(detail?.confirmCheck);
  // 회원 개최 배송은 진행 확정 때 생기고 운송장도 그 뒤에만 받는다(서버 DLV-009). 옛 서버가 입금 확인 때
  // 만들어 둔 배송이 입금 수집 중 분철에 남아 있어도 운송장 칸을 열지 않는다.
  const isC2CShippingOpen = isBuncheolConfirmedStatus(detail?.status);
  // 🔴 배송 집계는 <b>배송 단위</b>다. 참여 단위로 세면 한 묶음의 두 슬롯이 같은 배송을 물고 있을 때
  // 목록에는 운송장 입력칸이 1개인데 "운송장 대기 2건" 으로 뜬다. deliveryId 로 중복을 제거한다.
  const c2cDeliveries = new Map<
    string,
    { confirmed: boolean; trackingNumber?: string | null }
  >();

  for (const participant of isC2CShippingOpen ? activeC2CParticipants : []) {
    const deliveryId = participant.delivery?.deliveryId;

    if (!deliveryId) {
      continue;
    }

    const confirmed =
      isParticipationConfirmedStatus(participant.status) ||
      Boolean(participant.confirmedAt);
    const previous = c2cDeliveries.get(deliveryId);
    c2cDeliveries.set(deliveryId, {
      // 같은 배송을 문 슬롯 중 하나라도 확정이면 그 택배는 나가야 한다.
      confirmed: confirmed || Boolean(previous?.confirmed),
      trackingNumber:
        participant.delivery?.trackingNumber ?? previous?.trackingNumber ?? null,
    });
  }

  const c2cDeliveryReadyCount = [...c2cDeliveries.values()].filter(
    (delivery) => delivery.confirmed && !delivery.trackingNumber,
  ).length;
  const c2cTrackingCompletedCount = [...c2cDeliveries.values()].filter(
    (delivery) => Boolean(delivery.trackingNumber),
  ).length;
  // 「멤버 관리」 — 뺀 자리는 목록에서 숨기고 「멤버 추가」에서 다시 보여 준다.
  const memberSlots = (detail?.options ?? []).filter(
    (option) => !isRemovedMemberSlot(option),
  );
  const closedMemberSlots = (detail?.options ?? []).filter(isRemovedMemberSlot);
  // 서버의 마지막 자리 판정(BCH-120)·최소 인원 하향과 같은 수 — 닫히지 않은 자리.
  const openMemberSlotCount = memberSlots.length;
  // 관리 응답이 자리 목록을 직접 실으면 상세 보충을 건너뛰는데, 그 파서는 saleStatus 를 읽지 않는다.
  // 닫힌 자리·신청자 판정 근거가 없으면 「멤버 관리」 카드를 띄우지 않는다.
  const hasMemberSlotSaleStatus =
    (detail?.options ?? []).length > 0 &&
    (detail?.options ?? []).every((option) => Boolean(option.saleStatus));
  const activeParticipantBySlotId = new Map(
    activeC2CParticipants.flatMap((participant) =>
      participant.buncheolMemberId
        ? [[participant.buncheolMemberId, participant] as const]
        : [],
    ),
  );
  const memberSlotStates = detail
    ? memberSlots.map((option) => ({
        option,
        state: getMemberSlotState(
          option,
          activeParticipantBySlotId.get(option.buncheolMemberId),
          detail,
        ),
      }))
    : [];
  const isConfirmedC2C = isC2C && isBuncheolConfirmedStatus(detail?.status);
  // 진행 확정 뒤 「멤버 관리」와 스위치. 스위치 값이 없는 옛 서버거나 끝난 분철이면 그리지 않는다.
  const showsExtraRecruitControls =
    isConfirmedC2C &&
    detail?.ended === false &&
    typeof detail.extraRecruitOpen === "boolean";
  const isExtraRecruitOn = detail ? isExtraRecruiting(detail) : false;
  // 진행 확정 뒤 처음 들어올 때 추가 모집을 권하는 시트에 올릴 빈 자리(뺀 자리와 잡힌 자리 제외).
  const extraRecruitPromptSlotNamesKey =
    showsExtraRecruitControls && !isExtraRecruitOn
      ? memberSlotStates
          .filter(({ state }) => state.kind === "empty")
          .map(({ option }) => option.memberName)
          .join("\n")
      : "";
  const canEditMemberSlots = detail ? isAcceptingNewParticipation(detail) : false;
  // 진행 확정 분철의 신청은 수락을 기다리는 추가 신청뿐이다.
  const c2cAppliedTileLabel = isConfirmedC2C ? "수락 대기" : "신청";

  function updateTrackingNumber(optionId: string, trackingNumber: string) {
    setDeliveryStates((current) => ({
      ...current,
      [optionId]: {
        isShipped: current[optionId]?.isShipped ?? false,
        trackingNumber,
      },
    }));
  }

  async function completeShipping(option: BuncheolManagementOption) {
    const optionId = option.buncheolMemberId;
    const deliveryId = option.winner?.deliveryId;
    const trackingNumber = (
      deliveryStates[optionId]?.trackingNumber ??
      option.winner?.trackingNumber ??
      ""
    ).trim();

    if (!deliveryId) {
      showToast("운송장을 등록할 배송 ID가 없어요.", "error");
      return;
    }

    if (!trackingNumber) {
      showToast("운송장 번호를 입력해 주세요.", "error");
      return;
    }

    setRegisteringTrackingId(deliveryId);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        return;
      }

      await requestDeliveryTrackingRegistration(
        accessToken,
        deliveryId,
        trackingNumber,
      );
      const nextDetail = await requestHostedBuncheolManagement(accessToken, id);

      setDetail(nextDetail);
      setDeliveryStates((current) => ({
        ...current,
        [optionId]: {
          isShipped: true,
          trackingNumber,
        },
      }));
      showToast("운송장 번호를 등록했어요.", "success");
    } catch (error: unknown) {
      showToast(
        error instanceof Error
          ? error.message
          : "운송장 번호를 등록하지 못했어요.",
        "error",
      );
    } finally {
      setRegisteringTrackingId(null);
    }
  }

  async function confirmPayment(option: BuncheolManagementOption) {
    const participationId = option.winner?.participationId;

    if (!option.winner || confirmingPaymentId) {
      return;
    }

    if (!participationId) {
      showToast("입금 확인에 필요한 참여 ID가 없어요.", "error");
      return;
    }

    setConfirmingPaymentId(participationId);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        return;
      }

      await requestPaymentConfirmation(accessToken, participationId, {
        ignoreConflict: true,
      });
      const nextDetail = await requestHostedBuncheolManagement(accessToken, id);

      setDetail(nextDetail);
      showToast("입금 확인이 완료됐어요.", "success");
    } catch (error: unknown) {
      showToast(
        error instanceof Error
          ? error.message
          : "입금 확인을 처리하지 못했어요.",
        "error",
      );
    } finally {
      setConfirmingPaymentId(null);
    }
  }


  async function reloadManagementDetail(accessToken: string) {
    const nextDetail = await requestHostedBuncheolManagement(accessToken, id);

    setDetail(nextDetail);

    return nextDetail;
  }

  function openOpenChatUrlSheet() {
    setOpenChatUrlError("");
    setOpenChatUrlDraft(detail?.openChatUrl ?? "");
  }

  async function saveOpenChatUrl() {
    if (openChatUrlDraft === null || isSavingOpenChatUrl) {
      return;
    }

    const trimmedDraft = openChatUrlDraft.trim();
    // 빈 값은 "링크 제거" 로 그대로 보낸다 — 서버가 빈 문자열을 제거로 받는다.
    const normalizedUrl = trimmedDraft ? normalizeOpenChatUrlInput(trimmedDraft) : "";

    if (normalizedUrl === null) {
      setOpenChatUrlError("카카오 오픈채팅 주소만 등록할 수 있어요.");
      return;
    }

    setIsSavingOpenChatUrl(true);

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        // 스토어를 지우지 않고 null 이 돌아오는 경로가 있어 안내가 없으면 눌러도 아무 일이 없다 (다른 C2C 액션과 같은 문구).
        setOpenChatUrlError("로그인이 만료됐어요. 다시 로그인해 주세요.");
        return;
      }

      await updateBuncheolOpenChatUrl(accessToken, id, normalizedUrl);

      // 저장 성공 처리를 재조회보다 먼저 한다 — 순서를 바꾸면 GET 이 흔들릴 때
      // 이미 반영된 저장이 "저장 실패" 로 보이고 개최자가 다시 누른다.
      setOpenChatUrlDraft(null);
      setOpenChatUrlError("");
      showToast(
        normalizedUrl ? "오픈채팅 링크를 저장했어요." : "오픈채팅 링크를 지웠어요.",
        "success",
      );

      try {
        await reloadManagementDetail(accessToken);
      } catch {
        showToast("저장했어요. 화면 갱신에 실패해 잠시 뒤 다시 열어 주세요.");
      }
    } catch (error: unknown) {
      setOpenChatUrlError(
        error instanceof Error ? error.message : "오픈채팅 링크를 저장하지 못했어요.",
      );
    } finally {
      setIsSavingOpenChatUrl(false);
    }
  }

  // 진행 확정 시트. 빠질 참여는 지금 화면이 가진 관리 응답에서 고르고, 요청 본문도 시트에 보여 준
  // 그 목록을 그대로 보낸다. 서버가 상태까지 대조해 그 사이 바뀌었으면 409(BCH-127)로 거절한다.
  function openConfirmBuncheolSheet(targetDetail: BuncheolManagementDetail) {
    const activeParticipants = targetDetail.participants.filter(
      (participant) => !isParticipationCancelledStatus(participant.status),
    );
    const leavingParticipants = activeParticipants.filter(
      (participant) =>
        isParticipationAwaitingPaymentStatus(participant.status) ||
        isParticipationPaymentSentStatus(participant.status),
    );
    const cancelParticipations: ConfirmCancelParticipation[] =
      leavingParticipants.map((participant) => ({
        participationId: participant.participationId,
        status: isParticipationPaymentSentStatus(participant.status)
          ? "PAYMENT_SENT"
          : "AWAITING_PAYMENT",
      }));
    const leavingBundles = getParticipantBundles(leavingParticipants);
    const hasSentBundle = leavingBundles.some((bundle) =>
      bundle.slots.some((slot) => isParticipationPaymentSentStatus(slot.status)),
    );
    const staysCount = activeParticipants.length - leavingParticipants.length;
    const onConfirm = () => {
      setConfirmSheetRequest(null);
      void runConfirmBuncheol(cancelParticipations);
    };

    if (leavingBundles.length === 0) {
      setConfirmSheetRequest({
        confirmLabel: "진행 확정",
        description: `입금이 확인된 멤버 ${staysCount}명으로 진행해요. 확정하면 참여자에게 진행 확정 알림톡이 가고, 운송장을 넣을 수 있어요.`,
        onConfirm,
        title: "분철 진행을 확정할까요?",
        warnings: ["확정한 뒤에는 되돌릴 수 없어요."],
      });
      return;
    }

    setConfirmSheetRequest({
      confirmLabel: "진행 확정",
      description: `아래 멤버 ${leavingParticipants.length}명은 입금이 확인되지 않아 빠지고, 참여자에게 취소 알림톡이 가요.`,
      details: leavingBundles.map((bundle) => {
        const head = bundle.slots[0];
        const total = bundle.slots.reduce((sum, slot) => sum + slot.amount, 0);

        return {
          badge: bundle.slots.some((slot) =>
            isParticipationPaymentSentStatus(slot.status),
          )
            ? "보냈어요"
            : undefined,
          // 「보냈어요」 경고가 통장과 맞춰 보라고 하므로 대조 기준인 입금자명을 함께 보인다(목록 행과 같은 값).
          caption: `입금자명 ${getDepositorName(head)}`,
          label: getParticipantLabel(head),
          value: `${bundle.slots.map(getSlotMemberLabel).join(", ")} · ${formatWonAmount(total)}`,
        };
      }),
      detailsTitle: "빠지는 멤버",
      onConfirm,
      title: `입금된 멤버 ${staysCount}명으로 진행할까요?`,
      warnings: [
        ...(hasSentBundle
          ? [
              "「보냈어요」를 누른 참여자가 있어요. 통장에 입금이 들어왔다면 진행 확정 전에 「입금 확인」을 먼저 눌러 주세요.",
            ]
          : []),
        "빠진 자리는 진행 확정 뒤 추가 모집으로 다시 채울 수 있어요. 확정한 뒤에는 되돌릴 수 없어요.",
      ],
    });
  }

  function requestConfirmBuncheol() {
    if (!detail || pendingC2CAction || !canConfirmBuncheol) {
      return;
    }

    openConfirmBuncheolSheet(detail);
  }

  async function runConfirmBuncheol(
    cancelParticipations: ConfirmCancelParticipation[],
  ) {
    if (pendingC2CAction) {
      return;
    }

    setPendingC2CAction("confirm-buncheol");

    let accessToken: string | null = null;

    try {
      accessToken = await getFreshAccessToken();

      if (!accessToken) {
        showToast("로그인이 만료됐어요. 다시 로그인해 주세요.", "error");
        return;
      }

      await confirmBuncheol(accessToken, id, cancelParticipations);
      // 성공 알림을 재조회보다 먼저 띄운다 — GET 이 실패해도 이미 반영된 확정이 실패로 보이지 않게.
      showToast("진행을 확정했어요. 이제 굿즈 구매와 배송을 진행해 주세요.", "success");

      try {
        await reloadManagementDetail(accessToken);
      } catch {
        // 성공 알림을 그대로 둔다.
      }
    } catch (error: unknown) {
      showToast(
        error instanceof Error
          ? error.message
          : "진행 확정을 처리하지 못했어요.",
        "error",
      );

      if (!accessToken) {
        return;
      }

      try {
        const nextDetail = await reloadManagementDetail(accessToken);

        // 목록이 바뀐 것뿐이면 새 목록으로 시트를 다시 띄워 바로 다시 확인하게 한다.
        if (
          error instanceof ApiRequestError &&
          error.code === BUNCHEOL_CONFIRM_LIST_CHANGED_CODE &&
          isConfirmCheckReady(nextDetail.confirmCheck)
        ) {
          openConfirmBuncheolSheet(nextDetail);
        }
      } catch {
        // 실패 토스트가 이미 떠 있다.
      }
    } finally {
      setPendingC2CAction(null);
    }
  }

  // C2C 묶음 입금확인. 되돌릴 수 없어(참여가 CONFIRMED 로 확정되며 알림톡이 나간다) 확인 시트를 태운다.
  // 이 묶음으로 미확인이 0이 되면 서버가 같은 요청 안에서 분철을 진행 확정한다. 경고는 화면이 가진 상태로 한
  // 예측일 뿐이고, 실제로 확정됐는지는 응답의 buncheolConfirmed 로 본다.
  function requestConfirmBundlePayment(
    bundle: ManagementBundle,
    expectedSlotIds: string[],
  ) {
    if (pendingC2CAction) {
      return;
    }

    const head = bundle.slots[0];
    // 개최자가 통장에서 대조하는 값 그대로 — 입금자명과 묶음 총액. 이체가 한 번이므로 합계로 묻는다.
    const depositorName = getDepositorName(head);
    const total = bundle.slots.reduce((sum, slot) => sum + slot.amount, 0);
    const memberNames = bundle.slots.map(getSlotMemberLabel).join(", ");
    const onConfirm = () => {
      setConfirmSheetRequest(null);
      void runConfirmBundlePayment(bundle, expectedSlotIds);
    };

    // 진행 확정 뒤에 확인하는 묶음은 추가 신청뿐이다. 서버가 그 묶음의 배송을 바로 만들어 운송장 칸이 열린다.
    if (isConfirmedC2C) {
      setConfirmSheetRequest({
        confirmLabel: "입금 확인",
        description: "통장에 들어온 걸 봤을 때만 눌러 주세요.",
        onConfirm,
        title:
          total > 0
            ? `입금자명 ${depositorName}, ${formatWonAmount(total)} 입금을 확인했나요?`
            : `입금자명 ${depositorName} 입금을 확인했나요?`,
        warnings: [
          "확인하면 운송장 칸이 열리고, 참여자에게 진행 확정 알림톡이 가요.",
        ],
      });
      return;
    }

    const expectedSlotIdSet = new Set(expectedSlotIds);
    const confirmsBuncheol = activeC2CParticipants.every(
      (participant) =>
        expectedSlotIdSet.has(participant.participationId) ||
        isParticipationConfirmedStatus(participant.status) ||
        Boolean(participant.confirmedAt),
    );

    setConfirmSheetRequest({
      confirmLabel: "입금 확인",
      // 합계가 0원이면 「0원을 받으셨나요」가 돼 받을 돈이 있는 것처럼 읽힌다. 0원 슬롯 조합에서
      // 실제로 도달할 수 있어, 받을 금액이 없으면 금액 절을 통째로 뺀다.
      description:
        total > 0
          ? `${depositorName}님의 ${memberNames} ${formatWonAmount(total)}을 받으셨나요? 확인하면 되돌릴 수 없어요.`
          : `${depositorName}님의 ${memberNames} 입금을 받으셨나요? 확인하면 되돌릴 수 없어요.`,
      onConfirm,
      title:
        bundle.slots.length > 1
          ? `멤버 ${bundle.slots.length}명을 한 번에 확인할까요?`
          : "입금을 확인할까요?",
      warnings: confirmsBuncheol
        ? [
            "이번이 마지막 입금 확인이에요. 확인하면 분철이 바로 진행 확정되고, 참여자에게 진행 확정 알림톡이 가요.",
          ]
        : undefined,
    });
  }

  // 묶음 입금확인 — all-or-nothing (docs/70 §5). 슬롯마다 확인하면 묶음 안 상태가 갈려
  // 진행 확정 때 한 묶음의 일부 자리만 빠진다.
  async function runConfirmBundlePayment(
    bundle: ManagementBundle,
    expectedSlotIds: string[],
  ) {
    if (pendingC2CAction) {
      return;
    }

    if (!bundle.bundleId) {
      showToast(MISSING_BUNDLE_MESSAGE, "error");
      return;
    }

    setPendingC2CAction(`confirm:${bundle.key}`);

    let accessToken: string | null = null;

    try {
      accessToken = await getFreshAccessToken();

      if (!accessToken) {
        showToast("로그인이 만료됐어요. 다시 로그인해 주세요.", "error");
        return;
      }

      const { buncheolConfirmed } = await confirmBundlePayment(
        accessToken,
        bundle.bundleId,
        expectedSlotIds,
      );

      // 성공 알림을 재조회보다 먼저 띄운다 — GET 이 실패해도 이미 반영된 확인이 실패로 보이지 않게.
      showToast(
        buncheolConfirmed
          ? "모든 입금이 확인돼 분철이 진행 확정됐어요. 이제 굿즈 구매와 배송을 진행해 주세요."
          : isConfirmedC2C
            ? "입금을 확인했어요. 운송장 칸이 열렸어요"
            : "입금 확인이 완료됐어요.",
        "success",
      );

      try {
        await reloadManagementDetail(accessToken);
      } catch {
        // 성공 알림을 그대로 둔다.
      }
    } catch (error: unknown) {
      showToast(
        error instanceof Error
          ? error.message
          : "입금 확인을 처리하지 못했어요.",
        "error",
      );

      // 다른 탭에서 이미 확인했거나 진행 확정했으면 서버가 거절한다 — 다시 불러와 지금 상태를 보여 준다.
      if (accessToken) {
        try {
          await reloadManagementDetail(accessToken);
        } catch {
          // 실패 토스트가 이미 떠 있다.
        }
      }
    } finally {
      setPendingC2CAction(null);
    }
  }

  // 묶음 단위 쓰기(수락·거절·「제외」)의 공통 틀. 실패하면 다른 탭에서 처리했거나 참여자가 그사이 취소한 것이라
  // 다시 불러와 지금 상태를 보여 준다. 자리가 다시 비는 쓰기는 목록 카드의 남은 멤버도 바뀐다.
  async function runBundleAction(
    bundle: ManagementBundle,
    action: "accept" | "reject" | "release",
    request: (accessToken: string, bundleId: string) => Promise<void>,
    successMessage: string,
  ) {
    if (pendingC2CAction) {
      return;
    }

    if (!bundle.bundleId) {
      showToast(MISSING_BUNDLE_MESSAGE, "error");
      return;
    }

    setPendingC2CAction(`${action}:${bundle.key}`);

    let accessToken: string | null = null;

    try {
      accessToken = await getFreshAccessToken();

      if (!accessToken) {
        showToast("로그인이 만료됐어요. 다시 로그인해 주세요.", "error");
        return;
      }

      await request(accessToken, bundle.bundleId);

      if (action !== "accept") {
        void queryClient.invalidateQueries({ queryKey: buncheolsQueryKey });
      }

      // 성공 알림을 재조회보다 먼저 띄운다 — GET 이 실패해도 이미 반영된 처리가 실패로 보이지 않게.
      showToast(successMessage, "success");

      try {
        await reloadManagementDetail(accessToken);
      } catch {
        // 성공 알림을 그대로 둔다.
      }
    } catch (error: unknown) {
      showToast(
        error instanceof Error
          ? error.message
          : "처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
        "error",
      );

      if (accessToken) {
        try {
          await reloadManagementDetail(accessToken);
        } catch {
          // 실패 토스트가 이미 떠 있다.
        }
      }
    } finally {
      setPendingC2CAction(null);
    }
  }

  // 수락은 돈이 오가기 전이고 참여자가 스스로 취소할 수도 있어 확인 시트 없이 바로 보낸다.
  function acceptExtraBundle(bundle: ManagementBundle, expectedSlotIds: string[]) {
    void runBundleAction(
      bundle,
      "accept",
      (accessToken, bundleId) =>
        acceptBundle(accessToken, bundleId, expectedSlotIds),
      "수락했어요. 참여자가 24시간 안에 입금해요",
    );
  }

  function requestRejectExtraBundle(
    bundle: ManagementBundle,
    expectedSlotIds: string[],
  ) {
    if (pendingC2CAction) {
      return;
    }

    const head = bundle.slots[0];

    setConfirmSheetRequest({
      confirmLabel: "거절",
      description: `추가 신청이 취소되고 참여자에게 알림톡이 가요. ${bundle.slots
        .map(getSlotMemberLabel)
        .join(", ")} 자리는 다시 비어요.`,
      onConfirm: () => {
        setConfirmSheetRequest(null);
        void runBundleAction(
          bundle,
          "reject",
          (accessToken, bundleId) =>
            rejectBundle(accessToken, bundleId, expectedSlotIds),
          "거절했어요. 자리가 다시 비었어요",
        );
      },
      title: `${getParticipantLabel(head)}님의 추가 신청을 거절할까요?`,
    });
  }

  function requestReleaseBundle(bundle: ManagementBundle) {
    if (pendingC2CAction) {
      return;
    }

    const head = bundle.slots[0];

    setConfirmSheetRequest({
      confirmLabel: "제외",
      description: `입금 기한이 지났어요. 제외하면 참여가 취소되고 참여자에게 알림톡이 가요. ${bundle.slots
        .map(getSlotMemberLabel)
        .join(", ")} 자리는 다시 비어요.`,
      onConfirm: () => {
        setConfirmSheetRequest(null);
        void runBundleAction(
          bundle,
          "release",
          releaseBundle,
          "제외했어요. 자리가 다시 비었어요",
        );
      },
      title: `${getParticipantLabel(head)}님을 제외할까요?`,
      warnings: [
        "통장에 입금이 있다면 제외하지 말고 「입금 확인」을 눌러 주세요.",
      ],
    });
  }

  // 운송장 수정은 처음 등록과 같은 API 다. 서버가 번호를 바꿀 때마다 운송장 알림톡을 다시 보내
  // 확인 시트를 태운다(처음 등록은 시트 없이 바로 보낸다).
  function requestEditParticipantTracking(
    participant: BuncheolManagementParticipant,
    currentTrackingNumber: string,
  ) {
    if (pendingC2CAction) {
      return;
    }

    const nextTrackingNumber = (
      participantTrackingInputs[participant.participationId] ?? ""
    ).trim();

    if (
      !nextTrackingNumber ||
      nextTrackingNumber === currentTrackingNumber.trim()
    ) {
      return;
    }

    setConfirmSheetRequest({
      confirmLabel: "수정",
      description: "참여자에게 새 번호로 운송장 알림톡이 다시 가요.",
      details: [
        { label: "지금 번호", value: currentTrackingNumber },
        { label: "새 번호", value: nextTrackingNumber },
      ],
      onConfirm: () => {
        setConfirmSheetRequest(null);
        void handleRegisterParticipantTracking(participant, "edit");
      },
      title: "운송장 번호를 수정할까요?",
    });
  }

  // C2C 참여 단위 운송장 등록 — 다슬롯이라 옵션(winner)이 아닌 참여 기준으로 처리한다.
  async function handleRegisterParticipantTracking(
    participant: BuncheolManagementParticipant,
    mode: "register" | "edit" = "register",
  ) {
    const deliveryId = participant.delivery?.deliveryId;

    if (!deliveryId) {
      showToast("운송장을 등록할 배송 ID가 없어요.", "error");
      return;
    }

    const trackingNumber = (
      participantTrackingInputs[participant.participationId] ?? ""
    ).trim();

    if (!trackingNumber) {
      showToast("운송장 번호를 입력해 주세요.", "error");
      return;
    }

    if (pendingC2CAction) {
      return;
    }

    setPendingC2CAction(`tracking:${participant.participationId}`);

    let accessToken: string | null = null;

    try {
      accessToken = await getFreshAccessToken();

      if (!accessToken) {
        showToast("로그인이 만료됐어요. 다시 로그인해 주세요.", "error");
        return;
      }

      await requestDeliveryTrackingRegistration(
        accessToken,
        deliveryId,
        trackingNumber,
      );

      // 성공 처리를 재조회보다 먼저 한다 — GET 이 실패해 입력칸이 남으면 개최자가 다시 눌러
      // 알림톡이 두 번 나간다.
      setParticipantTrackingInputs((current) => {
        const next = { ...current };

        delete next[participant.participationId];

        return next;
      });

      if (mode === "edit") {
        setEditingTrackingOwnerId((current) =>
          current === participant.participationId ? null : current,
        );
      }

      showToast(
        mode === "edit"
          ? "운송장 번호를 수정했어요."
          : "운송장 번호를 등록했어요.",
        "success",
      );

      try {
        await reloadManagementDetail(accessToken);
      } catch {
        showToast("저장했어요. 화면 갱신에 실패해 잠시 뒤 다시 열어 주세요.");
      }
    } catch (error: unknown) {
      showToast(
        error instanceof Error
          ? error.message
          : mode === "edit"
            ? "운송장 번호를 수정하지 못했어요."
            : "운송장 번호를 등록하지 못했어요.",
        "error",
      );

      // 그사이 배송 완료로 넘어갔으면 서버가 409 로 거절한다 — 다시 불러와 「수정」을 거둔다.
      if (mode === "edit" && accessToken) {
        try {
          await reloadManagementDetail(accessToken);
        } catch {
          // 실패 토스트가 이미 떠 있다.
        }
      }
    } finally {
      setPendingC2CAction(null);
    }
  }

  // 모집 중에는 빼는 순간 서버가 최소 인원을 남은 열린 자리 수로 낮추고(다시 넣어도 올리지 않는다), 남은 열린 자리가
  // 모두 신청됐으면 같은 요청 안에서 입금 단계를 시작한다. 경고는 그 결과를 미리 알리는 것뿐이고,
  // 실제로 시작됐는지는 빼고 난 관리 응답의 상태로 본다. 진행 확정 뒤 빼기는 둘 다 하지 않는다.
  function requestRemoveMemberSlot(option: BuncheolManagementOption) {
    if (!detail || pendingC2CAction) {
      return;
    }

    const isRecruiting = isBuncheolRecruitingStatus(detail.status);
    const nextOpenSlotCount = openMemberSlotCount - 1;
    const lowersMinHeadcount =
      isRecruiting && nextOpenSlotCount < minHeadcount;
    const nextMinHeadcount = Math.min(minHeadcount, nextOpenSlotCount);
    const occupiedSlotCount = memberSlotStates.filter(
      ({ state }) => state.kind === "occupied",
    ).length;
    const startsPayment =
      isRecruiting &&
      occupiedSlotCount > 0 &&
      occupiedSlotCount === nextOpenSlotCount &&
      occupiedSlotCount >= nextMinHeadcount;
    const warnings = [
      ...(startsPayment
        ? [
            "이 멤버를 빼면 정원이 다 차서 바로 입금 단계가 시작돼요. 참여자에게 계좌가 안내돼요.",
          ]
        : []),
      ...(lowersMinHeadcount
        ? [
            `최소 진행 멤버 수가 ${minHeadcount}명에서 ${nextOpenSlotCount}명으로 줄어요. 다시 넣어도 늘지 않아요.`,
          ]
        : []),
    ];

    setConfirmSheetRequest({
      confirmLabel: "빼기",
      description:
        "뺀 멤버는 신청을 받지 않아요. 실수였다면 「멤버 추가」로 다시 넣을 수 있어요.",
      onConfirm: () => {
        setConfirmSheetRequest(null);
        void runRemoveMemberSlot(option);
      },
      title: `${option.memberName} 멤버를 뺄까요?`,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  }

  async function runRemoveMemberSlot(option: BuncheolManagementOption) {
    if (pendingC2CAction) {
      return;
    }

    setPendingC2CAction(`remove-member:${option.buncheolMemberId}`);

    let accessToken: string | null = null;

    try {
      accessToken = await getFreshAccessToken();

      if (!accessToken) {
        showToast("로그인이 만료됐어요. 다시 로그인해 주세요.", "error");
        return;
      }

      await removeBuncheolMember(accessToken, id, option.buncheolMemberId);
      // 홈·아티스트 카드의 멤버 칩이 60초 저장본으로 남지 않게 한다.
      void queryClient.invalidateQueries({ queryKey: buncheolsQueryKey });

      let nextDetail: BuncheolManagementDetail | null = null;

      try {
        nextDetail = await reloadManagementDetail(accessToken);
      } catch {
        nextDetail = null;
      }

      showToast(
        nextDetail && isBuncheolPaymentCollectingStatus(nextDetail.status)
          ? `${option.memberName} 멤버를 뺐어요. 자리가 모두 차서 입금 단계가 시작됐어요.`
          : `${option.memberName} 멤버를 뺐어요.`,
        "success",
      );

      if (!nextDetail) {
        showToast("저장했어요. 화면 갱신에 실패해 잠시 뒤 다시 열어 주세요.");
      }
    } catch (error: unknown) {
      showToast(
        error instanceof Error ? error.message : "멤버를 빼지 못했어요.",
        "error",
      );

      // 그사이 신청이 들어왔거나 다른 탭에서 뺐으면 서버가 거부한다 — 다시 불러와 지금 상태를 보여 준다.
      if (accessToken) {
        try {
          await reloadManagementDetail(accessToken);
        } catch {
          // 실패 토스트가 이미 떠 있다.
        }
      }
    } finally {
      setPendingC2CAction(null);
    }
  }

  async function changeExtraRecruit(open: boolean) {
    if (pendingC2CAction) {
      return;
    }

    setPendingC2CAction("extra-recruit");

    let accessToken: string | null = null;

    try {
      accessToken = await getFreshAccessToken();

      if (!accessToken) {
        showToast("로그인이 만료됐어요. 다시 로그인해 주세요.", "error");
        return;
      }

      await setExtraRecruit(accessToken, id, open);
      // 목록 카드의 「추가 모집」 배지와 남은 멤버 칩이 60초 저장본으로 남지 않게 한다.
      void queryClient.invalidateQueries({ queryKey: buncheolsQueryKey });
      showToast(
        open ? "추가 모집을 켰어요" : "추가 모집을 껐어요. 새 추가 신청만 막혀요",
        "success",
      );

      try {
        await reloadManagementDetail(accessToken);
      } catch {
        showToast("저장했어요. 화면 갱신에 실패해 잠시 뒤 다시 열어 주세요.");
      }
    } catch (error: unknown) {
      showToast(
        error instanceof Error ? error.message : "추가 모집을 바꾸지 못했어요.",
        "error",
      );

      // 그사이 모든 배송이 도착해 끝났으면 서버가 켜기를 거절한다(BCH-131) — 다시 불러와 지금 상태를 보여 준다.
      if (accessToken) {
        try {
          await reloadManagementDetail(accessToken);
        } catch {
          // 실패 토스트가 이미 떠 있다.
        }
      }
    } finally {
      setPendingC2CAction(null);
    }
  }

  // 뜨는 순간 기억한다 — 「나중에」, 「추가 모집 열기」, 바깥 누르기 모두 다시 뜨지 않는다.
  const openExtraRecruitPrompt = useEffectEvent((slotNames: string[]) => {
    if (confirmSheetRequest) {
      return;
    }

    markExtraRecruitPromptSeen(id);
    setConfirmSheetRequest({
      cancelLabel: "나중에",
      confirmLabel: "추가 모집 열기",
      description: `추가 모집을 열면 ${slotNames.join(", ")}에 추가 신청을 받아요. 추가 신청을 수락하면 참여자가 24시간 안에 입금해요.`,
      footnote:
        "「나중에」를 눌러도 「멤버 관리」 카드의 스위치로 언제든 켤 수 있어요.",
      onCancel: () => showToast("「멤버 관리」에서 언제든 켤 수 있어요"),
      onConfirm: () => {
        setConfirmSheetRequest(null);
        void changeExtraRecruit(true);
      },
      title: `빈 자리 ${slotNames.length}개가 남았어요`,
    });
  });

  useEffect(() => {
    if (!extraRecruitPromptSlotNamesKey || hasSeenExtraRecruitPrompt(id)) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      openExtraRecruitPrompt(extraRecruitPromptSlotNamesKey.split("\n"));
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [extraRecruitPromptSlotNamesKey, id]);

  async function openAddMemberSheet() {
    if (!detail || pendingC2CAction) {
      return;
    }

    const slotMemberIds = detail.options.flatMap((option) =>
      option.memberId ? [option.memberId] : [],
    );
    // 그룹 목록을 못 불러와도 닫힌 멤버는 상세에 남아 있어 다시 넣을 수 있다.
    const closedCandidates = closedMemberSlots.flatMap((option) =>
      option.memberId
        ? [
            {
              memberId: option.memberId,
              name: option.memberName,
              previousPrice: option.price,
            },
          ]
        : [],
    );
    const loadId = addMemberLoadIdRef.current + 1;

    addMemberLoadIdRef.current = loadId;
    setAddMemberSelectedId(null);
    setAddMemberPriceDraft("");
    setAddMemberError("");
    setAddMemberSheet({
      closedCandidates,
      groupCandidates: [],
      isLoading: true,
      loadFailed: false,
    });

    try {
      const groupMembers = await requestBuncheolGroupMembers(
        detail.groupName,
        slotMemberIds,
      );
      const slotMemberIdSet = new Set(slotMemberIds);
      const groupCandidates = groupMembers
        .filter((member) => !slotMemberIdSet.has(member.id))
        .map((member) => ({ memberId: member.id, name: member.name }));

      if (addMemberLoadIdRef.current !== loadId) {
        return;
      }

      setAddMemberSheet((current) =>
        current ? { ...current, groupCandidates, isLoading: false } : current,
      );
    } catch {
      if (addMemberLoadIdRef.current !== loadId) {
        return;
      }

      setAddMemberSheet((current) =>
        current ? { ...current, isLoading: false, loadFailed: true } : current,
      );
    }
  }

  function closeAddMemberSheet() {
    if (pendingC2CAction === "add-member") {
      return;
    }

    setAddMemberSheet(null);
    setAddMemberError("");
  }

  function selectAddMemberCandidate(candidate: AddMemberCandidate) {
    setAddMemberSelectedId(candidate.memberId);
    setAddMemberPriceDraft(
      typeof candidate.previousPrice === "number"
        ? String(candidate.previousPrice)
        : "",
    );
    setAddMemberError("");
  }

  async function submitAddMember() {
    if (!addMemberSheet || pendingC2CAction) {
      return;
    }

    const candidate = [
      ...addMemberSheet.closedCandidates,
      ...addMemberSheet.groupCandidates,
    ].find((entry) => entry.memberId === addMemberSelectedId);

    if (!candidate) {
      return;
    }

    if (!isMemberPriceInput(addMemberPriceDraft)) {
      setAddMemberError("가격은 100원 단위로 입력해 주세요.");
      return;
    }

    const price = Number(addMemberPriceDraft.replace(/[^\d]/g, ""));

    setPendingC2CAction("add-member");

    let accessToken: string | null = null;

    try {
      accessToken = await getFreshAccessToken();

      if (!accessToken) {
        setAddMemberError("로그인이 만료됐어요. 다시 로그인해 주세요.");
        return;
      }

      await addBuncheolMember(accessToken, id, {
        memberId: candidate.memberId,
        price,
      });
      setAddMemberSheet(null);
      void queryClient.invalidateQueries({ queryKey: buncheolsQueryKey });
      showToast(
        isConfirmedC2C
          ? `${candidate.name} 멤버를 넣었어요. 바로 추가 신청을 받을 수 있어요.`
          : `${candidate.name} 멤버를 넣었어요. 바로 신청받을 수 있어요.`,
        "success",
      );

      try {
        await reloadManagementDetail(accessToken);
      } catch {
        showToast("저장했어요. 화면 갱신에 실패해 잠시 뒤 다시 열어 주세요.");
      }
    } catch (error: unknown) {
      // 403·404·409 는 서버 상태가 화면과 달라진 것이라 닫고 다시 불러오고, 그 밖은 고른 멤버·가격을 둔 채 시트 안에 이유를 보인다.
      // 5xx·네트워크는 저장됐는데 응답만 끊겼을 수 있어 뒤에서 다시 불러오고, 5xx 본문엔 서버 문구가 없어 고정 안내를 쓴다.
      if (!(error instanceof ApiRequestError) || error.status >= 500) {
        setAddMemberError("멤버를 넣지 못했어요. 잠시 후 다시 시도해 주세요.");

        if (accessToken) {
          void reloadManagementDetail(accessToken).catch(() => {});
        }

        return;
      }

      if (![403, 404, 409].includes(error.status)) {
        setAddMemberError(
          error.status === 401
            ? "로그인이 만료됐어요. 다시 로그인해 주세요."
            : error.message,
        );
        return;
      }

      setAddMemberSheet(null);
      showToast(error.message, "error");

      if (accessToken) {
        try {
          await reloadManagementDetail(accessToken);
        } catch {
          // 실패 토스트가 이미 떠 있다.
        }
      }
    } finally {
      setPendingC2CAction(null);
    }
  }

  // ⚠️ 높이는 100dvh 가 아니라 h-full 이어야 한다. 이 화면은 HostedBuncheolManageExperience 의
  // .product-page-panel(absolute inset-0) 안에서 렌더되는데, 바깥 셸이 그 높이를 100dvh 보다
  // 작게 잡는 표시 모드가 여럿이다 — 데스크톱 폰 프레임(app/globals.css 의 desktop-web-shell:
  // min(840px, 100dvh - clamp(96px,12vh,148px), …)), safe-area 패딩이 붙는 인앱 웹뷰,
  // --app-viewport-height 를 쓰는 설치형 PWA. 100dvh 를 쓰면 그만큼 패널보다 내부가 커져
  // ① 참여자 리스트 끝이 프레임 밖으로 잘려 스크롤해도 못 보고(docs/56 H-01)
  // ② 패널 자체가 스크롤 가능해져, 데스크톱에서 fixed → absolute 로 바뀌는 확인 시트가
  //    스크롤된 패널 원점 기준으로 화면 밖에 그려진다(docs/56 H-10).
  // 어긋남이 가장 큰 데스크톱에서 먼저 발견됐을 뿐, 위 두 모드에도 inset 만큼 같은 문제가 있었다.
  /*
   * 상세를 못 받은 상태 — 불러오는 중이거나, 남의 분철 관리 URL 로 들어와 403 이 난 경우다.
   * 이전에는 문장 한 줄만 흰 화면 한가운데 떠 있어서, 뒤로가기도 다른 화면으로 갈 길도 없었다.
   * (하단 탭도 이 화면에는 없다.) 헤더와 나갈 길을 함께 준다.
   */
  if (!detail) {
    const isLoadingDetail = !loadMessage;

    return (
      <main className="system-chrome-white system-chrome-bottom-white h-full bg-white">
        <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
          <header className="shrink-0 px-5 pb-3 pt-4">
            <div className="flex items-center gap-3">
              <button
                aria-label="이전 화면"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white"
                onClick={onBack ?? (() => router.back())}
                type="button"
              >
                <BackIcon />
              </button>
              <div className="min-w-0 flex-1 text-right">
                <p className="text-[12px] font-semibold text-black/35">
                  분철 개최 관리
                </p>
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
            <p className="break-keep text-[15px] font-semibold leading-6 text-black/60">
              {isLoadingDetail ? "분철 정보를 불러오는 중이에요." : loadMessage}
            </p>
            {isLoadingDetail ? null : (
              <Link
                className="mt-5 flex h-12 w-full max-w-[240px] items-center justify-center rounded-full bg-[#CFE86B] text-[14px] font-semibold tracking-[-0.04em] text-black shadow-[0_10px_24px_rgba(120,132,82,0.2)]"
                href="/profile/participations"
              >
                내 분철로 돌아가기
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  const managementStatusBadge = getManagementStatusBadge(detail);

  return (
    <main className="system-chrome-white system-chrome-bottom-white h-full bg-white">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <header className="shrink-0 px-5 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white"
              aria-label="이전 화면"
              onClick={onBack ?? (() => router.back())}
            >
              <BackIcon />
            </button>
            <div className="min-w-0 flex-1 text-right">
              {/* 제목은 아래 검정 카드로 내렸다 — 헤더에서 truncate 로 잘리는 대신 두 줄까지 펼쳐진다 (docs/54 1-2 시안 A). */}
              <p className="text-[12px] font-semibold text-black/35">
                분철 개최 관리
              </p>
            </div>
          </div>
        </header>

        <div className="app-page-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-8">
          <section className="overflow-hidden rounded-[1.05rem] border border-black/10 bg-white shadow-[0_14px_34px_rgba(0,0,0,0.045)]">
            <div className="bg-black px-4 py-4 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {/* 제목이 이 화면의 주인공 — 두 줄까지 보여주고, 그룹·구매처는 아래 메타 한 줄로 내린다. */}
                  <h1 className="line-clamp-2 text-[19px] font-semibold leading-[1.32] tracking-[-0.05em]">
                    {detail.title}
                  </h1>
                  <p className="mt-2 truncate text-[12px] font-semibold text-white/55">
                    {detail.groupName}
                    <span className="px-1.5 text-white/30">·</span>
                    {detail.purchaseSite || "구매처 미입력"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold ${
                    managementStatusBadge.kind === "confirmed"
                      ? "bg-white text-black"
                      : "bg-white/12 text-white/75"
                  }`}
                >
                  {managementStatusBadge.label}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-[12px] font-semibold text-white/55">
                  <span>입금 확인</span>
                  <span>{confirmedProgressLabel}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-white transition-[width]"
                    style={{ width: `${confirmedProgressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-black/40">
                  운영 요약
                </p>
                <p className="mt-1 text-[14px] font-semibold text-black/60">
                  입금 확인 후 운송장 등록까지 한 곳에서 처리해요.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[0.85rem] border border-black/10 bg-white px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">{"멤버"}</p>
                <p className="mt-1 text-[15px] font-semibold">
                  {`${memberCount}명`}
                </p>
              </div>
              <div className="rounded-[0.85rem] border border-black/10 bg-white px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  {"최소 진행 멤버 수"}
                </p>
                <p className="mt-1 text-[15px] font-semibold">
                  {minHeadcount ? `${minHeadcount}\uba85` : "-"}
                </p>
              </div>
              <div className="rounded-[0.85rem] border border-black/10 bg-white px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">{"\ucc38\uc5ec"}</p>
                <p className="mt-1 text-[15px] font-semibold">
                  {formatMemberCount(participantCount)}
                </p>
              </div>
              <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  {"\uc785\uae08 \ub300\uae30"}
                </p>
                <p className="mt-1 text-[15px] font-semibold">
                  {formatMemberCount(
                    isC2C ? c2cAwaitingCount : awaitingPaymentCount,
                  )}
                </p>
              </div>
              {isC2C ? (
                <>
                  <div
                    className={`rounded-[0.85rem] px-3 py-3 ${
                      isConfirmedC2C && c2cAppliedCount > 0
                        ? "bg-brand-pale ring-1 ring-inset ring-brand-soft"
                        : "bg-[#f5f5f5]"
                    }`}
                  >
                    <p className="text-[11px] font-medium text-black/35">
                      {c2cAppliedTileLabel}
                    </p>
                    <p className="mt-1 text-[15px] font-semibold">
                      {formatMemberCount(c2cAppliedCount)}
                    </p>
                  </div>
                  <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                    <p className="text-[11px] font-medium text-black/35">
                      {"\ubcf4\ub0c8\uc5b4\uc694"}
                    </p>
                    <p className="mt-1 text-[15px] font-semibold">
                      {formatMemberCount(c2cPaymentSentCount)}
                    </p>
                  </div>
                </>
              ) : null}
              <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  운송장 대기
                </p>
                <p className="mt-1 text-[15px] font-semibold">
                  {`${isC2C ? c2cDeliveryReadyCount : deliveryReadyCount}건`}
                </p>
              </div>
              <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  운송장 완료
                </p>
                <p className="mt-1 text-[15px] font-semibold">
                  {`${isC2C ? c2cTrackingCompletedCount : trackingCompletedCount}건`}
                </p>
              </div>
              <div className="col-span-2 rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  {"\ubaa8\uc9d1 \uae30\ud55c"}
                </p>
                <p className="mt-1 whitespace-nowrap text-[15px] font-semibold tracking-[-0.04em]">
                  {formatKoreaDateTime(detail.deadline)}
                </p>
              </div>
            </div>
            </div>
          </section>

          {/*
            오픈채팅 링크는 전체 수정(모집중 전용)과 달리 상태와 무관하게 여기서 고친다 —
            링크가 가장 필요한 구간이 입금·문의가 몰리는 입금 단계 이후이기 때문이다.
            비어 있을 때 등록을 유도할 자리가 필요해 검정 카드 안이 아니라 독립 카드로 뒀다.

            C2C 전용이다 — 링크를 실제로 보여주는 세 화면(분철 상세·참여 내역·입금 안내 시트)이
            전부 C2C 게이트라, LEGACY 에 노출하면 "상세와 입금 안내에 보여요" 가 거짓이 되고
            등록해도 아무 데도 뜨지 않는다. 취소된 분철은 링크 등록을 권할 자리가 아니라 함께 접는다.
          */}
          {isC2C && !isBuncheolCancelledStatus(detail.status) ? (
          <section
            className={`mt-4 rounded-[1.05rem] border px-4 py-4 ${
              detail.openChatUrl
                ? "border-black/10 bg-white"
                : "border-dashed border-black/15 bg-[#f8f8f8]"
            }`}
          >
            <p className="text-[15px] font-semibold tracking-[-0.04em]">
              오픈채팅
            </p>
            <HelpText className="mt-1">
              참여자가 문의할 소통 창구예요. 분철 상세와 입금 안내 화면에 보여요.
            </HelpText>
            {detail.openChatUrl ? (
              <div className="mt-3 flex items-center gap-2 rounded-[0.85rem] bg-[#f4f4f4] px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-black/70">
                  {detail.openChatUrl}
                </span>
                <button
                  className="shrink-0 rounded-full bg-[#CFE86B] px-3 py-1.5 text-[12px] font-semibold text-black"
                  onClick={openOpenChatUrlSheet}
                  type="button"
                >
                  수정
                </button>
              </div>
            ) : (
              <button
                className="mt-3 h-11 w-full rounded-full bg-black text-[14px] font-semibold tracking-[-0.04em] text-[#D7FF5F]"
                onClick={openOpenChatUrlSheet}
                type="button"
              >
                링크 등록하기
              </button>
            )}
          </section>
          ) : null}

          {isC2C && isBuncheolRecruitingStatus(detail.status) ? (
            <section className="mt-4 rounded-[1.05rem] border border-[#DDE7B8] bg-[#F7FAEE] px-4 py-4">
              <p className="text-[15px] font-semibold tracking-[-0.04em]">
                모집이 끝나면
              </p>
              {/* 미달이면 마감 때 서버가 자동으로 취소한다(BuncheolAutoCloseService). 개최자에게는 이 문구가 유일한 안내다. */}
              {isUnderMinHeadcount ? (
                <HelpText className="mt-1">
                  마감 때 신청된 멤버가 최소 진행 멤버 수보다 적으면 자동으로 취소돼요.
                </HelpText>
              ) : null}
              <HelpText className={isUnderMinHeadcount ? "mt-1.5" : "mt-1"}>
                자리가 모두 차거나, 최소 진행 멤버 수를 채운 채 마감되면 입금 단계가 자동으로 시작돼요. 신청자 전원에게 입금 계좌와 24시간 기한이 알림톡으로 가요.
              </HelpText>
              {/* 개최자가 최소 인원을 채웠는지 가늠하는 신청 수. */}
              <HelpText className="mt-1.5">
                {`지금까지 신청된 멤버는 ${c2cAppliedCount}명이에요.`}
              </HelpText>
            </section>
          ) : null}

          {isC2C && isBuncheolPaymentCollectingStatus(detail.status) ? (
            <section className="mt-4 rounded-[1.05rem] border border-black/10 bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-semibold tracking-[-0.04em]">
                  입금 수집 중
                </p>
                {detail.paymentDueAt ? (
                  <span className="shrink-0 text-[12px] font-semibold text-black/45">
                    기한 {formatKoreaDateTime(detail.paymentDueAt)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[13px] font-medium leading-5 text-black/50">
                {/* ⚠️ 한 줄로 붙인다. 값 뒤에서 줄을 바꾸면 다음 텍스트 노드의 <b>선두 개행+들여쓰기가
                    통째로 버려져</b> 공백이 사라진다("1명· 보냈어요"). */}
                {`입금 확인 멤버 ${c2cConfirmedCount}명 · 입금 대기 ${c2cAwaitingCount}명 · 보냈어요 ${c2cPaymentSentCount}명`}
              </p>
              <button
                className="mt-3 h-12 w-full rounded-full bg-black text-[15px] font-semibold tracking-[-0.04em] text-[#D7FF5F] disabled:bg-black/15 disabled:text-black/35"
                disabled={!canConfirmBuncheol || pendingC2CAction !== null}
                onClick={requestConfirmBuncheol}
                type="button"
              >
                {pendingC2CAction === "confirm-buncheol"
                  ? "확정하는 중"
                  : detail.confirmCheck === "DUE_PASSED"
                    ? `입금된 멤버 ${c2cConfirmedCount}명으로 진행 확정`
                    : "진행 확정하기"}
              </button>
              {confirmCheckLine ? (
                <HelpText className="mt-2">{confirmCheckLine}</HelpText>
              ) : (
                <>
                  <HelpText className="mt-2">{AUTO_CONFIRM_NOTICE}</HelpText>
                  {/* NO_CONFIRMED 는 기한 전후를 가리지 않아, 기한이 지났는지는 표시용으로만 입금 기한을 본다. */}
                  {detail.confirmCheck === "NO_CONFIRMED" &&
                  isPastDateTime(detail.paymentDueAt ?? undefined) ? (
                    <HelpText className="mt-1.5">
                      입금이 확인된 참여자가 없어 진행 확정을 할 수 없어요. 아래 「운영진에게 알리기」로 알려 주세요.
                    </HelpText>
                  ) : null}
                </>
              )}
              <StaffContactLink
                className="mt-3 border-t border-black/[0.06] pt-3"
                description="진행이 어렵다면 운영진에게 알려 주세요. 입금한 참여자와 환불 계획을 함께 확인한 뒤 운영진이 분철을 파기해요."
              />
            </section>
          ) : null}

          {/* 진행 확정 뒤에도 운송장이 하나도 없으면 운영진이 파기할 수 있다(있으면 서버 BCH-130). 첫 운송장이 들어가면 숨긴다. */}
          {isC2C &&
          isBuncheolConfirmedStatus(detail.status) &&
          c2cTrackingCompletedCount === 0 ? (
            <section className="mt-4 rounded-[1.05rem] border border-black/10 bg-white px-4 py-4">
              <StaffContactLink description="진행이 어렵다면 운송장을 넣기 전에 운영진에게 알려 주세요. 입금한 참여자와 환불 계획을 함께 확인한 뒤 운영진이 분철을 파기해요." />
            </section>
          ) : null}

          {/* 끝나면 「멤버 관리」와 스위치가 사라진다 — 스위치를 쓰던 개최자가 이유를 알도록 그 자리에 남긴다. */}
          {isConfirmedC2C &&
          detail.ended === true &&
          typeof detail.extraRecruitOpen === "boolean" ? (
            <section className="mt-4 rounded-[1.05rem] bg-[#f7f7f7] px-4 py-3.5">
              <p className="text-[15px] font-semibold tracking-[-0.04em]">
                분철이 끝났어요
              </p>
              <HelpText className="mt-1">
                모든 배송이 도착해 「종료」됐어요. 추가 모집과 멤버 편집도 함께 닫혔어요. 다시 모으려면 새 분철을 열어 주세요.
              </HelpText>
            </section>
          ) : null}

          {hasMemberSlotSaleStatus &&
          (canEditMemberSlots || showsExtraRecruitControls) ? (
            <section className="mt-4 rounded-[1.05rem] border border-black/10 bg-white px-4 py-4">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-semibold tracking-[-0.04em]">
                  멤버 관리
                </p>
                {isExtraRecruitOn ? (
                  <span className="shrink-0 rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-brand-strong">
                    추가 모집 중
                  </span>
                ) : null}
              </div>
              {showsExtraRecruitControls ? (
                <>
                  <div className="mt-2.5 flex items-center justify-between gap-3 rounded-[0.85rem] bg-[#f6f6f6] px-3 py-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold tracking-[-0.03em]">
                        빈 자리 추가 모집
                      </p>
                      <p className="mt-px text-[12px] font-medium text-black/50">
                        {isExtraRecruitOn
                          ? "추가 신청을 수락해야 참여자가 입금해요"
                          : "켜면 빈 자리에 추가 신청을 받아요"}
                      </p>
                    </div>
                    <Switch
                      checked={isExtraRecruitOn}
                      disabled={pendingC2CAction !== null}
                      label="빈 자리 추가 모집"
                      onCheckedChange={(open) => void changeExtraRecruit(open)}
                    />
                  </div>
                  <HelpText className="mt-2">
                    {isExtraRecruitOn
                      ? "추가 모집을 하지 않을 멤버는 「빼기」를 눌러 주세요. 뺀 멤버는 신청을 받지 않아요."
                      : "추가 모집을 켜야 빈 자리에 추가 신청을 받고, 멤버를 빼거나 더할 수 있어요."}
                  </HelpText>
                </>
              ) : (
                <HelpText className="mt-1">
                  모집하지 않을 멤버는 「빼기」를 눌러 주세요. 뺀 멤버는 신청을 받지
                  않아요.
                </HelpText>
              )}
              <ul className="mt-3 divide-y divide-black/[0.06]">
                {memberSlotStates.map(({ option, state: slotState }) => {
                  const isLastOpenSlot = openMemberSlotCount <= 1;
                  const canRemove =
                    canEditMemberSlots && slotState.kind === "empty";
                  // 진행 확정 뒤에는 잡힌 자리가 대부분이라 「뺄 수 없어요」를 줄마다 달지 않는다.
                  const blockedReason = !canEditMemberSlots
                    ? null
                    : slotState.kind === "occupied" && !isConfirmedC2C
                      ? "신청자가 있는 자리는 뺄 수 없어요."
                      : canRemove && isLastOpenSlot
                        ? "마지막 멤버는 뺄 수 없어요."
                        : null;
                  const isRemoving =
                    pendingC2CAction ===
                    `remove-member:${option.buncheolMemberId}`;

                  return (
                    <li
                      className="flex items-center gap-2 py-2.5"
                      key={option.buncheolMemberId}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold tracking-[-0.04em]">
                          {option.memberName}
                        </p>
                        <p className="mt-0.5 text-[12px] font-medium text-black/40">
                          {formatMemberSlotPrice(option.price)}
                        </p>
                        {blockedReason ? (
                          <HelpText className="mt-0.5" size="caption">
                            {blockedReason}
                          </HelpText>
                        ) : null}
                      </div>
                      {slotState.extra ? (
                        <StatusTag tone="extra">추가 모집</StatusTag>
                      ) : null}
                      <StatusTag tone={slotState.tone}>{slotState.label}</StatusTag>
                      {canRemove ? (
                        <button
                          className="h-9 shrink-0 rounded-full border border-black/10 bg-white px-3 text-[12px] font-semibold text-black/60 disabled:border-black/[0.06] disabled:text-black/25"
                          disabled={isLastOpenSlot || pendingC2CAction !== null}
                          onClick={() => requestRemoveMemberSlot(option)}
                          type="button"
                        >
                          {isRemoving ? "빼는 중" : "빼기"}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {canEditMemberSlots ? (
                <button
                  className="mt-3 flex h-11 w-full items-center justify-center gap-1 rounded-full border border-black/10 bg-white text-[14px] font-semibold tracking-[-0.04em] text-black/70 disabled:text-black/25"
                  disabled={pendingC2CAction !== null}
                  onClick={() => void openAddMemberSheet()}
                  type="button"
                >
                  <PlusIcon className="h-4 w-4" />
                  멤버 추가
                </button>
              ) : null}
            </section>
          ) : null}

          {/* 입금 확인된 취소 참여는 활성 목록에서 빠져 환불 계좌에 닿을 길이 없어진다. C2C 전용이다 —
              LEGACY 는 환불 주체가 플랫폼이라 개최자에게 계좌를 보여주면 없는 의무를 만든다.
              ⚠️ 노출 조건: 보여줄 게 있을 때만 — 환불 대상 또는 「보냈어요」 미확인 건.
              cancelledParticipants 전체로 열면 흔한 경우(신청 취소뿐)에 「0건」 헤더와
              "아래 계좌로 환불해 주세요" 만 있는 빈 껍데기가 뜬다. refundTargetParticipants 로만
              좁히면 취소분이 전부 「보냈어요만」일 때 섹션째 사라져 안내조차 안 나온다. */}
          {isC2C &&
          (refundTargetParticipants.length > 0 || sentButUnconfirmedCount > 0) ? (
            <section className="mt-6 rounded-[1.05rem] border border-black/10 bg-[#f7f7f7] px-4 py-4">
              <p className="text-[15px] font-semibold tracking-[-0.04em]">
                {refundTargetParticipants.length > 0
                  ? `환불이 필요한 참여 ${refundTargetParticipants.length}건`
                  : "환불 확인이 필요한 참여"}
              </p>
              <HelpText className="mt-1">
                {refundTargetParticipants.length > 0
                  ? "입금 확인된 취소 건이에요. 통장을 확인하고 아래 계좌로 환불해 주세요."
                  : "환불 계좌를 보여드릴 확정 건은 없어요. 아래 안내를 확인해 주세요."}
              </HelpText>
              <div className="mt-3 space-y-2">
                {refundTargetParticipants.map((participant) => (
                  <div
                    className="rounded-[0.85rem] bg-white px-3 py-3"
                    key={participant.participationId}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold tracking-[-0.04em]">
                          {/* 🔴 통장 대조가 필요한 섹션이라 닉네임이 아니라 <b>입금자명</b>을 쓴다 —
                            바로 위 문구가 "통장을 확인하고" 이고, getDepositorName 규약이
                            "확인 시트 문구와 목록 행이 반드시 같은 값" 을 요구한다. */}
                        {getDepositorName(participant)}
                        </p>
                        {/* 파서 최종 폴백이 리터럴 "멤버" 라 그대로 찍으면 의미 없는 줄이 된다. */}
                        {participant.memberName && participant.memberName !== "멤버" ? (
                          <p className="mt-0.5 truncate text-[12px] font-medium text-black/40">
                            {participant.memberName}
                          </p>
                        ) : null}
                        {/* 목록이 confirmedAt 로 좁혀져 있어 여기 오는 건 전부 확인된 건이다. */}
                        <p className="mt-1 text-[12px] font-semibold text-black/45">
                          입금 확인됨
                        </p>
                      </div>
                      <p className="shrink-0 text-[14px] font-semibold tabular-nums">
                        {formatWonAmount(participant.amount)}
                      </p>
                    </div>
                    {participant.refundAccount ? (
                      <p className="mt-1 break-all text-[13px] font-medium text-black/60">
                        {participant.refundAccount.bank}{" "}
                        {participant.refundAccount.account} (예금주:{" "}
                        {participant.refundAccount.holder})
                      </p>
                    ) : (
                      <p className="mt-1 text-[13px] font-medium text-black/35">
                        환불 계좌가 등록되어 있지 않아요.
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {sentButUnconfirmedCount > 0 ? (
                <HelpText className="mt-3">
                  입금 확인 전에 빠진 참여 {sentButUnconfirmedCount}건이 있어요.
                  보냈다고 표시했지만 확인되지 않아 계좌는 보여드리지 않아요.
                  통장에 늦게 찍힌 이체가 있는지 확인해 주세요.
                </HelpText>
              ) : null}
              {noTraceCancelledCount > 0 ? (
                <HelpText className="mt-2">
                  입금 전에 취소된 참여 {noTraceCancelledCount}건은 환불할 금액이
                  없어 여기 표시하지 않아요.
                </HelpText>
              ) : null}
            </section>
          ) : null}

          <section className="mt-6">
            <div className="mb-3">
              <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                {isC2C ? "참여자 관리" : "멤버별 참여 관리"}
              </h2>
              {/* 리스트 모수는 취소를 뺀 활성 참여 전건(신청됨·입금 대기 포함)이라
                  "여기에 표시돼요"로 쓰면 안 된다 — 바뀌는 것은 존재가 아니라 상태다. */}
              <HelpText className="mt-1">
                {isC2C
                  ? "참여자가 송금 후 「보냈어요」를 누르면 상태가 바뀌어요. 입금자명으로 통장 내역과 맞춰 확인해 주세요."
                  : "멤버마다 입금 확인 → 운송장 등록 순서로 처리해요."}
              </HelpText>
            </div>

            <div className="space-y-3">
              {/* 개최자 취소는 공개 상세가 404라 멤버 목록이 비고, 회원 분철 자동 취소는 활성 참여가 0이라
                  묶음이 빈다 — 둘 다 일시 오류나 「아직 신청한…」이 아니다. */}
              {isBuncheolCancelledStatus(detail.status) &&
              (detail.options.length === 0 ||
                (isC2C && c2cBundles.length === 0)) ? (
                <p className="rounded-[1rem] bg-[#f7f7f7] px-4 py-5 text-center text-[13px] font-semibold text-black/40">
                  취소된 분철이라 관리할 참여자가 없어요.
                </p>
              ) : detail.options.length === 0 ? (
                <p className="rounded-[1rem] bg-[#f7f7f7] px-4 py-5 text-center text-[13px] font-semibold text-black/40">
                  옵션 정보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.
                </p>
              ) : isC2C && c2cBundles.length === 0 ? (
                <p className="rounded-[1rem] bg-[#f7f7f7] px-4 py-5 text-center text-[13px] font-semibold text-black/40">
                  아직 신청한 참여자가 없어요.
                </p>
              ) : isC2C ? (
                // 🔴 C2C 는 <b>묶음</b> 단위로 보여준다 — 입금확인이 묶음 API 하나뿐이라,
                // 멤버 자리 줄에 버튼을 달면 "한 줄을 눌렀는데 그 사람 자리가 전부 빠지는" 화면이 된다.
                // 대신 자리 축(누가 남았나)이 흐려지므로 줄 안에 멤버명을 칩으로 나열한다 (docs/84 §3-5).
                c2cBundles.map((bundle) => {
                  const head = bundle.slots[0];
                  const depositorName = getDepositorName(head);
                  const isBundleConfirmed = bundle.slots.every(
                    (slot) =>
                      isParticipationConfirmedStatus(slot.status) ||
                      Boolean(slot.confirmedAt),
                  );
                  const isBundleSent = bundle.slots.some((slot) =>
                    isParticipationPaymentSentStatus(slot.status),
                  );
                  const isBundleAwaiting = bundle.slots.some((slot) =>
                    isParticipationAwaitingPaymentStatus(slot.status),
                  );
                  const isBundleApplied = bundle.slots.some((slot) =>
                    isParticipationAppliedStatus(slot.status),
                  );
                  // 🔴 확정 대상은 서버가 슬롯마다 내려주는 confirmTarget 이다. 화면이 상태로
                  // 재판정하면 서버가 가진 집합과 갈려 409(BCH-115)가 영구히 난다.
                  // 판정이 없는 구 응답에서는 입금 가능 상태로 폴백한다.
                  const confirmTargetIds = bundle.slots
                    .filter((slot) =>
                      typeof slot.confirmTarget === "boolean"
                        ? slot.confirmTarget
                        : isParticipationAwaitingPaymentStatus(slot.status) ||
                          isParticipationPaymentSentStatus(slot.status),
                    )
                    .map((slot) => slot.participationId);
                  const acceptTargetIds = getAcceptTargetIds(bundle);
                  const isPendingAccept = acceptTargetIds.length > 0;
                  const releasability = getBundleReleasability(bundle);
                  const isBundleExtra = head.extra === true;
                  const hasBundleId = Boolean(bundle.bundleId);
                  const isBundleConfirming =
                    pendingC2CAction === `confirm:${bundle.key}`;
                  const bundleTotal = bundle.slots.reduce(
                    (sum, slot) => sum + slot.amount,
                    0,
                  );
                  const bundleShippingFee = bundle.slots.reduce(
                    (sum, slot) =>
                      sum +
                      (typeof slot.shippingFee === "number"
                        ? slot.shippingFee
                        : 0),
                    0,
                  );
                  // 택배 1개 = 묶음 1개 — 배송은 묶음에 하나뿐이라 대표 슬롯에서 읽는다.
                  // 🔴 배송은 <b>deliveryId 로 중복 제거해 전건</b>을 낸다. 서버가 묶음당 1건으로
                  // 정리했지만(#166) 그 배포 전 데이터·롤아웃 순서에서는 슬롯마다 배송이 따로 온다.
                  // 첫 건만 그리면 두 번째 택배의 운송장을 등록할 UI 경로가 사라진다.
                  const bundleDeliveries: {
                    delivery: NonNullable<
                      BuncheolManagementParticipant["delivery"]
                    >;
                    ownerId: string;
                  }[] = [];

                  for (const slot of isC2CShippingOpen ? bundle.slots : []) {
                    // 🔴 운송장 입력칸의 게이트는 둘이다 — 분철 진행 확정(isC2CShippingOpen, 서버 DLV-009)과
                    // 입금확인된 자리(isSlotConfirmed). 진행 확정 때 빠진 자리는 취소로 활성 목록에서 빠지지만,
                    // 옛 데이터에서 자리마다 상태가 갈린 묶음이 있어 자리 기준 필터를 남긴다.
                    const isSlotConfirmed =
                      isParticipationConfirmedStatus(slot.status) ||
                      Boolean(slot.confirmedAt);

                    if (
                      !slot.delivery?.deliveryId ||
                      !isSlotConfirmed ||
                      bundleDeliveries.some(
                        (entry) =>
                          entry.delivery.deliveryId === slot.delivery?.deliveryId,
                      )
                    ) {
                      continue;
                    }

                    bundleDeliveries.push({
                      delivery: slot.delivery,
                      ownerId: slot.participationId,
                    });
                  }

                  const sentAtSlot = bundle.slots.find(
                    (slot) => slot.paymentSentAt,
                  );
                  const bundleStatusTag: { label: string; tone: StatusTagTone } =
                    isBundleConfirmed
                      ? { label: "입금 확인 완료", tone: "black" }
                      : isBundleSent
                        ? { label: "보냈어요", tone: "lime" }
                        : isBundleAwaiting
                          ? releasability === "RELEASABLE"
                            ? { label: "기한 지남", tone: "warning" }
                            : { label: "입금 대기", tone: "grey" }
                          : isBundleApplied
                            ? isAwaitingHostAccept(detail.status, head.status)
                              ? { label: "수락 대기", tone: "warning" }
                              : { label: "신청됨", tone: "grey" }
                            : { label: "확인 필요", tone: "grey" };
                  const extraApplyTag = isBundleExtra ? (
                    <span className="ml-1.5 inline-flex rounded-full bg-brand-pale px-[7px] py-px align-[1px] text-[10.5px] font-bold text-brand-ink ring-1 ring-inset ring-brand-soft">
                      추가 신청
                    </span>
                  ) : null;
                  const showsNicknameLine =
                    head.participantNickname !== depositorName &&
                    !isSyntheticParticipantName(head.participantNickname);
                  // 수락 전에 더 고른 자리가 같은 묶음에 붙으므로 묶음의 신청 시각은 가장 이른 자리 것이다.
                  const bundleAppliedAt = bundle.slots
                    .flatMap((slot) => (slot.appliedAt ? [slot.appliedAt] : []))
                    .sort(
                      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
                    )[0];
                  const bundleTimeInfo =
                    isBundleSent && sentAtSlot?.paymentSentAt
                      ? ` · 보냈어요 ${formatKoreaDateTime(sentAtSlot.paymentSentAt)}`
                      : isBundleAwaiting && head.dueAt
                        ? ` · 기한 ${formatKoreaDateTime(head.dueAt)}`
                        : isBundleConfirmed && head.confirmedAt
                          ? ` · 확인 ${formatKoreaDateTime(head.confirmedAt)}`
                          : isPendingAccept && bundleAppliedAt
                            ? ` · 신청 ${formatKoreaDateTime(bundleAppliedAt)}`
                            : "";

                  return (
                    <article
                      className={`overflow-hidden rounded-[1.05rem] border bg-white px-4 py-3.5 ${
                        isPendingAccept
                          ? "scroll-mt-4 border-warning-ink/25 shadow-[0_0_0_3px_var(--warning-soft)]"
                          : "border-black/10 shadow-[0_10px_28px_rgba(0,0,0,0.035)]"
                      }`}
                      id={
                        bundle.key === firstPendingAcceptBundleKey
                          ? EXTRA_ACCEPT_ANCHOR_ID
                          : undefined
                      }
                      key={bundle.key}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {/* ⚠️ 값이 같으면 감춘다. 입금자명은 비면 닉네임으로 폴백하고(getDepositorName),
                              파서의 participantNickname 도 depositorName 을 별칭으로 흡수한다 — 그대로 두면
                              같은 이름이 두 줄 뜬다. */}
                          {showsNicknameLine ? (
                            <p className="truncate text-[13px] font-semibold text-black/60">
                              <span className="mr-1.5 text-black/35">참여자</span>
                              {head.participantNickname}
                              {extraApplyTag}
                            </p>
                          ) : null}
                          <p className="mt-0.5 truncate text-[14px] font-semibold tracking-[-0.04em]">
                            입금자명 {depositorName}
                            {showsNicknameLine ? null : extraApplyTag}
                          </p>
                          <p className="mt-0.5 text-[12px] font-medium text-black/40">
                            {formatWonAmount(bundleTotal)}
                            {bundle.slots.length > 1
                              ? ` · 멤버 ${bundle.slots.length}명`
                              : ""}
                            {bundleTimeInfo}
                          </p>
                          {/* 배송비는 묶음에 1회만 붙는다 — 합계만 보여주면 개최자가 통장 금액과
                              왜 다른지 설명할 수 없다 (docs/53 Q-22). */}
                          {bundleShippingFee > 0 ? (
                            <p className="mt-0.5 text-[11px] font-medium text-black/30">
                              {`상품 ${formatWonAmount(Math.max(bundleTotal - bundleShippingFee, 0))} + 배송비 ${formatWonAmount(bundleShippingFee)}`}
                            </p>
                          ) : null}
                        </div>
                        <StatusTag tone={bundleStatusTag.tone}>
                          {bundleStatusTag.label}
                        </StatusTag>
                      </div>

                      {/* 묶음으로 접으면서 "어느 자리를 잡았나" 가 흐려진다 — 칩으로 되살린다. */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {bundle.slots.map((slot) => (
                          <span
                            className="rounded-full bg-[#f1f1f1] px-2 py-0.5 text-[11px] font-semibold text-black/60"
                            key={slot.participationId}
                          >
                            {getSlotMemberLabel(slot)}
                          </span>
                        ))}
                      </div>

                      {isPendingAccept ? (
                        <>
                          {hasBundleId ? null : (
                            <HelpText className="mt-3" size="caption">
                              {MISSING_BUNDLE_MESSAGE}
                            </HelpText>
                          )}
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              className="h-11 rounded-full bg-[#f1f1f1] text-[14px] font-semibold tracking-[-0.04em] text-black/60 disabled:text-black/25"
                              disabled={!hasBundleId || pendingC2CAction !== null}
                              onClick={() =>
                                requestRejectExtraBundle(bundle, acceptTargetIds)
                              }
                              type="button"
                            >
                              {pendingC2CAction === `reject:${bundle.key}`
                                ? "거절하는 중"
                                : "거절"}
                            </button>
                            <button
                              className="h-11 rounded-full bg-black text-[14px] font-semibold tracking-[-0.04em] text-brand-strong disabled:bg-black/15 disabled:text-black/35"
                              disabled={!hasBundleId || pendingC2CAction !== null}
                              onClick={() =>
                                acceptExtraBundle(bundle, acceptTargetIds)
                              }
                              type="button"
                            >
                              {pendingC2CAction === `accept:${bundle.key}`
                                ? "수락하는 중"
                                : "수락"}
                            </button>
                          </div>
                          <HelpText className="mt-2" size="caption">
                            추가 신청을 수락하면 참여자가 24시간 안에 입금해요. 거절하면 그 자리는 다시 비어요.
                          </HelpText>
                        </>
                      ) : null}

                      {/* 상태 화이트리스트로 게이트하면 모르는 status 에서 버튼이 0개인 유령 줄이 남는다.
                          서버가 입금확인 대상으로 내려 준 자리가 있을 때만 연다. */}
                      {!isBundleConfirmed && confirmTargetIds.length > 0 ? (
                        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                          {hasBundleId ? null : (
                            <HelpText className="mr-auto" size="caption">
                              {MISSING_BUNDLE_MESSAGE}
                            </HelpText>
                          )}
                          {releasability ? (
                            <>
                              <HelpText className="w-full" size="caption">
                                {releasability === "RELEASABLE"
                                  ? "입금 기한이 지났어요. 통장에 입금이 없다면 「제외」로 빼 주세요. 그 자리는 다시 비어요."
                                  : `기한 ${formatKoreaDateTime(head.dueAt ?? undefined)}이 지나도 입금이 없으면 「제외」를 누를 수 있어요.`}
                              </HelpText>
                              <button
                                className="h-9 shrink-0 rounded-full border border-black/10 bg-white px-3.5 text-[12px] font-semibold text-black/65 disabled:border-black/[0.06] disabled:text-black/25"
                                disabled={
                                  releasability !== "RELEASABLE" ||
                                  !hasBundleId ||
                                  pendingC2CAction !== null
                                }
                                onClick={() => requestReleaseBundle(bundle)}
                                type="button"
                              >
                                {pendingC2CAction === `release:${bundle.key}`
                                  ? "처리 중"
                                  : "제외"}
                              </button>
                            </>
                          ) : null}
                          {confirmTargetIds.length > 0 ? (
                            <button
                              className="h-9 shrink-0 rounded-full bg-black px-3.5 text-[12px] font-semibold text-white disabled:bg-black/15 disabled:text-black/35"
                              disabled={
                                !hasBundleId || pendingC2CAction !== null
                              }
                              onClick={() =>
                                requestConfirmBundlePayment(
                                  bundle,
                                  confirmTargetIds,
                                )
                              }
                              type="button"
                            >
                              {isBundleConfirming ? "처리 중" : "입금 확인"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      {bundleDeliveries.length > 0 ? (
                        <div className="mt-3 space-y-3 border-t border-black/[0.06] pt-3">
                          {bundleDeliveries.map((entry) => {
                            const hasTracking = Boolean(
                              entry.delivery.trackingNumber,
                            );
                            const currentTrackingNumber =
                              entry.delivery.trackingNumber ?? "";
                            // 서버는 배송 중(SHIPPING)까지만 번호를 바꿔 준다 — 배송 완료·수령 완료는 409.
                            const canEditTracking =
                              hasTracking &&
                              isDeliveryShippingStatus(entry.delivery.status);
                            const isEditingTracking =
                              canEditTracking &&
                              editingTrackingOwnerId === entry.ownerId;
                            const isRegistering =
                              pendingC2CAction === `tracking:${entry.ownerId}`;
                            const trackingInput =
                              participantTrackingInputs[entry.ownerId] ?? "";
                            // 같은 번호를 다시 보내도 서버가 알림톡을 또 보낸다 — 저장을 막는다.
                            const isTrackingUnchanged =
                              trackingInput.trim() ===
                              currentTrackingNumber.trim();
                            const ownerSlot =
                              bundle.slots.find(
                                (slot) =>
                                  slot.participationId === entry.ownerId,
                              ) ?? head;

                            return (
                              <div key={entry.delivery.deliveryId}>
                                <p className="text-[12px] font-medium text-black/40">
                                  {[
                                    getShippingMethodLabel(
                                      entry.delivery.shippingMethod,
                                    ),
                                    entry.delivery.storeName,
                                    entry.delivery.receiverPhoneNumber,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                                {hasTracking && !isEditingTracking ? (
                                  <div className="mt-1.5 flex items-center justify-between gap-2">
                                    <p className="min-w-0 text-[13px] font-semibold text-black/60">
                                      운송장 {entry.delivery.trackingNumber}
                                      {getDeliveryStatusLabel(
                                        entry.delivery.status,
                                      )
                                        ? ` · ${getDeliveryStatusLabel(entry.delivery.status)}`
                                        : ""}
                                    </p>
                                    {canEditTracking ? (
                                      <button
                                        className="h-8 shrink-0 rounded-full border border-black/10 bg-white px-3 text-[12px] font-semibold text-black/60 disabled:border-black/[0.06] disabled:text-black/25"
                                        disabled={pendingC2CAction !== null}
                                        onClick={() => {
                                          setParticipantTrackingInputs(
                                            (inputs) => ({
                                              ...inputs,
                                              [entry.ownerId]:
                                                currentTrackingNumber,
                                            }),
                                          );
                                          setEditingTrackingOwnerId(
                                            entry.ownerId,
                                          );
                                        }}
                                        type="button"
                                      >
                                        수정
                                      </button>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div className="mt-2 flex gap-2">
                                    <input
                                      className="h-10 min-w-0 flex-1 rounded-[0.7rem] border border-black/10 px-3 text-[13px] outline-none placeholder:text-black/25 focus:border-black"
                                      inputMode="numeric"
                                      // 🔴 updater 는 렌더 단계에서 늦게 불려 그때 currentTarget 은
                                      // null 이다 — 값을 밖에서 먼저 꺼내야 한다.
                                      onChange={(event) => {
                                        const trackingNumber =
                                          event.currentTarget.value;
                                        setParticipantTrackingInputs(
                                          (inputs) => ({
                                            ...inputs,
                                            [entry.ownerId]: trackingNumber,
                                          }),
                                        );
                                      }}
                                      placeholder="운송장 번호 입력"
                                      value={trackingInput}
                                    />
                                    {isEditingTracking ? (
                                      <>
                                        <button
                                          className="h-10 shrink-0 rounded-full border border-black/10 bg-white px-3.5 text-[13px] font-semibold text-black/60 disabled:border-black/[0.06] disabled:text-black/25"
                                          disabled={isRegistering}
                                          onClick={() => {
                                            setEditingTrackingOwnerId(null);
                                            setParticipantTrackingInputs(
                                              (inputs) => {
                                                const next = { ...inputs };

                                                delete next[entry.ownerId];

                                                return next;
                                              },
                                            );
                                          }}
                                          type="button"
                                        >
                                          취소
                                        </button>
                                        <button
                                          className="h-10 shrink-0 rounded-full bg-black px-4 text-[13px] font-semibold text-white disabled:bg-black/15 disabled:text-black/35"
                                          disabled={
                                            trackingInput.trim().length === 0 ||
                                            isTrackingUnchanged ||
                                            pendingC2CAction !== null
                                          }
                                          onClick={() =>
                                            requestEditParticipantTracking(
                                              ownerSlot,
                                              currentTrackingNumber,
                                            )
                                          }
                                          type="button"
                                        >
                                          {isRegistering ? "저장 중" : "저장"}
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        className="h-10 shrink-0 rounded-full bg-black px-4 text-[13px] font-semibold text-white disabled:bg-black/15 disabled:text-black/35"
                                        disabled={
                                          trackingInput.trim().length === 0 ||
                                          pendingC2CAction !== null
                                        }
                                        onClick={() =>
                                          void handleRegisterParticipantTracking(
                                            ownerSlot,
                                          )
                                        }
                                        type="button"
                                      >
                                        {isRegistering ? "등록 중" : "등록"}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                detail.options.map((option) => {
                const optionId = option.buncheolMemberId;
                const deliveryState = deliveryStates[optionId] ?? {
                  isShipped: false,
                  trackingNumber: option.winner?.trackingNumber ?? "",
                };
                const isPaymentAwaiting = isParticipationAwaitingPaymentStatus(
                  option.winner?.paymentStatus,
                );
                const isConfirming =
                  confirmingPaymentId === option.winner?.participationId;
                const shippingMethodLabel = getShippingMethodLabel(
                  option.winner?.shippingMethod,
                );
                const storeName = option.winner?.storeName ?? "";
                const receiverLabel = getWinnerReceiverLabel(option.winner);
                const deliveryStatusLabel = getDeliveryStatusLabel(
                  option.winner?.deliveryStatus,
                );
                const isPaymentConfirmed =
                  isParticipationConfirmedStatus(option.winner?.paymentStatus) ||
                  Boolean(option.winner?.paymentConfirmedAt);
                // (LEGACY 한정) 운송장 등록은 분철이 진행확정(CONFIRMED)된 뒤에만 가능하다 —
                // 모집중 발송 후 분철이 무산(최소 인원 미달 취소)되는 모순을 막는 서버 가드(DLV-009)와
                // 동일 조건. #183 이 이 가드를 LEGACY 한정으로 좁혔으므로 C2C 분기에는 없다.
                // 중앙 confirmed 계열(PAID 등 동의어 포함)로 넓히지 않고 서버 가드와 같은
                // 정확한 CONFIRMED 비교를 의도적으로 유지한다.
                const isBuncheolConfirmedForShipping =
                  detail.status === "CONFIRMED";
                const canUseTrackingInput = Boolean(
                  option.winner?.deliveryId &&
                    isPaymentConfirmed &&
                    isBuncheolConfirmedForShipping,
                );
                const isRegisteringTracking =
                  registeringTrackingId === option.winner?.deliveryId;
                const hasRegisteredTrackingNumber = Boolean(
                  option.winner?.trackingNumber || deliveryState.isShipped,
                );
                const isPaymentDuePassed = isPastDateTime(
                  option.winner?.paymentDueAt,
                );
                const shouldShowPaymentRecord =
                  Boolean(option.winner) &&
                  (isPaymentAwaiting || isPaymentConfirmed);
                const optionPurchaseAmount = getHighestBidAmount(option);
                const paymentAmount = getWinnerBidAmount(option);
                const hasOrder = Boolean(option.winner);
                // 통장 대조용 이름 — 예금주 우선, 없으면 닉네임 (C2C 참여자 목록과 같은 규칙, docs/53 Q-18).
                // ⚠️ participationId 가 일치하는 참여만 쓴다. LEGACY 는 슬롯당 참여가 여러 건이라
                // participants[0] 은 낙찰자라는 보장이 없고, 그걸 폴백으로 쓰면 제3자의 실명 예금주가
                // "입금자명"에 찍힌다 — 대조를 틀리게 만들 뿐 아니라 실명 노출이다.
                const matchedParticipant = option.participants?.find(
                  (participant) =>
                    participant.participationId ===
                    option.winner?.participationId,
                );
                const optionDepositorName =
                  matchedParticipant?.depositorName ||
                  option.winner?.depositorName ||
                  null;
                const isTrackingRegistered = Boolean(
                  option.winner?.trackingNumber || deliveryState.isShipped,
                );
                const paymentStatusLabel = getPaymentStatusLabel(
                  option.winner ?? null,
                );
                const paymentStatusClass = isPaymentConfirmed
                  ? "bg-black text-white"
                  : hasOrder
                    ? "bg-[#eeeeee] text-black/60"
                    : "bg-[#f7f7f7] text-black/40";

                return (
                  <article
                    className={`overflow-hidden rounded-[1.05rem] border bg-white shadow-[0_10px_28px_rgba(0,0,0,0.035)] ${
                      hasOrder ? "border-black/10" : "border-dashed border-black/10"
                    }`}
                    key={optionId}
                  >
                    <div className="px-4 pb-4 pt-4">
                    <div className="flex items-start gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[1rem] bg-[#f1f1f1] ring-1 ring-black/[0.04]">
                        {option.memberImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt=""
                            className="h-full w-full object-cover"
                            src={option.memberImage}
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-semibold tracking-[-0.04em]">
                          {option.memberName || `멤버 ${option.memberId ?? optionId}`}
                        </p>
                        <p className="mt-1 text-[12px] font-medium text-black/40">
                          참여 {option.participationCount}명
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${paymentStatusClass}`}
                      >
                        {paymentStatusLabel}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-[1.15fr_0.85fr] gap-2">
                      {/* 읽기 전용 금액이라 검정 면을 쓰지 않는다 — 이 화면에서 검정은
                          기본 버튼·현재 선택을 뜻해서, 누를 수 있는 것처럼 보였다. */}
                      <div className="rounded-[0.9rem] bg-brand-pale px-3 py-3 ring-1 ring-[#E4F6A5]/70">
                        <p className="text-[11px] font-medium text-black/35">
                          상품 금액
                        </p>
                        <p className="mt-1 text-[17px] font-semibold tracking-[-0.04em]">
                          {formatWonAmount(optionPurchaseAmount)}
                        </p>
                      </div>
                      <div className="rounded-[0.9rem] bg-[#f7f7f7] px-3 py-3">
                        <p className="text-[11px] font-medium text-black/35">
                          참여
                        </p>
                        <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                          {option.participationCount}명
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                      <span
                        className={`rounded-full px-2 py-1.5 text-[11px] font-semibold ${
                          hasOrder
                            ? "bg-black text-white"
                            : "bg-[#f7f7f7] text-black/35"
                        }`}
                      >
                        참여
                      </span>
                      <span
                        className={`rounded-full px-2 py-1.5 text-[11px] font-semibold ${
                          isPaymentConfirmed
                            ? "bg-black text-white"
                            : "bg-[#f7f7f7] text-black/35"
                        }`}
                      >
                        입금 확인
                      </span>
                      <span
                        className={`rounded-full px-2 py-1.5 text-[11px] font-semibold ${
                          isTrackingRegistered
                            ? "bg-black text-white"
                            : "bg-[#f7f7f7] text-black/35"
                        }`}
                      >
                        배송 등록
                      </span>
                    </div>

                    </div>

                    <div className="border-t border-black/10 px-4 py-4">
                      {(
                        <>
                          {shouldShowPaymentRecord ? (
                            <div className="rounded-[0.9rem] border border-black/[0.06] bg-white px-3 py-3 shadow-[0_8px_20px_rgba(0,0,0,0.025)]">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium text-black/35">
                                    입금 확인
                                  </p>
                                  <div className="mt-2 space-y-1">
                                    <p className="text-[13px] font-semibold text-black/60">
                                      <span className="mr-2 text-black/35">
                                        참여자
                                      </span>
                                      {/* ⚠️ winner.depositorName 을 쓰면 안 된다. winner 파서는
                                          depositorName → … → participantNickname 순으로 읽는데,
                                          서버가 참여 레코드에 depositorName(실명 예금주)을 싣기 시작하면
                                          이 줄이 실명으로 바뀐다 — 라벨과 값이 어긋나고 바로 아래
                                          "입금자명"과 같은 값이 두 번 뜨며 닉네임이 화면에서 사라진다.
                                          이 줄은 닉네임 전용이다. */}
                                      {matchedParticipant?.participantNickname &&
                                      !isSyntheticParticipantName(
                                        matchedParticipant.participantNickname,
                                      )
                                        ? matchedParticipant.participantNickname
                                        : "-"}
                                    </p>
                                    {/* 통장에 찍히는 건 예금주명이라, 닉네임(참여자)만으로는 대조가 안 된다 (docs/53 Q-18).
                                        C2C 참여자 목록과 같은 규칙(예금주 우선)을 여기서도 보여준다. */}
                                    <p className="text-[13px] font-semibold text-black/60">
                                      <span className="mr-2 text-black/35">
                                        입금자명
                                      </span>
                                      {optionDepositorName ?? "-"}
                                    </p>
                                    <p className="text-[13px] font-semibold text-black/60">
                                      <span className="mr-2 text-black/35">
                                        입금액
                                      </span>
                                      {formatWonAmount(paymentAmount)}
                                    </p>
                                    <p className="text-[13px] font-semibold text-black/60">
                                      <span className="mr-2 text-black/35">
                                        {isPaymentConfirmed ? "확인" : "기한"}
                                      </span>
                                      {formatKoreaDateTime(
                                        isPaymentConfirmed
                                          ? option.winner?.paymentConfirmedAt
                                          : option.winner?.paymentDueAt,
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  className="h-10 shrink-0 rounded-full bg-black px-4 text-[13px] font-semibold text-white disabled:bg-black/10 disabled:text-black/30"
                                  disabled={
                                    !option.winner?.participationId ||
                                    isPaymentConfirmed ||
                                    isPaymentDuePassed ||
                                    isConfirming
                                  }
                                  onClick={() => void confirmPayment(option)}
                                  type="button"
                                >
                                  {isPaymentConfirmed
                                    ? "입금 확인 완료"
                                    : isConfirming
                                      ? "확인 중"
                                      : "입금 확인"}
                                </button>
                              </div>
                              {/* "확인 시각 …" 줄을 뺐다 — 바로 위 "확인 …" 이 같은
                                  paymentConfirmedAt 을 이미 보여주고 있어, 입금 확인이
                                  끝난 건마다 같은 시각이 두 줄 연속으로 찍혔다. */}
                            </div>
                          ) : (
                            <div className="rounded-[0.85rem] bg-[#f7f7f7] px-3 py-3">
                              <p className="text-[11px] font-medium text-black/35">
                                입금 확인
                              </p>
                              <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em] text-black/60">
                                {option.winner
                                  ? isPaymentDuePassed
                                    ? "입금 기한이 지났어요."
                                    : "참여자 입금을 기다리고 있어요."
                                  : "아직 참여자가 없어요."}
                              </p>
                              {option.winner?.paymentDueAt ? (
                                <p className="mt-1 text-[12px] font-medium text-black/35">
                                  기한{" "}
                                  {formatKoreaDateTime(
                                    option.winner.paymentDueAt,
                                  )}
                                </p>
                              ) : null}
                            </div>
                          )}

                          {isPaymentConfirmed ? (
                            <>
                              <div className="mt-3 rounded-[0.85rem] bg-black/[0.04] px-3 py-3">
                                <p className="text-[11px] font-medium text-black/35">
                                  배송 정보
                                </p>
                                {shippingMethodLabel || storeName ? (
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {shippingMethodLabel ? (
                                      <span className="inline-flex h-8 items-center rounded-full bg-black px-3 text-[12px] font-semibold text-white">
                                        {shippingMethodLabel}
                                      </span>
                                    ) : null}
                                    {storeName ? (
                                      <span className="text-[15px] font-semibold tracking-[-0.04em] text-black">
                                        {storeName}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : (
                                  <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em] text-black/60">
                                    배송 정보가 아직 내려오지 않았어요.
                                  </p>
                                )}
                                {receiverLabel ? (
                                  <p className="mt-3 text-[13px] font-semibold text-black/45">
                                    연락처 {receiverLabel}
                                  </p>
                                ) : null}
                                {deliveryStatusLabel ? (
                                  <p className="mt-2 text-[12px] font-medium text-black/35">
                                    {deliveryStatusLabel}
                                  </p>
                                ) : null}
                              </div>

                              <label className="mt-3 block">
                                <span className="text-[12px] font-semibold text-black/45">
                                  운송장 번호
                                </span>
                                <input
                                  className="mt-2 h-12 w-full rounded-[0.85rem] border border-black/10 bg-white px-4 text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black disabled:bg-[#f7f7f7] disabled:text-black/35"
                                  disabled={
                                    hasRegisteredTrackingNumber ||
                                    !canUseTrackingInput ||
                                    isRegisteringTracking
                                  }
                                  inputMode="numeric"
                                  onChange={(event) =>
                                    updateTrackingNumber(
                                      optionId,
                                      event.currentTarget.value,
                                    )
                                  }
                                  placeholder={
                                    canUseTrackingInput
                                      ? "운송장 번호 입력"
                                      : isBuncheolConfirmedForShipping
                                        ? "배송 ID 확인 중"
                                        : "분철 진행 확정 후 등록 가능"
                                  }
                                  value={deliveryState.trackingNumber}
                                />
                              </label>

                              <button
                                type="button"
                                className="mt-3 h-12 w-full rounded-full bg-black text-[15px] font-semibold tracking-[-0.04em] text-white disabled:bg-black/15 disabled:text-black/35"
                                disabled={
                                  hasRegisteredTrackingNumber ||
                                  !canUseTrackingInput ||
                                  isRegisteringTracking ||
                                  deliveryState.trackingNumber.trim().length === 0
                                }
                                onClick={() => void completeShipping(option)}
                              >
                                {hasRegisteredTrackingNumber
                                  ? "운송장 등록 완료"
                                  : isRegisteringTracking
                                    ? "등록 중"
                                    : "운송장 등록"}
                              </button>
                            </>
                          ) : null}
                        </>
                      )}
                    </div>
                  </article>
                );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {openChatUrlDraft !== null ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-4 backdrop-blur-[2px]">
          <div className="w-full max-w-[402px] rounded-[1.2rem] bg-white px-5 pb-5 pt-5">
            <p className="text-[16px] font-semibold tracking-[-0.04em]">
              오픈채팅 링크
            </p>
            <HelpText className="mt-1">
              카카오 오픈채팅 주소를 붙여 넣어 주세요. 비우고 저장하면 링크가
              지워져요.
            </HelpText>
            <input
              aria-invalid={openChatUrlError ? true : undefined}
              aria-label="오픈채팅 링크"
              autoFocus
              className="mt-3 h-12 w-full rounded-[0.9rem] border border-black/10 px-4 text-[15px] tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
              inputMode="url"
              maxLength={200}
              onChange={(event) => {
                setOpenChatUrlDraft(event.currentTarget.value);
                setOpenChatUrlError("");
              }}
              placeholder="https://open.kakao.com/o/..."
              type="url"
              value={openChatUrlDraft}
            />
            {openChatUrlError ? (
              <p className="mt-2 text-[12px] font-semibold text-danger-base">
                {openChatUrlError}
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="h-12 rounded-full bg-[#f4f4f4] text-[15px] font-semibold text-black/60 disabled:text-black/25"
                disabled={isSavingOpenChatUrl}
                onClick={() => {
                  setOpenChatUrlDraft(null);
                  setOpenChatUrlError("");
                }}
                type="button"
              >
                취소
              </button>
              <button
                className="h-12 rounded-full bg-[#CFE86B] text-[15px] font-semibold text-black disabled:bg-black/20 disabled:text-white"
                disabled={isSavingOpenChatUrl}
                onClick={saveOpenChatUrl}
                type="button"
              >
                {isSavingOpenChatUrl ? "저장 중" : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addMemberSheet !== null ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-4 backdrop-blur-[2px]">
          <div className="flex max-h-[calc(100%-2rem)] w-full max-w-[402px] flex-col rounded-[1.2rem] bg-white px-5 pb-5 pt-5">
            <p className="shrink-0 text-[16px] font-semibold tracking-[-0.04em]">
              멤버 추가
            </p>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {addMemberSheet.closedCandidates.length +
                addMemberSheet.groupCandidates.length >
              0 ? (
                <ul className="space-y-1.5">
                  {[
                    ...addMemberSheet.closedCandidates,
                    ...addMemberSheet.groupCandidates,
                  ].map((candidate) => {
                    const isSelected =
                      candidate.memberId === addMemberSelectedId;

                    return (
                      <li key={candidate.memberId}>
                        <button
                          aria-pressed={isSelected}
                          className={`flex w-full items-center justify-between gap-3 rounded-[0.85rem] border px-3 py-2.5 text-left ${
                            isSelected
                              ? "border-black bg-[#F7FAEE]"
                              : "border-black/10 bg-white"
                          }`}
                          disabled={pendingC2CAction === "add-member"}
                          onClick={() => selectAddMemberCandidate(candidate)}
                          type="button"
                        >
                          <span className="min-w-0 truncate text-[14px] font-semibold tracking-[-0.04em]">
                            {candidate.name}
                          </span>
                          {typeof candidate.previousPrice === "number" ? (
                            <span className="shrink-0 text-[12px] font-medium text-black/40">
                              {`이전 가격 ${candidate.previousPrice.toLocaleString("ko-KR")}원`}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {addMemberSheet.isLoading ? (
                <p className="py-3 text-center text-[13px] font-medium text-black/40">
                  멤버 목록을 불러오는 중이에요.
                </p>
              ) : addMemberSheet.loadFailed ? (
                <HelpText className="mt-2">
                  멤버 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
                </HelpText>
              ) : addMemberSheet.closedCandidates.length +
                  addMemberSheet.groupCandidates.length ===
                0 ? (
                <p className="py-3 text-center text-[13px] font-medium text-black/40">
                  더 넣을 수 있는 멤버가 없어요.
                </p>
              ) : null}
            </div>
            <label
              className="mt-4 block shrink-0 text-[12px] font-semibold text-black/45"
              htmlFor="add-member-price"
            >
              가격(100원 단위)
            </label>
            <input
              aria-invalid={addMemberError ? true : undefined}
              className="mt-1.5 h-12 w-full shrink-0 rounded-[0.9rem] border border-black/10 px-4 text-[15px] tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black disabled:bg-[#f7f7f7]"
              disabled={
                addMemberSelectedId === null ||
                pendingC2CAction === "add-member"
              }
              id="add-member-price"
              inputMode="numeric"
              maxLength={9}
              onChange={(event) => {
                setAddMemberPriceDraft(
                  event.currentTarget.value.replace(/[^\d]/g, ""),
                );
                setAddMemberError("");
              }}
              type="text"
              value={addMemberPriceDraft}
            />
            {addMemberError ? (
              <p className="mt-2 shrink-0 text-[12px] font-semibold text-danger-base">
                {addMemberError}
              </p>
            ) : null}
            <div className="mt-4 grid shrink-0 grid-cols-2 gap-2">
              <button
                className="h-12 rounded-full bg-[#f4f4f4] text-[15px] font-semibold text-black/60 disabled:text-black/25"
                disabled={pendingC2CAction === "add-member"}
                onClick={closeAddMemberSheet}
                type="button"
              >
                취소
              </button>
              <button
                className="h-12 rounded-full bg-[#CFE86B] text-[15px] font-semibold text-black disabled:bg-black/20 disabled:text-white"
                disabled={
                  addMemberSelectedId === null ||
                  addMemberPriceDraft === "" ||
                  pendingC2CAction !== null
                }
                onClick={() => void submitAddMember()}
                type="button"
              >
                {pendingC2CAction === "add-member" ? "추가하는 중" : "추가"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmSheet
        onCancel={() => {
          confirmSheetRequest?.onCancel?.();
          setConfirmSheetRequest(null);
        }}
        request={confirmSheetRequest}
      />
    </main>
  );
}
