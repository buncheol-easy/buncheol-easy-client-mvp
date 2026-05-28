"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "scale";
};

type ScrollDirection = "down" | "up";

type IntroMotionContextValue = {
  prefersReducedMotion: boolean;
  scrollDirection: ScrollDirection;
};

type LegacyMediaQueryList = MediaQueryList & {
  addListener: (listener: () => void) => void;
  removeListener: (listener: () => void) => void;
};

const IntroMotionContext = createContext<IntroMotionContextValue>({
  prefersReducedMotion: false,
  scrollDirection: "down",
});

type PhoneMockupProps = {
  accent: string;
  children?: ReactNode;
  className?: string;
  label: string;
  title: string;
};

type FeatureSection = {
  accent: string;
  body: string;
  eyebrow: string;
  glow: string;
  label: string;
  messages: string[];
  title: string;
};

const featureSections: FeatureSection[] = [
  {
    accent: "#d8e8ff",
    body: "관심 있는 상품과 멤버 옵션을 한 흐름 안에서 가볍게 살펴봐요.",
    eyebrow: "Search",
    glow: "#d8e8ff",
    label: "홈 피드 캡쳐 자리",
    messages: ["D-1", "멤버별 옵션", "참여 36명"],
    title: "원하는 분철을 빠르게",
  },
  {
    accent: "#ffdff2",
    body: "조건과 현황을 오가며 확인하지 않아도, 필요한 정보가 한 화면에 모여요.",
    eyebrow: "Bid",
    glow: "#ffdff2",
    label: "상품 상세 캡쳐 자리",
    messages: ["현재 1위", "8,600원", "D-1"],
    title: "조건은 선명하게",
  },
  {
    accent: "#fff1a8",
    body: "참여한 분철의 순위와 결제 예정 금액을 놓치지 않고 이어서 확인해요.",
    eyebrow: "Track",
    glow: "#fff1a8",
    label: "입찰 현황 캡쳐 자리",
    messages: ["결제 대기", "배송지 선택", "정산 확인"],
    title: "참여 이후까지 이어서",
  },
  {
    accent: "#dbf5dc",
    body: "배송지와 정산 정보까지 정리해두고, 다음 참여도 더 간단하게 이어가요.",
    eyebrow: "Manage",
    glow: "#dbf5dc",
    label: "마이페이지 캡쳐 자리",
    messages: ["GS25 기본", "CU 추가", "계좌 등록"],
    title: "관리까지 깔끔하게",
  },
];

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

