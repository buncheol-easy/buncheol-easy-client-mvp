import type {
  InboxMessageDetail,
  InboxMessageSummary,
} from "@/lib/auth-api";

export type BoardCategory = "notice" | "alert";

export type BoardPost = {
  id: string;
  category: BoardCategory;
  title: string;
  date: string;
  isNew?: boolean;
  isPinned?: boolean;
  summary: string;
  body: string[];
  action?: {
    href: string;
    label: string;
    title: string;
  };
};

function getBoardCategoryFromInboxType(type: string | undefined): BoardCategory {
  return type === "NOTICE" ? "notice" : "alert";
}

function formatBoardDate(value: string | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const today = new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(new Date());
  const target = new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(date);

  if (today === target) {
    return "오늘";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function isRecentlyCreated(value: string | undefined) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return Date.now() - date.getTime() < 1000 * 60 * 60 * 24 * 3;
}

// 문단 안의 줄바꿈·앞 공백은 유지한다 (본문은 whitespace-pre-wrap 으로 렌더링).
function getBodyParagraphs(description: string | undefined, fallback: string) {
  const paragraphs = (description ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trimEnd())
    .filter((paragraph) => paragraph.trim().length > 0);

  return paragraphs.length > 0 ? paragraphs : [fallback];
}

export function getBoardPostFromInboxMessage(
  message: InboxMessageDetail | InboxMessageSummary,
): BoardPost {
  const detail = message as InboxMessageDetail;
  const summary = detail.reference || detail.description || message.title;

  return {
    id: message.id,
    body: getBodyParagraphs(detail.description, summary),
    category: getBoardCategoryFromInboxType(message.type),
    date: formatBoardDate(message.createdAt),
    isNew: isRecentlyCreated(message.createdAt),
    isPinned: message.pinned,
    summary,
    title: message.title,
    action: detail.linkPath
      ? {
          href: detail.linkPath,
          label: "관련 화면 보기",
          title: detail.reference || "연결된 화면으로 이동",
        }
      : undefined,
  };
}

export const boardPosts: BoardPost[] = [
  {
    id: "transfer-payment",
    category: "notice",
    title: "입금 확인 방식이 계좌이체 기반으로 변경될 예정이에요",
    date: "오늘",
    isNew: true,
    isPinned: true,
    summary: "참여 후 입금 안내와 확인 흐름이 계좌이체 기준으로 정리돼요.",
    body: [
      "PG 결제 연동 전까지 참여 상품 결제는 계좌이체 기반으로 운영될 예정이에요.",
      "결제 화면에서는 입금 계좌와 금액을 확인하고, 송금 후 운영자 확인을 기다리는 흐름으로 진행돼요.",
      "입금 확인 기준과 운영자 승인 방식은 서비스 테스트 상황에 맞춰 계속 다듬을게요.",
    ],
  },
  {
    id: "payment-due",
    category: "alert",
    title: "참여된 분철은 결제 가능 시간 안에 입금해 주세요",
    date: "오늘",
    isNew: true,
    summary: "결제 대기 상태인 분철은 기한 안에 입금이 필요해요.",
    body: [
      "참여 후 결제 대기 상태로 바뀐 분철은 안내된 시간 안에 입금해 주세요.",
      "기한이 지나면 주최자 확인이나 운영 정책에 따라 참여 상태가 변경될 수 있어요.",
      "입금 전에는 상품명, 멤버 옵션, 배송지를 다시 한 번 확인하는 걸 추천해요.",
    ],
    action: {
      href: "/profile/bids",
      label: "참여 내역으로 이동",
      title: "결제할 참여 내역을 확인해요",
    },
  },
  {
    id: "shipping-method-filter",
    category: "notice",
    title: "편의점 반값택배 배송지는 상품별 지원 택배사만 선택할 수 있어요",
    date: "5월 31일",
    summary: "상품이 지원하는 CU/GS25 배송 방식에 맞춰 배송지가 표시돼요.",
    body: [
      "상품이 CU 반값택배만 지원하면 CU 배송지만, GS25 반값택배만 지원하면 GS25 배송지만 선택할 수 있어요.",
      "두 배송 방식을 모두 지원하는 상품은 등록된 CU와 GS25 배송지가 함께 표시돼요.",
      "배송지가 보이지 않는다면 마이페이지에서 해당 편의점 배송지를 먼저 등록해 주세요.",
    ],
  },
  {
    id: "closed-bid-status",
    category: "alert",
    title: "참여 후 입금 기한 안에 계좌이체를 진행해 주세요",
    date: "5월 30일",
    summary: "모집 종료 직후에는 상태 반영까지 시간이 조금 걸릴 수 있어요.",
    body: [
      "모집 기한까지 참여를 받고, 입금 기한 내 결제 확인 상태를 반영해요.",
      "상태 반영 전에는 참여 내역에서 아직 진행 중이거나 모집 종료처럼 보일 수 있어요.",
      "잠시 후 다시 확인하면 결제 가능한 참여 항목이 갱신돼요.",
    ],
    action: {
      href: "/profile/bids",
      label: "참여 내역으로 이동",
      title: "내 참여 상태를 다시 확인해요",
    },
  },
  {
    id: "favorite-group-limit",
    category: "notice",
    title: "최애 아티스트는 최대 5개까지 등록할 수 있어요",
    date: "5월 29일",
    summary: "최애 목록이 가득 차면 하나를 해제한 뒤 새 아티스트를 추가해 주세요.",
    body: [
      "현재 최애 아티스트는 최대 5개까지 등록할 수 있어요.",
      "목록이 가득 찬 상태에서 새 아티스트를 추가하려면 기존 최애 중 하나를 먼저 해제해야 해요.",
      "최애 아티스트는 홈 추천과 찜 필터에서 더 빠르게 관심 상품을 찾는 데 사용돼요.",
    ],
  },
  {
    id: "upload-option-check",
    category: "notice",
    title: "분철 등록 시 멤버별 옵션과 배송 방법을 다시 확인해 주세요",
    date: "5월 28일",
    summary: "등록 전 멤버 옵션, 최소가, 배송 방식을 한 번 더 확인해 주세요.",
    body: [
      "분철 등록 후 참여자가 생기면 옵션 변경이 어려울 수 있어요.",
      "멤버별 옵션 가격과 배송 가능 택배사를 등록 전에 다시 확인해 주세요.",
      "정확한 옵션은 참여자 혼선을 줄이고 결제 확인과 배송 흐름을 더 안정적으로 만들어줘요.",
    ],
  },
];

export function getBoardPost(id: string) {
  return boardPosts.find((post) => post.id === id) ?? null;
}
