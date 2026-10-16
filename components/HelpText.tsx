import { Children, type ReactNode } from "react";

type HelpTextProps = {
  // 문자열은 문장 끝(. ? !) 뒤에서 줄을 나눈다. 요소(강조·링크 줄)는 받은 그대로 그 자리에 둔다.
  children: ReactNode;
  // dark: 검정 카드 위
  tone?: "light" | "dark";
  // caption: 버튼 위 한 줄 안내처럼 짧은 캡션
  size?: "body" | "caption";
  align?: "left" | "center";
  // label 안처럼 p 를 둘 수 없는 자리
  as?: "p" | "span";
  className?: string;
};

const toneClassNames = {
  light: "text-black/60",
  dark: "text-white/70",
};

const sizeClassNames = {
  body: "text-[13px] leading-[1.55]",
  caption: "text-[12px] leading-5",
};

// lookbehind 정규식은 Safari 16.4 미만에서 청크 파싱부터 실패해 쓰지 않는다.
function splitSentences(text: string) {
  return text
    .replace(/([.?!])\s+/g, "$1\n")
    .split("\n")
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function HelpText({
  children,
  tone = "light",
  size = "body",
  align = "left",
  as: Tag = "p",
  className = "",
}: HelpTextProps) {
  const lines: ReactNode[] = [];
  let text = "";

  function appendText(piece: string) {
    // JSX 는 `{식}` 다음 줄 텍스트의 앞 공백을 버린다. 문장이 끝난 자리에서 붙으면 띄어 써야 줄이 나뉜다.
    const needsSpace = /[.?!]$/.test(text) && !/^\s/.test(piece);

    text += (needsSpace ? " " : "") + piece;
  }

  function flushText() {
    splitSentences(text).forEach((sentence) => {
      lines.push(
        <span className="block" key={`line-${lines.length}`}>
          {sentence}
        </span>,
      );
    });
    text = "";
  }

  // 「입금한 {count}{unit}로」처럼 값이 끼어든 문장은 조각이 나뉘어 들어오므로 이어 붙인 뒤 나눈다.
  Children.toArray(children).forEach((child) => {
    if (typeof child === "string" || typeof child === "number") {
      appendText(String(child));
      return;
    }

    flushText();
    lines.push(child);
  });
  flushText();

  return (
    <Tag
      className={`block space-y-0.5 break-keep font-medium ${sizeClassNames[size]} ${toneClassNames[tone]} ${
        align === "center" ? "text-center" : ""
      } ${className}`}
    >
      {lines}
    </Tag>
  );
}
