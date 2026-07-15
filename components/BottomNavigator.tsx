"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BidIcon,
  HeartIcon,
  HomeIcon,
  PlusIcon,
  ProfileIcon,
} from "@/components/icons";
import {
  createLoginHref,
  getCurrentBrowserHref,
} from "@/lib/auth-navigation";
import { readAuthState } from "@/lib/auth-store";

type NavItem = {
  authRequired?: boolean;
  href?: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "Home" },
  { authRequired: true, href: "/upload", label: "Upload" },
  { authRequired: true, href: "/profile/bids", label: "Bids" },
  { authRequired: true, href: "/favorites", label: "Favorites" },
  { href: "/profile", label: "Profile" },
];

type BottomNavigatorProps = {
  activeLabel?: string | null;
};

export function BottomNavigator({ activeLabel = "Home" }: BottomNavigatorProps) {
  const router = useRouter();

  function handleProtectedNavigation(
    event: MouseEvent<HTMLAnchorElement>,
    item: NavItem,
  ) {
    if (!item.authRequired || !item.href || readAuthState().isLoggedIn) {
      return;
    }

    event.preventDefault();
    router.push(
      createLoginHref({
        cancelTo: getCurrentBrowserHref(),
        returnTo: item.href,
      }),
    );
  }

  return (
    <nav className="bottom-navigator shrink-0 bg-black px-3 py-2 text-white">
      <div className="bottom-navigator__grid grid grid-cols-5 items-center">
        {navItems.map((item) => {
          const isActive = item.label === activeLabel;
          const className = `bottom-navigator__item flex min-w-0 items-center justify-center px-1 ${
            isActive ? "text-white" : "text-white/55"
          }`;
          const content = (
            <>
              <span
                className={`motion-icon-button inline-flex h-9 w-9 items-center justify-center rounded-full ${
                  isActive
                    ? "bg-[#DDE7B8] text-black shadow-[0_8px_24px_rgba(120,132,82,0.22)]"
                    : "bg-transparent"
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
              <span className="bottom-navigator__label hidden max-w-full truncate">
                {item.label === "Bids" ? "참여" : item.label}
              </span>
            </>
          );

          if (item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className={className}
                aria-label={item.label}
                onClick={(event) => handleProtectedNavigation(event, item)}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.label}
              className={className}
              type="button"
              aria-label={item.label}
            >
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
