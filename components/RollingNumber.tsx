"use client";

import { useEffect, useState } from "react";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// 글자는 data-char 와 ::before 로 그린다. 띠의 0~9 가 본문 텍스트(복사·검색·스크린리더)에 섞이지 않게 한다.
function RollingDigit({ digit, rollIn }: { digit: number; rollIn: boolean }) {
  const [isSettled, setIsSettled] = useState(!rollIn);

  useEffect(() => {
    if (isSettled) {
      return;
    }

    // 0 이 한 번 그려진 다음 프레임에 옮겨야 전환이 시작된다.
    let innerFrame = 0;
    const outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => setIsSettled(true));
    });

    return () => {
      window.cancelAnimationFrame(outerFrame);
      window.cancelAnimationFrame(innerFrame);
    };
  }, [isSettled]);

  const shownDigit = isSettled ? digit : 0;

  return (
    <span className="rolling-number-digit">
      <span className="rolling-number-sizer" data-char={shownDigit} />
      <span
        className="rolling-number-reel"
        style={{ transform: `translateY(${shownDigit * -10}%)` }}
      >
        {DIGITS.map((value) => (
          <span data-char={value} key={value} />
        ))}
      </span>
    </span>
  );
}

type RollingNumberProps = {
  className?: string;
  // 처음 보일 때 이 값에서 시작해 value 까지 굴러간다. 없으면 첫 값은 그대로 보인다.
  startFrom?: string;
  startDelayMs?: number;
  // 숫자가 섞인 표시 문자열 그대로("13,800원", "현재 2/5명"). 숫자 자리만 굴러간다.
  value: string;
};

export function RollingNumber({
  className = "",
  startFrom,
  startDelayMs = 0,
  value,
}: RollingNumberProps) {
  const [hasStarted, setHasStarted] = useState(startFrom === undefined);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setHasMounted(true));

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (hasStarted) {
      return;
    }

    const timer = window.setTimeout(() => setHasStarted(true), startDelayMs);

    return () => window.clearTimeout(timer);
  }, [hasStarted, startDelayMs]);

  const text = hasStarted || startFrom === undefined ? value : startFrom;
  const chars = Array.from(text);

  return (
    <span className={`rolling-number ${className}`}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="rolling-number-track">
        {chars.map((char, index) => {
          // 오른쪽 끝에서 센 위치를 키로 써서, 자릿수가 늘어도 같은 자리는 같은 요소로 남긴다.
          const position = chars.length - index;

          return /\d/.test(char) ? (
            <RollingDigit
              digit={Number(char)}
              key={`digit-${position}`}
              rollIn={hasMounted}
            />
          ) : (
            <span
              className="rolling-number-static"
              data-char={char}
              key={`static-${position}-${char}`}
            />
          );
        })}
      </span>
    </span>
  );
}

type AmountChangeBadgeProps = {
  amount: number;
  format: (amount: number) => string;
};

// 합계가 바뀌면 바뀐 만큼을 합계 위에 잠깐 띄운다. 부모는 position: relative 여야 한다.
export function AmountChangeBadge({ amount, format }: AmountChangeBadgeProps) {
  const [previousAmount, setPreviousAmount] = useState(amount);
  const [change, setChange] = useState<{ key: number; value: number } | null>(
    null,
  );

  if (amount !== previousAmount) {
    setPreviousAmount(amount);
    setChange((current) => ({
      key: (current?.key ?? 0) + 1,
      value: amount - previousAmount,
    }));
  }

  if (!change || change.value === 0) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className={`amount-change-badge ${
        change.value < 0 ? "amount-change-badge--down" : ""
      }`}
      key={change.key}
    >
      {change.value > 0 ? "+" : "−"}
      {format(Math.abs(change.value))}
    </span>
  );
}
