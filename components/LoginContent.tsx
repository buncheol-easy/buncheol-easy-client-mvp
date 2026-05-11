"use client";

import { useRouter } from "next/navigation";
import { BackIcon, CheckIcon, ProfileIcon } from "@/components/icons";
import { writeAuthState } from "@/lib/auth-store";

type LoginContentProps = {
  returnHref?: string;
};

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

export function LoginContent({ returnHref = "/profile" }: LoginContentProps) {
  const router = useRouter();

  function handleBack() {
    const historyIndex = getHistoryIndex();

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace(returnHref);
  }

  function handleKakaoLogin() {
    writeAuthState({ isLoggedIn: true });
    router.replace(returnHref);
  }

  return (
    <div className="tab-content-enter flex min-h-0 flex-1 flex-col bg-white">
      <header className="profile-header shrink-0 px-4 py-3">
        <div className="flex h-10 items-center gap-3">
          <button
            aria-label="이전 화면"
            className="product-detail-action inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white"
            onClick={handleBack}
            type="button"
          >
            <BackIcon />
          </button>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-black/35">
              Login
            </p>
            <h1 className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.06em]">
              로그인
            </h1>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center px-4 pb-6">
        <section className="w-full">
          <div className="relative mx-auto h-[9.5rem] w-[9.5rem]">
            <div className="absolute left-2 top-5 h-[7.5rem] w-[5.6rem] rotate-[-10deg] rounded-[0.9rem] border border-black/10 bg-[#f1f1f1] shadow-[0_16px_35px_rgba(0,0,0,0.12)]" />
            <div className="absolute right-1 top-2 h-[8.25rem] w-[6.1rem] rotate-[8deg] rounded-[1rem] border border-black/10 bg-white shadow-[0_18px_42px_rgba(0,0,0,0.16)]">
              <div className="m-2 h-[4.8rem] rounded-[0.75rem] bg-black" />
              <div className="mx-2 mt-2 h-2 rounded-full bg-black/12" />
              <div className="mx-2 mt-1.5 h-2 w-2/3 rounded-full bg-black/12" />
            </div>
            <div className="absolute bottom-0 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-black text-white shadow-[0_14px_30px_rgba(0,0,0,0.2)]">
              <ProfileIcon />
            </div>
          </div>

          <h2 className="mt-7 text-center text-[27px] font-semibold leading-tight tracking-[-0.07em]">
            내 분철 흐름을
            <br />
            바로 이어서 볼 수 있어요
          </h2>
          <p className="mt-3 text-center text-[14px] font-medium leading-6 tracking-[-0.04em] text-black/45">
            입찰 현황, 배송지, 찜한 포토카드를 한 번에 관리해요.
          </p>

          <div className="mt-6 grid gap-2">
            {["진행 중인 입찰 확인", "배송지 관리", "찜한 상품 이어보기"].map(
              (label) => (
                <div
                  className="flex h-11 items-center gap-3 rounded-[0.85rem] bg-[#f7f7f7] px-3 text-[13px] font-semibold tracking-[-0.04em] text-black/65"
                  key={label}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black text-white">
                    <CheckIcon />
                  </span>
                  {label}
                </div>
              ),
            )}
          </div>

          <button
            className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-[#fee500] text-[15px] font-semibold text-black shadow-[0_10px_24px_rgba(254,229,0,0.32)]"
            onClick={handleKakaoLogin}
            type="button"
          >
            카카오로 로그인
          </button>
        </section>
      </main>
    </div>
  );
}
