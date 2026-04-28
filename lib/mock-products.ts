import type { ProductCardItem } from "@/components/ProductCard";

export type ProductOption = {
  id: string;
  label: string;
  price: string;
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
  courier: string;
  description: string;
  deadline: string;
  purchaseSource?: string;
  shippingDeadline?: string;
  shippingMethods?: ShippingMethod[];
  options: [ProductOption, ...ProductOption[]];
};

export const productDetails: ProductDetailItem[] = [
  {
    id: "ive-love-dive-wonyoung-1",
    title: "러브다이브 미공포 1차 분철",
    member: "장원영",
    era: "IVE LOVE DIVE",
    price: "3,000원",
    rating: "4.8",
    reviews: "41",
    badge: "인기",
    liked: true,
    tone: "from-black via-zinc-800 to-zinc-500",
    courier: "CJ대한통운",
    deadline: "2026.05.03 23:59",
    purchaseSource: "스타쉽 스퀘어",
    shippingDeadline: "마감 후 7일 이내",
    shippingMethods: [
      { name: "일반 택배", price: "3,200원" },
      { name: "반값 택배", price: "2,000원" },
      { name: "준등기", price: "1,800원" },
    ],
    description: "포토카드는 슬리브와 탑로더로 포장해서 안전하게 보내드려요.",
    options: [
      {
        id: "photocard",
        label: "포토카드 1매",
        price: "3,000원",
        currentBid: "3,000원",
        participantCount: 8,
        topBids: ["3,000원", "2,800원", "2,600원"],
        avatarInitials: "PC",
        avatarTone: "from-zinc-950 via-zinc-600 to-zinc-200",
      },
      {
        id: "toploader",
        label: "탑로더 추가",
        price: "3,500원",
        currentBid: "3,500원",
        participantCount: 5,
        topBids: ["3,500원", "3,300원", "3,100원"],
        avatarInitials: "TL",
        avatarTone: "from-neutral-200 via-white to-zinc-500",
      },
      {
        id: "pob-a",
        label: "미공포 A버전",
        price: "4,200원",
        currentBid: "4,200원",
        participantCount: 11,
        topBids: ["4,200원", "4,000원", "3,900원"],
        avatarInitials: "A",
        avatarTone: "from-black via-zinc-700 to-stone-300",
      },
      {
        id: "pob-b",
        label: "미공포 B버전",
        price: "4,700원",
        currentBid: "4,700원",
        participantCount: 9,
        topBids: ["4,700원", "4,500원", "4,300원"],
        avatarInitials: "B",
        avatarTone: "from-zinc-300 via-zinc-50 to-neutral-500",
      },
      {
        id: "lucky-draw",
        label: "럭키드로우 특전",
        price: "5,000원",
        currentBid: "5,000원",
        participantCount: 16,
        topBids: ["5,000원", "4,800원", "4,600원"],
        avatarInitials: "LD",
        avatarTone: "from-zinc-900 via-neutral-500 to-white",
      },
      {
        id: "broadcast",
        label: "방송 사녹 포카",
        price: "6,500원",
        currentBid: "6,500원",
        participantCount: 21,
        topBids: ["6,500원", "6,200원", "6,000원"],
        avatarInitials: "BC",
        avatarTone: "from-neutral-700 via-zinc-300 to-white",
      },
      {
        id: "unit-card",
        label: "유닛 포카",
        price: "3,800원",
        currentBid: "3,800원",
        participantCount: 6,
        topBids: ["3,800원", "3,600원", "3,400원"],
        avatarInitials: "UN",
        avatarTone: "from-stone-200 via-zinc-100 to-zinc-700",
      },
      {
        id: "message-card",
        label: "메시지 카드",
        price: "2,900원",
        currentBid: "2,900원",
        participantCount: 4,
        topBids: ["2,900원", "2,700원", "2,500원"],
        avatarInitials: "MS",
        avatarTone: "from-zinc-100 via-white to-neutral-400",
      },
    ],
  },
  {
    id: "ive-popup-wonyoung-card",
    title: "최애컷 포카 소량 분철",
    member: "장원영",
    era: "팝업 MD",
    price: "5,500원",
    rating: "4.9",
    reviews: "63",
    badge: "추천",
    liked: true,
    tone: "from-zinc-700 via-zinc-500 to-zinc-100",
    courier: "우체국택배",
    deadline: "2026.05.04 22:00",
    purchaseSource: "IVE POP-UP STORE",
    shippingDeadline: "마감 후 5일 이내",
    shippingMethods: [
      { name: "우체국 택배", price: "3,500원" },
      { name: "준등기", price: "1,800원" },
      { name: "편의점 택배", price: "3,000원" },
    ],
    description: "팝업 현장 수령분입니다. 하자 확인 후 개별 포장해 발송해요.",
    options: [
      {
        id: "single",
        label: "포카 단품",
        price: "5,500원",
        currentBid: "5,500원",
        participantCount: 12,
        topBids: ["5,500원", "5,200원", "5,000원"],
        avatarInitials: "SG",
        avatarTone: "from-zinc-800 via-zinc-400 to-white",
      },
      {
        id: "set",
        label: "포카+엽서 세트",
        price: "8,000원",
        currentBid: "8,000원",
        participantCount: 7,
        topBids: ["8,000원", "7,600원", "7,300원"],
        avatarInitials: "ST",
        avatarTone: "from-stone-200 via-white to-zinc-600",
      },
    ],
  },
  {
    id: "ive-season-greeting-yujin",
    title: "시즌그리팅 특전 공구",
    member: "안유진",
    era: "2026 SG",
    price: "4,500원",
    rating: "4.7",
    reviews: "29",
    badge: "신규",
    tone: "from-zinc-900 via-zinc-700 to-zinc-300",
    courier: "한진택배",
    deadline: "2026.05.05 21:30",
    purchaseSource: "시즌그리팅 공동구매",
    shippingDeadline: "입고 후 10일 이내",
    shippingMethods: [
      { name: "한진택배", price: "3,300원" },
      { name: "GS 반값택배", price: "2,100원" },
    ],
    description: "구성품 확인을 위해 개봉했고, 이후 OPP에 넣어 보관했습니다.",
    options: [
      {
        id: "benefit",
        label: "특전 포토카드",
        price: "4,500원",
        currentBid: "4,500원",
        participantCount: 6,
        topBids: ["4,500원", "4,300원", "4,100원"],
        avatarInitials: "BF",
        avatarTone: "from-zinc-950 via-zinc-600 to-zinc-200",
      },
      {
        id: "bundle",
        label: "특전+미니포스터",
        price: "6,500원",
        currentBid: "6,500원",
        participantCount: 3,
        topBids: ["6,500원", "6,200원", "5,900원"],
        avatarInitials: "MP",
        avatarTone: "from-neutral-200 via-zinc-50 to-zinc-500",
      },
    ],
  },
  {
    id: "aespa-drama-karina-card",
    title: "드라마 사전 포카 분철",
    member: "카리나",
    era: "aespa DRAMA",
    price: "6,000원",
    rating: "4.6",
    reviews: "87",
    badge: "마감임박",
    tone: "from-zinc-300 via-zinc-100 to-neutral-400",
    courier: "롯데택배",
    deadline: "2026.05.06 23:00",
    purchaseSource: "SMTOWN &STORE",
    shippingDeadline: "마감 후 6일 이내",
    shippingMethods: [
      { name: "롯데택배", price: "3,200원" },
      { name: "CU 알뜰택배", price: "2,000원" },
      { name: "준등기", price: "1,800원" },
    ],
    description: "앨범 개봉 직후 분리한 포카입니다. 기본 방수 포장 포함이에요.",
    options: [
      {
        id: "basic",
        label: "기본 포장",
        price: "6,000원",
        currentBid: "6,000원",
        participantCount: 14,
        topBids: ["6,000원", "5,700원", "5,400원"],
        avatarInitials: "BK",
        avatarTone: "from-zinc-200 via-white to-neutral-500",
      },
      {
        id: "safe",
        label: "보강 포장",
        price: "6,800원",
        currentBid: "6,800원",
        participantCount: 9,
        topBids: ["6,800원", "6,500원", "6,200원"],
        avatarInitials: "SF",
        avatarTone: "from-black via-zinc-600 to-stone-200",
      },
    ],
  },
  {
    id: "aespa-fanmeet-karina-card",
    title: "팬미팅 한정 포카 분철",
    member: "카리나",
    era: "FAN MEET",
    price: "4,000원",
    rating: "4.5",
    reviews: "18",
    badge: "소량",
    tone: "from-zinc-950 via-zinc-700 to-stone-300",
    courier: "GS 반값택배",
    deadline: "2026.05.07 20:00",
    purchaseSource: "팬미팅 현장 MD",
    shippingDeadline: "마감 후 4일 이내",
    shippingMethods: [
      { name: "GS 반값택배", price: "2,000원" },
      { name: "일반 택배", price: "3,400원" },
    ],
    description: "팬미팅 현장 수령 상품입니다. 반값택배 또는 일반택배 가능해요.",
    options: [
      {
        id: "gs",
        label: "반값택배",
        price: "4,000원",
        currentBid: "4,000원",
        participantCount: 4,
        topBids: ["4,000원", "3,800원", "3,600원"],
        avatarInitials: "GS",
        avatarTone: "from-zinc-900 via-zinc-500 to-white",
      },
      {
        id: "parcel",
        label: "일반택배",
        price: "5,800원",
        currentBid: "5,800원",
        participantCount: 2,
        topBids: ["5,800원", "5,500원", "5,200원"],
        avatarInitials: "PA",
        avatarTone: "from-stone-300 via-white to-zinc-600",
      },
    ],
  },
  {
    id: "ive-comeback-yujin-bundle",
    title: "컴백 주간 특전 묶음",
    member: "안유진",
    era: "COMEBACK WEEK",
    price: "7,500원",
    rating: "4.9",
    reviews: "72",
    badge: "인기",
    tone: "from-neutral-300 via-zinc-100 to-zinc-500",
    courier: "CJ대한통운",
    deadline: "2026.05.08 23:59",
    purchaseSource: "컴백 위크 특전몰",
    shippingDeadline: "특전 입고 후 7일 이내",
    shippingMethods: [
      { name: "CJ대한통운", price: "3,200원" },
      { name: "편의점 택배", price: "3,000원" },
      { name: "준등기", price: "1,800원" },
    ],
    description: "특전 2종 묶음 구성입니다. 구성 변경은 구매 옵션에서 선택해 주세요.",
    options: [
      {
        id: "two-card",
        label: "특전 2종",
        price: "7,500원",
        currentBid: "7,500원",
        participantCount: 11,
        topBids: ["7,500원", "7,200원", "6,900원"],
        avatarInitials: "T2",
        avatarTone: "from-neutral-200 via-zinc-50 to-zinc-600",
      },
      {
        id: "full",
        label: "특전 2종+스티커",
        price: "9,000원",
        currentBid: "9,000원",
        participantCount: 6,
        topBids: ["9,000원", "8,600원", "8,200원"],
        avatarInitials: "FS",
        avatarTone: "from-zinc-950 via-zinc-500 to-stone-200",
      },
    ],
  },
];

export function getProductById(id: string) {
  return productDetails.find((product) => product.id === id);
}
