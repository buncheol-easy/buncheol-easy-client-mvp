import type { ReactNode } from "react";

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
      {children}
    </div>
  );
}
