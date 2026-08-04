"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

type SlidingTab<Value extends string> = {
  label: string;
  value: Value;
};

type SlidingTabsProps<Value extends string> = {
  barClassName?: string;
  onChange: (value: Value) => void;
  pillClassName?: string;
  tabs: readonly SlidingTab<Value>[];
  value: Value;
};

const pillTransitionClassName =
  "pointer-events-none absolute w-0 transition-[transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[transform,width] motion-reduce:transition-none";
const tabTransitionClassName =
  "relative z-[1] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

function useSlidingPill<Value extends string>(value: Value) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLSpanElement | null>(null);
  const tabRefs = useRef(new Map<Value, HTMLButtonElement | null>());
  const pillValueRef = useRef<Value | null>(null);
  const valueRef = useRef(value);

  const movePillTo = useCallback((tabValue: Value, animate: boolean) => {
    const pill = pillRef.current;
    const tab = tabRefs.current.get(tabValue);

    if (!pill || !tab) {
      return;
    }

    if (!animate) {
      pill.style.transitionProperty = "none";
    }

    pill.style.transform = `translateX(${tab.offsetLeft}px)`;
    pill.style.width = `${tab.offsetWidth}px`;

    if (!animate) {
      // Force a reflow so the snapped position commits before the
      // transition is restored.
      void pill.offsetWidth;
      pill.style.transitionProperty = "";
    }

    pillValueRef.current = tabValue;
  }, []);

  // Snap without animation on first paint and on external value changes
  // (e.g. restored view state). Clicks animate via selectTab, which updates
  // pillValueRef first so this effect leaves the transition alone.
  useLayoutEffect(() => {
    valueRef.current = value;

    if (pillValueRef.current !== value) {
      movePillTo(value, false);
    }
  });

  // Re-snap when the container is resized or toggled from display: none
  // (both report a size change), so the pill never desyncs from its tab.
  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const observer = new ResizeObserver(() => {
      movePillTo(valueRef.current, false);
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [movePillTo]);

  const selectTab = useCallback(
    (tabValue: Value) => {
      movePillTo(tabValue, true);
    },
    [movePillTo],
  );

  const setTabRef = useCallback(
    (tabValue: Value, element: HTMLButtonElement | null) => {
      tabRefs.current.set(tabValue, element);
    },
    [],
  );

  return { containerRef, pillRef, selectTab, setTabRef };
}

export function SlidingTabs<Value extends string>({
  barClassName = "bg-[#f4f5ef] ring-1 ring-black/[0.03]",
  onChange,
  pillClassName = "bg-black shadow-[0_8px_18px_rgba(0,0,0,0.12)]",
  tabs,
  value,
}: SlidingTabsProps<Value>) {
  const { containerRef, pillRef, selectTab, setTabRef } = useSlidingPill(value);

  return (
    <div
      className={`relative flex gap-1.5 rounded-[0.95rem] p-1.5 ${barClassName}`}
      ref={containerRef}
    >
      <span
        aria-hidden="true"
        className={`left-0 top-1.5 h-10 rounded-[0.8rem] ${pillTransitionClassName} ${pillClassName}`}
        ref={pillRef}
      />
      {tabs.map((tab) => {
        const isActive = tab.value === value;

        return (
          <button
            aria-pressed={isActive}
            className={`h-10 flex-1 rounded-[0.8rem] text-[13px] font-semibold tracking-[-0.04em] ${tabTransitionClassName} ${
              isActive ? "text-white" : "text-black/45"
            }`}
            key={tab.value}
            onClick={() => {
              selectTab(tab.value);
              onChange(tab.value);
            }}
            ref={(element) => {
              setTabRef(tab.value, element);
            }}
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// 필터 칩은 서로 떨어진 버튼이라 pill이 칩 사이를 날아다니는 모션이 어색하다.
// 슬라이딩 없이 즉시 전환한다 — pill 은 value 변경 시 레이아웃 이펙트가 스냅 이동.
export function SlidingFilterChips<Value extends string>({
  onChange,
  tabs,
  value,
}: {
  onChange: (value: Value) => void;
  tabs: readonly SlidingTab<Value>[];
  value: Value;
}) {
  const { containerRef, pillRef, setTabRef } = useSlidingPill(value);

  return (
    <div
      className="relative flex justify-end gap-2 overflow-x-auto pb-1"
      ref={containerRef}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-8 w-0 rounded-full border border-[#CFE86B] bg-[#E4F6A5] shadow-[0_8px_18px_rgba(215,255,95,0.22)]"
        ref={pillRef}
      />
      {tabs.map((tab) => {
        const isActive = tab.value === value;

        return (
          <button
            aria-pressed={isActive}
            className={`relative z-[1] h-8 w-[76px] shrink-0 rounded-full border text-[13px] font-semibold tracking-[-0.04em] ${
              isActive
                ? "border-transparent text-black"
                : "border-black/10 bg-[#f7f7f7] text-black/45"
            }`}
            key={tab.value}
            onClick={() => {
              onChange(tab.value);
            }}
            ref={(element) => {
              setTabRef(tab.value, element);
            }}
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
