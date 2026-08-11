import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { NotFoundChromeColorSync } from "@/components/NotFoundChromeColorSync";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없어요",
  robots: { index: false, follow: false },
};

// 루트 not-found — 매칭되지 않는 모든 경로와 하위 세그먼트의 notFound() 를 받아
// Next.js 기본 404 대신 브랜딩된 안내와 홈 이동 경로를 제공한다.
export default function NotFound() {
  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <NotFoundChromeColorSync />
      {/* 가용 높이가 콘텐츠보다 낮은 환경(가로 모드 등)에서도 버튼이 잘리지 않게 스크롤을 허용한다 */}
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col overflow-y-auto bg-white">
        <div className="m-auto flex flex-col items-center px-6 py-10 text-center">
          {/* 로고 에셋(1200×675)은 여백 포함 OG 캔버스라 고정 박스 + object-contain 으로 맞춘다 */}
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
            404 Not Found
          </p>
          <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.05em]">
            페이지를 찾을 수 없어요
          </h1>
          <p className="mt-3 text-[14px] font-medium leading-6 tracking-[-0.03em] text-black/55">
            주소가 잘못 입력됐거나
            <br />
            삭제된 페이지일 수 있어요.
          </p>
          <Link
            className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-black px-8 text-[15px] font-semibold tracking-[-0.04em] text-white"
            href="/"
          >
            홈으로 가기
          </Link>
        </div>
      </div>
    </main>
  );
}
