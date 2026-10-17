"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import {
  ArrowUpRightIcon,
  EditIcon,
  ForwardIcon,
  KakaoIcon,
  XLogoIcon,
} from "@/components/icons";
import { KAKAO_CHANNEL_URL, X_PROFILE_URL } from "@/lib/site";

const subscribeNoop = () => () => {};

function getQrPath(modules: boolean[][]) {
  return modules
    .flatMap((row, y) =>
      row.map((isDark, x) => (isDark ? `M${x} ${y}h1v1h-1z` : "")),
    )
    .join("");
}

// 패널은 모바일에서 display:none 이라 화면에 보일 때만 QR 라이브러리를 불러온다.
function PageQrCode({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [qr, setQr] = useState<{ modules: boolean[][]; url: string } | null>(
    null,
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setIsVisible(true);
        observer.disconnect();
      }
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    let isCancelled = false;

    // 배포 직후 청크가 바뀌었거나 오프라인이면 QR 자리만 비워 둔다.
    import("uqr")
      .then(({ encode }) => {
        if (!isCancelled) {
          setQr({ modules: encode(url, { border: 1, ecc: "M" }).data, url });
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [isVisible, url]);

  const modules = qr?.url === url ? qr.modules : null;

  return (
    <div className="desktop-web-help__qr" ref={containerRef}>
      {modules ? (
        <svg
          aria-label="지금 보는 화면을 폰에서 여는 QR 코드"
          role="img"
          shapeRendering="crispEdges"
          viewBox={`0 0 ${modules.length} ${modules.length}`}
        >
          <path d={getQrPath(modules)} fill="#111111" />
        </svg>
      ) : null}
    </div>
  );
}

// 서버 HTML 에는 넣지 않고 브라우저에서만 그린다. 모든 페이지 원문에 같은 소개 문구가 들어가 있으면
// 네이버가 그 문구를 각 페이지의 검색 설명으로 골라 쓴다(docs/106).
// 위치는 globals.css 의 `body > .desktop-web-*` 직속 선택자가 정하므로 감싸는 요소를 두지 않는다.
export function DesktopBrandPanel() {
  const isClient = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const pathname = usePathname();
  // 의견 시트는 가운데 앱 화면 안에서 올라와야 해서 main 에 붙인다(데스크톱에서 main 안의 fixed 는 main 기준).
  const [feedbackTarget, setFeedbackTarget] = useState<{
    frame: HTMLElement;
    pathname: string;
  } | null>(null);

  // 다른 화면으로 넘어가면 시트를 닫는다 — 포털 대상 main 이 그 화면 것으로 바뀐다.
  if (feedbackTarget && feedbackTarget.pathname !== pathname) {
    setFeedbackTarget(null);
  }

  function openFeedbackSheet() {
    const frame = document.querySelector<HTMLElement>("body > main");

    if (frame) {
      setFeedbackTarget({ frame, pathname });
    }
  }

  if (!isClient) {
    return null;
  }

  return (
    <>
      <aside className="desktop-web-brand" aria-label="분철이지 소개">
        {/* width/height 는 원본 비율(672×243)을 줄인 값이어야 next/image 가 비율 경고를 찍지 않는다. */}
        <Image
          alt="분철이지"
          className="desktop-web-brand__logo"
          height={71}
          src="/brand/logo-white.png"
          width={196}
        />
        {/* 페이지별 h1 과 중복되지 않도록 데스크톱 장식 태그라인은 제목 요소를 쓰지 않는다. */}
        <p className="desktop-web-brand__title">
          분철이
          <br />
          <em>쉬워진다.</em>
        </p>
        <span aria-hidden="true" className="desktop-web-brand__rule" />
        <p className="desktop-web-brand__body">이름값 하는 분철 전용 공간.</p>
      </aside>
      <aside className="desktop-web-help" aria-label="폰으로 이어 보기와 도움">
        <PageQrCode url={`${window.location.origin}${pathname}`} />
        <p className="desktop-web-help__title">폰으로 이어 보기</p>
        <p className="desktop-web-help__desc">
          카메라로 찍으면 지금 보는
          <br />
          화면이 폰에서 열려요.
        </p>
        <div className="desktop-web-help__links">
          <p className="desktop-web-help__eyebrow">도움이 필요하면</p>
          <a
            className="desktop-web-help__link"
            href={KAKAO_CHANNEL_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span className="desktop-web-help__icon desktop-web-help__icon--kakao">
              <KakaoIcon className="h-4 w-4" />
            </span>
            <span className="desktop-web-help__label">
              카카오톡 고객센터
              <small>카카오톡 채널로 연결돼요</small>
            </span>
            <ArrowUpRightIcon className="desktop-web-help__arrow h-4 w-4 shrink-0" />
            <span className="sr-only">(새 창에서 열림)</span>
          </a>
          <button
            className="desktop-web-help__link"
            onClick={openFeedbackSheet}
            type="button"
          >
            <span className="desktop-web-help__icon">
              <EditIcon className="h-4 w-4" />
            </span>
            <span className="desktop-web-help__label">
              의견 남기기
              <small>앱 화면 안에서 바로 보내요</small>
            </span>
            <ForwardIcon className="desktop-web-help__arrow desktop-web-help__arrow--forward h-4 w-4 shrink-0" />
          </button>
          <a
            className="desktop-web-help__link"
            href={X_PROFILE_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span className="desktop-web-help__icon">
              <XLogoIcon className="h-4 w-4" />
            </span>
            <span className="desktop-web-help__label">X에서 새 소식</span>
            <ArrowUpRightIcon className="desktop-web-help__arrow h-4 w-4 shrink-0" />
            <span className="sr-only">(새 창에서 열림)</span>
          </a>
        </div>
      </aside>
      {feedbackTarget
        ? createPortal(
            <FeedbackSheet onClose={() => setFeedbackTarget(null)} />,
            feedbackTarget.frame,
          )
        : null}
    </>
  );
}
