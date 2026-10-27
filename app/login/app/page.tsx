import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata: Metadata = {
  title: "앱에서 로그인을 이어 가 주세요",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// 분철이지 iOS 앱의 카카오 로그인 결과 주소. 평소에는 앱의 로그인 창이 이 주소를 가로채서 화면이 열리지 않는다.
// 브라우저에서 열렸다면 앱으로 돌아가지 못한 것 — 주소의 코드를 buncheoleasy:// 같은 앱 주소로 넘겨주면 안 된다.
// 그 주소는 다른 앱도 등록할 수 있어, 남이 시작한 로그인의 코드가 그 앱으로 간다(이 https 주소로 바꾼 이유).
export default function AppLoginReturnPage() {
  return (
    <main className="min-h-[100dvh] bg-white text-[#111111]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col justify-center px-6 py-10 text-center">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.05em]">
          분철이지 앱으로 돌아가
          <br />
          로그인을 다시 해 주세요
        </h1>
        <p className="mt-3 text-[14px] font-medium leading-6 tracking-[-0.03em] text-black/60">
          로그인 결과가 앱으로 전달되지 않았어요.
          <br />
          다시 해도 이 화면이 보이면 {CONTACT_EMAIL} 로 알려 주세요.
        </p>
        <Link
          className="mx-auto mt-8 inline-flex h-12 items-center justify-center rounded-full bg-black px-8 text-[15px] font-semibold tracking-[-0.04em] text-white"
          href="/"
        >
          웹에서 분철이지 보기
        </Link>
      </div>
    </main>
  );
}
