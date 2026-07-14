import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  Heart,
  House,
  Minus,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

export function SearchIcon() {
  return (
    <Search
      aria-hidden="true"
      className="motion-icon h-6 w-6"
      strokeWidth={1.55}
    />
  );
}

export function BellIcon() {
  return (
    <Bell
      aria-hidden="true"
      className="motion-icon h-6 w-6"
      strokeWidth={1.55}
    />
  );
}

export function BackIcon() {
  return (
    <ChevronLeft
      aria-hidden="true"
      className="motion-icon h-6 w-6"
      strokeWidth={1.55}
    />
  );
}

export function CloseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <X
      aria-hidden="true"
      className={`motion-icon ${className}`}
      strokeWidth={1.9}
    />
  );
}

export function CheckIcon({
  className = "h-3.5 w-3.5",
}: {
  className?: string;
}) {
  return (
    <Check
      aria-hidden="true"
      className={`motion-icon ${className}`}
      strokeWidth={1.9}
    />
  );
}

export function HeartIcon({
  className = "h-5 w-5",
  filled = false,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <Heart
      aria-hidden="true"
      className={`motion-icon ${className} ${
        filled ? "motion-icon-swap-enter" : ""
      }`}
      fill={filled ? "currentColor" : "none"}
      strokeWidth={filled ? 1.45 : 1.55}
    />
  );
}

export function EditIcon() {
  return (
    <Pencil
      aria-hidden="true"
      className="motion-icon h-5 w-5"
      strokeWidth={1.55}
    />
  );
}

export function TrashIcon() {
  return (
    <Trash2
      aria-hidden="true"
      className="motion-icon h-5 w-5"
      strokeWidth={1.55}
    />
  );
}

export function BidIcon() {
  return (
    <ReceiptText
      aria-hidden="true"
      className="motion-icon h-6 w-6"
      strokeWidth={1.55}
    />
  );
}

export function HomeIcon() {
  return (
    <House
      aria-hidden="true"
      className="motion-icon h-6 w-6"
      strokeWidth={1.55}
    />
  );
}

export function PlusIcon() {
  return (
    <Plus
      aria-hidden="true"
      className="motion-icon h-6 w-6"
      strokeWidth={1.55}
    />
  );
}

export function MinusIcon() {
  return (
    <Minus
      aria-hidden="true"
      className="motion-icon h-6 w-6"
      strokeWidth={1.55}
    />
  );
}

export function ProfileIcon() {
  return (
    <UserRound
      aria-hidden="true"
      className="motion-icon h-6 w-6"
      strokeWidth={1.55}
    />
  );
}

export function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <ChevronDown
      aria-hidden="true"
      className={`motion-icon h-3.5 w-3.5 ${className}`}
      strokeWidth={2}
    />
  );
}
