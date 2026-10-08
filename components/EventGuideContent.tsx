"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BusinessFooter } from "@/components/BusinessFooter";
import {
  ArrowRight,
  IntroMotionContext,
  Reveal,
  usePrefersReducedMotion,
} from "@/components/IntroContent";

// 라임색 강조는 받는 돈(금액 카드·지급 줄), 꼭 기억할 문구 형광펜, 마지막 버튼에만 쓴다. 나머지 강조는 검정·회색으로.
const eventTerms = [
  { label: "대상", value: "처음 여는 분철 1건" },
  { label: "조건", value: "배송비 모두 0원" },
  { label: "지급", value: "배송 확인 후 정산 계좌로" },
  { label: "취소되면", value: "다음 0원 분철에 적용" },
] as const;

const keyPoints = [
  {
    body: "처음엔 멤버 수 전체라 한 자리만 비어도 취소돼요.",
    highlight: "최소 진행 인원은",
    title: " 줄여 두기",
  },
  { body: "넘기면 자동 취소돼요.", highlight: "마감 뒤 48시간", title: " 안에 성사 확정" },
  {
    body: "입금 안 한 자리는 '제외'하고 진행 확정해요.",
    highlight: "입금 기한 24시간",
    title: " 뒤엔 직접 정리",
  },
] as const;

const hostRequirements = [
  "카카오 연령대 20대 이상",
  "닉네임·전화번호",
  "정산 계좌(지원금도 여기로)",
] as const;

const replacedChores = ["계좌 DM", "엑셀 대조", "운송장 DM"] as const;

const shippingOptions = ["GS25 반값택배", "CU 알뜰택배"] as const;

function StepBadge({ children }: { children: number }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0A0B0D] text-[14px] font-semibold tabular-nums text-white">
      {children}
    </span>
  );
}

