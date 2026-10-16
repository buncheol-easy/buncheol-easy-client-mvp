"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const TOAST_DURATION_MS = 3200;
const TOAST_LEAVE_MS = 200;
// 입력칸 옆 안내처럼 사용자가 이미 그 자리를 보고 있을 때 쓴다.
export const BRIEF_TOAST_DURATION_MS = 1800;

export type ToastTone = "success" | "error";

type ShowToast = (message: string, tone?: ToastTone) => void;

type ToastEntry = {
  id: number;
  // 사라지는 동안에도 밀려 있던 깊이를 지켜야 뒤 카드의 글자가 다시 비치지 않는다.
  leaveDepth: number | null;
  message: string;
  tone?: ToastTone;
};

type ToastSize = { height: number; width: number };

const ToastContext = createContext<ShowToast | null>(null);

function ToastIcon({ tone }: { tone: ToastTone }) {
  return (
    <span aria-hidden="true" className={`toast-icon toast-icon--${tone}`}>
      {tone === "success" ? (
        <svg viewBox="0 0 12 12">
          <path d="M2.4 6.3l2.4 2.4 4.8-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 12 12">
          <path d="M6 2.6v4.2M6 9.2v.1" />
        </svg>
      )}
    </span>
  );
}

function StackedToast({
  depth,
  entry,
  onMeasure,
  size,
}: {
  depth: number;
  entry: ToastEntry;
  onMeasure: (id: number, size: ToastSize) => void;
  size: ToastSize | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isEntered, setIsEntered] = useState(false);

  useLayoutEffect(() => {
    if (ref.current) {
      onMeasure(entry.id, {
        height: ref.current.offsetHeight,
        width: ref.current.offsetWidth,
      });
    }
  }, [entry.id, onMeasure]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setIsEntered(true));
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className="toast-pill toast-item"
      data-depth={Math.min(depth, 3)}
      data-state={
        entry.leaveDepth !== null
          ? "leaving"
          : isEntered
            ? "shown"
            : "entering"
      }
      data-tone={entry.tone}
      ref={ref}
      style={
        {
          "--toast-depth": Math.min(depth, 2),
          height: size?.height,
          width: size?.width,
        } as CSSProperties
      }
    >
      {entry.tone ? <ToastIcon tone={entry.tone} /> : null}
      <span>{entry.message}</span>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const [naturalSizes, setNaturalSizes] = useState<Record<number, ToastSize>>(
    {},
  );
  // 데스크톱에서는 main 이 폰 프레임이라 그 안에 띄워야 프레임 하단 버튼 위에 맞는다.
  const [stackHost, setStackHost] = useState<HTMLElement | null>(null);
  const nextIdRef = useRef(0);
  const timersRef = useRef(new Set<number>());

  const runLater = useCallback((callback: () => void, delayMs: number) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, delayMs);

    timersRef.current.add(timer);
  }, []);

  const showToast = useCallback<ShowToast>(
    (message, tone) => {
      const id = ++nextIdRef.current;

      setEntries((current) => [
        ...current,
        { id, leaveDepth: null, message, tone },
      ]);
      runLater(() => {
        setEntries((current) => {
          const visible = current.filter((entry) => entry.leaveDepth === null);
          const depth = visible.length - 1 - visible.findIndex((entry) => entry.id === id);

          return current.map((entry) =>
            entry.id === id ? { ...entry, leaveDepth: depth } : entry,
          );
        });
        runLater(() => {
          setEntries((current) => current.filter((entry) => entry.id !== id));
          setNaturalSizes((current) => {
            const next = { ...current };
            delete next[id];
            return next;
          });
        }, TOAST_LEAVE_MS);
      }, TOAST_DURATION_MS);
    },
    [runLater],
  );

  const handleMeasure = useCallback((id: number, size: ToastSize) => {
    setNaturalSizes((current) =>
      current[id] === undefined ? { ...current, [id]: size } : current,
    );
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    const findHost = () =>
      setStackHost(
        document.querySelector<HTMLElement>("body > main") ?? document.body,
      );
    const frame = window.requestAnimationFrame(findHost);
    const observer = new MutationObserver(findHost);

    observer.observe(document.body, { childList: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const visibleEntries = entries.filter((entry) => entry.leaveDepth === null);
  const frontEntry = visibleEntries.at(-1);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {stackHost
        ? createPortal(
            <div className="toast-stack">
              <div aria-live="polite" className="toast-stack-inner">
                {entries.map((entry) => {
                  const depth =
                    entry.leaveDepth ??
                    visibleEntries.length - 1 - visibleEntries.indexOf(entry);
                  // 뒤로 밀린 알림은 맨 앞 알림 크기에 맞춰 위쪽 테두리만 겹쳐 보이게 한다.
                  const size =
                    depth > 0 && frontEntry
                      ? naturalSizes[frontEntry.id]
                      : naturalSizes[entry.id];

                  return (
                    <StackedToast
                      depth={depth}
                      entry={entry}
                      key={entry.id}
                      onMeasure={handleMeasure}
                      size={size}
                    />
                  );
                })}
              </div>
            </div>,
            stackHost,
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useAppToast(): ShowToast {
  const showToast = useContext(ToastContext);

  if (!showToast) {
    throw new Error("useAppToast 는 ToastProvider 안에서만 쓸 수 있어요.");
  }

  return showToast;
}

type ToastProps = {
  // 입력칸 옆처럼 화면 안 특정 자리에 붙는 안내용. 앱 전체 알림은 useAppToast 를 쓴다.
  className?: string;
  message: string | null | undefined;
};

export function Toast({ className = "", message }: ToastProps) {
  const [renderedMessage, setRenderedMessage] = useState(message ?? null);
  const [previousMessage, setPreviousMessage] = useState(message);

  if (message !== previousMessage) {
    setPreviousMessage(message);

    if (message) {
      setRenderedMessage(message);
    }
  }

  if (!renderedMessage) {
    return null;
  }

  const isLeaving = !message;

  return (
    <div className={`pointer-events-none flex justify-center ${className}`}>
      <p
        aria-live="polite"
        className={`toast-pill max-w-full ${
          isLeaving ? "toast-inline-leave" : "toast-inline-enter"
        }`}
        onAnimationEnd={() => {
          if (isLeaving) {
            setRenderedMessage(null);
          }
        }}
        role="status"
      >
        {renderedMessage}
      </p>
    </div>
  );
}

export function useToast<T = string>(durationMs = TOAST_DURATION_MS) {
  const [toast, setToast] = useState<T | null>(null);
  const timerRef = useRef<number | null>(null);

  const hideToast = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setToast(null);
  }, []);

  const showToast = useCallback(
    (next: T) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      setToast(next);
      timerRef.current = window.setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return [toast, showToast, hideToast] as const;
}
