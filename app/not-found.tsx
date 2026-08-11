import Image from "next/image";
import Link from "next/link";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

// 루트 not-found — 매칭되지 않는 모든 경로와 하위 세그먼트의 notFound() 를 받아
// Next.js 기본 404 대신 브랜딩된 안내와 홈 이동 경로를 제공한다.
export default function NotFound() {
  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col items-center justify-center bg-white px-6 text-center">
        <Image
          alt="분철이지"
          className="h-auto w-[132px]"
          height={42}
          src="/brand/logo-black.png"
          width={132}
        />
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
    </main>
  );
}
