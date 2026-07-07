"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from "react";
import { requestBuncheols, type BuncheolSummary } from "@/lib/auth-api";
import { BusinessFooter } from "@/components/BusinessFooter";
import {
  BackIcon,
  BellIcon,
  BidIcon,
  HeartIcon,
  HomeIcon,
  PlusIcon,
  ProfileIcon,
  SearchIcon,
} from "@/components/icons";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "scale";
};

type ScrollDirection = "down" | "up";

type IntroMotionContextValue = {
  homeScrollOffset: number;
  pageScrollTop: number;
  prefersReducedMotion: boolean;
  scrollDirection: ScrollDirection;
};

type LegacyMediaQueryList = MediaQueryList & {
  addListener: (listener: () => void) => void;
  removeListener: (listener: () => void) => void;
};

type FeatureSection = {
  body: string;
  eyebrow: string;
  screen: ReactNode;
  title: string;
};

type IntroRecentBuncheol = {
  deadline: string;
  state: string;
  title: string;
};

const IntroMotionContext = createContext<IntroMotionContextValue>({
  homeScrollOffset: 0,
  pageScrollTop: 0,
  prefersReducedMotion: false,
  scrollDirection: "down",
});

const fallbackRecentBuncheols: IntroRecentBuncheol[] = [
  {
    deadline: "D-1",
    state: "참여 9명",
    title: "RIIZE 팬콘 특전 포카",
  },
  {
    deadline: "D-DAY",
    state: "마감임박",
    title: "세븐틴 팬미팅 MD",
  },
];

function formatIntroRecentDeadline(deadline: string) {
  const deadlineTime = new Date(deadline).getTime();

  if (!Number.isFinite(deadlineTime)) {
    return "진행중";
  }

  const diff = deadlineTime - Date.now();

  if (diff <= 0) {
    return "마감";
  }

  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  return days <= 1 ? "D-DAY" : `D-${days}`;
}

function getIntroRecentState(item: BuncheolSummary) {
  if (typeof item.activeParticipationCount === "number") {
    return `참여 ${item.activeParticipationCount}명`;
  }

  if (item.memberNames.length > 0) {
    return item.memberNames.slice(0, 2).join(" · ");
  }

  return item.groupName || "모집중";
}

function toIntroRecentBuncheol(item: BuncheolSummary): IntroRecentBuncheol {
  return {
    deadline: formatIntroRecentDeadline(item.deadline),
    state: getIntroRecentState(item),
    title: item.title,
  };
}

function Reveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { prefersReducedMotion, scrollDirection } =
    useContext(IntroMotionContext);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const element = ref.current;

    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(Boolean(entry?.isIntersecting));
      },
      {
        rootMargin: "-8% 0px -12% 0px",
        threshold: 0.18,
      },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  const hiddenTransforms = {
    down: "translateY(-28px)",
    left: "translateX(32px)",
    right: "translateX(-32px)",
    scale: "translateY(18px) scale(0.94)",
    up: "translateY(34px)",
  };
  const reverseHiddenTransforms = {
    down: "translateY(28px)",
    left: "translateX(-32px)",
    right: "translateX(32px)",
    scale: "translateY(-18px) scale(0.94)",
    up: "translateY(-34px)",
  };
  const hiddenTransform =
    scrollDirection === "down"
      ? hiddenTransforms[direction]
      : reverseHiddenTransforms[direction];
  const shouldShow = prefersReducedMotion || isVisible;

  return (
    <div
      className={className}
      ref={ref}
      style={{
        opacity: shouldShow ? 1 : 0,
        transform: prefersReducedMotion
          ? "none"
          : shouldShow
            ? "translate3d(0,0,0) scale(1)"
            : hiddenTransform,
        transition: prefersReducedMotion
          ? "none"
          : `opacity 680ms ${delay}ms cubic-bezier(0.22, 1, 0.36, 1), transform 680ms ${delay}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        willChange: prefersReducedMotion ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

function useDeferredMockupImages<T extends HTMLElement>(
  ref: RefObject<T | null>,
  rootMargin = "280px 0px",
) {
  const [shouldLoadImages, setShouldLoadImages] = useState(false);

  useEffect(() => {
    if (shouldLoadImages) {
      return;
    }

    const element = ref.current;

    if (!element) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      const animationFrame = window.requestAnimationFrame(() => {
        setShouldLoadImages(true);
      });

      return () => window.cancelAnimationFrame(animationFrame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        setShouldLoadImages(true);
        observer.disconnect();
      },
      {
        rootMargin,
        threshold: 0.01,
      },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, rootMargin, shouldLoadImages]);

  return shouldLoadImages;
}

function MiniPhone({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const screenRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const screenElement = screenRef.current;

    if (!screenElement) {
      return;
    }

    const activeScreenElement = screenElement;

    function syncPhoneScale() {
      const nextScale = activeScreenElement.clientWidth / 430;

      activeScreenElement.style.setProperty(
        "--intro-phone-screen-scale",
        String(nextScale),
      );
    }

    const animationFrame = window.requestAnimationFrame(syncPhoneScale);

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", syncPhoneScale);

      return () => {
        window.cancelAnimationFrame(animationFrame);
        window.removeEventListener("resize", syncPhoneScale);
      };
    }

    const resizeObserver = new ResizeObserver(syncPhoneScale);

    resizeObserver.observe(activeScreenElement);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className={`relative mx-auto w-[21rem] max-w-[86vw] ${className}`}>
      <div className="absolute -left-[0.28rem] top-[7.5rem] h-14 w-[0.34rem] rounded-l-full bg-[#171717] shadow-[inset_1px_0_0_rgba(255,255,255,0.16)]" />
      <div className="absolute -left-[0.28rem] top-[11.6rem] h-20 w-[0.34rem] rounded-l-full bg-[#171717] shadow-[inset_1px_0_0_rgba(255,255,255,0.16)]" />
      <div className="absolute -right-[0.28rem] top-[9.6rem] h-24 w-[0.34rem] rounded-r-full bg-[#171717] shadow-[inset_-1px_0_0_rgba(255,255,255,0.12)]" />
      <div className="relative rounded-[2.75rem] bg-[linear-gradient(145deg,#252529_0%,#090909_34%,#000_72%,#202022_100%)] p-[0.42rem] shadow-[0_32px_80px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="relative rounded-[2.42rem] bg-[#050505] px-[0.58rem] pb-7 pt-8">
          <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-5 w-[5.4rem] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]" />
          <div className="absolute bottom-2 left-1/2 z-20 h-1 w-24 -translate-x-1/2 rounded-full bg-white/22" />
          <div
            className="intro-mini-phone-screen relative aspect-[430/932] overflow-hidden rounded-[1.35rem] bg-black text-black"
            ref={screenRef}
          >
            <div className="intro-mini-phone-content pointer-events-none absolute left-0 top-0 h-[932px] w-[430px] origin-top-left">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const introFavoriteArtists = [
  {
    kind: "add",
    name: "최애 추가",
  },
  {
    background: "#3f3568",
    kind: "logo",
    logo: "/intro-logos/ive.svg",
    logoSize: "35% auto",
    name: "IVE",
  },
  {
    background: "#2e735f",
    kind: "logo",
    logo: "/intro-logos/nct-dream.svg",
    logoSize: "78% auto",
    name: "NCT",
  },
  {
    background: "#6d5838",
    kind: "logo",
    logo: "/intro-logos/aespa.svg",
    logoSize: "78% auto",
    name: "aespa",
  },
] as const;

const introRecommendedProducts = [
  {
    deadline: "D-2",
    image: "/intro-products/nct-dream-main.png",
    status: "마감 임박",
    tags: "#재민 #런쥔",
    title: "NCT DREAM 일본 럭드 분철",
    tone: "green",
  },
  {
    deadline: "D-DAY",
    image: "/intro-products/monsta-x-main.png",
    status: "오늘 마감",
    tags: "#형원 #민혁",
    title: "MONSTA X 팬콘 특전 포카",
    tone: "blue",
  },
  {
    deadline: "CLOSED",
    image: "/intro-products/seventeen-main.png",
    status: "마감",
    tags: "#정한 #호시",
    title: "세븐틴 팬미팅 MD 포카",
    tone: "pink",
  },
  {
    deadline: "D-1",
    image: "/intro-products/riize-main.png",
    status: "마감 임박",
    tags: "#원빈 #성찬",
    title: "RIIZE 팬콘 특전 포카",
    tone: "gray",
  },
  {
    deadline: "CLOSED",
    image: "/intro-products/ive-main.png",
    status: "마감",
    tags: "#장원영 #리즈",
    title: "IVE 시즌그리팅 포카",
    tone: "blue",
  },
  {
    deadline: "D-3",
    image: "/intro-products/aespa-main.png",
    status: "마감 임박",
    tags: "#카리나 #윈터",
    title: "aespa 미공포 럭드",
    tone: "pink",
  },
] as const;

function MiniBottomNav() {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex h-16 items-center justify-around bg-black px-4 text-white/42">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black">
        <HomeIcon />
      </span>
      <span className="flex h-10 w-10 items-center justify-center">
        <PlusIcon />
      </span>
      <span className="flex h-10 w-10 items-center justify-center">
        <BidIcon />
      </span>
      <span className="flex h-10 w-10 items-center justify-center">
        <HeartIcon />
      </span>
      <span className="flex h-10 w-10 items-center justify-center">
        <ProfileIcon />
      </span>
    </div>
  );
}

function HomeMiniScreen() {
  const { homeScrollOffset } = useContext(IntroMotionContext);

  return (
    <div className="relative h-full overflow-hidden bg-black">
      <div className="absolute inset-x-0 top-0 z-20 border-b border-black bg-black px-5 py-3 text-white">
        <div className="flex h-10 items-center gap-3">
          <p className="shrink-0 text-[22px] font-semibold tracking-[-0.05em]">
            분철이지
          </p>
          <div className="flex h-10 min-w-0 flex-1 items-center justify-between rounded-full bg-white px-4 text-left text-[13px] text-black">
            <span className="min-w-0 truncate text-[16px] text-black/35">
              포토카드
            </span>
            <SearchIcon />
          </div>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white">
            <BellIcon />
          </span>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-16 top-16 overflow-hidden bg-white">
        <div
          className="intro-home-screen-scroll px-4 pb-24 pt-4"
          style={{
            transform: `translateY(-${homeScrollOffset}px)`,
          }}
        >
          <div className="grid w-full grid-cols-[0.95fr_1.05fr] overflow-hidden rounded-[1.15rem] border border-black bg-black text-white">
            <div className="flex items-center px-4 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                  Buncheol Easy
                </p>
                <h2 className="mt-2 whitespace-pre-line text-[17px] font-semibold leading-[1.22] text-white">
                  최애 굿즈{"\n"}분철을 더 쉽게
                </h2>
                <p className="mt-2 text-[10px] font-semibold tracking-[-0.03em] text-white/52">
                  탐색 · 참여 · 결제 확인
                </p>
              </div>
            </div>
            <div className="relative min-h-[112px] overflow-hidden border-l border-white/10 bg-[linear-gradient(135deg,#171717_0%,#6f6f6f_48%,#f0f0f0_100%)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_28%,rgba(255,255,255,0.7),transparent_22%)]" />
              <div className="absolute bottom-4 left-4 h-[82px] w-[62px] rotate-[-10deg] rounded-[0.85rem] border border-white/25 bg-black shadow-[0_12px_24px_rgba(0,0,0,0.24)]" />
              <div className="absolute bottom-4 left-[4.8rem] h-[96px] w-[70px] rotate-[7deg] rounded-[0.85rem] border border-white/40 bg-white/85 shadow-[0_12px_24px_rgba(0,0,0,0.16)]" />
              <div className="absolute right-4 top-4 rounded-full bg-black px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-white">
                NEW
              </div>
              <div className="absolute bottom-3 right-3 rounded-xl border border-black/10 bg-white/90 px-2.5 py-2 backdrop-blur">
                <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-black/45">
                  Start Flow
                </p>
                <p className="mt-1 text-[12px] font-semibold tracking-[-0.03em] text-black">
                  바로 둘러보기
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 pb-4 pt-2">
            <span className="h-2 w-5 rounded-full bg-black" />
            <span className="h-2 w-2 rounded-full bg-zinc-300" />
            <span className="h-2 w-2 rounded-full bg-zinc-300" />
          </div>

        <div className="flex gap-3 overflow-hidden">
          {introFavoriteArtists.map((artist) => (
            <div
              className={`flex min-w-[76px] flex-col items-center gap-2.5 ${
                artist.kind === "add"
                  ? "mr-1 border-r border-black/10 pr-3"
                  : ""
              }`}
              key={artist.name}
            >
              {artist.kind === "add" ? (
                <span className="relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[1.15rem] bg-[#efefed] text-black/35 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]">
                  <span className="-translate-x-2 -translate-y-1 scale-95">
                    <ProfileIcon />
                  </span>
                  <span className="absolute bottom-[0.62rem] right-[0.62rem] text-[27px] font-light leading-none text-black/42">
                    +
                  </span>
                </span>
              ) : (
                <span
                  className="relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[1.15rem] bg-center bg-no-repeat shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]"
                  style={{
                    backgroundColor: artist.background,
                    backgroundImage: `url(${artist.logo})`,
                    backgroundSize: artist.logoSize,
                  }}
                >
                  <span className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[17px] leading-none text-black shadow-[0_2px_7px_rgba(0,0,0,0.18)]">
                    ♥
                  </span>
                </span>
              )}
              <span className="max-w-[78px] text-center text-[15px] font-semibold leading-[1.14] tracking-[-0.05em]">
                {artist.name}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-black/10 pt-5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            {introRecommendedProducts.map(({ deadline, image, status, tags, title, tone }) => (
              <div className="min-w-0" key={title}>
                <div className="relative aspect-square overflow-hidden rounded-[1.05rem] bg-[#f5f5f5]">
                  <span
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${image}), ${
                        tone === "green"
                          ? "linear-gradient(135deg,#d7f2df 0%,#ffffff 48%,#1d7f5f 100%)"
                          : tone === "pink"
                            ? "linear-gradient(135deg,#ffe0f0 0%,#ffffff 55%,#202029 100%)"
                            : tone === "gray"
                              ? "linear-gradient(135deg,#1f2027 0%,#f8f8f8 58%,#cfd1d6 100%)"
                              : "linear-gradient(135deg,#dceaff 0%,#f8fbff 52%,#1b1b1f 100%)"
                      }`,
                      backgroundPosition: "center",
                      backgroundSize: "cover",
                    }}
                  />
                  <span
                    className={`absolute inset-0 ${
                      deadline === "CLOSED" ? "bg-black/18" : "bg-transparent"
                    }`}
                  />
                  <span className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/62 via-black/22 to-transparent" />
                  <span className="absolute bottom-12 left-3 rounded-full bg-black/72 px-2.5 py-1 text-[10px] font-semibold tracking-[-0.03em] text-white">
                    {status}
                  </span>
                  <span className="absolute bottom-3 left-3 text-[18px] font-semibold tracking-[-0.06em] text-white">
                    {deadline}
                  </span>
                  <span className="absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[20px] text-black/50 shadow-[0_8px_16px_rgba(0,0,0,0.16)]">
                    ♥
                  </span>
                </div>
                <p className="mt-2 truncate text-[11px] font-semibold text-black/36">
                  {tags}
                </p>
                <p className="mt-0.5 truncate text-[14px] font-semibold tracking-[-0.05em]">
                  {title}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
      <MiniBottomNav />
    </div>
  );
}

