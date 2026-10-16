"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { applyChromeColors } from "@/components/SystemChromeColorSync";
import { trackEvent } from "@/lib/analytics";

const white = "#ffffff";
const homeButtonClassName =
  "inline-flex h-12 items-center justify-center rounded-full border border-black/15 bg-white px-7 text-[15px] font-semibold tracking-[-0.04em] text-[#111111]";

// 같은 오류 객체로 오류 화면이 다시 마운트돼도 분석 이벤트는 한 번만 보낸다.
let lastReportedError: unknown = null;

// 화면을 그리다 오류가 나면 Next.js 기본(영어) 화면 대신 보여 준다. 루트 레이아웃 안이라
// PC 폰 액자·브랜드 패널은 그대로 남는다(레이아웃 자체 오류는 global-error.tsx).
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const pathname = usePathname();

  // 같은 주소에서 [다시 시도]로 복구되면 SystemChromeColorSync 가 다시 돌지 않아 흰 크롬이 남는다 —
  // 들어올 때 색을 기억해 두고 이 화면이 사라질 때(복구·이동) 되돌린다.
  useEffect(() => {
    const rootStyle = document.documentElement.style;
    const previousTop = rootStyle.getPropertyValue("--system-top-color");
    const previousBottom = rootStyle.getPropertyValue("--system-bottom-color");

    applyChromeColors(white, white);

    return () => {
      if (previousTop && previousBottom) {
        applyChromeColors(previousTop, previousBottom);
      }
    };
  }, []);

  useEffect(() => {
    console.error(error);

    if (lastReportedError === error) {
      return;
    }
    lastReportedError = error;
    // 오류 메시지·쿼리스트링은 개인정보가 섞일 수 있어 보내지 않는다 — 경로와 서버 식별값만.
    trackEvent("error_screen_shown", {
      path: window.location.pathname,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <div className="app-page-scroll mx-auto flex h-full w-full max-w-[430px] flex-col overflow-y-auto bg-white">
        <div className="m-auto flex flex-col items-center px-6 py-10 text-center">
          <div className="relative h-32 w-80 max-w-full">
            <Image
              alt="분철이지"
              className="object-contain"
              fill
              sizes="320px"
              src="/brand/logo-black.png"
            />
          </div>
          <p className="mt-8 text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-black/35">
            Error
          </p>
          <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.05em]">
            화면을 불러오지 못했어요
          </h1>
          <p className="mt-3 text-[14px] font-medium leading-6 tracking-[-0.03em] text-black/55">
            일시적인 문제일 수 있어요.
            <br />
            잠시 후 다시 시도해 주세요.
          </p>
          <div className="mt-8 flex gap-2">
            <button
              className="inline-flex h-12 items-center justify-center rounded-full bg-black px-7 text-[15px] font-semibold tracking-[-0.04em] text-white"
              onClick={() => retry()}
              type="button"
            >
              다시 시도
            </button>
            {/* 오류 화면은 경로가 바뀔 때만 풀린다 — 이미 홈이면 <Link>가 아무것도 안 해서 문서를 새로 받는다. */}
            {pathname === "/" ? (
              <button
                className={homeButtonClassName}
                onClick={() => window.location.replace("/")}
                type="button"
              >
                홈으로 가기
              </button>
            ) : (
              <Link className={homeButtonClassName} href="/">
                홈으로 가기
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
