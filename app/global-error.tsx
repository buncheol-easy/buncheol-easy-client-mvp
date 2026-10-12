"use client";

import Image from "next/image";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import "./globals.css";

let lastReportedError: unknown = null;

// 루트 레이아웃이 깨졌을 때 문서 전체를 대신한다. 레이아웃 부품(폰 액자·브랜드 패널·
// QueryProvider 등)은 그 자체가 원인일 수 있어 가져오지 않는다.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);

    if (lastReportedError === error) {
      return;
    }
    lastReportedError = error;
    trackEvent("error_screen_shown", {
      path: window.location.pathname,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        <title>문제가 생겼어요 | 분철이지</title>
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
                {/* <Link>는 주소만 바뀌고 이 화면이 남는다 — 문서를 새로 받아야 레이아웃이 다시 그려진다.
                    replace 는 깨진 주소를 방문 기록에서 빼고, assign·href 대입은 lint(상대 경로 규칙)에 걸린다. */}
                <button
                  className="inline-flex h-12 items-center justify-center rounded-full border border-black/15 bg-white px-7 text-[15px] font-semibold tracking-[-0.04em] text-[#111111]"
                  onClick={() => window.location.replace("/")}
                  type="button"
                >
                  홈으로 가기
                </button>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
