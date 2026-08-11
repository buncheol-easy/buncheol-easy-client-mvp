import {
  Banknote,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Heart,
  House,
  Minus,
  PackageCheck,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Share2,
  Trash2,
  Truck,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

type IconProps = {
  className?: string;
};

// 모든 아이콘은 동일한 스트로크(1.75)와 motion-icon 클래스를 공유한다.
// className은 기본 크기 클래스를 통째로 대체하므로, 크기를 바꿀 때는
// 크기 클래스를 포함해 전달한다. (tailwind-merge 미사용 — 클래스 충돌 주의)
function createIcon(Icon: LucideIcon, defaultClassName: string) {
  function IconComponent({ className = defaultClassName }: IconProps) {
    return (
      <Icon
        aria-hidden="true"
        className={`motion-icon ${className}`}
        strokeWidth={1.75}
      />
    );
  }

  return IconComponent;
}

export const SearchIcon = createIcon(Search, "h-6 w-6");
export const BellIcon = createIcon(Bell, "h-6 w-6");
export const BackIcon = createIcon(ChevronLeft, "h-6 w-6");
export const ForwardIcon = createIcon(ChevronRight, "h-6 w-6");
export const CloseIcon = createIcon(X, "h-4 w-4");
export const CheckIcon = createIcon(Check, "h-3.5 w-3.5");
export const EditIcon = createIcon(Pencil, "h-5 w-5");
export const ShareIcon = createIcon(Share2, "h-5 w-5");
export const TrashIcon = createIcon(Trash2, "h-5 w-5");
export const BidIcon = createIcon(ReceiptText, "h-6 w-6");
export const HomeIcon = createIcon(House, "h-6 w-6");
export const PlusIcon = createIcon(Plus, "h-6 w-6");
export const MinusIcon = createIcon(Minus, "h-6 w-6");
export const ProfileIcon = createIcon(UserRound, "h-6 w-6");
export const ChevronDownIcon = createIcon(ChevronDown, "h-3.5 w-3.5");
export const BanknoteIcon = createIcon(Banknote, "h-3.5 w-3.5");
export const ClipboardListIcon = createIcon(ClipboardList, "h-3.5 w-3.5");
export const TruckIcon = createIcon(Truck, "h-3.5 w-3.5");
export const UsersRoundIcon = createIcon(UsersRound, "h-3.5 w-3.5");
export const PackageCheckIcon = createIcon(PackageCheck, "h-3.5 w-3.5");

// lucide 의 X 는 닫기(✕) 아이콘이라 브랜드 마크로 쓸 수 없다. X 로고는 스트로크가
// 아닌 단색 채움이라 createIcon 을 태우지 않고 공식 path 를 그대로 둔다.
export function XLogoIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function HeartIcon({
  className = "h-5 w-5",
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <Heart
      aria-hidden="true"
      className={`motion-icon ${className} ${
        filled ? "motion-icon-swap-enter" : ""
      }`}
      fill={filled ? "currentColor" : "none"}
      strokeWidth={1.75}
    />
  );
}