export function EventGuideContent() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const motionContextValue = useMemo(
    () => ({ homeScrollOffset: 0, prefersReducedMotion }),
    [prefersReducedMotion],
  );

  return (
    <IntroMotionContext.Provider value={motionContextValue}>
      <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] min-h-[100dvh] overflow-hidden bg-white text-[#0A0B0D]">
        <div className="app-page-scroll mx-auto h-full w-full max-w-[430px] overflow-x-hidden overflow-y-auto overscroll-contain bg-white">
          <section className="relative overflow-hidden bg-white px-6 pb-16 pt-5">
            <div className="pointer-events-none absolute -right-28 -top-10 h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(215,255,95,0.5),transparent_64%)] blur-[64px]" />

            <nav className="relative flex items-center">
              <Link
                className="text-[23px] font-semibold leading-none tracking-[-0.05em]"
                href="/"
              >
                분철이지
              </Link>
            </nav>

            {/* DM 링크로 바로 들어오는 페이지라 첫 화면 글자는 하이드레이션을 기다리지 않고 보이게 둔다(Reveal 미사용). */}
            <div className="relative pt-10">
              <span className="inline-flex items-center rounded-full border border-[#0A0B0D]/8 bg-white/85 px-3.5 py-1.5 text-[12.5px] font-semibold tracking-[-0.02em] text-[#5A6069] shadow-[0_1px_2px_rgba(10,11,13,0.04)] backdrop-blur">
                첫 분철 배송비 지원 이벤트
              </span>

              <h1 className="mt-5 break-keep text-[46px] font-semibold leading-[1.12] tracking-[-0.05em]">
                첫 분철,
                <br />
                택배비는 저희가.
              </h1>

              <p className="mt-4 break-keep text-[16px] font-medium leading-[1.6] tracking-[-0.02em] text-[#5A6069]">
                처음 여는 분철을 배송비 0원으로 열면
              </p>

              <div className="mt-5 rounded-[1.6rem] bg-[#D7FF5F] px-6 pb-6 pt-5 shadow-[0_20px_40px_-24px_rgba(120,150,20,0.7)]">
                <p className="text-[14px] font-semibold tracking-[-0.02em] text-[#3C4A12]">
                  참여자에게 보낸 택배 1건당
                </p>
                <p className="mt-2 text-[56px] font-semibold leading-none tracking-[-0.055em] tabular-nums">
                  3,000<span className="ml-1 text-[24px]">원</span>
                </p>
                <p className="mt-5 inline-flex rounded-full bg-[#0A0B0D] px-3.5 py-1.5 text-[13px] font-semibold tracking-[-0.02em] text-[#D7FF5F]">
                  분철 1건에 2만 원까지
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <Link
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#0A0B0D] px-6 py-4 text-[15.5px] font-semibold tracking-[-0.02em] text-white shadow-[0_1px_2px_rgba(10,11,13,0.24),0_16px_32px_-12px_rgba(10,11,13,0.45)]"
                  href="/upload"
                >
                  분철 열러 가기
                  <ArrowRight />
                </Link>
                <a
                  className="whitespace-nowrap rounded-full border border-[#0A0B0D]/10 bg-white px-5 py-4 text-[15.5px] font-semibold tracking-[-0.02em] text-[#5A6069]"
                  href="#event"
                >
                  참여 방법
                </a>
              </div>

              <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] font-medium text-[#5A6069]">
                <li className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0A0B0D]" />
                  입금은 내 계좌로 바로
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0A0B0D]" />
                  지금은 수수료 없음
                </li>
              </ul>
            </div>
          </section>

          <section
            className="relative rounded-t-[2.5rem] bg-[#F6F7F8] px-6 pb-20 pt-16"
            id="event"
          >
            <Reveal>
              <h2 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.048em]">
                참여는 세 단계.
              </h2>
              <p className="mt-2 text-[15.5px] font-medium tracking-[-0.02em] text-[#5A6069]">
                따로 신청할 필요 없어요.
              </p>
              <div className="mt-5">
                <p className="text-[12.5px] font-semibold text-[#868C95]">
                  열기 전에 필요해요
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {hostRequirements.map((requirement) => (
                    <li
                      className="rounded-full border border-[#0A0B0D]/10 bg-white px-3 py-1.5 text-[13px] font-semibold tracking-[-0.02em]"
                      key={requirement}
                    >
                      {requirement}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <ol className="mt-8 grid gap-3">
              <li>
                <Reveal>
                  <div className="rounded-[1.3rem] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(10,11,13,0.03),0_14px_30px_-22px_rgba(10,11,13,0.3)]">
                    <div className="flex items-center gap-3">
                      <StepBadge>{1}</StepBadge>
                      <p className="text-[17px] font-semibold tracking-[-0.035em]">
                        배송비 칸에 0 적기
                      </p>
                    </div>
                    <div aria-hidden="true" className="mt-4 grid gap-2">
                      {shippingOptions.map((option) => (
                        <div
                          className="flex items-center justify-between rounded-[0.8rem] bg-[#F6F7F8] py-2 pl-3.5 pr-2"
                          key={option}
                        >
                          <span className="text-[13px] font-semibold tracking-[-0.03em] text-[#5A6069]">
                            {option}
                          </span>
                          <span className="flex min-w-[4.5rem] items-center justify-between rounded-[0.6rem] bg-white px-3 py-1.5 ring-2 ring-[#0A0B0D]">
                            <span className="text-[15px] font-semibold tabular-nums">
                              0
                            </span>
                            <span className="text-[12px] font-semibold text-[#868C95]">
                              원
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[13px] font-medium text-[#868C95]">
                      GS25·CU 둘 다 골랐다면 둘 다 0원이에요.
                    </p>
                  </div>
                </Reveal>
              </li>

              <li>
                <Reveal delay={70}>
                  <div className="rounded-[1.3rem] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(10,11,13,0.03),0_14px_30px_-22px_rgba(10,11,13,0.3)]">
                    <div className="flex items-center gap-3">
                      <StepBadge>{2}</StepBadge>
                      <p className="text-[17px] font-semibold tracking-[-0.035em]">
                        모이면 성사 확정
                      </p>
                    </div>
                    <div
                      aria-hidden="true"
                      className="mt-4 rounded-full bg-[#0A0B0D] py-3 text-center text-[14px] font-semibold text-white"
                    >
                      성사 확정하기
                    </div>
                    <p className="mt-3 text-[13px] font-medium text-[#868C95]">
                      계좌·입금 안내는 알림톡이 보내요.
                    </p>
                  </div>
                </Reveal>
              </li>

              <li>
                <Reveal delay={140}>
                  <div className="rounded-[1.3rem] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(10,11,13,0.03),0_14px_30px_-22px_rgba(10,11,13,0.3)]">
                    <div className="flex items-center gap-3">
                      <StepBadge>{3}</StepBadge>
                      <p className="text-[17px] font-semibold tracking-[-0.035em]">
                        운송장 번호 넣기
                      </p>
                    </div>
                    <div aria-hidden="true" className="mt-4 flex gap-2">
                      <span className="flex-1 rounded-[0.8rem] border border-[#0A0B0D]/10 bg-[#F6F7F8] px-3.5 py-2.5 text-[14px] font-semibold tabular-nums tracking-[0.02em]">
                        1234 5678 9012
                      </span>
                      <span className="rounded-[0.8rem] bg-[#0A0B0D] px-4 py-2.5 text-[14px] font-semibold text-white">
                        등록
                      </span>
                    </div>
                    <p className="mt-3 text-[13px] font-medium text-[#868C95]">
                      이게 증빙이에요. 따로 보낼 건 없어요.
                    </p>
                  </div>
                </Reveal>
              </li>
            </ol>

            <Reveal className="mt-3" delay={200}>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[1.3rem] bg-[#D7FF5F] px-5 py-4">
                <p className="text-[14px] font-semibold tracking-[-0.03em] text-[#3C4A12]">
                  배송이 확인되면
                </p>
                <p className="whitespace-nowrap text-[16px] font-semibold tracking-[-0.035em]">
                  1건당 3,000원 입금
                </p>
              </div>
            </Reveal>

            <Reveal className="mt-8" delay={100}>
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[1.3rem] bg-[#2A2C30] text-white">
                {eventTerms.map(({ label, value }) => (
                  <div className="bg-[#0A0B0D] px-4 py-4" key={label}>
                    <dt className="text-[12.5px] font-semibold text-white/45">
                      {label}
                    </dt>
                    <dd className="mt-1.5 break-keep text-[14px] font-semibold leading-[1.45] tracking-[-0.02em]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[12.5px] font-medium text-[#868C95]">
                이벤트는 공지 후 종료될 수 있어요.
              </p>
            </Reveal>
          </section>

          <section className="relative bg-white px-6 pb-20 pt-16">
            <Reveal>
              <h2 className="text-[30px] font-semibold leading-[1.25] tracking-[-0.045em]">
                이것만 기억하세요!
              </h2>
            </Reveal>

            <ol className="mt-7 grid gap-3">
              {keyPoints.map(({ body, highlight, title }, index) => (
                <li key={highlight}>
                  <Reveal delay={index * 70}>
                    <div className="flex gap-3.5 rounded-[1.2rem] border border-[#0A0B0D]/[0.07] px-4 py-4">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0A0B0D] text-[13px] font-semibold tabular-nums text-white">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[16px] font-semibold tracking-[-0.035em]">
                          <span className="rounded-[0.25em] bg-[#D7FF5F] px-1 box-decoration-clone">
                            {highlight}
                          </span>
                          {title}
                        </p>
                        <p className="mt-1 break-keep text-[14px] font-medium leading-[1.55] text-[#5A6069]">
                          {body}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </section>

          <section className="intro-grain relative overflow-hidden rounded-t-[2.5rem] bg-[#0A0B0D] px-6 pb-16 pt-16 text-white">
            <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(215,255,95,0.2),transparent_66%)] blur-2xl" />
            <Reveal>
              <ul aria-hidden="true" className="relative z-10 flex flex-wrap gap-2">
                {replacedChores.map((chore, index) => (
                  <li
                    className={`rounded-[0.6rem] border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[13.5px] font-semibold text-white/50 line-through decoration-[#D7FF5F] decoration-2 ${
                      index % 2 === 0 ? "-rotate-2" : "rotate-2"
                    }`}
                    key={chore}
                  >
                    {chore}
                  </li>
                ))}
              </ul>
              <h2 className="relative z-10 mt-6 text-[36px] font-semibold leading-[1.18] tracking-[-0.05em]">
                첫 분철,
                <br />
                지금 열어볼까요?
              </h2>
              <p className="relative z-10 mt-3 break-keep text-[15px] font-medium leading-[1.6] tracking-[-0.02em] text-white/55">
                계좌·운송장 안내는 알림톡이 대신 보내요.
              </p>
            </Reveal>

            <Reveal className="relative z-10 mt-8" delay={100}>
              <Link
                className="flex items-center justify-center gap-1.5 rounded-full bg-[#D7FF5F] py-4 text-[16px] font-semibold tracking-[-0.02em] text-[#0A0B0D] shadow-[0_0_44px_rgba(215,255,95,0.24)]"
                href="/upload"
              >
                분철 열러 가기
                <ArrowRight />
              </Link>
              <Link
                className="mt-4 block text-center text-[13px] font-medium text-white/45 underline underline-offset-2"
                href="/guide"
              >
                자세한 개최 방법은 개최 가이드에서
              </Link>
            </Reveal>
          </section>

          <BusinessFooter />
        </div>
      </main>
    </IntroMotionContext.Provider>
  );
}
