import {
  Banknote,
  Bell,
  Camera,
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
export const CameraIcon = createIcon(Camera, "h-6 w-6");
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

// 브랜드 마크 안의 4각 별. 워드마크 PNG 를 헤더 크기(40px)로 줄이면 글자를 감싼
// 라운드 사각 테두리가 정체불명의 헤어라인이 되고 카드 심볼이 뭉개져서, 헤더에서는
// 이 별 하나만 떼어 텍스트와 조립해 쓴다. 라임 채움이라 검정·흰 배경 모두에서 살아남는다.
export function BrandSparkleIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 1.5c.55 5.3 5.2 9.95 10.5 10.5-5.3.55-9.95 5.2-10.5 10.5-.55-5.3-5.2-9.95-10.5-10.5C6.8 11.45 11.45 6.8 12 1.5z" />
    </svg>
  );
}

// 카카오 로그인 버튼 심볼. 노란 면에 텍스트만 있으면 카카오 로그인인지 인지가 느리고,
// 카카오 로그인 버튼 가이드도 심볼 노출을 요구한다. 단색 채움이라 createIcon 을 태우지 않는다.
export function KakaoIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 3C6.99 3 2.93 6.2 2.93 10.15c0 2.53 1.68 4.75 4.2 6.01-.18.65-.67 2.42-.77 2.8-.12.47.17.46.36.34.15-.1 2.39-1.62 3.36-2.28.63.09 1.27.14 1.92.14 5.01 0 9.07-3.2 9.07-7.15S17.01 3 12 3z" />
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
