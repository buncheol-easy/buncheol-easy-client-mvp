"use client";

import { createContext, useContext, type ReactNode } from "react";

const UnderlayContext = createContext(false);

// 패널 밑에 깔린 화면인지. 보이지 않는 층에서 자동 넘김 같은 동작이 돌지 않게 할 때 쓴다.
export function useIsUnderlay() {
  return useContext(UnderlayContext);
}

type SwipeUnderlayProps = {
  children: ReactNode;
  isEntered: boolean;
  isExiting: boolean;
  constrainWidth?: boolean;
  className?: string;
};

export function SwipeUnderlay({
  children,
  className = "",
  isEntered,
  isExiting,
  constrainWidth = true,
}: SwipeUnderlayProps) {
  return (
    <div
      className={`swipe-underlay pointer-events-none absolute inset-0 ${
        constrainWidth ? "mx-auto flex h-full w-full max-w-[430px] flex-col bg-white" : ""
      } ${className} ${isEntered && !isExiting ? "swipe-underlay-active" : ""} ${
        isExiting ? "swipe-underlay-exit" : ""
      }`}
    >
      <UnderlayContext.Provider value>{children}</UnderlayContext.Provider>
    </div>
  );
}
