"use client";

import { useEffect, useRef, type MouseEvent } from "react";
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
import { useScrollDirectionHidden } from "@/lib/use-scroll-direction-hidden";

/*
 * key 는 활성 탭 판별용 식별자(호출부가 넘기는 값), label 은 화면·스크린리더에 쓰는 한글이다.
 * 예전에는 label 하나가 두 역할을 겸해서, 설치형 PWA 처럼 라벨이 켜지는 환경에서
 * "Home / Upload / 참여 / Favorites / Profile" 처럼 영어가 그대로 노출됐다.
 * key 는 "Bids" 같은 과거 경매 용어가 남아 있지만 화면에는 나오지 않는 내부 값이다.
 */
type NavItem = {
  authRequired?: boolean;
  /* 알약 배경을 상시 두르는 항목. 활성 상태가 아니라 그 항목의 성질이다. */
  emphasized?: boolean;
  href?: string;
  key: string;
  label: string;
};

/*
 * 개최는 서비스의 핵심 행동이라 가운데 칸에 두고 알약 배경으로 상시 강조한다.
 * 나머지 네 개의 상대 순서는 근육 기억을 지키려고 그대로 둔다.
 * 이 순서·알약 위치는 /intro 의 목업 탭바(IntroContent 의 MiniBottomNav)와 같이 움직인다.
 */
const navItems: NavItem[] = [
  { href: "/", key: "Home", label: "홈" },
  { authRequired: true, href: "/profile/bids", key: "Bids", label: "참여 내역" },
  {
    authRequired: true,
    emphasized: true,
    href: "/upload",
    key: "Upload",
    label: "개최",
  },
  { authRequired: true, href: "/favorites", key: "Favorites", label: "찜" },
  { href: "/profile", key: "Profile", label: "마이페이지" },
];

/*
 * 탭 아이콘은 28px 로 통일한다. 공용 기본값을 쓰면 HeartIcon 만 20px 이라 찜만 작아 보이고,
 * 탭바가 70px 로 높아진 뒤에는 24px 도 바 대비 작게 읽힌다.
 * 알약(개최) 안 글리프는 예외 — 채워진 면 안에서는 24px 이 맞다.
 */
const navIconClassName = "h-7 w-7";

type BottomNavigatorProps = {
  activeLabel?: string | null;
};

export function BottomNavigator({ activeLabel = "Home" }: BottomNavigatorProps) {
  const router = useRouter();
  // 스크롤을 내리면 비켜나고 올리면 돌아온다 — 홈 상단 헤더가 이미 하던 동작을
  // 하단 탭에도 맞춘다. 목록을 훑는 동안 화면 세로를 그만큼 돌려준다.
  const isScrolledAway = useScrollDirectionHidden();
  const navRef = useRef<HTMLElement | null>(null);

  /*
   * 탭이 비켜날 때 그 자리를 콘텐츠가 쓰게 하려면 흐름에서도 빠져야 한다.
   * 높이는 환경마다 다르므로(설치형 PWA 라벨 높이·safe-area) 실측해서 CSS 변수로 넘기고,
   * 숨김 상태에서 같은 값만큼 음수 마진을 준다. transform 과 함께 트랜지션되어
   * 탭이 내려가는 동안 스크롤 영역이 같은 속도로 늘어난다.
   */
  useEffect(() => {
    const navElement = navRef.current;

    if (!navElement || typeof ResizeObserver === "undefined") {
      return;
    }

    function syncHeight(element: HTMLElement) {
      element.style.setProperty(
        "--bottom-navigator-height",
        `${element.offsetHeight}px`,
      );
    }

    syncHeight(navElement);

    const observer = new ResizeObserver(() => syncHeight(navElement));

    observer.observe(navElement);

    return () => observer.disconnect();
  }, []);

  function handleProtectedNavigation(
    event: MouseEvent<HTMLAnchorElement>,
    item: NavItem,
  ) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

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
    <nav
      className={`bottom-navigator shrink-0 bg-black px-3 py-2 text-white ${
        isScrolledAway ? "bottom-navigator--scrolled-away" : ""
      }`}
      ref={navRef}
    >
      <div className="bottom-navigator__grid grid grid-cols-5 items-center">
        {navItems.map((item) => {
          const isActive = item.key === activeLabel;
          /*
           * 간격 8px 은 알약 기준이다. 나머지 탭은 24px 글리프가 36px 박스 안에 있어
           * 위아래 6px 이 이미 비지만, 알약은 박스를 꽉 채워 이 간격이 곧 보이는 여백이다.
           * 줄이면 개최만 라벨에 붙어 보인다.
           */
          const className = `bottom-navigator__item flex min-w-0 flex-col items-center justify-center gap-2 px-1 ${
            isActive ? "text-white" : "text-white/55"
          }`;
          /*
           * 강조 항목은 아이콘이 알약 안에서 text-black 로 고정이라, 활성이 돼도
           * 다른 탭처럼 아이콘이 밝아지지 않는다. 라벨 굵기만으로는 신호가 약해
           * 활성일 때 알약에 링을 하나 더 얹는다.
           */
          const emphasisClassName = item.emphasized
            ? `bg-brand-soft text-black shadow-[0_8px_24px_rgba(120,132,82,0.22)]${
                isActive ? " ring-2 ring-white/70" : ""
              }`
            : "bg-transparent";
          const content = (
            <>
              <span
                className={`motion-icon-button inline-flex h-9 w-9 items-center justify-center rounded-full ${emphasisClassName}`}
              >
                {item.key === "Home" ? (
                  <HomeIcon className={navIconClassName} />
                ) : item.key === "Upload" ? (
                  /* 알약 안에서는 키우지 않는다 — 채워진 36px 면을 글리프가 다 먹으면
                     알약이 아니라 뭉개진 사각형으로 보인다. */
                  <PlusIcon />
                ) : item.key === "Bids" ? (
                  <BidIcon className={navIconClassName} />
                ) : item.key === "Favorites" ? (
                  <HeartIcon className={navIconClassName} />
                ) : (
                  <ProfileIcon className={navIconClassName} />
                )}
              </span>
              {/* 아이콘만 있는 탭바는 "＋(개최)"·"영수증(참여 내역)"이 무엇인지 알 수 없어
                  첫 사용자의 탐색이 막힌다. 라벨은 브라우저에서도 항상 노출한다. */}
              <span
                className={`bottom-navigator__label max-w-full truncate text-[10px] leading-none tracking-[-0.02em] ${
                  isActive ? "font-bold" : "font-medium"
                }`}
              >
                {item.label}
              </span>
            </>
          );

          if (item.href) {
            return (
              <Link
                key={item.key}
                href={item.href}
                className={className}
                aria-current={isActive ? "page" : undefined}
                onClick={(event) => handleProtectedNavigation(event, item)}
              >
                {content}
              </Link>
            );
          }

          return (
            <button key={item.key} className={className} type="button">
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
