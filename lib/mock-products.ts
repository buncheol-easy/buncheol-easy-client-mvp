import type { ProductCardItem } from "@/components/ProductCard";

export type ProductOption = {
  id: string;
  imageUrl?: string;
  buncheolMemberId?: string;
  myBidAmount?: number;
  myParticipationId?: string;
  myRank?: number;
  label: string;
  price: string;
  startingBid?: string;
  currentBid: string;
  participantCount: number;
  topBids?: [string, string, string];
  avatarInitials?: string;
  avatarTone?: string;
};

export type ShippingMethod = {
  name: string;
  price: string;
};

export type ProductDetailItem = ProductCardItem & {
  buncheolId?: string;
  courier: string;
  description: string;
  deadline: string;
  imageUrl?: string;
  imageUrls?: string[];
  imageIds?: number[];
  isApiProduct?: boolean;
  isPublicPreview?: boolean;
  isBidUnavailable?: boolean;
  isHostedByMe?: boolean;
  minHeadcount?: number | null;
  purchaseSource?: string;
  shippingDeadline?: string;
  shippingMethods?: ShippingMethod[];
  status?: string;
  options: [ProductOption, ...ProductOption[]];
};

export const productDetails: ProductDetailItem[] = [
  {
    id: "ive-switch-album-split",
    title: "IVE SWITCH 앨범 분철",
    member: "장원영 외 2명",
    targetMembers: ["장원영", "안유진", "리즈"],
    uploadedAt: "2026.05.02 12",
    era: "IVE SWITCH",
    price: "4,800원",
    rating: "4.8",
    reviews: "41",
    badge: "인기",
    liked: true,
    tone: "from-black via-zinc-800 to-zinc-500",
    courier: "GS 편의점 택배",
    deadline: "2026.05.03 23",
    purchaseSource: "스타쉽 스퀘어",
    shippingDeadline: "마감 후 7일 이내",
    shippingMethods: [
      { name: "GS 편의점 택배", price: "2,000원" },
      { name: "CU 편의점 택배", price: "2,100원" },
    ],
    description: "앨범 개봉 후 멤버별 구성품을 분리해 방수 포장으로 발송해요.",
    options: [
      {
        id: "wonyoung",
        label: "장원영",
        price: "5,400원",
        currentBid: "5,400원",
        participantCount: 18,
        topBids: ["5,400원", "5,200원", "5,000원"],
        avatarInitials: "WY",
        avatarTone: "from-zinc-950 via-zinc-600 to-zinc-200",
      },
      {
        id: "yujin",
        label: "안유진",
        price: "4,800원",
        currentBid: "4,800원",
        participantCount: 14,
        topBids: ["4,800원", "4,600원", "4,400원"],
        avatarInitials: "YJ",
        avatarTone: "from-neutral-200 via-white to-zinc-500",
      },
      {
        id: "liz",
        label: "리즈",
        price: "4,200원",
        currentBid: "4,200원",
        participantCount: 9,
        topBids: ["4,200원", "4,000원", "3,800원"],
        avatarInitials: "LZ",
        avatarTone: "from-black via-zinc-700 to-stone-300",
      },
    ],
  },
  {
    id: "aespa-armageddon-album-split",
    title: "aespa Armageddon 앨범 분철",
    member: "카리나 외 2명",
    targetMembers: ["카리나", "윈터", "닝닝"],
    uploadedAt: "2026.05.05 10",
    era: "aespa Armageddon",
    price: "5,200원",
    rating: "4.9",
    reviews: "63",
    badge: "추천",
    liked: true,
    tone: "from-zinc-700 via-zinc-500 to-zinc-100",
    courier: "CU 편의점 택배",
    deadline: "2026.05.06 23",
    purchaseSource: "SMTOWN &STORE",
    shippingDeadline: "마감 후 5일 이내",
    shippingMethods: [
      { name: "CU 편의점 택배", price: "2,000원" },
    ],
    description: "앨범 특전과 포토카드를 멤버별로 나눠서 안전하게 보내드립니다.",
    options: [
      {
        id: "karina",
        label: "카리나",
        price: "6,000원",
        currentBid: "6,000원",
        participantCount: 22,
        topBids: ["6,000원", "5,700원", "5,400원"],
        avatarInitials: "KR",
        avatarTone: "from-zinc-800 via-zinc-400 to-white",
      },
      {
        id: "winter",
        label: "윈터",
        price: "5,600원",
        currentBid: "5,600원",
        participantCount: 19,
        topBids: ["5,600원", "5,300원", "5,000원"],
        avatarInitials: "WT",
        avatarTone: "from-stone-200 via-white to-zinc-600",
      },
      {
        id: "ningning",
        label: "닝닝",
        price: "4,900원",
        currentBid: "4,900원",
        participantCount: 11,
        topBids: ["4,900원", "4,700원", "4,500원"],
        avatarInitials: "NN",
        avatarTone: "from-zinc-200 via-white to-neutral-500",
      },
    ],
  },
  {
    id: "newjeans-get-up-album-split",
    title: "NewJeans Get Up 앨범 분철",
    member: "민지 외 3명",
    targetMembers: ["민지", "하니", "다니엘", "해린"],
    uploadedAt: "2026.05.06 09",
    era: "NewJeans Get Up",
    price: "4,600원",
    rating: "4.7",
    reviews: "29",
    badge: "신규",
    liked: true,
    tone: "from-zinc-900 via-zinc-700 to-zinc-300",
    courier: "GS 편의점 택배",
    deadline: "2026.05.08 21",
    purchaseSource: "Weverse Shop",
    shippingDeadline: "입고 후 10일 이내",
    shippingMethods: [
      { name: "GS 편의점 택배", price: "2,000원" },
    ],
    description: "앨범 개봉 후 멤버별 구성품을 정리해 OPP 포장으로 발송합니다.",
    options: [
      {
        id: "minji",
        label: "민지",
        price: "4,800원",
        currentBid: "4,800원",
        participantCount: 10,
        topBids: ["4,800원", "4,600원", "4,400원"],
        avatarInitials: "MJ",
        avatarTone: "from-zinc-950 via-zinc-600 to-zinc-200",
      },
      {
        id: "hanni",
        label: "하니",
        price: "5,100원",
        currentBid: "5,100원",
        participantCount: 13,
        topBids: ["5,100원", "4,900원", "4,700원"],
        avatarInitials: "HN",
        avatarTone: "from-neutral-200 via-zinc-50 to-zinc-500",
      },
      {
        id: "danielle",
        label: "다니엘",
        price: "4,300원",
        currentBid: "4,300원",
        participantCount: 8,
        topBids: ["4,300원", "4,100원", "3,900원"],
        avatarInitials: "DN",
        avatarTone: "from-stone-200 via-zinc-100 to-zinc-700",
      },
      {
        id: "haerin",
        label: "해린",
        price: "4,900원",
        currentBid: "4,900원",
        participantCount: 12,
        topBids: ["4,900원", "4,700원", "4,500원"],
        avatarInitials: "HR",
        avatarTone: "from-zinc-100 via-white to-neutral-400",
      },
    ],
  },
  {
    id: "lesserafim-easy-album-split",
    title: "LE SSERAFIM EASY 앨범 분철",
    member: "김채원 외 2명",
    targetMembers: ["김채원", "사쿠라", "허윤진"],
    uploadedAt: "2026.05.04 15",
    era: "LE SSERAFIM EASY",
    price: "5,000원",
    rating: "4.6",
    reviews: "87",
    badge: "마감임박",
    liked: true,
    tone: "from-zinc-300 via-zinc-100 to-neutral-400",
    courier: "CU 편의점 택배",
    deadline: "2026.05.12 23",
    purchaseSource: "Source Music Shop",
    shippingDeadline: "마감 후 6일 이내",
    shippingMethods: [
      { name: "CU 편의점 택배", price: "2,000원" },
      { name: "GS 편의점 택배", price: "2,100원" },
    ],
    description: "앨범 구성품을 멤버별로 분리하고 기본 방수 포장을 포함합니다.",
    options: [
      {
        id: "chaewon",
        label: "김채원",
        price: "5,700원",
        currentBid: "5,700원",
        participantCount: 17,
        topBids: ["5,700원", "5,400원", "5,100원"],
        avatarInitials: "CW",
        avatarTone: "from-zinc-200 via-white to-neutral-500",
      },
      {
        id: "sakura",
        label: "사쿠라",
        price: "5,200원",
        currentBid: "5,200원",
        participantCount: 12,
        topBids: ["5,200원", "5,000원", "4,800원"],
        avatarInitials: "SK",
        avatarTone: "from-black via-zinc-600 to-stone-200",
      },
      {
        id: "yunjin",
        label: "허윤진",
        price: "4,900원",
        currentBid: "4,900원",
        participantCount: 9,
        topBids: ["4,900원", "4,700원", "4,500원"],
        avatarInitials: "YJ",
        avatarTone: "from-zinc-900 via-zinc-500 to-white",
      },
    ],
  },
  {
    id: "ive-mine-album-split",
    title: "IVE I'VE MINE 앨범 분철",
    member: "레이 외 3명",
    targetMembers: ["레이", "이서", "가을", "리즈"],
    uploadedAt: "2026.04.28 11",
    era: "IVE I'VE MINE",
    price: "4,400원",
    rating: "4.5",
    reviews: "18",
    badge: "소량",
    liked: true,
    tone: "from-zinc-950 via-zinc-700 to-stone-300",
    courier: "GS 편의점 택배",
    deadline: "2026.05.20 20",
    purchaseSource: "스타쉽 스퀘어",
    shippingDeadline: "마감 후 4일 이내",
    shippingMethods: [
      { name: "GS 편의점 택배", price: "2,000원" },
      { name: "CU 편의점 택배", price: "2,100원" },
    ],
    description: "미개봉 앨범 개봉 후 멤버별 구성품을 분리해 발송합니다.",
    options: [
      {
        id: "rei",
        label: "레이",
        price: "4,600원",
        currentBid: "4,600원",
        participantCount: 8,
        topBids: ["4,600원", "4,400원", "4,200원"],
        avatarInitials: "RE",
        avatarTone: "from-zinc-900 via-zinc-500 to-white",
      },
      {
        id: "leeseo",
        label: "이서",
        price: "4,900원",
        currentBid: "4,900원",
        participantCount: 10,
        topBids: ["4,900원", "4,700원", "4,500원"],
        avatarInitials: "LS",
        avatarTone: "from-stone-300 via-white to-zinc-600",
      },
      {
        id: "gaeul",
        label: "가을",
        price: "4,200원",
        currentBid: "4,200원",
        participantCount: 6,
        topBids: ["4,200원", "4,000원", "3,800원"],
        avatarInitials: "GE",
        avatarTone: "from-neutral-200 via-white to-zinc-600",
      },
      {
        id: "liz",
        label: "리즈",
        price: "4,500원",
        currentBid: "4,500원",
        participantCount: 7,
        topBids: ["4,500원", "4,300원", "4,100원"],
        avatarInitials: "LZ",
        avatarTone: "from-zinc-950 via-zinc-500 to-stone-200",
      },
    ],
  },
  {
    id: "aespa-supernova-album-split",
    title: "aespa Supernova 앨범 분철",
    member: "지젤 외 1명",
    targetMembers: ["지젤", "윈터"],
    uploadedAt: "2026.04.25 18",
    era: "aespa Supernova",
    price: "5,300원",
    rating: "4.9",
    reviews: "72",
    badge: "인기",
    liked: true,
    tone: "from-neutral-300 via-zinc-100 to-zinc-500",
    courier: "CU 편의점 택배",
    deadline: "2026.06.03 23",
    purchaseSource: "SMTOWN &STORE",
    shippingDeadline: "특전 입고 후 7일 이내",
    shippingMethods: [
      { name: "CU 편의점 택배", price: "2,000원" },
      { name: "GS 편의점 택배", price: "2,100원" },
    ],
    description: "장기 마감 테스트용 앨범 분철입니다. 멤버별 옵션을 선택해 주세요.",
    options: [
      {
        id: "giselle",
        label: "지젤",
        price: "5,300원",
        currentBid: "5,300원",
        participantCount: 12,
        topBids: ["5,300원", "5,100원", "4,900원"],
        avatarInitials: "GZ",
        avatarTone: "from-neutral-200 via-zinc-50 to-zinc-600",
      },
      {
        id: "winter",
        label: "윈터",
        price: "5,900원",
        currentBid: "5,900원",
        participantCount: 15,
        topBids: ["5,900원", "5,600원", "5,300원"],
        avatarInitials: "WT",
        avatarTone: "from-zinc-950 via-zinc-500 to-stone-200",
      },
    ],
  },
];

export function getProductById(id: string) {
  return productDetails.find((product) => product.id === id);
}