function SearchMiniScreen() {
  const { pageScrollTop } = useContext(IntroMotionContext);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [searchScrollOffset, setSearchScrollOffset] = useState(0);
  const shouldLoadSearchImages = useDeferredMockupImages(frameRef);
  const searchMembers = [
    {
      group: "MONSTA X",
      name: "셔누",
      photo: "/intro-members/shownu.webp",
      selected: false,
      tone: "gray",
    },
    {
      group: "MONSTA X",
      name: "민혁",
      photo: "/intro-members/minhyuk.webp",
      selected: false,
      tone: "blue",
    },
    {
      group: "MONSTA X",
      name: "형원",
      photo: "/intro-members/hyungwon.webp",
      selected: false,
      tone: "green",
    },
    {
      group: "MONSTA X",
      name: "아이엠",
      photo: "/intro-members/im.webp",
      selected: false,
      tone: "pink",
    },
  ] as const;
  const searchResults = [
    {
      deadline: "D-DAY",
      image: "/intro-products/monsta-x-search-1.png",
      status: "오늘 마감",
      tags: "#셔누 #형원",
      title: "MONSTA X 팬콘 특전 포카",
      tone: "green",
    },
    {
      deadline: "D-2",
      image: "/intro-products/monsta-x-search-2.png",
      status: "마감 임박",
      tags: "#민혁 #아이엠",
      title: "몬스타엑스 미공포 럭드 분철",
      tone: "blue",
    },
    {
      deadline: "D-4",
      image: "/intro-products/monsta-x-search-3.png",
      status: "마감 임박",
      tags: "#기현 #주헌",
      title: "MONSTA X 시즌그리팅 포카",
      tone: "gray",
    },
    {
      deadline: "CLOSED",
      image: "/intro-products/monsta-x-search-4.png",
      status: "마감",
      tags: "#형원 #민혁",
      title: "몬스타엑스 쇼케이스 포카",
      tone: "pink",
    },
    {
      deadline: "D-1",
      image: "/intro-products/monsta-x-search-5.png",
      status: "마감 임박",
      tags: "#셔누 #기현",
      title: "MONSTA X 럭드 포카 세트",
      tone: "blue",
    },
    {
      deadline: "D-5",
      image: "/intro-products/monsta-x-search-6.png",
      status: "모집 중",
      tags: "#주헌 #아이엠",
      title: "몬스타엑스 앨범 포카 분철",
      tone: "green",
    },
  ] as const;

  useLayoutEffect(() => {
    const frameElement = frameRef.current;

    if (!frameElement) {
      return;
    }

    const viewportHeight = window.innerHeight || 900;
    const frameTop = frameElement.getBoundingClientRect().top;
    const startLine = viewportHeight * 0.2;
    const nextSearchScrollOffset = Math.max(
      0,
      Math.min(150, Math.round((startLine - frameTop) * 0.62)),
    );
    const animationFrame = window.requestAnimationFrame(() => {
      setSearchScrollOffset((currentOffset) =>
        currentOffset === nextSearchScrollOffset
          ? currentOffset
          : nextSearchScrollOffset,
      );
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [pageScrollTop]);

  return (
    <div className="h-full overflow-hidden bg-white" ref={frameRef}>
      <div className="bg-black px-4 pb-3 pt-9 text-white">
        <div className="flex h-12 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center text-white">
            <BackIcon />
          </span>
          <div className="flex h-12 min-w-0 flex-1 items-center justify-between rounded-full bg-white px-5 text-black">
            <span className="intro-typing-text overflow-hidden whitespace-nowrap text-[18px] font-semibold tracking-[-0.05em] text-black">
              몬스타엑스
            </span>
            <SearchIcon />
          </div>
        </div>
      </div>

      <div className="relative h-[calc(100%-6.75rem)] overflow-hidden bg-white">
        <div
          className="intro-search-results pt-5 will-change-transform"
          style={{ transform: `translateY(-${searchScrollOffset}px)` }}
        >
          <div className="flex gap-4 overflow-hidden border-b border-black/10 px-5 pb-5">
          <div className="flex w-[84px] shrink-0 flex-col gap-2 border-r border-black/10 pr-4">
            <div
              className="relative flex h-[72px] w-[72px] items-center justify-center rounded-[1.05rem] bg-black bg-center bg-no-repeat text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
              style={{
                backgroundImage: shouldLoadSearchImages
                  ? "url(/intro-members/monsta-x-group.svg)"
                  : undefined,
                backgroundSize: "74% auto",
              }}
            >
              <span className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[17px] leading-none text-black shadow-[0_2px_7px_rgba(0,0,0,0.18)]">
                ♡
              </span>
            </div>
            <p className="text-center text-[15px] font-semibold tracking-[-0.05em]">
              MONSTA X
            </p>
          </div>

          {searchMembers.map(({ group, name, photo, selected, tone }) => (
            <div className="flex w-[74px] shrink-0 flex-col gap-2" key={name}>
              <div
                className="relative flex h-[72px] w-[72px] items-center justify-center rounded-[1.05rem] bg-[#d4d0d2] p-[6px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
              >
                <span
                  className="block h-full w-full rounded-[0.55rem] bg-cover bg-center"
                  style={{
                    backgroundColor:
                      tone === "green"
                        ? "#1d332c"
                        : tone === "pink"
                          ? "#2b1f27"
                          : tone === "gray"
                            ? "#d4d0d2"
                            : "#3b4c68",
                    backgroundImage: shouldLoadSearchImages
                      ? `url(${photo})`
                      : undefined,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }}
                />
                {selected ? (
                  <span className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black text-[18px] text-white ring-[3px] ring-white">
                    ✓
                  </span>
                ) : null}
              </div>
              <div className="text-center leading-tight">
                <p className="truncate text-[15px] font-semibold tracking-[-0.05em]">
                  {name}
                </p>
                <p className="mt-1 truncate text-[12px] font-semibold text-black/34">
                  {group}
                </p>
              </div>
            </div>
          ))}
        </div>

        <section className="px-5 pt-5">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
              검색 결과
            </h2>
            <span className="text-[13px] font-medium text-black/45">6개</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
              {searchResults.map(({ deadline, image, status, tags, title, tone }) => (
                <div className="min-w-0" key={title}>
                  <div
                    className="relative aspect-square overflow-hidden rounded-[1.05rem] bg-[#f5f5f5] ring-1 ring-black/8"
                    style={{
                      backgroundImage: `${
                        shouldLoadSearchImages ? `url(${image}), ` : ""
                      }${
                        tone === "green"
                          ? "linear-gradient(135deg,#d7f2df 0%,#ffffff 48%,#1d7f5f 100%)"
                          : tone === "pink"
                            ? "linear-gradient(135deg,#ffe0f0 0%,#ffffff 55%,#202029 100%)"
                            : tone === "gray"
                              ? "linear-gradient(135deg,#1f2027 0%,#f8f8f8 58%,#cfd1d6 100%)"
                              : "linear-gradient(135deg,#dceaff 0%,#f8fbff 52%,#1b1b1f 100%)"
                      }`,
                      backgroundPosition: "center",
                      backgroundSize: "cover",
                    }}
                  >
                    <span
                      className={`absolute inset-0 ${
                        deadline === "CLOSED" ? "bg-black/18" : "bg-transparent"
                      }`}
                    />
                    <span className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/62 via-black/22 to-transparent" />
                    <span className="absolute bottom-12 left-3 rounded-full bg-black/72 px-2.5 py-1 text-[10px] font-semibold tracking-[-0.03em] text-white">
                      {status}
                    </span>
                    <span className="absolute bottom-3 left-3 text-[18px] font-semibold tracking-[-0.06em] text-white">
                      {deadline}
                    </span>
                    <span className="absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[20px] text-black/50 shadow-[0_8px_16px_rgba(0,0,0,0.16)]">
                      ♥
                    </span>
                  </div>
                  <p className="mt-2 truncate text-[11px] font-semibold text-black/36">
                    {tags}
                  </p>
                  <p className="mt-0.5 truncate text-[14px] font-semibold tracking-[-0.05em]">
                    {title}
                  </p>
                </div>
              ))}
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}

function getThreeDaysLaterDeadlineText() {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 3);

  const year = deadline.getFullYear();
  const month = String(deadline.getMonth() + 1).padStart(2, "0");
  const day = String(deadline.getDate()).padStart(2, "0");
  const hour = String(deadline.getHours()).padStart(2, "0");

  return `${year}년 ${month}월 ${day}일 ${hour}시`;
}

function DetailMiniScreen() {
  const { pageScrollTop } = useContext(IntroMotionContext);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [detailScrollOffset, setDetailScrollOffset] = useState(0);
  const shouldLoadDetailImages = useDeferredMockupImages(frameRef);
  const bidDeadlineText = getThreeDaysLaterDeadlineText();
  const optionPrices = [
    {
      image: "/intro-members/nct-dream/jaemin.webp",
      member: "재민",
      participants: 14,
      prices: ["31,000원", "28,000원", "24,000원"],
    },
    {
      image: "/intro-members/nct-dream/haechan.webp",
      member: "해찬",
      participants: 11,
      prices: ["29,000원", "25,000원", "21,000원"],
    },
    {
      image: "/intro-members/nct-dream/renjun.webp",
      member: "런쥔",
      participants: 9,
      prices: ["22,000원", "20,000원", "18,000원"],
    },
    {
      image: "/intro-members/nct-dream/jeno.webp",
      member: "제노",
      participants: 7,
      prices: ["19,000원", "17,000원", "15,000원"],
    },
    {
      image: "/intro-members/nct-dream/jisung.webp",
      member: "지성",
      participants: 6,
      prices: ["18,000원", "16,000원", "14,000원"],
    },
  ] as const;

  useEffect(() => {
    const frameElement = frameRef.current;

    if (!frameElement) {
      return;
    }

    const viewportHeight = window.innerHeight || 900;
    const frameTop = frameElement.getBoundingClientRect().top;
    const startLine = viewportHeight * 0.34;
    const nextDetailScrollOffset = Math.max(
      0,
      Math.min(430, Math.round((startLine - frameTop) * 0.95)),
    );

    setDetailScrollOffset((currentOffset) =>
      currentOffset === nextDetailScrollOffset
        ? currentOffset
        : nextDetailScrollOffset,
    );
  }, [pageScrollTop]);

  return (
    <div className="relative h-full overflow-hidden bg-white" ref={frameRef}>
      <div
        className="px-5 pb-28 pt-7 will-change-transform"
        style={{ transform: `translateY(-${detailScrollOffset}px)` }}
      >
        <div className="sticky top-0 z-10 -mx-5 flex items-center justify-between bg-white/96 px-5 pb-3 pt-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-white">
            <BackIcon />
          </span>
          <div className="flex gap-2 text-black">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white">
              <HeartIcon />
            </span>
          </div>
        </div>

        <div
          className="relative mt-4 aspect-[4/3] overflow-hidden rounded-[1.35rem] bg-[#f5f5f5] bg-cover bg-center"
          style={{
            backgroundImage: shouldLoadDetailImages
              ? "url(/intro-products/nct-dream-main.png)"
              : undefined,
          }}
        >
          <span className="absolute left-5 top-5 rounded-full bg-black px-3 py-1.5 text-[12px] font-semibold tracking-[-0.04em] text-white">
            모집 중
          </span>
          <span className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black/40 via-black/8 to-transparent" />
          <span className="absolute bottom-4 right-4 rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-semibold text-white">
            1/5
          </span>
        </div>
        <p className="mt-5 text-[13px] font-semibold leading-5 text-black/38">
          #런쥔 #제노 #해찬 #재민 #천러 #지성
        </p>
        <h3 className="mt-3 break-keep text-[28px] font-semibold leading-[1.08] tracking-[-0.08em]">
          드림 2026 시즌팩 포카 분철
        </h3>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <div className="col-span-2 rounded-[0.9rem] border border-black/10 bg-white px-4 py-3">
            <p className="text-[12px] font-medium text-black/45">구매처</p>
            <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
              공식 시즌팩 판매처
            </p>
          </div>
          <div className="col-span-2 rounded-[0.9rem] border border-black/10 bg-white px-4 py-3">
            <p className="text-[12px] font-medium text-black/45">참여 기한</p>
            <p
              className="mt-1 text-[16px] font-semibold tracking-[-0.04em]"
              suppressHydrationWarning
            >
              {bidDeadlineText}
            </p>
          </div>
        </div>

        <section className="mt-7 border-t border-black/10 pt-6">
          <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
            배송 방법
          </h2>
          <div className="mt-3 grid gap-2">
            {[
              ["CU 알뜰택배", "3,000원"],
              ["GS25 반값택배", "3,200원"],
            ].map(([method, price]) => (
              <div
                className="flex min-h-12 items-center justify-between rounded-[0.8rem] bg-white px-4"
                key={method}
              >
                <span className="text-[14px] font-semibold tracking-[-0.04em]">
                  {method}
                </span>
                <span className="text-[14px] font-semibold tracking-[-0.04em] text-black/55">
                  {price}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-7 border-t border-black/10 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
              옵션별 가격
            </h2>
            <span className="text-[12px] font-medium text-black/45">
              5개 옵션
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {optionPrices.map(({ image, member, participants, prices }) => (
              <div
                className="rounded-[0.9rem] border border-black/10 bg-white px-4 py-3"
                key={member}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="block h-16 w-16 shrink-0 rounded-[1.05rem] bg-[#f5f5f5] bg-cover bg-center ring-1 ring-black/5"
                      style={{
                        backgroundImage: shouldLoadDetailImages
                          ? `url(${image})`
                          : undefined,
                      }}
                    />
                    <p className="truncate text-[16px] font-semibold tracking-[-0.04em]">
                      {member}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-medium text-black/45">
                    참여 {participants}명
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {prices.map((price) => (
                    <div
                      className="rounded-[0.7rem] bg-[#f7f7f7] px-3 py-2"
                      key={price}
                    >
                      <p className="text-[11px] font-semibold text-black/35">
                        가격
                      </p>
                      <p className="mt-1 text-[12px] font-semibold tracking-[-0.04em]">
                        {price}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-white px-5 pb-5 pt-3 shadow-[0_-12px_34px_rgba(0,0,0,0.08)]">
        <div className="rounded-full bg-black py-4 text-center text-[17px] font-semibold text-white">
          참여하기
        </div>
      </div>
    </div>
  );
}

function PaymentMiniScreen() {
  const { pageScrollTop, prefersReducedMotion } = useContext(IntroMotionContext);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] =
    useState(prefersReducedMotion);
  const shouldLoadPaymentImages = useDeferredMockupImages(frameRef);
  const participatedBids = [
    {
      amount: "42,000원",
      deadline: "입금 마감 14시간 남음",
      image: "/intro-products/ive-main.png",
      member: "장원영",
      rank: "참여",
      status: "입금대기",
      title: "IVE 시즌그리팅 포카",
    },
    {
      amount: "31,000원",
      deadline: "입금 마감 23시간 남음",
      image: "/intro-products/seventeen-main.png",
      member: "정한",
      rank: "참여",
      status: "입금대기",
      title: "세븐틴 팬미팅 MD 포카",
    },
  ] as const;

  useEffect(() => {
    const frameElement = frameRef.current;

    if (!frameElement || isPaymentSheetOpen) {
      return;
    }

    const viewportHeight = window.innerHeight || 900;
    const frameTop = frameElement.getBoundingClientRect().top;

    if (frameTop < viewportHeight * 0.22) {
      const animationFrame = window.requestAnimationFrame(() => {
        setIsPaymentSheetOpen(true);
      });

      return () => window.cancelAnimationFrame(animationFrame);
    }
  }, [isPaymentSheetOpen, pageScrollTop, prefersReducedMotion]);

  return (
    <div className="relative h-full overflow-hidden bg-white" ref={frameRef}>
      <div className="px-4 pt-9">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/35">
          History
        </p>
        <h3 className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.06em]">
          참여 내역
        </h3>

        <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-[0.95rem] bg-[#f7f7f7] p-1.5">
          <div className="h-10 rounded-[0.8rem] bg-black text-center text-[13px] font-semibold leading-10 text-white">
            참여한 분철
          </div>
          <div className="h-10 rounded-[0.8rem] text-center text-[13px] font-semibold leading-10 text-black/45">
            개최한 분철
          </div>
        </div>

        <div className="mt-3 grid gap-3">
          {participatedBids.map(({ amount, deadline, image, member, rank, status, title }) => (
            <div className="rounded-[1rem] border border-black/10 px-4 py-4" key={title}>
              <div className="flex items-start gap-3">
                <span
                  className="block h-16 w-16 shrink-0 rounded-[1rem] bg-[#f4f4f4] bg-cover bg-center ring-1 ring-black/5"
                  style={{
                    backgroundImage: shouldLoadPaymentImages
                      ? `url(${image})`
                      : undefined,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                        {title}
                      </p>
                      <p className="mt-1 text-[13px] font-medium text-black/45">
                        {member} · {status}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-black px-2.5 py-1 text-[12px] font-semibold text-white">
                      {rank}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-[0.75rem] bg-[#f7f7f7] px-3 py-2">
                        <p className="text-[11px] font-medium text-black/35">
                          상품 금액
                        </p>
                        <p className="mt-1 text-[14px] font-semibold">{amount}</p>
                      </div>
                      <div className="rounded-[0.75rem] bg-[#f7f7f7] px-3 py-2">
                        <p className="text-[11px] font-medium text-black/35">
                          상태
                        </p>
                        <p className="mt-1 text-[14px] font-semibold">{status}</p>
                      </div>
                    </div>
                    <div className="rounded-[0.75rem] bg-[#f7f7f7] px-3 py-2">
                      <p className="text-[11px] font-medium text-black/35">마감</p>
                      <p className="mt-1 text-[14px] font-semibold">
                        {deadline}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-[12px] font-medium text-black">
                      <p>결제가 필요해요</p>
                      <p className="mt-0.5 text-black/45">결제까지 23시간</p>
                    </div>
                    <span className="rounded-full bg-black px-3 py-2 text-[13px] font-semibold text-white">
                      결제
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className={`intro-payment-sheet absolute inset-x-0 bottom-0 rounded-t-[1.8rem] bg-white px-5 pb-5 pt-6 shadow-[0_-18px_55px_rgba(0,0,0,0.2)] ${
          isPaymentSheetOpen ? "intro-payment-sheet-open" : ""
        }`}
      >
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-black/12" />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[24px] font-semibold tracking-[-0.08em]">
              배송지 선택
            </p>
            <p className="mt-2 text-[14px] font-medium text-black/45">
              참여 상품을 받을 주소를 확인해 주세요.
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-[24px] font-semibold text-white">
            ×
          </span>
        </div>

        <div className="mt-5 rounded-[1rem] bg-[#f7f7f7] px-4 py-4">
          <p className="text-[16px] font-semibold tracking-[-0.04em]">
            IVE 시즌그리팅 포카
          </p>
          <p className="mt-1 text-[13px] font-medium text-black/45">
            6개 옵션 · 장원영
          </p>
        </div>

        <div className="mt-4 rounded-[1rem] border border-black/10 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-black/35">
                개최자 계좌
              </p>
              <p className="mt-2 text-[17px] font-semibold tracking-[-0.05em]">
                카카오뱅크 3333-24-2427024
              </p>
              <p className="mt-2 text-[13px] font-medium leading-5 text-black/45">
                개최자가 등록한 계좌로 입금해 주세요.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-black px-4 py-2 text-[12px] font-semibold text-white">
              계좌 복사
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-[0.95rem] bg-[#f4f4f4] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-black/48">
              CU
            </span>
            <p className="text-[15px] font-semibold tracking-[-0.04em]">
              성수역점
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-black/10 pt-4">
          <div className="flex justify-between text-[15px] font-medium text-black/45">
            <span>상품 금액</span>
            <span>42,000원</span>
          </div>
          <div className="mt-2 flex justify-between text-[15px] font-medium text-black/45">
            <span>배송비</span>
            <span>1,800원</span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[17px] font-semibold tracking-[-0.04em]">
              결제 예정 금액
            </span>
            <span className="text-[28px] font-semibold tracking-[-0.07em]">
              43,800원
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-full bg-black py-4 text-center text-[16px] font-semibold text-white">
          확인했어요
        </div>
      </div>
    </div>
  );
}

function ManageMiniScreen() {
  const { pageScrollTop } = useContext(IntroMotionContext);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [manageScrollOffset, setManageScrollOffset] = useState(0);
  const shouldLoadManageImages = useDeferredMockupImages(frameRef);
  const manageMembers = [
    {
      amount: "42,000원",
      image: "/intro-members/ive/wonyoung.webp",
      member: "장원영",
      participants: "6명",
      reported: true,
      trackingNumber: "CJ 5839 2047 1182",
      store: "CU 성수역점",
    },
    {
      amount: "31,000원",
      image: "/intro-members/ive/liz.webp",
      member: "리즈",
      participants: "5명",
      reported: false,
      trackingNumber: "",
      store: "GS25 홍대입구점",
    },
  ] as const;

  useLayoutEffect(() => {
    const frameElement = frameRef.current;

    if (!frameElement) {
      return;
    }

    const viewportHeight = window.innerHeight || 900;
    const frameTop = frameElement.getBoundingClientRect().top;
    const startLine = viewportHeight * 0.34;
    const nextManageScrollOffset = Math.max(
      0,
      Math.min(165, Math.round((startLine - frameTop) * 0.7)),
    );
    const animationFrame = window.requestAnimationFrame(() => {
      setManageScrollOffset((currentOffset) =>
        currentOffset === nextManageScrollOffset
          ? currentOffset
          : nextManageScrollOffset,
      );
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [pageScrollTop]);

  return (
    <div className="h-full overflow-hidden bg-white" ref={frameRef}>
      <div
        className="px-5 pb-24 pt-9 will-change-transform"
        style={{ transform: `translateY(-${manageScrollOffset}px)` }}
      >
      <div className="flex items-end justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
          <BackIcon />
        </span>
        <div className="text-right">
          <p className="text-[12px] font-semibold text-black/35">
            개최 분철 관리
          </p>
          <p className="mt-1 max-w-[12rem] truncate text-[22px] font-semibold leading-none tracking-[-0.06em]">
            IVE 시즌그리팅 포카
          </p>
        </div>
      </div>

      <section className="mt-5 rounded-[1rem] border border-black/10 px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-black/40">IVE</p>
            <p className="mt-1 truncate text-[18px] font-semibold tracking-[-0.05em]">
              시즌그리팅 MD
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#f1f1f1] px-3 py-1 text-[12px] font-semibold text-black/55">
            마감
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3">
            <p className="text-[11px] font-medium text-black/35">옵션</p>
            <p className="mt-1 text-[15px] font-semibold">6개</p>
          </div>
          <div className="rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3">
            <p className="text-[11px] font-medium text-black/35">참여</p>
            <p className="mt-1 text-[15px] font-semibold">23명</p>
          </div>
          <div className="col-span-2 rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3">
            <p className="text-[11px] font-medium text-black/35">마감</p>
            <p className="mt-1 whitespace-nowrap text-[15px] font-semibold tracking-[-0.04em]">
              2026년 06월 03일 18시
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <div className="mb-3">
          <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
            멤버별 참여 현황
          </h2>
          <p className="mt-1 text-[13px] font-medium text-black/40">
            멤버별 참여와 배송 준비를 확인해요.
          </p>
        </div>

        <div className="grid gap-3">
          {manageMembers.map(({ amount, image, member, participants, reported, store, trackingNumber }) => (
        <article className="rounded-[1rem] border border-black/10 px-4 py-4" key={member}>
          <div className="flex items-center gap-3">
            <span
              className="block h-16 w-16 shrink-0 rounded-[1rem] bg-[#f4f4f4] bg-cover bg-center ring-1 ring-black/5"
              style={{
                backgroundImage: shouldLoadManageImages
                  ? `url(${image})`
                  : undefined,
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-semibold tracking-[-0.04em]">
                {member}
              </p>
              <p className="mt-1 text-[12px] font-medium text-black/40">
                참여 {participants}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3">
              <p className="text-[11px] font-medium text-black/35">
                가격
              </p>
              <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                {amount}
              </p>
            </div>
            <div className="rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3">
              <p className="text-[11px] font-medium text-black/35">참여</p>
              <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
                {participants}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-black/10 pt-4">
            <div className="rounded-[0.85rem] bg-[#f7f7f7] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-black/35">
                    결제 확인
                  </p>
                  <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em]">
                    {reported ? "결제 확인 완료" : "결제 대기"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold ${
                    reported
                      ? "intro-confirm-pulse bg-black text-white"
                      : "bg-black/10 text-black/32"
                  }`}
                >
                  결제 확인
                </span>
              </div>
            </div>

            <div className="mt-3 rounded-[0.85rem] bg-[#f7f7f7] px-3 py-3">
              <p className="text-[11px] font-medium text-black/35">
                배송 정보
              </p>
              <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em]">
                {store}
              </p>
            </div>

            <p className="mt-3 text-[12px] font-semibold text-black/45">
              운송장 번호
            </p>
            <div className="mt-2 rounded-[0.85rem] border border-black/10 px-4 py-3 text-[14px] font-semibold text-black/70">
              {trackingNumber ? (
                <span className="intro-waybill-typing inline-block overflow-hidden whitespace-nowrap">
                  {trackingNumber}
                </span>
              ) : (
                <span className="text-black/24">운송장 번호 입력</span>
              )}
            </div>
            <div
              className={`mt-3 rounded-full py-3 text-center text-[14px] font-semibold tracking-[-0.04em] ${
                trackingNumber
                  ? "intro-ship-complete-button bg-black text-white"
                  : "bg-black/15 text-black/35"
              }`}
            >
              발송 완료
            </div>
          </div>
        </article>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
}

function FeatureBlock({ section, index }: { section: FeatureSection; index: number }) {
  return (
    <section className="relative px-5 py-20 text-black">
      <Reveal direction={index % 2 === 0 ? "right" : "left"}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/32">
          {section.eyebrow}
        </p>
        <h2 className="mt-3 break-keep text-[36px] font-semibold leading-[1.04] tracking-[-0.08em]">
          {section.title}
        </h2>
        <p className="mt-4 break-keep text-[15px] font-medium leading-6 tracking-[-0.04em] text-black/56">
          {section.body}
        </p>
      </Reveal>
      <Reveal className="mt-10" delay={160} direction="scale">
        <MiniPhone
          className={
            index % 2 === 0 ? "rotate-[2deg]" : "rotate-[-2deg]"
          }
        >
          {section.screen}
        </MiniPhone>
      </Reveal>
    </section>
  );
}

const featureSections: FeatureSection[] = [
  {
    body: "그룹과 멤버를 입력하는 순간, 맞는 후보와 분철 결과가 자연스럽게 이어져요.",
    eyebrow: "Search",
    screen: <SearchMiniScreen />,
    title: "찾는 멤버까지 빠르게",
  },
  {
    body: "대표 이미지, 옵션별 가격과 참여 상태를 한 화면에서 확인하고 바로 참여해요.",
    eyebrow: "Detail",
    screen: <DetailMiniScreen />,
    title: "참여 조건은 선명하게",
  },
  {
    body: "참여 후에는 계좌와 입금 마감 시각을 한 화면에서 확인해요.",
    eyebrow: "Payment",
    screen: <PaymentMiniScreen />,
    title: "송금 흐름도 가볍게",
  },
  {
    body: "개최자는 결제 대기 건을 확인하고, 운송장 등록까지 같은 화면에서 이어가요.",
    eyebrow: "Manage",
    screen: <ManageMiniScreen />,
    title: "개최 관리까지 이어서",
  },
];

export function IntroContent() {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const homeScrollOffsetRef = useRef(0);
  const lastScrollTopRef = useRef(0);
  const pageScrollTopRef = useRef(0);
  const [homeScrollOffset, setHomeScrollOffset] = useState(0);
  const [pageScrollTop, setPageScrollTop] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [recentBuncheols, setRecentBuncheols] = useState(
    fallbackRecentBuncheols,
  );
  const [scrollDirection, setScrollDirection] =
    useState<ScrollDirection>("down");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function syncMotionPreference() {
      setPrefersReducedMotion(mediaQuery.matches);
    }

    function addMotionPreferenceListener() {
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", syncMotionPreference);

        return () => {
          mediaQuery.removeEventListener("change", syncMotionPreference);
        };
      }

      const legacyMediaQuery = mediaQuery as LegacyMediaQueryList;

      legacyMediaQuery.addListener(syncMotionPreference);

      return () => {
        legacyMediaQuery.removeListener(syncMotionPreference);
      };
    }

    syncMotionPreference();
    const removeMotionPreferenceListener = addMotionPreferenceListener();

    return () => {
      removeMotionPreferenceListener();
    };
  }, []);

  useLayoutEffect(() => {
    const scrollElement = scrollContainerRef.current;

    if (!scrollElement) {
      return;
    }

    const activeScrollElement: HTMLDivElement = scrollElement;

    let scheduledFrameId = 0;

    function syncScrollDirection() {
      const documentScrollTop =
        document.scrollingElement?.scrollTop ?? window.scrollY ?? 0;
      const nextScrollTop = Math.max(
        activeScrollElement.scrollTop,
        documentScrollTop,
      );
      const previousScrollTop = lastScrollTopRef.current;

      if (pageScrollTopRef.current !== nextScrollTop) {
        pageScrollTopRef.current = nextScrollTop;
        setPageScrollTop(nextScrollTop);
      }

      const scrollLinkedOffset = Math.max(0, Math.round(nextScrollTop * 0.8));
      const nextHomeScrollOffset = Math.min(
        330,
        scrollLinkedOffset,
      );

      if (homeScrollOffsetRef.current !== nextHomeScrollOffset) {
        homeScrollOffsetRef.current = nextHomeScrollOffset;
        setHomeScrollOffset(nextHomeScrollOffset);
      }

      if (Math.abs(nextScrollTop - previousScrollTop) > 3) {
        setScrollDirection(nextScrollTop > previousScrollTop ? "down" : "up");
        lastScrollTopRef.current = nextScrollTop;
      }
    }

    function scheduleScrollSync() {
      if (scheduledFrameId) {
        return;
      }

      scheduledFrameId = window.requestAnimationFrame(() => {
        scheduledFrameId = 0;
        syncScrollDirection();
      });
    }

    lastScrollTopRef.current = Math.max(
      activeScrollElement.scrollTop,
      document.scrollingElement?.scrollTop ?? window.scrollY ?? 0,
    );

    scheduleScrollSync();

    activeScrollElement.addEventListener("scroll", scheduleScrollSync, {
      passive: true,
    });
    window.addEventListener("scroll", scheduleScrollSync, {
      passive: true,
    });
    window.addEventListener("resize", scheduleScrollSync, {
      passive: true,
    });
    window.addEventListener("pageshow", scheduleScrollSync);

    return () => {
      window.cancelAnimationFrame(scheduledFrameId);
      activeScrollElement.removeEventListener("scroll", scheduleScrollSync);
      window.removeEventListener("scroll", scheduleScrollSync);
      window.removeEventListener("resize", scheduleScrollSync);
      window.removeEventListener("pageshow", scheduleScrollSync);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    requestBuncheols(undefined, { size: 2 })
      .then((items) => {
        if (!isActive || items.length === 0) {
          return;
        }

        setRecentBuncheols(items.slice(0, 2).map(toIntroRecentBuncheol));
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setRecentBuncheols(fallbackRecentBuncheols);
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <IntroMotionContext.Provider
      value={{ homeScrollOffset, pageScrollTop, prefersReducedMotion, scrollDirection }}
    >
      <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#f7f3eb] text-black">
        <div
          className="mx-auto h-full w-full max-w-[430px] overflow-x-hidden overflow-y-auto overscroll-contain bg-[#f7f3eb]"
          ref={scrollContainerRef}
        >
          <section className="relative flex min-h-[100dvh] flex-col px-5 pb-9 pt-5">
            <nav className="flex items-center justify-between">
              <p className="text-[24px] font-semibold leading-none tracking-[-0.07em]">
                분철이지
              </p>
            </nav>

            <div className="flex flex-1 flex-col justify-center py-9">
              <Reveal>
                <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-black/36">
                  Bias Goods Split
                </p>
                <h1 className="mt-4 text-[46px] font-semibold leading-[0.96] tracking-[-0.085em]">
                  최애 굿즈
                  <br />
                  분철을 더
                  <br />
                  쉽게.
                </h1>
                <p className="mt-5 max-w-[20rem] text-[15px] font-medium leading-6 tracking-[-0.04em] text-black/54">
                  찾고, 참여하고, 결제 확인까지. 분철에 필요한 흐름을 한
                  화면 안에서 이어가요.
                </p>
              </Reveal>

              <Reveal className="relative mt-10" delay={120} direction="scale">
                <MiniPhone>
                  <HomeMiniScreen />
                </MiniPhone>
              </Reveal>
            </div>
          </section>

          <section className="relative -mt-10 rounded-t-[2rem] bg-white px-5 pb-20 pt-16 text-black shadow-[0_-18px_48px_rgba(0,0,0,0.08)]">
            <Reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/32">
                Flow
              </p>
              <h2 className="mt-3 text-[36px] font-semibold leading-[1.02] tracking-[-0.08em]">
                복잡한 분철을
                <br />
                순서대로 가볍게.
              </h2>
            </Reveal>

            <div className="mt-8 grid gap-3">
              {["상품 탐색", "옵션 참여", "계좌 입금", "결제 확인"].map(
                (item, index) => (
                  <Reveal delay={index * 90} direction="up" key={item}>
                    <div className="flex h-16 items-center justify-between rounded-[1.1rem] bg-[#f6f6f6] px-4">
                      <span className="text-[17px] font-semibold tracking-[-0.06em]">
                        {item}
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-[12px] font-semibold text-white">
                        {index + 1}
                      </span>
                    </div>
                  </Reveal>
                ),
              )}
            </div>
          </section>

          <div className="relative -mt-10 rounded-t-[2rem] bg-[radial-gradient(circle_at_78%_6%,rgba(255,255,255,0.92),transparent_30%),radial-gradient(circle_at_14%_24%,rgba(202,225,230,0.58),transparent_32%),radial-gradient(circle_at_88%_70%,rgba(246,222,206,0.56),transparent_34%),linear-gradient(180deg,#faf7f0_0%,#e9f0f1_46%,#f7f1e9_100%)] pt-10">
            {featureSections.map((section, index) => (
              <FeatureBlock index={index} key={section.eyebrow} section={section} />
            ))}
          </div>

          <section className="relative -mt-10 rounded-t-[2rem] bg-white px-5 pb-12 pt-14 text-black shadow-[0_-16px_40px_rgba(0,0,0,0.06)]">
            <Reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/32">
                Start
              </p>
              <h2 className="mt-3 text-[39px] font-semibold leading-[1] tracking-[-0.085em]">
                열려 있는
                <br />
                분철부터 확인해요.
              </h2>
              <p className="mt-4 text-[15px] font-medium leading-6 tracking-[-0.04em] text-black/54">
                필요한 건 빠르게 찾고, 진행 상황은 놓치지 않게. 분철이지에서
                바로 시작할 수 있어요.
              </p>
            </Reveal>

            <Reveal className="mt-8" delay={120}>
              <div className="rounded-[1.5rem] bg-[#111111] px-5 py-5 text-white shadow-[0_22px_54px_rgba(0,0,0,0.22)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/38">
                      Today
                    </p>
                    <p className="mt-2 text-[22px] font-semibold tracking-[-0.07em]">
                      최근 열린 분철
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {recentBuncheols.map(({ deadline, state, title }) => (
                    <div
                      className="flex items-center justify-between rounded-[0.85rem] bg-white px-3 py-3 text-black"
                      key={title}
                    >
                      <div>
                        <p className="text-[14px] font-semibold tracking-[-0.05em]">
                          {title}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-black/36">
                          {state}
                        </p>
                      </div>
                      <span className="rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white">
                        {deadline}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </section>

          <BusinessFooter />
        </div>
      </main>
    </IntroMotionContext.Provider>
  );
}
