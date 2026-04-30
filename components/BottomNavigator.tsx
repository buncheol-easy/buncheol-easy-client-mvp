import Link from "next/link";
import {
  BidIcon,
  HeartIcon,
  HomeIcon,
  PlusIcon,
  ProfileIcon,
} from "@/components/icons";

type NavItem = {
  href?: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/upload", label: "Upload" },
  { href: "/profile/bids", label: "Bids" },
  { href: "/favorites", label: "Favorites" },
  { href: "/profile", label: "Profile" },
];

type BottomNavigatorProps = {
  activeLabel?: string | null;
};

export function BottomNavigator({ activeLabel = "Home" }: BottomNavigatorProps) {
  return (
    <nav className="shrink-0 bg-black px-3 pb-4 pt-3 text-white">
      <div className="grid grid-cols-5 items-start">
        {navItems.map((item) => {
          const isActive = item.label === activeLabel;
          const className = `flex min-w-0 flex-col items-center gap-1.5 px-1 text-[11px] ${
            isActive ? "text-white" : "text-white/55"
          }`;
          const content = (
            <>
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                  isActive ? "bg-white text-black" : "bg-transparent"
                }`}
              >
                {item.label === "Home" ? (
                  <HomeIcon />
                ) : item.label === "Upload" ? (
                  <PlusIcon />
                ) : item.label === "Bids" ? (
                  <BidIcon />
                ) : item.label === "Favorites" ? (
                  <HeartIcon />
                ) : (
                  <ProfileIcon />
                )}
              </span>
              <span className="max-w-full truncate">
                {item.label === "Bids" ? "입찰" : item.label}
              </span>
            </>
          );

          if (item.href) {
            return (
              <Link key={item.label} href={item.href} className={className}>
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.label}
              className={className}
              type="button"
            >
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
