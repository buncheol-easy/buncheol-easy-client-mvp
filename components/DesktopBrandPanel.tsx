"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import { XLogoIcon } from "@/components/icons";
import { X_HANDLE, X_PROFILE_URL } from "@/lib/site";

const subscribeNoop = () => () => {};

// 서버 HTML 에는 넣지 않고 브라우저에서만 그린다. 모든 페이지 원문에 같은 소개 문구가 들어가 있으면
// 네이버가 그 문구를 각 페이지의 검색 설명으로 골라 쓴다(docs/106).
// 위치는 globals.css 의 `body > .desktop-web-brand` 직속 선택자가 정하므로 감싸는 요소를 두지 않는다.
export function DesktopBrandPanel() {
  const isClient = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  if (!isClient) {
    return null;
  }

  return (
    <aside className="desktop-web-brand" aria-label="분철이지 웹 소개">
      {/* 로고 줄 안에 X 버튼을 넣어 패널 높이를 늘리지 않는다.
          세로 여백이 빠듯해 아래 min-height 게이트에 걸리면 패널이 통째로 사라진다.
          버튼은 헤더 우측 정렬이라 로고에 인접하지는 않는다(패널 우측 라인에 맞춘다). */}
      <div className="desktop-web-brand__header">
        <div className="desktop-web-brand__logo">
          {/* 데스크톱 전용 장식 로고 — priority 를 주면 모바일에서도 preload 되어 LCP 대역폭을 뺏는다.
              width/height 는 원본 비율(1200×675)을 그대로 축소한 값이어야 한다. 224×72 로
              두면 실제 렌더 비율(CSS width:100% + height:auto)과 어긋나, 모든 페이지 로드마다
              next/image 가 "width or height modified, but not the other" 경고를 찍었다. */}
          <Image
            alt="분철이지"
            height={126}
            src="/brand/logo-black.png"
            width={224}
          />
        </div>
        {/* 마크만 두면 X 로고가 닫기 버튼처럼 읽힌다. 말풍선으로 무엇을 여는 링크인지 밝힌다.
            aria-label 대신 가시 텍스트를 접근 이름으로 쓴다 (WCAG 2.5.3). */}
        <a
          className="desktop-web-brand__social"
          href={X_PROFILE_URL}
          rel="noopener noreferrer"
          target="_blank"
          title={`X ${X_HANDLE}`}
        >
          {/* 크기는 아이콘 props 로 넘긴다 — CSS 로 svg 를 덮으면 JSX 만 읽었을 때
              기본값(h-5 w-5)이 적용되는 것처럼 보인다. */}
          <XLogoIcon className="h-[26px] w-[26px]" />
          <span className="desktop-web-brand__social-hint">
            X에서 새 소식을 확인해보세요
          </span>
          <span className="sr-only">(새 창에서 열림)</span>
        </a>
      </div>
      <div>
        <p className="desktop-web-brand__eyebrow">BUNCHEOL EASY</p>
        {/* 페이지별 h1 과 중복되지 않도록 데스크톱 장식 태그라인은 제목 요소를 쓰지 않는다. */}
        <p className="desktop-web-brand__title">
          최애 포카 분철,
          <br />
          이제 분철이지.
        </p>
        <p className="desktop-web-brand__body">
          멤버별 모집부터 입금 안내, 편의점 배송까지 복잡한 분철을
          한 화면에서 깔끔하게 관리해요.
        </p>
      </div>
      <div className="desktop-web-brand__chips" aria-hidden="true">
        <span>빠른 모집</span>
        <span>안심 입금</span>
        <span>편의점 배송</span>
        <span>분철 관리</span>
      </div>
      <div className="desktop-web-brand__visual" aria-hidden="true">
        <div className="desktop-web-brand__card desktop-web-brand__card--dark">
          <span>LIVE</span>
          <strong>IVE · 안유진</strong>
        </div>
        <div className="desktop-web-brand__thumb desktop-web-brand__thumb--front">
          <Image
            alt=""
            fill
            sizes="180px"
            src="/intro-products/ive-main.png"
          />
        </div>
        <div className="desktop-web-brand__thumb desktop-web-brand__thumb--back">
          <Image
            alt=""
            fill
            sizes="160px"
            src="/intro-products/riize-main.png"
          />
        </div>
      </div>
    </aside>
  );
}
