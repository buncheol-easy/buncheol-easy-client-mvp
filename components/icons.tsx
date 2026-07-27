import {
  Banknote,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Heart,
  House,
  Minus,
  PackageCheck,
  Pencil,
  Plus,
  ReceiptText,
  Search,
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
export const CloseIcon = createIcon(X, "h-4 w-4");
export const CheckIcon = createIcon(Check, "h-3.5 w-3.5");
export const EditIcon = createIcon(Pencil, "h-5 w-5");
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