function PhoneMockup({
  accent,
  children,
  className = "",
  label,
  title,
}: PhoneMockupProps) {
  const hasPositionClass = /\b(?:static|fixed|absolute|relative|sticky)\b/.test(
    className,
  );
  const hasWidthClass = /(?:^|\s)w-(?:\[[^\]]+\]|\S+)/.test(className);
  const rootClassName = [
    hasPositionClass ? "" : "relative",
    hasWidthClass ? "" : "w-[min(17.35rem,73vw)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      <div className="absolute -right-3 top-14 h-14 w-24 rotate-6 rounded-[1rem] bg-white/70 shadow-[0_16px_36px_rgba(0,0,0,0.08)]" />
      <div className="relative aspect-[393/852] rounded-[2.35rem] bg-[#101010] p-[0.55rem] shadow-[0_26px_70px_rgba(22,22,22,0.28)] ring-1 ring-black/12">
        <div className="absolute left-1/2 top-3 z-20 h-6 w-[5.6rem] -translate-x-1/2 rounded-full bg-[#050505]" />
        <div className="absolute bottom-2 left-1/2 z-20 h-1 w-24 -translate-x-1/2 rounded-full bg-white/20" />

        <div className="h-full overflow-hidden rounded-[1.82rem] bg-white text-black">
          <div
            className="flex h-full flex-col p-4"
            style={{
              background: `linear-gradient(145deg, ${accent} 0%, #ffffff 42%, #f7f7f7 100%)`,
            }}
          >
            <div className="mt-5 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/35">
                분철이지
              </p>
              <span className="h-2.5 w-2.5 rounded-full bg-black" />
            </div>

            <div className="mt-5 rounded-[1rem] border border-white/10 bg-[#151515] p-3 text-white shadow-[0_18px_42px_rgba(0,0,0,0.16)]">
              <div className="aspect-[3/3.55] rounded-[0.8rem] bg-[linear-gradient(145deg,rgba(255,255,255,0.18),rgba(255,255,255,0.04))]" />
              <p className="mt-3 text-[11px] font-semibold text-white/42">
                {label}
              </p>
              <p className="mt-1 text-[18px] font-semibold leading-tight tracking-[-0.06em]">
                실제 앱 캡쳐
                <br />
                교체 영역
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[0.85rem] bg-white/80 px-3 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.06)]">
                <p className="text-[10px] font-semibold text-black/34">상태</p>
                <p className="mt-1 text-[17px] font-semibold tracking-[-0.05em]">
                  진행 중
                </p>
              </div>
              <div className="rounded-[0.85rem] bg-white/80 px-3 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.06)]">
                <p className="text-[10px] font-semibold text-black/34">마감</p>
                <p className="mt-1 text-[17px] font-semibold tracking-[-0.05em]">
                  21:00
                </p>
              </div>
            </div>

            <div className="mt-auto pt-4">
              <p className="text-[13px] font-semibold tracking-[-0.04em] text-black/48">
                {title}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <span className="h-2 rounded-full bg-black/18" />
                <span className="h-2 rounded-full bg-black/10" />
                <span className="h-2 rounded-full bg-black/10" />
              </div>
            </div>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function ProductPreviewStack() {
  return (
    <div className="grid gap-2">
      {[
        ["윈터", "Lucky Draw", "#d8e8ff"],
        ["카리나", "Season Kit", "#ffdff2"],
        ["닝닝", "MD Pack", "#dbf5dc"],
      ].map(([member, product, color], index) => (
        <Reveal delay={index * 90} direction="right" key={product}>
          <div className="flex items-center gap-3 rounded-[1rem] bg-white px-3 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.08)]">
            <span
              className="h-12 w-9 shrink-0 rounded-[0.55rem]"
              style={{ backgroundColor: color }}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold tracking-[-0.05em]">
                {member}
              </span>
              <span className="block text-[12px] font-medium text-black/36">
                {product}
              </span>
            </span>
            <span className="rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white">
              참여
            </span>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function BidStatusBoard() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        ["내 순위", "1위"],
        ["입찰가", "8,600"],
        ["마감", "D-1"],
        ["참여자", "36명"],
      ].map(([label, value], index) => (
        <Reveal delay={index * 70} direction="scale" key={label}>
          <div className="min-h-[6.45rem] rounded-[1rem] bg-white px-4 py-4 shadow-[0_12px_32px_rgba(0,0,0,0.08)]">
            <p className="text-[12px] font-semibold text-black/42">{label}</p>
            <p className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.07em] text-black">
              {value}
            </p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function DeliveryCards() {
  return (
    <div className="space-y-2">
      {[
        ["GS25", "홍대입구역점", "기본"],
        ["CU", "성수카페거리점", "추가"],
        ["7-ELEVEN", "강남대로점", "선택"],
      ].map(([store, branch, state], index) => (
        <Reveal delay={index * 90} direction="left" key={branch}>
          <div className="flex min-h-[5.9rem] items-center justify-between rounded-[1rem] bg-white px-4 py-4 shadow-[0_12px_32px_rgba(0,0,0,0.08)]">
            <div className="min-w-0 pr-3">
              <p className="text-[12px] font-semibold text-black/42">
                {store}
              </p>
              <p className="mt-1 truncate text-[16px] font-semibold tracking-[-0.05em] text-black">
                {branch}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white">
              {state}
            </span>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function FeatureShowcase({
  index,
  section,
}: {
  index: number;
  section: FeatureSection;
}) {
  if (index === 0) {
    return (
      <div className="mt-10 pb-12">
        <Reveal className="relative z-10" delay={100}>
          <div className="rounded-[1.25rem] border border-white/10 bg-[#111111] px-4 py-4 text-white shadow-[0_22px_54px_rgba(0,0,0,0.28)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
              Search
            </p>
            <p className="mt-2 text-[22px] font-semibold tracking-[-0.07em]">
              에스파 미공포
            </p>
          </div>
        </Reveal>
        <div className="relative mt-4 min-h-[34rem]">
          <div className="w-[58%] pt-8">
            <ProductPreviewStack />
          </div>
          <Reveal
            className="absolute -right-16 top-[5.2rem] w-[16.35rem]"
            delay={180}
            direction="left"
          >
            <PhoneMockup
              accent={section.accent}
              className="w-full rotate-[4deg]"
              label={section.label}
              title={section.title}
            />
          </Reveal>
        </div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="relative mt-10 h-[35rem]">
        <Reveal
          className="absolute -left-12 top-8 w-[15.4rem]"
          delay={120}
          direction="right"
        >
          <PhoneMockup
            accent="#f1f1f1"
            className="w-full rotate-[-7deg] opacity-80"
            label="옵션 리스트 캡쳐 자리"
            title="멤버별 옵션"
          />
        </Reveal>
        <Reveal
          className="absolute right-1 top-0 w-[17.35rem]"
          delay={240}
          direction="left"
        >
          <PhoneMockup
            accent={section.accent}
            className="w-full rotate-[5deg]"
            label={section.label}
            title={section.title}
          >
            <FloatingBadge className="-left-4 top-24" delay={480}>
              현재 1위
            </FloatingBadge>
          </PhoneMockup>
        </Reveal>
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className="mt-10">
        <BidStatusBoard />
        <Reveal className="relative mt-8" delay={180} direction="scale">
          <div className="relative h-[27rem] overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#111111] px-5 pt-6 text-white shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
            <div className="relative z-10 max-w-[9.6rem]">
              <div className="pb-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/38">
                  Payment
                </p>
                <span className="mt-4 inline-flex rounded-full bg-[#fee500] px-3 py-1 text-[12px] font-semibold text-black">
                  결제 준비 완료
                </span>
                <p className="mt-3 max-w-[8.8rem] break-keep text-[23px] font-semibold leading-[1.04] tracking-[-0.08em]">
                  결제 예정
                  <br />
                  8,600원
                </p>
              </div>
            </div>
              <PhoneMockup
                accent={section.accent}
                className="absolute -right-5 top-12 w-[13.1rem]"
                label={section.label}
                title={section.title}
              />
          </div>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <DeliveryCards />
      <Reveal className="relative mt-8 h-[31rem]" delay={180}>
        <PhoneMockup
          accent={section.accent}
          className="absolute left-1/2 top-0 w-[13.6rem] -translate-x-1/2 rotate-[-3deg]"
          label={section.label}
          title={section.title}
        />
      </Reveal>
    </div>
  );
}

function FloatingBadge({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className: string;
  delay?: number;
}) {
  return (
    <Reveal className={`absolute ${className}`} delay={delay} direction="scale">
      <div className="intro-float rounded-full border border-black/8 bg-white px-4 py-2 text-[13px] font-semibold tracking-[-0.04em] text-black shadow-[0_14px_36px_rgba(20,20,20,0.16)]">
        {children}
      </div>
    </Reveal>
  );
}

export function IntroContent() {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
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

  useEffect(() => {
    const scrollElement = scrollContainerRef.current;

    if (!scrollElement) {
      return;
    }

    const activeScrollElement: HTMLDivElement = scrollElement;

    lastScrollTopRef.current = activeScrollElement.scrollTop;

    function syncScrollDirection() {
      const nextScrollTop = activeScrollElement.scrollTop;
      const previousScrollTop = lastScrollTopRef.current;

      if (Math.abs(nextScrollTop - previousScrollTop) > 3) {
        setScrollDirection(nextScrollTop > previousScrollTop ? "down" : "up");
        lastScrollTopRef.current = nextScrollTop;
      }
    }

    activeScrollElement.addEventListener("scroll", syncScrollDirection, {
      passive: true,
    });

    return () => {
      activeScrollElement.removeEventListener("scroll", syncScrollDirection);
    };
  }, []);

  return (
    <IntroMotionContext.Provider
      value={{ prefersReducedMotion, scrollDirection }}
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
              <h1 className="mt-4 text-[47px] font-semibold leading-[0.96] tracking-[-0.085em]">
                포카 분철,
                <br />
                더 가볍게
                <br />
                모으는 법.
              </h1>
              <p className="mt-5 max-w-[20rem] text-[15px] font-medium leading-6 tracking-[-0.04em] text-black/54">
                원하는 멤버를 고르고, 참여 현황부터 배송까지 한 번에 이어가요.
              </p>
            </Reveal>

            <Reveal className="relative mt-10" delay={120} direction="scale">
              <PhoneMockup
                accent="#d8e8ff"
                label="메인 홈 캡쳐 자리"
                title="진행 중인 분철을 한눈에"
              >
                <FloatingBadge className="-left-3 top-20" delay={260}>
                  D-1 마감
                </FloatingBadge>
                <FloatingBadge className="-right-2 bottom-20" delay={420}>
                  참여 36명
                </FloatingBadge>
              </PhoneMockup>
            </Reveal>
          </div>

        </section>

        <section className="relative -mt-10 rounded-t-[2rem] bg-white px-5 pb-24 pt-16 text-black shadow-[0_-18px_48px_rgba(0,0,0,0.08)]">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/32">
              Bunchul Easy
            </p>
            <h2 className="mt-3 text-[36px] font-semibold leading-[1.02] tracking-[-0.08em]">
              필요한 순간만
              <br />
              또렷하게.
            </h2>
          </Reveal>

          <div className="mt-8 grid gap-3">
            {["상품 탐색", "옵션 확인", "참여 현황", "배송 관리"].map(
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

        <div className="relative -mt-10 rounded-t-[2rem] bg-[radial-gradient(circle_at_78%_8%,rgba(216,232,255,0.22),transparent_26%),radial-gradient(circle_at_12%_32%,rgba(255,223,242,0.16),transparent_28%),radial-gradient(circle_at_90%_58%,rgba(255,241,168,0.15),transparent_30%),radial-gradient(circle_at_10%_88%,rgba(219,245,220,0.16),transparent_28%),linear-gradient(180deg,#111318_0%,#15141a_34%,#141307_68%,#101711_100%)] pt-14 shadow-[0_-18px_55px_rgba(0,0,0,0.16)]">
          {featureSections.map((section, index) => (
            <section
              className="relative overflow-visible px-5 py-24 text-white"
              key={section.eyebrow}
            >
              <div
                className="intro-pulse pointer-events-none absolute -right-24 top-12 h-56 w-56 rounded-full opacity-28 blur-3xl"
                style={{ backgroundColor: section.glow }}
              />
              <div
                className="intro-float pointer-events-none absolute -left-24 bottom-10 h-44 w-44 rounded-full opacity-16 blur-3xl"
                style={{ backgroundColor: section.glow }}
              />

              <Reveal direction={index % 2 === 0 ? "right" : "left"}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
                  {section.eyebrow}
                </p>
                <h2 className="mt-3 break-keep text-[38px] font-semibold leading-[1.04] tracking-[-0.08em]">
                  {section.title}
                </h2>
                <p className="mt-4 break-keep text-[15px] font-medium leading-6 tracking-[-0.04em] text-white/64">
                  {section.body}
                </p>
              </Reveal>

              <FeatureShowcase index={index} section={section} />
            </section>
          ))}
        </div>

        <section className="relative -mt-10 rounded-t-[2rem] bg-white px-5 pb-12 pt-14 text-black shadow-[0_-18px_48px_rgba(0,0,0,0.16)]">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/32">
              Start
            </p>
            <h2 className="mt-3 text-[39px] font-semibold leading-[1] tracking-[-0.085em]">
              준비되면
              <br />
              바로 참여해요.
            </h2>
            <p className="mt-4 text-[15px] font-medium leading-6 tracking-[-0.04em] text-black/54">
              열려 있는 분철과 내가 참여한 흐름을 한눈에 확인해요.
            </p>
          </Reveal>

          <Reveal className="mt-8" delay={120}>
            <div className="rounded-[1.5rem] bg-[#111111] px-5 py-5 text-white shadow-[0_22px_54px_rgba(0,0,0,0.22)]">
              <div className="rounded-[1rem] bg-white/8 px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/38">
                      Today
                    </p>
                    <p className="mt-2 text-[22px] font-semibold tracking-[-0.07em]">
                      열려 있는 분철
                    </p>
                  </div>
                  <span className="rounded-full bg-[#fee500] px-3 py-1 text-[12px] font-semibold text-black">
                    4개
                  </span>
                </div>

                <div className="mt-4 grid gap-2">
                  {[
                    ["에스파 미공포", "D-1", "참여 36명"],
                    ["럭드 포카 세트", "D-3", "입찰 1위"],
                  ].map(([title, deadline, state]) => (
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

            </div>
          </Reveal>
        </section>
      </div>
    </main>
    </IntroMotionContext.Provider>
  );
}
