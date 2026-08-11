"use client";

import Link from "next/link";
import {
  createContext,
  memo,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from "react";
import { requestBuncheols, type BuncheolSummary } from "@/lib/auth-api";
import { isBuncheolRecruitingStatus } from "@/lib/buncheol-states";
import { X_HANDLE, X_PROFILE_URL } from "@/lib/site";
import { BusinessFooter } from "@/components/BusinessFooter";
import {
  BackIcon,
  BanknoteIcon,
  BellIcon,
  ClipboardListIcon,
  CloseIcon,
  ForwardIcon,
  HeartIcon,
  HomeIcon,
  PackageCheckIcon,
  PlusIcon,
  ProfileIcon,
  BidIcon,
  TruckIcon,
  UsersRoundIcon,
  XLogoIcon,
} from "@/components/icons";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right" | "scale";
};

type IntroMotionContextValue = {
  homeScrollOffset: number;
  prefersReducedMotion: boolean;
};

type LegacyMediaQueryList = MediaQueryList & {
  addListener: (listener: () => void) => void;
  removeListener: (listener: () => void) => void;
};

type FeatureSlide = {
  body: string;
  chips: readonly string[];
  title: string;
};

type IntroRecentBuncheol = {
  deadline: string;
  state: string;
  title: string;
};

