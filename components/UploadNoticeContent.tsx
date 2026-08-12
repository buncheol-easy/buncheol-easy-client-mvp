"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomNavigator } from "@/components/BottomNavigator";
import { BackIcon } from "@/components/icons";
import { getHistoryIndex } from "@/lib/history-index";

// 안내 문구는 확정 전 임시 카피입니다. 내용 확정 시 아래 상수만 교체하세요.
const noticeHeadline = "이제 직접 분철을 열 수 있어요";
const noticeDescription =
  "만 19세 이상이고 연락처를 등록했다면 바로 개최할 수 있어요.";
const noticeItems = [
  {
    title: "분철 참여는 그대로",
    description: "진행 중인 분철은 홈과 검색에서 자유롭게 참여할 수 있어요.",
  },
  {
    title: "개최를 원하시면",
    description:
      "아래 이메일로 문의해 주세요. 운영진이 확인한 뒤 개최를 도와드려요.",
  },
  {
    title: "개최 기능 오픈 소식",
    description:
      "일반 회원 개최 기능은 준비 중이에요. 오픈 소식은 공지로 가장 먼저 알려드릴게요.",
  },
];
const contactEmail = "teameasy024@gmail.com";

export function UploadNoticeContent() {
  const router = useRouter();

  function handleBack() {
    const historyIndex = getHistoryIndex();

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace("/");
  }

  return (
    <main className="system-chrome-black h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
          <div className="absolute inset-0 flex flex-col bg-white">
            <header className="upload-header shrink-0 border-b border-black bg-black px-4 py-3 text-white">
              <div className="upload-header__inner flex h-10 items-center justify-between">
                <button
                  aria-label="이전 화면"
                  className="upload-header__back inline-flex h-10 w-10 items-center justify-center text-white"
                  onClick={handleBack}
                  type="button"
                >
                  <BackIcon />
                </button>

                <div className="upload-header__copy translate-y-0.5 text-right">
                  <p className="upload-header__eyebrow text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-white/45">
                    Upload
                  </p>
                  <h1 className="upload-header__title mt-1 text-[20px] leading-none tracking-[-0.05em]">
                    분철 개최 안내
                  </h1>
                </div>
              </div>
            </header>

            <div className="tab-content-enter min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4">
              <section className="relative overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-[#10110D] via-[#222719] to-[#D7FF5F] px-5 py-7 text-white shadow-[0_18px_42px_rgba(120,132,82,0.18)] ring-1 ring-[#D7FF5F]/45">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_20%,rgba(215,255,95,0.5),transparent_26%),radial-gradient(circle_at_14%_82%,rgba(255,255,255,0.18),transparent_30%)]" />
                <div className="relative">
                  <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.18em] text-[#D7FF5F]">
                    Hosting Notice
                  </p>
                  <h2 className="mt-3 break-keep text-[22px] font-semibold leading-[1.25] tracking-[-0.05em]">
                    {noticeHeadline}
                  </h2>
                  <p className="mt-3 break-keep text-[14px] font-medium leading-6 tracking-[-0.03em] text-white/75">
                    {noticeDescription}
                  </p>
                </div>
              </section>

              <section className="mt-7">
                <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                  이렇게 이용할 수 있어요
                </h2>
                <ul className="mt-4 space-y-3">
                  {noticeItems.map((item) => (
                    <li
                      className="rounded-[1.15rem] bg-[#f7f7f7] px-4 py-4"
                      key={item.title}
                    >
                      <p className="text-[15px] font-semibold tracking-[-0.04em]">
                        {item.title}
                      </p>
                      <p className="mt-1.5 break-keep text-[14px] font-medium leading-6 tracking-[-0.03em] text-black/55">
                        {item.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-7 rounded-[1.15rem] border border-black/10 px-4 py-4">
                <p className="text-[12px] font-semibold uppercase leading-none tracking-[0.18em] text-black/35">
                  Contact
                </p>
                <a
                  className="mt-2 inline-block text-[15px] font-semibold tracking-[-0.03em] underline underline-offset-4"
                  href={`mailto:${contactEmail}`}
                >
                  {contactEmail}
                </a>
                <p className="mt-1.5 break-keep text-[13px] font-medium leading-5 tracking-[-0.03em] text-black/45">
                  개최 문의는 이메일로 보내주시면 순서대로 안내해 드려요.
                </p>
              </section>

              <div className="mt-8 space-y-3">
                <Link
                  className="flex h-14 w-full items-center justify-center rounded-full bg-[#CFE86B] text-[17px] font-semibold tracking-[-0.04em] text-black shadow-[0_12px_28px_rgba(120,132,82,0.24)]"
                  href="/"
                >
                  진행 중인 분철 둘러보기
                </Link>
                <Link
                  className="flex h-14 w-full items-center justify-center rounded-full border border-black/15 text-[16px] font-semibold tracking-[-0.04em] text-black/70"
                  href="/board"
                >
                  공지사항 보기
                </Link>
              </div>
            </div>
          </div>
        </div>

        <BottomNavigator activeLabel="Upload" />
      </div>
    </main>
  );
}
