import Image from "next/image";
import Link from "next/link";

// 삭제됐거나 없는 분철(page.tsx 의 notFound())을 흰 화면 막다른 길 대신
// 브랜딩된 안내와 홈 이동 경로로 받는다.
// viewport 는 같은 세그먼트의 page.tsx 가 whiteChromeViewport 를 export 하고 있어
// 여기서 다시 선언하지 않는다 (not-found 파일의 export 는 세그먼트 경계에서 무시됨).
export default function ProductNotFound() {
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
          존재하지 않는 분철이에요
        </h1>
        <p className="mt-3 text-[14px] font-medium leading-6 tracking-[-0.03em] text-black/55">
          삭제됐거나 주소가 잘못된 분철이에요.
          <br />
          진행 중인 다른 분철을 둘러보세요.
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