const IntroMotionContext = createContext<IntroMotionContextValue>({
  homeScrollOffset: 0,
  prefersReducedMotion: false,
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
  const { prefersReducedMotion } = useContext(IntroMotionContext);
  const [isVisible, setIsVisible] = useState(false);
  // 전이가 끝나면 will-change 를 놓아준다 — 30여 개가 페이지 수명 내내 합성 레이어를 붙잡지 않도록.
  const [isSettled, setIsSettled] = useState(false);

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
        if (!entry?.isIntersecting) {
          return;
        }

        setIsVisible(true);
        observer.disconnect();
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.12,
      },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  const hiddenTransforms = {
    left: "translate3d(20px,0,0)",
    right: "translate3d(-20px,0,0)",
    scale: "translate3d(0,14px,0) scale(0.97)",
    up: "translate3d(0,22px,0)",
  };
  const shouldShow = prefersReducedMotion || isVisible;

  return (
    <div
      className={className}
      onTransitionEnd={() => setIsSettled(true)}
      ref={ref}
      style={{
        opacity: shouldShow ? 1 : 0,
        transform: prefersReducedMotion
          ? "none"
          : shouldShow
            ? "translate3d(0,0,0) scale(1)"
            : hiddenTransforms[direction],
        transition: prefersReducedMotion
          ? "none"
          : `opacity 620ms ${delay}ms cubic-bezier(0.16, 1, 0.3, 1), transform 620ms ${delay}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        willChange:
          prefersReducedMotion || isSettled ? "auto" : "opacity, transform",
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

// 목업 화면은 실제 앱과 같은 430px 기준으로 그리고, 폰 프레임 폭에 맞춰 스케일만 줄인다.
function MiniPhone({
  children,
  className = "",
  widthClassName = "w-[20rem] max-w-[84vw]",
}: {
  children: ReactNode;
  className?: string;
  widthClassName?: string;
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
    <div className={`relative mx-auto ${widthClassName} ${className}`}>
      <div className="absolute -left-[0.26rem] top-[22%] h-[6%] w-[0.32rem] rounded-l-full bg-[#1a1a1c]" />
      <div className="absolute -left-[0.26rem] top-[31%] h-[9%] w-[0.32rem] rounded-l-full bg-[#1a1a1c]" />
      <div className="absolute -right-[0.26rem] top-[27%] h-[11%] w-[0.32rem] rounded-r-full bg-[#1a1a1c]" />
      <div className="relative rounded-[2.6rem] bg-[linear-gradient(150deg,#3a3a3f_0%,#0b0b0c_28%,#000_70%,#2b2b2f_100%)] p-[0.4rem] shadow-[0_2px_6px_rgba(0,0,0,0.12),0_28px_60px_-18px_rgba(0,0,0,0.45)]">
        <div className="relative rounded-[2.3rem] bg-[#050505] px-[0.5rem] pb-6 pt-7">
          <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-[1.05rem] w-[26%] -translate-x-1/2 rounded-full bg-black" />
          <div className="absolute bottom-2 left-1/2 z-20 h-1 w-[24%] -translate-x-1/2 rounded-full bg-white/25" />
          <div
            className="intro-mini-phone-screen relative aspect-[430/932] overflow-hidden rounded-[1.3rem] bg-black text-black"
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

// 홈 목록 카드 — components/ProductCard.tsx 의 wide variant 를 그대로 옮긴 구성.
const introHomeProducts = [
  {
    availableMembers: ["셔누", "민혁", "기현", "형원", "아이엠"],
    deadline: "D-2",
    image: "/intro-products/monsta-x-main.png",
    isNew: true,
    purchasable: true,
    status: "구매 가능",
    title: "MONSTA X 팬콘 특전 포카 분철",
  },
  {
    availableMembers: ["재민", "런쥔", "제노"],
    deadline: "D-4",
    image: "/intro-products/nct-dream-main.png",
    isNew: false,
    purchasable: true,
    status: "구매 가능",
    title: "NCT DREAM 일본 럭드 분철",
  },
  {
    availableMembers: ["장원영", "리즈"],
    deadline: "D-DAY",
    image: "/intro-products/ive-main.png",
    isNew: false,
    purchasable: true,
    status: "구매 가능",
    title: "IVE 시즌그리팅 포카 분철",
  },
  {
    availableMembers: [],
    deadline: "",
    image: "/intro-products/seventeen-main.png",
    isNew: false,
    purchasable: false,
    status: "모집 종료",
    title: "세븐틴 팬미팅 MD 포카 분철",
  },
] as const;

function MiniBottomNav() {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 grid h-16 grid-cols-5 items-center bg-black px-3 text-white/55">
      <span className="flex justify-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DDE7B8] text-black shadow-[0_8px_24px_rgba(120,132,82,0.22)]">
          <HomeIcon />
        </span>
      </span>
      <span className="flex justify-center">
        <PlusIcon />
      </span>
      <span className="flex justify-center">
        <BidIcon />
      </span>
      <span className="flex justify-center">
        <HeartIcon />
      </span>
      <span className="flex justify-center">
        <ProfileIcon />
      </span>
    </div>
  );
}

function HomeMiniScreen() {
  const { homeScrollOffset } = useContext(IntroMotionContext);

  return (
    <div className="relative h-full overflow-hidden bg-white">
      <div className="absolute inset-x-0 top-0 z-20 border-b border-black bg-black px-5 py-3">
        <div className="flex h-10 items-center gap-3">
          <span
            className="-ml-2 h-10 w-[106px] shrink-0 bg-contain bg-left bg-no-repeat"
            style={{ backgroundImage: "url(/brand/logo-white.png)" }}
          />
          <span className="min-w-0 flex-1" />
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#C8D4A5] bg-[#DDE7B8] text-black shadow-[0_8px_22px_rgba(120,132,82,0.24)]">
            <BellIcon />
          </span>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-16 top-16 overflow-hidden bg-white">
        <div
          className="intro-home-screen-scroll px-4 pb-16 pt-4"
          style={{
            transform: `translateY(-${homeScrollOffset}px)`,
          }}
        >
          <div className="relative aspect-[1.72/1] overflow-hidden rounded-[1.15rem] bg-white shadow-[0_14px_34px_rgba(0,0,0,0.08)]">
            <span
              className="absolute inset-0 scale-110 bg-cover bg-center blur-xl"
              style={{ backgroundImage: "url(/banners/buncheol-guide.png)" }}
            />
            <span
              className="absolute inset-0 bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: "url(/banners/buncheol-guide.png)" }}
            />
          </div>

          <div className="flex items-center justify-center gap-2 pb-4 pt-2">
            <span className="h-2 w-6 rounded-full bg-[#CFE86B] shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_6px_16px_rgba(120,132,82,0.3)]" />
            <span className="h-2 w-2 rounded-full bg-zinc-300" />
            <span className="h-2 w-2 rounded-full bg-zinc-300" />
          </div>

          <div className="space-y-3 pt-2">
            {introHomeProducts.map(
              ({
                availableMembers,
                deadline,
                image,
                isNew,
                purchasable,
                status,
                title,
              }) => (
                <div
                  className="overflow-hidden rounded-[1rem] border border-black/8 bg-white shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
                  key={title}
                >
                  <div
                    className="relative aspect-[1.72/1] overflow-hidden bg-cover bg-center"
                    style={{ backgroundImage: `url(${image})` }}
                  >
                    {purchasable ? null : (
                      <span className="absolute inset-0 bg-black/45" />
                    )}
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          purchasable
                            ? "bg-[#DDE7B8] text-black shadow-[0_8px_22px_rgba(120,132,82,0.22)]"
                            : "bg-black/55 text-white/80"
                        }`}
                      >
                        {status}
                      </span>
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/95 text-black/45 shadow-[0_10px_22px_rgba(0,0,0,0.16)]">
                        <HeartIcon />
                      </span>
                    </div>
                    {deadline ? (
                      <span className="absolute bottom-3 left-3 rounded-full bg-black/76 px-2.5 py-1 text-[13px] font-semibold tracking-[-0.04em] text-white">
                        {deadline}
                      </span>
                    ) : null}
                  </div>

                  <div
                    className={`px-3.5 py-3.5 ${purchasable ? "" : "opacity-60"}`}
                  >
                    {availableMembers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold leading-4 tracking-[-0.04em] text-[#D7FF5F]">
                          남은 멤버
                        </span>
                        {availableMembers.map((memberName) => (
                          <span
                            className="rounded-full bg-[#EEF8C8] px-2.5 py-1 text-[11px] font-semibold leading-4 tracking-[-0.04em] text-black/70 ring-1 ring-[#CFE86B]/55"
                            key={memberName}
                          >
                            {memberName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="inline-flex rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-black/38">
                        남은 멤버 없음
                      </span>
                    )}
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <p className="min-w-0 text-[16px] font-semibold leading-6 tracking-[-0.04em] text-black">
                        {title}
                      </p>
                      {isNew ? (
                        <span className="shrink-0 rounded-full bg-[#E4F6A5] px-2 py-0.5 text-[10px] font-semibold text-black">
                          신규
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </div>

      <span className="absolute bottom-[4.75rem] right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-black text-[18px] font-semibold text-[#D7FF5F] shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
        ?
      </span>
      <MiniBottomNav />
    </div>
  );
}

// 목업의 구매 기한 — 렌더 중에 날짜를 만들면 정적 프리렌더된 HTML 에 빌드 시각(CI 는 UTC)이
// 굳어 배포가 묵을수록 과거 날짜가 뜬다. 실제 화면 캡처처럼 고정 문자열로 둔다.
const MOCKUP_PURCHASE_DEADLINE = "2026년 08월 14일 18시";

// 분철 상세 — components/ProductDetail.tsx 의 섹션 순서·토큰을 그대로 따른다.
const DetailMiniScreen = memo(function DetailMiniScreen({ progress }: { progress: number }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const shouldLoadDetailImages = useDeferredMockupImages(frameRef);
  const memberSlots = [
    {
      image: "/intro-members/nct-dream/jaemin.webp",
      member: "재민",
      price: "24,000원",
      soldOut: false,
    },
    {
      image: "/intro-members/nct-dream/haechan.webp",
      member: "해찬",
      price: "24,000원",
      soldOut: false,
    },
    {
      image: "/intro-members/nct-dream/renjun.webp",
      member: "런쥔",
      price: "22,000원",
      soldOut: true,
    },
    {
      image: "/intro-members/nct-dream/jeno.webp",
      member: "제노",
      price: "22,000원",
      soldOut: false,
    },
    {
      image: "/intro-members/nct-dream/jisung.webp",
      member: "지성",
      price: "20,000원",
      soldOut: true,
    },
  ] as const;

  return (
    <div className="relative h-full overflow-hidden bg-white" ref={frameRef}>
      <div
        className="pb-40 pt-3 will-change-transform"
        style={{ transform: `translateY(-${Math.round(progress * 520)}px)` }}
      >
        <div className="flex items-center gap-2 px-4 pb-2">
          <span className="mr-auto flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
            <BackIcon />
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black">
            <HeartIcon />
          </span>
        </div>

        <div className="px-4">
          <div
            className="relative aspect-[4/3] overflow-hidden rounded-[1.35rem] bg-[#f5f5f5] bg-cover bg-center"
            style={{
              backgroundImage: shouldLoadDetailImages
                ? "url(/intro-products/nct-dream-main.png)"
                : undefined,
            }}
          >
            <span className="absolute left-5 top-5 rounded-full bg-[#DDE7B8] px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-black shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
              구매 가능
            </span>
            <span className="absolute bottom-4 right-4 rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-semibold text-white">
              1/5
            </span>
          </div>
        </div>

        <div className="px-5 pt-6">
          <p className="text-[13px] font-semibold leading-5 text-black/40">
            #런쥔 #제노 #해찬 #재민 #천러 #지성
          </p>
          <h3 className="mt-4 text-[27px] font-semibold leading-[1.18] tracking-[-0.06em]">
            드림 2026 시즌팩 포카 분철
          </h3>

          <div className="mt-7 overflow-hidden rounded-[1.15rem] border border-black/10 bg-white shadow-[0_14px_34px_rgba(0,0,0,0.045)]">
            <div className="grid grid-cols-[0.86fr_1.14fr] divide-x divide-black/10 border-b border-black/10">
              <div className="min-w-0 px-4 py-3.5">
                <p className="text-[12px] font-medium text-black/45">구매처</p>
                <p className="mt-1 truncate text-[16px] font-semibold tracking-[-0.04em]">
                  공식 판매처
                </p>
              </div>
              <div className="min-w-0 px-4 py-3.5">
                <p className="text-[12px] font-medium text-black/45">
                  구매 기한
                </p>
                <p className="mt-1 text-[15px] font-semibold leading-6 tracking-[-0.04em] tabular-nums">
                  {MOCKUP_PURCHASE_DEADLINE}
                </p>
              </div>
            </div>
            <div className="px-4 py-4">
              <p className="text-[12px] font-medium text-black/45">참여 현황</p>
              <p className="mt-1 text-[22px] font-semibold tracking-[-0.06em]">
                현재 4/6명
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.06]">
                <div
                  className="h-full rounded-full bg-[#CFE86B]"
                  style={{ width: "66%" }}
                />
              </div>
              <p className="mt-2 text-[12px] font-semibold text-black/40">
                분철 진행 최소 인원까지 2명 남았어요. 인원을 채우면 진행이
                확정돼요.
              </p>
            </div>
          </div>

          <div className="mt-7 border-t border-black/10 pt-6">
            <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
              배송 방법
            </h2>
            <div className="mt-3 space-y-2">
              {[
                ["CU 알뜰택배", "3,000원"],
                ["GS25 반값택배", "3,200원"],
              ].map(([method, price]) => (
                <div
                  className="flex min-h-12 items-center justify-between rounded-[0.8rem] bg-[#f7f7f7] px-4"
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
            <p className="mt-3 text-[12px] font-medium leading-5 text-black/40">
              이 분철에서 이용할 수 있는 배송 방법과 배송비예요. 참여할 때 이
              중에서 택배 받을 편의점 지점을 고르고, 배송비는 상품 금액과 함께
              입금해요.
            </p>
          </div>

          <div className="mt-8 border-t border-black/10 pt-6">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-[18px] font-semibold">멤버</h2>
              <p className="text-[12px] font-semibold text-black/35">5명</p>
            </div>
            <div className="mt-4 overflow-hidden rounded-[0.95rem] border border-black/10 bg-white">
              {memberSlots.map(({ image, member, price, soldOut }) => (
                <div
                  className={`relative flex min-h-[72px] items-center justify-between gap-3 overflow-hidden border-b border-black/[0.06] px-4 py-3 last:border-b-0 ${
                    soldOut ? "bg-[#fafafa]" : "bg-white"
                  }`}
                  key={member}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`block h-12 w-12 shrink-0 rounded-[0.9rem] bg-[#f1f1f1] bg-cover bg-center ring-1 ring-black/[0.04] ${
                        soldOut ? "opacity-45" : ""
                      }`}
                      style={{
                        backgroundImage: shouldLoadDetailImages
                          ? `url(${image})`
                          : undefined,
                      }}
                    />
                    <div className="min-w-0">
                      <p
                        className={`truncate text-[16px] font-semibold ${
                          soldOut ? "text-black/45" : "text-black"
                        }`}
                      >
                        {member}
                      </p>
                      {soldOut ? null : (
                        <p className="mt-0.5 text-[12px] font-semibold text-black/35">
                          구매 가능 멤버
                        </p>
                      )}
                    </div>
                  </div>
                  <div
                    className={`shrink-0 text-right ${soldOut ? "opacity-45" : ""}`}
                  >
                    <p className="text-[11px] font-semibold text-black/35">
                      구매가
                    </p>
                    <p className="mt-0.5 text-[16px] font-semibold">{price}</p>
                  </div>
                  {soldOut ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/55 backdrop-blur-[0.5px]">
                      <span className="rounded-full bg-black/70 px-3.5 py-1.5 text-[12px] font-semibold text-white backdrop-blur">
                        매진
                      </span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 bg-white px-5 pb-5 pt-3 shadow-[0_-12px_34px_rgba(0,0,0,0.08)]">
        <p className="mb-2 text-center text-[11px] font-medium text-black/40">
          지금은 신청만 하고, 개최자가 확정하면 입금해요.
        </p>
        <div className="flex h-14 items-center justify-center rounded-full bg-[#CFE86B] text-[17px] font-semibold tracking-[-0.04em] text-black shadow-[0_12px_28px_rgba(120,132,82,0.24)]">
          신청하기
        </div>
      </div>
    </div>
  );
});

// 참여 진행 바 — C2C 6단계 (components/BidHistoryContent.tsx 의 c2cProgressStepLabels 와 동일 문자열).
const introProgressSteps = [
  "신청",
  "입금 대기",
  "입금 확인",
  "진행 확정",
  "배송 중",
  "배송 완료",
] as const;

// 참여 내역 + 결제 정보 시트 — components/BidHistoryContent.tsx 의 카드·시트 구성을 따른다.
const PaymentMiniScreen = memo(function PaymentMiniScreen({ progress }: { progress: number }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const shouldLoadPaymentImages = useDeferredMockupImages(frameRef);
  const isSheetOpen = progress > 0.28;

  return (
    <div className="relative h-full overflow-hidden bg-white" ref={frameRef}>
      <div className="px-4 pt-9">
        <h3 className="text-[22px] font-semibold leading-none tracking-[-0.05em]">
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

        <div className="mt-3 rounded-[1.05rem] border border-black/10 bg-white px-4 py-4 shadow-[0_10px_28px_rgba(0,0,0,0.035)]">
          <div className="flex items-start gap-3">
            <div className="flex w-14 shrink-0 flex-col items-center gap-1.5">
              <span
                className="block h-14 w-14 overflow-hidden rounded-[0.85rem] bg-[#f1f1f1] bg-cover bg-center"
                style={{
                  backgroundImage: shouldLoadPaymentImages
                    ? "url(/intro-products/ive-main.png)"
                    : undefined,
                }}
              />
              <span className="w-full whitespace-nowrap rounded-full bg-[#E4F6A5] px-1 py-0.5 text-center text-[10px] font-semibold text-black/70">
                입금 진행
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                IVE 시즌그리팅 포카 분철
              </p>
              <p className="mt-1 text-[13px] font-medium text-black/45">
                장원영
              </p>

              <div className="mt-4 grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["상품 금액", "24,000원"],
                    ["배송비", "3,000원"],
                    ["입금 총액", "27,000원"],
                    ["모집 기한", "8.14 17시"],
                  ].map(([label, value]) => (
                    <div
                      className="rounded-[0.75rem] bg-[#F7FAEE] px-3 py-2 ring-1 ring-[#E4F6A5]/55"
                      key={label}
                    >
                      <p className="text-[11px] font-medium text-black/35">
                        {label}
                      </p>
                      <p className="mt-1 text-[14px] font-semibold tracking-[-0.04em]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="rounded-[0.75rem] bg-[#F7FAEE] px-3 py-2 ring-1 ring-[#E4F6A5]/55">
                  <p className="text-[11px] font-medium text-black/35">
                    배송지
                  </p>
                  <p className="mt-1 truncate text-[14px] font-semibold tracking-[-0.04em]">
                    CU 성수역점
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[0.8rem] bg-[#F7FAEE] px-3 py-3 ring-1 ring-[#E4F6A5]/50">
                <div className="relative">
                  <div className="absolute left-[8.333%] right-[8.333%] top-[9px] h-px bg-[#CAD6A0]" />
                  <div className="relative grid grid-cols-6 gap-1">
                    {introProgressSteps.map((step, stepIndex) => (
                      <div
                        className="flex min-w-0 flex-col items-center gap-1.5"
                        key={step}
                      >
                        <span
                          className={`h-[18px] w-[18px] rounded-full border-2 ${
                            stepIndex === 1
                              ? "border-[#CFE86B] bg-[#D7FF5F]"
                              : "border-[#dedede] bg-white"
                          }`}
                        />
                        <span
                          className={`break-keep text-center text-[10px] font-semibold leading-3 ${
                            stepIndex === 1 ? "text-black" : "text-black/35"
                          }`}
                        >
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`intro-payment-sheet absolute inset-x-0 bottom-0 rounded-t-[1.4rem] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
          isSheetOpen ? "intro-payment-sheet-open" : ""
        }`}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[21px] font-semibold tracking-[-0.06em]">
              결제 정보
            </p>
            <p className="mt-1 text-[13px] font-medium text-black/45">
              계좌 확인 후 입금하고 &apos;보냈어요&apos;를 눌러주세요.
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white">
            <CloseIcon />
          </span>
        </div>

        <div className="mt-5 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3">
          <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
            IVE 시즌그리팅 포카 분철
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold tracking-[-0.04em] text-black/65">
              장원영
            </span>
          </div>
        </div>

        <div className="mt-3 rounded-[0.9rem] bg-black px-4 py-3 text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold text-[#D7FF5F]/80">
              입금 마감까지
            </p>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70">
              입금 대기
            </span>
          </div>
          <p className="mt-1 text-[24px] font-semibold tracking-[-0.06em]">
            23시간 12분
          </p>
          <p className="mt-1 text-[12px] font-medium leading-5 text-white/60">
            기한 안에 아래 계좌로 입금해 주세요.
          </p>
        </div>

        <div className="mt-4 rounded-[0.95rem] border border-black/10 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-black/40">
                개최자 계좌
              </p>
              <p className="mt-1 truncate text-[15px] font-semibold tracking-[-0.04em]">
                카카오뱅크 3333-24-2427024
              </p>
              <p className="mt-1 text-[12px] font-medium text-black/40">
                예금주 김분철
              </p>
            </div>
            <span className="flex h-9 shrink-0 items-center rounded-full bg-black px-3 text-[12px] font-semibold text-[#D7FF5F]">
              계좌 복사
            </span>
          </div>
          <p className="mt-3 text-[12px] font-medium leading-5 text-black/45">
            송금 후 아래 &apos;보냈어요&apos;를 누르면 개최자가 입금을 확인해요.
          </p>
        </div>

        <div className="mt-3 rounded-[0.85rem] border border-[#DDE7B8] bg-[#F7FAEE] px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold text-[#D7FF5F]">
                  CU
                </span>
                <span className="rounded-full bg-[#E4F6A5] px-2 py-0.5 text-[10px] font-semibold text-black/55">
                  배송지 고정
                </span>
              </div>
              <p className="mt-1.5 truncate text-[13px] font-semibold tracking-[-0.04em]">
                성수역점
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-semibold text-black/40">
              변경 불가
            </span>
          </div>
        </div>

        <div className="mt-4 border-t border-black/10 pt-4">
          <div className="flex items-center justify-between text-[14px] font-medium text-black/45">
            <span>상품 금액</span>
            <span>24,000원</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[14px] font-medium text-black/45">
            <span>배송비</span>
            <span>3,000원</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[15px] font-semibold tracking-[-0.04em]">
              결제 예정 금액
            </span>
            <span className="text-[22px] font-semibold tracking-[-0.05em]">
              27,000원
            </span>
          </div>
        </div>

        <div className="intro-confirm-pulse mt-4 flex h-14 items-center justify-center rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-[#D7FF5F] shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
          입금했어요 · 보냈어요 표시
        </div>
      </div>
    </div>
  );
});

// 개최 분철 관리 — components/HostedBuncheolManage.tsx 의 운영 요약·입금 수집 중·참여자 관리 구성.
const ManageMiniScreen = memo(function ManageMiniScreen({ progress }: { progress: number }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const shouldLoadManageImages = useDeferredMockupImages(frameRef);
  const manageMembers = [
    {
      amount: "24,000원",
      depositor: "김분철",
      image: "/intro-members/ive/wonyoung.webp",
      member: "장원영",
      state: "sent",
    },
    {
      amount: "24,000원",
      depositor: "이분철",
      image: "/intro-members/ive/liz.webp",
      member: "리즈",
      state: "confirmed",
    },
  ] as const;

  return (
    <div className="relative h-full overflow-hidden bg-white" ref={frameRef}>
      <div
        className="px-4 pb-24 pt-9 will-change-transform"
        style={{ transform: `translateY(-${Math.round(progress * 300)}px)` }}
      >
        <div className="flex items-center gap-2 pb-3">
          <span className="mr-auto flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
            <BackIcon />
          </span>
          <p className="text-[13px] font-semibold text-black/40">
            개최 분철 관리
          </p>
        </div>

        <section className="overflow-hidden rounded-[1.05rem] border border-black/10 bg-white shadow-[0_10px_28px_rgba(0,0,0,0.035)]">
          <div className="bg-black px-4 py-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[#D7FF5F]/80">
                  IVE
                </p>
                <p className="mt-1 truncate text-[18px] font-semibold tracking-[-0.05em]">
                  시즌그리팅 포카 분철
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/75">
                입금 수집중
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: "66%" }}
              />
            </div>
          </div>

          <div className="px-4 py-4">
            <p className="text-[13px] font-semibold text-black/40">운영 요약</p>
            <p className="mt-1 text-[14px] font-semibold text-black/55">
              입금 확인 후 운송장 등록까지 한 곳에서 처리해요.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[0.85rem] border border-black/10 bg-white px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">멤버</p>
                <p className="mt-1 text-[15px] font-semibold">6명</p>
              </div>
              <div className="rounded-[0.85rem] border border-black/10 bg-white px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  최소 진행 인원
                </p>
                <p className="mt-1 text-[15px] font-semibold">4명</p>
              </div>
              <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  입금 대기
                </p>
                <p className="mt-1 text-[15px] font-semibold">1명</p>
              </div>
              <div className="rounded-[0.85rem] bg-[#f5f5f5] px-3 py-3">
                <p className="text-[11px] font-medium text-black/35">
                  보냈어요
                </p>
                <p className="mt-1 text-[15px] font-semibold">1명</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[1.05rem] border border-black/10 bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-semibold tracking-[-0.04em]">
              입금 수집 중
            </p>
            <span className="shrink-0 text-[12px] font-semibold text-black/45">
              기한 8월 14일 17시
            </span>
          </div>
          <p className="mt-1 text-[13px] font-medium leading-5 text-black/50">
            입금 확인 4명 · 입금 대기 1명 · 보냈어요 1명
          </p>
          <div className="intro-confirm-pulse mt-3 flex h-12 items-center justify-center rounded-full bg-black text-[15px] font-semibold tracking-[-0.04em] text-[#D7FF5F]">
            입금 수집 종료 · 진행 확정
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3">
            <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
              참여자 관리
            </h2>
            <p className="mt-1 text-[13px] font-medium text-black/40">
              입금자명과 통장 내역을 대조해 입금을 확인해요. 내역이 없으면
              반려로 재확인을 요청할 수 있어요.
            </p>
          </div>

          <div className="grid gap-3">
            {manageMembers.map(
              ({ amount, depositor, image, member, state }) => (
                <article
                  className="overflow-hidden rounded-[1.05rem] border border-black/10 bg-white shadow-[0_10px_28px_rgba(0,0,0,0.035)]"
                  key={member}
                >
                  <div className="flex items-center gap-3 border-b border-black/[0.06] px-4 py-3">
                    <span
                      className="block h-11 w-11 shrink-0 rounded-[0.9rem] bg-[#f1f1f1] bg-cover bg-center ring-1 ring-black/[0.04]"
                      style={{
                        backgroundImage: shouldLoadManageImages
                          ? `url(${image})`
                          : undefined,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold tracking-[-0.04em]">
                        {member}
                      </p>
                      <p className="mt-0.5 text-[12px] font-medium text-black/40">
                        참여 1명
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 px-4 py-3">
                    <div className="rounded-[0.85rem] border border-black/[0.08] px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold tracking-[-0.04em]">
                            입금자명 {depositor}
                          </p>
                          <p className="mt-0.5 text-[12px] font-medium text-black/40">
                            {amount}
                            {state === "sent"
                              ? " · 보냈어요 8월 12일 21시"
                              : " · 확인 8월 12일 09시"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            state === "sent"
                              ? "bg-[#D7FF5F] text-black"
                              : "bg-black text-white"
                          }`}
                        >
                          {state === "sent" ? "보냈어요" : "입금 확인"}
                        </span>
                      </div>

                      {state === "sent" ? (
                        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                          <div className="intro-confirm-pulse flex h-10 items-center justify-center rounded-full bg-black text-[13px] font-semibold text-[#D7FF5F]">
                            입금 확인
                          </div>
                          <div className="flex h-10 items-center justify-center rounded-full border border-black/10 px-4 text-[13px] font-semibold text-black/50">
                            반려
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <p className="text-[11px] font-medium text-black/35">
                            운송장 번호
                          </p>
                          <div className="mt-1.5 rounded-[0.7rem] border border-black/10 px-3 py-2.5 text-[13px] font-semibold text-black/70">
                            <span className="intro-waybill-typing inline-block overflow-hidden whitespace-nowrap">
                              CJ 5839 2047 1182
                            </span>
                          </div>
                          <div className="intro-ship-complete-button mt-2 flex h-10 items-center justify-center rounded-full text-[13px] font-semibold tracking-[-0.04em]">
                            운송장 등록
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>
      </div>
    </div>
  );
});

const featureSlides: readonly FeatureSlide[] = [
  {
    body: "멤버별 가격과 남은 자리를 한 화면에서 확인해요.\n원하는 멤버가 여럿이면 각각 신청할 수 있어요.",
    chips: ["멤버별 가격"],
    title: "남은 자리가 한눈에",
  },
  {
    body: "성사가 확정되면 계좌와 입금 기한이 안내돼요.\n송금 뒤 '보냈어요'만 누르면 끝.",
    chips: ["24시간 기한"],
    title: "입금은 확정된 뒤에",
  },
  {
    body: "신청 현황과 입금 확인은 물론,\n참여자들이 고른 배송지도 한 화면에 모여요.",
    chips: ["배송지 한눈에"],
    title: "개최도 화면 하나로",
  },
] as const;

const introFlowSteps = [
  {
    body: "원하는 멤버 자리를 잡아요. 이 단계에서는 입금하지 않아요.",
    label: "신청",
  },
  {
    body: "개최자가 성사를 확정하면 계좌와 24시간 입금 기한이 안내돼요.",
    label: "입금 대기",
  },
  {
    body: "송금 후 '보냈어요'를 누르면 개최자가 확인해 참여가 확정돼요.",
    label: "입금 확인",
  },
  {
    body: "최소 인원이 모이면 분철이 확정되고 굿즈 준비가 시작돼요.",
    label: "진행 확정",
  },
  {
    body: "운송장이 등록되면 배송 상태가 자동으로 따라붙어요.",
    label: "배송 중",
  },
  {
    body: "선택한 편의점에서 받고 수령을 확인하면 끝나요.",
    label: "배송 완료",
  },
] as const;

const introPainPoints = [
  {
    items: [
      { after: "명단에서 버튼으로 한 번에", before: "입금 확인 DM 한 명씩" },
      { after: "배송지가 한 화면에 모여요", before: "주소 하나씩 받아 적기" },
      { after: "인원 미달이면 자동 취소·안내", before: "성사 여부 수동 공지" },
    ],
    role: "개최자",
  },
  {
    items: [
      { after: "버튼으로 신청, DM 0회", before: "처음 보는 사람에게 먼저 DM" },
      { after: "남은 자리가 실시간으로 표시", before: "남은 멤버 물어보기" },
      { after: "단계별 알림톡과 진행 바", before: "진행 상황은 깜깜이" },
    ],
    role: "참여자",
  },
] as const;

const introSafetyPoints = [
  {
    body: "마감 때 최소 인원이 모자라면\n분철이 자동으로 취소돼요.\n참여자 전원에게 안내가 나가요.",
    icon: UsersRoundIcon,
    title: "인원 미달이면 자동 취소",
  },
  {
    body: "입금 안내, 진행 확정, 운송장 등록까지\n단계마다 알림톡으로 알려드려요.",
    icon: BellIcon,
    title: "단계마다 알림톡",
  },
  {
    body: "개인 DM 대신 참여 내역에 상태가 남아요.\n어디까지 왔는지 언제든 확인할 수 있어요.",
    icon: ClipboardListIcon,
    title: "모든 과정이 기록으로",
  },
  {
    body: "택배가 도착하면 고른 편의점에서 받고,\n수령 확인까지 앱에서 남겨요.",
    icon: PackageCheckIcon,
    title: "편의점에서 받고 수령 확인",
  },
] as const;

const introHostPoints = [
  {
    body: "멤버 자리와 가격, 마감일과 최소 인원만 정하면 등록이 끝나요.",
    icon: ClipboardListIcon,
    title: "정할 건 네 가지",
  },
  {
    body: "신청 인원과 입금 현황이 자동으로 집계돼 확인 버튼만 누르면 돼요.",
    icon: BanknoteIcon,
    title: "입금 확인은 버튼 하나",
  },
  {
    body: "참여자들이 고른 배송지가 한 화면에 모여 있어, 보고 그대로 보내면 돼요.",
    icon: TruckIcon,
    title: "배송지는 한 화면에",
  },
] as const;

function ArrowRight() {
  return (
    <svg
      aria-hidden="true"
      className="h-[1.05em] w-[1.05em]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

// 폰이 화면에 고정된 채 설명만 넘어가는 구간. 슬라이드별 진행도로 목업 내부 스크롤·시트까지 함께 움직인다.
// 스크롤 구독을 이 컴포넌트가 직접 들고 있어야 부모(IntroContent) 가 매 프레임 리렌더되지 않는다.
function FeatureStack({
  scrollContainerRef,
}: {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}) {
  const stackRef = useRef<HTMLDivElement | null>(null);
  const [stackProgress, setStackProgress] = useState(0);

  useLayoutEffect(() => {
    const containerElement = scrollContainerRef.current;

    if (!containerElement) {
      return;
    }

    let scheduledFrameId = 0;

    function syncStackProgress() {
      const stackElement = stackRef.current;

      if (!stackElement || !containerElement) {
        return;
      }

      const stackRect = stackElement.getBoundingClientRect();
      const containerRect = containerElement.getBoundingClientRect();
      const travel = stackRect.height - containerRect.height;

      if (travel <= 0) {
        return;
      }

      const nextProgress = clamp(
        (containerRect.top - stackRect.top) / travel,
        0,
        1,
      );

      setStackProgress((currentProgress) =>
        Math.abs(currentProgress - nextProgress) < 0.002
          ? currentProgress
          : nextProgress,
      );
    }

    function scheduleSync() {
      if (scheduledFrameId) {
        return;
      }

      scheduledFrameId = window.requestAnimationFrame(() => {
        scheduledFrameId = 0;
        syncStackProgress();
      });
    }

    scheduleSync();
    containerElement.addEventListener("scroll", scheduleSync, {
      passive: true,
    });
    window.addEventListener("resize", scheduleSync, { passive: true });

    return () => {
      window.cancelAnimationFrame(scheduledFrameId);
      containerElement.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
    };
  }, [scrollContainerRef]);

  // 앞뒤 10% 는 첫·마지막 슬라이드가 고정된 채 머무는 구간 — 없으면 마지막 슬라이드를 보자마자 sticky 가 풀린다.
  const slidePosition =
    clamp((stackProgress - 0.1) / 0.8, 0, 1) * featureSlides.length;
  const activeIndex = clamp(
    Math.floor(slidePosition),
    0,
    featureSlides.length - 1,
  );
  const slideProgress = (index: number) => clamp(slidePosition - index, 0, 1);

  return (
    <section
      className="relative"
      ref={stackRef}
      style={{
        height: `calc(var(--intro-vh, 100dvh) * ${featureSlides.length + 0.4})`,
      }}
    >
      <div className="sticky top-0 flex h-[var(--intro-vh,100dvh)] flex-col justify-center overflow-hidden px-6">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-[38%] rounded-full bg-[radial-gradient(circle,rgba(215,255,95,0.34),transparent_66%)] blur-[64px]" />

        <div className="relative h-[9.5rem]">
          {featureSlides.map(({ body, chips, title }, index) => (
            <div
              className="absolute inset-x-0 top-0"
              key={title}
              style={{
                opacity: index === activeIndex ? 1 : 0,
                transform:
                  index === activeIndex
                    ? "translate3d(0,0,0)"
                    : index < activeIndex
                      ? "translate3d(0,-14px,0)"
                      : "translate3d(0,14px,0)",
                transition:
                  "opacity 420ms cubic-bezier(0.16, 1, 0.3, 1), transform 420ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <p className="text-[13px] font-semibold tabular-nums tracking-[0.06em] text-[#A9AEB5]">
                {String(index + 1).padStart(2, "0")}
                <span className="text-[#C9CDD2]"> / 03</span>
              </p>
              <h2 className="mt-2 break-keep text-[30px] font-semibold leading-[1.18] tracking-[-0.045em]">
                {title}
              </h2>
              <p className="mt-2.5 whitespace-pre-line break-keep text-[14px] font-medium leading-[1.66] tracking-[-0.02em] text-[#5A6069]">
                {body}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <span
                    className="rounded-full border border-[#0A0B0D]/[0.06] bg-white px-2.5 py-1 text-[12px] font-semibold tracking-[-0.02em] text-[#5A6069]"
                    key={chip}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="relative mt-5 flex justify-center gap-1.5">
          {featureSlides.map(({ title }, index) => (
            <span
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? "w-6 bg-[#0A0B0D]"
                  : "w-1.5 bg-[#C9CDD2]"
              }`}
              key={title}
            />
          ))}
        </div>

        <div className="relative mt-5">
          <MiniPhone widthClassName="w-[min(18rem,calc((var(--intro-vh,100dvh)-15rem)/2.42))]">
            <div className="absolute inset-0">
              {featureSlides.map(({ title }, index) => (
                <div
                  className="absolute inset-0"
                  key={title}
                  style={{
                    opacity: index === activeIndex ? 1 : 0,
                    transition: "opacity 380ms ease",
                  }}
                >
                  {index === 0 ? (
                    <DetailMiniScreen progress={slideProgress(0)} />
                  ) : index === 1 ? (
                    <PaymentMiniScreen progress={slideProgress(1)} />
                  ) : (
                    <ManageMiniScreen progress={slideProgress(2)} />
                  )}
                </div>
              ))}
            </div>
          </MiniPhone>
        </div>
      </div>
    </section>
  );
}

export function IntroContent() {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const homeScrollOffsetRef = useRef(0);
  const [homeScrollOffset, setHomeScrollOffset] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isMarkerOn, setIsMarkerOn] = useState(false);
  const [liveBuncheolTitle, setLiveBuncheolTitle] = useState<string | null>(
    null,
  );
  const [recentBuncheols, setRecentBuncheols] = useState(
    fallbackRecentBuncheols,
  );

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

  useEffect(() => {
    const timer = window.setTimeout(() => setIsMarkerOn(true), 420);

    return () => window.clearTimeout(timer);
  }, []);

  // 100dvh 는 설치형 PWA 에서 실제 스크롤포트보다 크다 — main 이 safe-area inset 만큼
  // padding 을 먹고 border-box 라 컨테이너 높이에서 그만큼 빠진다(globals.css 의 standalone 블록).
  // sticky 패널·폰 크기·히어로 높이는 이 변수를 기준으로 잡는다.
  useLayoutEffect(() => {
    const scrollElement = scrollContainerRef.current;

    if (!scrollElement) {
      return;
    }

    const activeScrollElement: HTMLDivElement = scrollElement;

    function syncViewportHeight() {
      activeScrollElement.style.setProperty(
        "--intro-vh",
        `${activeScrollElement.clientHeight}px`,
      );
    }

    syncViewportHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", syncViewportHeight);

      return () => window.removeEventListener("resize", syncViewportHeight);
    }

    const resizeObserver = new ResizeObserver(syncViewportHeight);

    resizeObserver.observe(activeScrollElement);

    return () => resizeObserver.disconnect();
  }, []);

  useLayoutEffect(() => {
    const scrollElement = scrollContainerRef.current;

    if (!scrollElement) {
      return;
    }

    const activeScrollElement: HTMLDivElement = scrollElement;

    let scheduledFrameId = 0;

    function syncScroll() {
      const documentScrollTop =
        document.scrollingElement?.scrollTop ?? window.scrollY ?? 0;
      const nextScrollTop = Math.max(
        activeScrollElement.scrollTop,
        documentScrollTop,
      );

      // 히어로 목업 전용 오프셋이라 360px 에서 멈춘다 — 그 뒤로는 상태가 안 바뀌어
      // 스크롤 내내 리렌더가 이어지지 않는다.
      const nextHomeScrollOffset = Math.min(
        360,
        Math.max(0, Math.round(nextScrollTop * 0.8)),
      );

      if (homeScrollOffsetRef.current !== nextHomeScrollOffset) {
        homeScrollOffsetRef.current = nextHomeScrollOffset;
        setHomeScrollOffset(nextHomeScrollOffset);
      }
    }

    function scheduleScrollSync() {
      if (scheduledFrameId) {
        return;
      }

      scheduledFrameId = window.requestAnimationFrame(() => {
        scheduledFrameId = 0;
        syncScroll();
      });
    }

    scheduleScrollSync();

    activeScrollElement.addEventListener("scroll", scheduleScrollSync, {
      passive: true,
    });
    window.addEventListener("scroll", scheduleScrollSync, { passive: true });
    window.addEventListener("resize", scheduleScrollSync, { passive: true });
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

    // 목록 API 는 hideClosed·sort 파라미터를 받지 않고(BuncheolController#searchBuncheols)
    // 모집중 → 진행확정 → 인원미달취소 순으로 이어 붙여 내려준다. "지금 열린 분철" 문구에 맞추려면
    // 모집중만 클라에서 걸러야 해서, 앞 구간을 넉넉히 받아 필터링한다.
    requestBuncheols(undefined, { size: 12 })
      .then((items) => {
        const openItems = items.filter((item) =>
          isBuncheolRecruitingStatus(item.status),
        );

        if (!isActive || openItems.length === 0) {
          return;
        }

        setRecentBuncheols(openItems.slice(0, 2).map(toIntroRecentBuncheol));
        setLiveBuncheolTitle(openItems[0]?.title ?? null);
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

  const motionContextValue = useMemo(
    () => ({ homeScrollOffset, prefersReducedMotion }),
    [homeScrollOffset, prefersReducedMotion],
  );

  return (
    <IntroMotionContext.Provider value={motionContextValue}>
      <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] min-h-[100dvh] overflow-hidden bg-white text-[#0A0B0D]">
        <div
          className="mx-auto h-full w-full max-w-[430px] overflow-x-hidden overflow-y-auto overscroll-contain bg-white"
          ref={scrollContainerRef}
        >
          <section className="relative flex min-h-[var(--intro-vh,100dvh)] flex-col overflow-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#FBFCFC_62%,#F6F7F8_100%)] px-6 pb-10 pt-5">
            <div className="pointer-events-none absolute -right-28 -top-10 h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(215,255,95,0.5),transparent_64%)] blur-[64px]" />
            <div className="pointer-events-none absolute -left-24 top-[38%] h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,rgba(10,11,13,0.05),transparent_66%)] blur-[64px]" />

            <nav className="relative flex items-center">
              <p className="text-[23px] font-semibold leading-none tracking-[-0.05em]">
                분철이지
              </p>
            </nav>

            <div className="relative flex flex-1 flex-col justify-center py-8">
              <Reveal>
                <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#0A0B0D]/8 bg-white/85 py-1.5 pl-2.5 pr-3.5 shadow-[0_1px_2px_rgba(10,11,13,0.04)] backdrop-blur">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="intro-live-ping absolute inline-flex h-full w-full rounded-full bg-[#A6D92B]/60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#A6D92B]" />
                  </span>
                  <span className="truncate text-[12.5px] font-semibold tracking-[-0.02em] text-[#5A6069]">
                    {liveBuncheolTitle
                      ? `방금 열린 분철 · ${liveBuncheolTitle}`
                      : "지금도 분철이 열리고 있어요"}
                  </span>
                </span>

                <h1 className="mt-6 text-[54px] font-semibold leading-[1.1] tracking-[-0.05em]">
                  최애 굿즈
                  <br />
                  분철을 더
                  <br />
                  {/* isolate 필수 — 형광펜이 -z-10 이라 stacking context 가 없으면 루트까지 올라가
                      섹션 배경에 덮인다. Reveal 의 transform 은 reduced-motion 에서 none 이 되므로
                      Reveal 에 기댈 수 없다. */}
                  <span className="relative isolate inline-block">
                    <span
                      className={`intro-marker absolute inset-x-[-0.08em] bottom-[0.14em] top-[0.52em] -z-10 rounded-[0.1em] bg-[#d7ff5f] ${
                        isMarkerOn ? "intro-marker-on" : ""
                      }`}
                    />
                    쉽게.
                  </span>
                </h1>

                <p className="mt-6 max-w-[19.5rem] break-keep text-[16px] font-medium leading-[1.7] tracking-[-0.02em] text-[#5A6069]">
                  원하는 멤버만 골라 신청하세요.
                  <br />
                  입금 확인부터 편의점 수령까지 한 화면에서,
                  <br />
                  개최자와 DM 주고받을 일 없어요.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-2.5">
                  <Link
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#0A0B0D] px-6 py-4 text-[15.5px] font-semibold tracking-[-0.02em] text-white shadow-[0_1px_2px_rgba(10,11,13,0.24),0_16px_32px_-12px_rgba(10,11,13,0.45)]"
                    href="/"
                  >
                    분철 둘러보기
                    <ArrowRight />
                  </Link>
                  <a
                    className="rounded-full border border-[#0A0B0D]/10 bg-white px-5 py-4 text-[15.5px] font-semibold tracking-[-0.02em] text-[#5A6069] shadow-[0_1px_2px_rgba(10,11,13,0.04)]"
                    href="#what"
                  >
                    분철이 처음이에요
                  </a>
                </div>
              </Reveal>

              <Reveal className="relative mt-12" delay={140} direction="scale">
                <div className="pointer-events-none absolute inset-x-6 bottom-6 top-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(10,11,13,0.14),transparent_70%)] blur-2xl" />
                <MiniPhone>
                  <HomeMiniScreen />
                </MiniPhone>
              </Reveal>
            </div>
          </section>

          <section
            className="relative -mt-8 rounded-t-[2.5rem] bg-white px-6 pb-24 pt-28"
            id="what"
          >
            <Reveal>
              <h2 className="break-keep text-[38px] font-semibold leading-[1.18] tracking-[-0.048em]">
                최애를 확률에
                <br />
                맡기지 않는 방법.
              </h2>
              <p className="mt-6 break-keep text-[16px] font-medium leading-[1.7] tracking-[-0.02em] text-[#5A6069]">
                포토카드·특전은 대부분 멤버 랜덤이에요.
                <br />
                그런데 멤버 수만큼 세트를 사면, 판매처가 중복 없이 전 멤버를
                보내줘요.
                <br />
                서로 다른 최애를 가진 팬들이 한 세트를 함께 사서 나누는 게
                &lsquo;분철&rsquo;이에요.
              </p>
            </Reveal>

            <Reveal className="mt-10" delay={100}>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[1.4rem] border border-[#0A0B0D]/[0.06] bg-[#F6F7F8] px-5 py-6">
                  <p className="text-[13px] font-semibold tracking-[-0.02em] text-[#868C95]">
                    혼자 사면
                  </p>
                  <p className="mt-4 text-[40px] font-semibold leading-none tracking-[-0.05em] text-[#A9AEB5]">
                    1/10
                  </p>
                  <p className="mt-4 text-[13.5px] font-medium leading-[1.5] text-[#868C95]">
                    최애가 나올 확률
                  </p>
                </div>
                <div className="relative overflow-hidden rounded-[1.4rem] bg-[#0A0B0D] px-5 py-6 text-white shadow-[0_20px_44px_-18px_rgba(10,11,13,0.55)]">
                  <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(215,255,95,0.32),transparent_65%)] blur-xl" />
                  <p className="relative text-[13px] font-semibold tracking-[-0.02em] text-[#D7FF5F]">
                    분철하면
                  </p>
                  <p className="relative mt-4 text-[40px] font-semibold leading-none tracking-[-0.05em]">
                    100%
                  </p>
                  <p className="relative mt-4 text-[13.5px] font-medium leading-[1.5] text-white/55">
                    고른 멤버만 확정으로
                  </p>
                </div>
              </div>
            </Reveal>
          </section>

          <section className="relative bg-white px-6 pb-28">
            <Reveal>
              <h2 className="break-keep text-[38px] font-semibold leading-[1.18] tracking-[-0.048em]">
                DM 100통 없이,
                <br />
                버튼 한 번으로.
              </h2>
              <p className="mt-6 break-keep text-[16px] font-medium leading-[1.7] tracking-[-0.02em] text-[#5A6069]">
                지금까지 분철은 타임라인과 DM으로 굴러갔어요.
                <br />
                분철이지는 그 과정을 전부 화면 안에 넣었어요.
              </p>
            </Reveal>

            <div className="mt-10 grid gap-10">
              {introPainPoints.map(({ items, role }, roleIndex) => (
                <Reveal delay={roleIndex * 80} key={role}>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#A6D92B]" />
                      <p className="text-[15px] font-semibold tracking-[-0.03em]">
                        {role}
                      </p>
                    </div>
                    <div className="mt-4 border-t border-[#0A0B0D]/[0.07]">
                      {items.map(({ after, before }) => (
                        <div
                          className="border-b border-[#0A0B0D]/[0.07] py-4"
                          key={before}
                        >
                          <p className="text-[13px] font-medium leading-5 text-[#A9AEB5] line-through decoration-[#C9CDD2]">
                            {before}
                          </p>
                          <p className="mt-1.5 break-keep text-[16.5px] font-semibold leading-[1.45] tracking-[-0.03em]">
                            {after}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section className="intro-grain relative overflow-hidden rounded-t-[2.5rem] bg-[#0A0B0D] px-6 pb-28 pt-24 text-white">
            <div className="pointer-events-none absolute -left-16 top-40 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(215,255,95,0.16),transparent_68%)] blur-2xl" />
            <Reveal>
              <h2 className="relative z-10 break-keep text-[38px] font-semibold leading-[1.18] tracking-[-0.048em]">
                신청부터 수령까지
                <br />
                여섯 단계.
              </h2>
              <p className="relative z-10 mt-6 break-keep text-[16px] font-medium leading-[1.7] tracking-[-0.02em] text-white/52">
                지금 내 참여가 어느 단계인지,
                <br />
                참여 내역의 진행 바에서 항상 보여요.
              </p>
            </Reveal>

            {/* ol 의 직계 자식은 li 여야 목록으로 인식된다 — Reveal(div) 은 li 안에 둔다. */}
            <ol className="relative z-10 mt-12">
              {introFlowSteps.map(({ body, label }, stepIndex) => (
                <li className="relative" key={label}>
                  <Reveal delay={stepIndex * 60}>
                    <div className="relative grid grid-cols-[2.5rem_1fr] gap-4 pb-8">
                      {stepIndex === introFlowSteps.length - 1 ? null : (
                        <span className="absolute bottom-0 left-[1.25rem] top-10 w-px -translate-x-1/2 bg-gradient-to-b from-white/[0.14] to-white/[0.03]" />
                      )}
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-semibold tabular-nums ${
                          stepIndex === 0
                            ? "bg-[#D7FF5F] text-[#0A0B0D] shadow-[0_0_28px_rgba(215,255,95,0.32)]"
                            : "border border-white/[0.12] bg-white/[0.05] text-white/70"
                        }`}
                      >
                        {stepIndex + 1}
                      </span>
                      <div className="pt-1.5">
                        <p className="text-[20px] font-semibold tracking-[-0.04em]">
                          {label}
                        </p>
                        <p className="mt-2 break-keep text-[14.5px] font-medium leading-[1.62] tracking-[-0.02em] text-white/50">
                          {body}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </section>

          <div className="relative -mt-8 rounded-t-[2.5rem] bg-[linear-gradient(180deg,#FFFFFF_0%,#F6F7F8_38%,#F6F7F8_70%,#FFFFFF_100%)]">
            <FeatureStack scrollContainerRef={scrollContainerRef} />
          </div>

          <section className="relative bg-white px-6 pb-28 pt-24">
            <Reveal>
              <h2 className="break-keep text-[38px] font-semibold leading-[1.18] tracking-[-0.048em]">
                진행 상황은
                <br />
                전부 기록으로.
              </h2>
              <p className="mt-6 break-keep text-[16px] font-medium leading-[1.7] tracking-[-0.02em] text-[#5A6069]">
                신청부터 수령까지 어디까지 왔는지,
                <br />
                참여 내역에서 언제든 확인할 수 있어요.
              </p>
            </Reveal>

            <div className="mt-10">
              {introSafetyPoints.map(({ body, icon: Icon, title }, index) => (
                <Reveal delay={index * 70} key={title}>
                  <div className="flex gap-4 border-b border-[#0A0B0D]/[0.07] py-6 first:border-t">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A0B0D] text-[#D7FF5F]">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[17px] font-semibold tracking-[-0.035em]">
                        {title}
                      </p>
                      <p className="mt-2 whitespace-pre-line break-keep text-[14.5px] font-medium leading-[1.66] tracking-[-0.02em] text-[#5A6069]">
                        {body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section className="relative -mt-8 rounded-t-[2.5rem] border-t border-[#0A0B0D]/[0.05] bg-[#F6F7F8] px-6 pb-28 pt-24">
            <Reveal>
              <h2 className="break-keep text-[38px] font-semibold leading-[1.18] tracking-[-0.048em]">
                분철,
                <br />
                직접 열어볼까요?
              </h2>
              <p className="mt-6 break-keep text-[16px] font-medium leading-[1.7] tracking-[-0.02em] text-[#5A6069]">
                누구나 분철을 열 수 있어요.
                <br />
                모집 공지부터 입금 확인, 배송까지
                <br />
                번거로운 일은 분철이지가 이어받아요.
              </p>
            </Reveal>

            <div className="mt-10 grid gap-3">
              {introHostPoints.map(({ body, icon: Icon, title }, index) => (
                <Reveal delay={index * 70} key={title}>
                  <div className="rounded-[1.3rem] border border-[#0A0B0D]/[0.05] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(10,11,13,0.03),0_14px_30px_-20px_rgba(10,11,13,0.3)]">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D7FF5F] text-[#0A0B0D]">
                        <Icon className="h-[17px] w-[17px]" />
                      </span>
                      <p className="text-[16.5px] font-semibold tracking-[-0.035em]">
                        {title}
                      </p>
                    </div>
                    <p className="mt-3 break-keep text-[14.5px] font-medium leading-[1.62] tracking-[-0.02em] text-[#5A6069]">
                      {body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal className="mt-7" delay={140}>
              <Link
                className="flex items-center justify-center gap-1.5 rounded-full border border-[#0A0B0D]/10 bg-white px-6 py-4 text-[15.5px] font-semibold tracking-[-0.02em] text-[#0A0B0D] shadow-[0_1px_2px_rgba(10,11,13,0.04)]"
                href="/upload"
              >
                분철 열어보기
                <ArrowRight />
              </Link>
            </Reveal>
          </section>

          <section className="intro-grain relative overflow-hidden rounded-t-[2.5rem] bg-[#0A0B0D] px-6 pb-16 pt-24 text-white">
            <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(215,255,95,0.2),transparent_66%)] blur-2xl" />
            <Reveal>
              <h2 className="relative z-10 break-keep text-[40px] font-semibold leading-[1.16] tracking-[-0.05em]">
                지금 열린
                <br />
                분철부터 확인해요.
              </h2>
              <p className="relative z-10 mt-6 text-[16px] font-medium leading-[1.68] tracking-[-0.02em] text-white/52">
                원하는 멤버 자리가 남아 있는지 지금 바로 확인할 수 있어요.
              </p>
            </Reveal>

            <Reveal className="relative z-10 mt-10" delay={100}>
              <p className="text-[13px] font-semibold tracking-[-0.02em] text-white/40">
                최근 열린 분철
              </p>
              <div className="mt-3 grid gap-2">
                {recentBuncheols.map(({ deadline, state, title }) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-[1rem] border border-white/[0.08] bg-white/[0.04] px-4 py-3.5"
                    key={title}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold tracking-[-0.03em]">
                        {title}
                      </p>
                      <p className="mt-1 text-[12px] font-medium text-white/40">
                        {state}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold tabular-nums text-white/75">
                      {deadline}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                className="mt-6 flex items-center justify-center gap-1.5 rounded-full bg-[#D7FF5F] py-4 text-[16px] font-semibold tracking-[-0.02em] text-[#0A0B0D] shadow-[0_0_44px_rgba(215,255,95,0.24)]"
                href="/"
              >
                분철 둘러보기
                <ArrowRight />
              </Link>
            </Reveal>

            <Reveal className="relative z-10 mt-4" delay={180}>
              {/* aria-label 을 주면 접근 이름이 통째로 덮여 가시 텍스트를 포함하지 않게 된다
                  (WCAG 2.5.3). 여기는 아이콘 전용이 아니라 문구가 보이므로 가시 텍스트를
                  그대로 이름으로 쓰고, 새 창 안내만 sr-only 로 덧붙인다. */}
              <a
                className="flex items-center gap-4 rounded-[1.5rem] border border-white/[0.1] bg-white/[0.04] px-5 py-4"
                href={X_PROFILE_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#0A0B0D]">
                  <XLogoIcon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold leading-none tracking-[-0.05em]">
                    공식 X 계정 보러 가기
                  </span>
                  <span className="mt-2 block text-[12px] font-semibold leading-none tracking-[-0.02em] text-white/45">
                    {X_HANDLE}
                  </span>
                  <span className="sr-only">(새 창에서 열림)</span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-white/30">
                  <ForwardIcon />
                </span>
              </a>
            </Reveal>
          </section>

          <BusinessFooter />
        </div>
      </main>
    </IntroMotionContext.Provider>
  );
}
