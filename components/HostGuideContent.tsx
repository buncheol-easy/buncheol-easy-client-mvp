"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BusinessFooter } from "@/components/BusinessFooter";
import {
  ArrowRight,
  IntroMotionContext,
  ManageMiniScreen,
  MiniPhone,
  Reveal,
  usePrefersReducedMotion,
} from "@/components/IntroContent";
import {
  BanknoteIcon,
  BellIcon,
  ClipboardListIcon,
  ProfileIcon,
  UsersRoundIcon,
} from "@/components/icons";

const guidePreparations = [
  {
    body: "개최는 성인 회원만 할 수 있어요. 카카오 로그인 때 '연령대' 제공에 동의해 주세요. 카카오는 연령대를 구간으로 알려줘서 20대 이상 구간부터 확인돼요.",
    icon: UsersRoundIcon,
    title: "카카오 연령대 동의",
  },
  {
    body: "참여자와 문제가 생겼을 때 연락이 닿아야 해서 필요해요. 전화번호는 참여자에게 그냥 공개되지 않아요.",
    icon: ProfileIcon,
    title: "닉네임 · 전화번호",
  },
  {
    body: "참여자가 총대님 계좌로 직접 입금해요. 마이페이지 > 정산 계좌에서 등록하고, 예금주명은 실제 통장과 같게 적어 주세요.",
    icon: BanknoteIcon,
    title: "정산 계좌",
  },
] as const;

const guideSteps = [
  {
    body: "개최 화면에서 아래 항목을 채우면 분철이 열려요.",
    details: [
      "사진, 분철 제목, 그룹",
      "멤버별 가격 — 비어 있는 멤버에 같은 가격을 한 번에 넣을 수 있어요",
      "최소 진행 인원과 마감 기한",
      "배송비 — GS25 반값택배·CU 알뜰택배, 0원(무료 배송)도 돼요",
      "구매처와 설명, 오픈채팅 링크(참여한 사람에게만 보여요)",
    ],
    label: "분철 등록",
  },
  {
    body: "분철 상세의 공유 버튼을 누르면 링크가 복사돼요. 트위터 모집글에 붙여 주세요. 신청 순서대로 자리가 잡혀 같은 자리에 두 명이 겹치지 않고, 이 단계에서는 아무도 입금하지 않아요.",
    details: [],
    label: "링크 공유",
  },
  {
    body: "신청이 모이면 관리 화면에서 '성사 확정하기'를 눌러요. 신청자 전원에게 입금 계좌와 24시간 입금 기한이 알림톡으로 가요. 최소 진행 인원에 못 미쳐도 직접 판단해서 확정할 수 있어요.",
    details: [],
    label: "성사 확정",
  },
  {
    body: "참여자가 송금 후 '보냈어요'를 누르면 표시돼요. 통장에서 입금자명을 대조하고 '입금 확인'을 눌러 주세요. 기한이 지나도 입금이 없는 참여는 '제외'로 정리할 수 있어요.",
    details: [],
    label: "입금 확인",
  },
  {
    body: "참여자 전원의 입금을 확인하면 보통 자동으로 진행 확정돼요. 입금 안 한 참여를 제외해서 관리 화면에 '입금한 N자리로 진행 확정' 버튼이 보이면 직접 눌러 주세요. 확정 후에는 참여를 더 받을 수 없어요.",
    details: [],
    label: "진행 확정",
  },
  {
    body: "진행 확정이 되면 운송장을 등록할 수 있어요. 택배를 보낸 뒤 운송장 번호를 넣으면 참여자에게 알림이 가고 배송 상태가 자동으로 바뀌어요. 참여자가 편의점에서 받고 수령을 확인하면 끝이에요.",
    details: [],
    label: "운송장 등록",
  },
] as const;

const guideCautions = [
  {
    body: "확정하기 전에 마감 기한이 됐는데 최소 진행 인원이 안 찼다면 분철이 바로 자동 취소되고 신청자에게도 안내가 가요. 입금 전이라 돌려줄 돈은 없어요.",
    icon: UsersRoundIcon,
    title: "인원이 안 차면 자동 취소",
  },
  {
    body: "인원이 찼더라도 모집 기한이 지나고 2일(48시간) 안에 '성사 확정하기'를 누르지 않으면 자동으로 취소돼요.",
    icon: BellIcon,
    title: "확정은 마감 후 48시간 안에",
  },
  {
    body: "참여자가 총대님 계좌로 직접 보내는 직거래라 통장을 보고 직접 확인해 주세요.",
    icon: BanknoteIcon,
    title: "입금 확인은 직접",
  },
  {
    body: "분철을 열고 운영하는 데 드는 수수료는 지금은 없어요.",
    icon: ClipboardListIcon,
    title: "지금은 수수료 없음",
  },
] as const;

export function HostGuideContent() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const motionContextValue = useMemo(
    () => ({ homeScrollOffset: 0, prefersReducedMotion }),
    [prefersReducedMotion],
  );

  return (
    <IntroMotionContext.Provider value={motionContextValue}>
      <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] min-h-[100dvh] overflow-hidden bg-white text-[#0A0B0D]">
        <div className="app-page-scroll mx-auto h-full w-full max-w-[430px] overflow-x-hidden overflow-y-auto overscroll-contain bg-white">
          <section className="relative overflow-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#FBFCFC_62%,#F6F7F8_100%)] px-6 pb-20 pt-5">
            <div className="pointer-events-none absolute -right-28 -top-10 h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(215,255,95,0.5),transparent_64%)] blur-[64px]" />
            <div className="pointer-events-none absolute -left-24 top-[38%] h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,rgba(10,11,13,0.05),transparent_66%)] blur-[64px]" />

            <nav className="relative flex items-center">
              <Link
                className="text-[23px] font-semibold leading-none tracking-[-0.05em]"
                href="/"
              >
                분철이지
              </Link>
            </nav>

            <div className="relative pt-12">
              <Reveal>
                <span className="inline-flex items-center rounded-full border border-[#0A0B0D]/8 bg-white/85 px-3.5 py-1.5 text-[12.5px] font-semibold tracking-[-0.02em] text-[#5A6069] shadow-[0_1px_2px_rgba(10,11,13,0.04)] backdrop-blur">
                  처음 여는 분을 위한 개최 가이드
                </span>

                <h1 className="mt-6 text-[50px] font-semibold leading-[1.12] tracking-[-0.05em]">
                  내 분철,
                  <br />
                  직접 열어도
                  <br />
                  {/* isolate 필수 — 형광펜이 -z-10 이라 stacking context 가 없으면 섹션 배경에 덮인다. */}
                  <span className="relative isolate inline-block">
                    <span className="absolute inset-x-[-0.08em] bottom-[0.14em] top-[0.52em] -z-10 rounded-[0.1em] bg-[#d7ff5f]" />
                    쉽게.
                  </span>
                </h1>

                <p className="mt-6 break-keep text-[16px] font-medium leading-[1.7] tracking-[-0.02em] text-[#5A6069]">
                  신청 받기부터 입금 확인, 운송장 알림까지
                  <br />
                  분철이지 한 화면에서 관리해요.
                  <br />
                  이 순서대로 따라 하면 첫 분철을 열 수 있어요.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-2.5">
                  <Link
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#0A0B0D] px-6 py-4 text-[15.5px] font-semibold tracking-[-0.02em] text-white shadow-[0_1px_2px_rgba(10,11,13,0.24),0_16px_32px_-12px_rgba(10,11,13,0.45)]"
                    href="/upload"
                  >
                    분철 열러 가기
                    <ArrowRight />
                  </Link>
                  <a
                    className="rounded-full border border-[#0A0B0D]/10 bg-white px-5 py-4 text-[15.5px] font-semibold tracking-[-0.02em] text-[#5A6069] shadow-[0_1px_2px_rgba(10,11,13,0.04)]"
                    href="#prepare"
                  >
                    준비할 것 보기
                  </a>
                </div>
              </Reveal>

              <Reveal className="relative mt-12" delay={140} direction="scale">
                <div className="pointer-events-none absolute inset-x-6 bottom-6 top-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(10,11,13,0.14),transparent_70%)] blur-2xl" />
                <MiniPhone>
                  <ManageMiniScreen progress={0} />
                </MiniPhone>
                <p className="mt-4 text-center text-[12.5px] font-medium text-[#868C95]">
                  개최한 분철의 관리 화면
                </p>
              </Reveal>
            </div>
          </section>

          <section
            className="relative -mt-8 rounded-t-[2.5rem] bg-white px-6 pb-24 pt-24"
            id="prepare"
          >
            <Reveal>
              <h2 className="break-keep text-[38px] font-semibold leading-[1.18] tracking-[-0.048em]">
                열기 전에
                <br />
                세 가지만 준비해요.
              </h2>
              <p className="mt-6 break-keep text-[16px] font-medium leading-[1.7] tracking-[-0.02em] text-[#5A6069]">
                셋 중 하나라도 없으면 개최 화면이 열리지 않아요.
                <br />
                마이페이지에서 미리 채워 두면 바로 열 수 있어요.
              </p>
            </Reveal>

            <div className="mt-10 grid gap-3">
              {guidePreparations.map(({ body, icon: Icon, title }, index) => (
                <Reveal delay={index * 70} key={title}>
                  <div className="rounded-[1.3rem] border border-[#0A0B0D]/[0.05] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(10,11,13,0.03),0_14px_30px_-20px_rgba(10,11,13,0.3)]">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D7FF5F] text-[#0A0B0D]">
                        <Icon className="h-[17px] w-[17px]" />
                      </span>
                      <p className="text-[16.5px] font-semibold tracking-[-0.035em]">
                        {title}
                      </p>
                    </div>
                    <p className="mt-3 break-keep text-[14.5px] font-medium leading-[1.62] tracking-[-0.02em] text-[#5A6069]">
                      {body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal className="mt-7" delay={140}>
              <Link
                className="flex items-center justify-center gap-1.5 rounded-full border border-[#0A0B0D]/10 bg-white px-6 py-4 text-[15.5px] font-semibold tracking-[-0.02em] text-[#0A0B0D] shadow-[0_1px_2px_rgba(10,11,13,0.04)]"
                href="/profile"
              >
                마이페이지에서 미리 등록하기
                <ArrowRight />
              </Link>
            </Reveal>
          </section>

          <section className="intro-grain relative overflow-hidden rounded-t-[2.5rem] bg-[#0A0B0D] px-6 pb-28 pt-24 text-white">
            <div className="pointer-events-none absolute -left-16 top-40 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(215,255,95,0.16),transparent_68%)] blur-2xl" />
            <Reveal>
              <h2 className="relative z-10 break-keep text-[38px] font-semibold leading-[1.18] tracking-[-0.048em]">
                분철 여는
                <br />
                여섯 단계.
              </h2>
              <p className="relative z-10 mt-6 break-keep text-[16px] font-medium leading-[1.7] tracking-[-0.02em] text-white/52">
                등록부터 운송장까지,
                <br />
                관리 화면의 버튼 이름 그대로 따라가면 돼요.
              </p>
            </Reveal>

            {/* ol 의 직계 자식은 li 여야 목록으로 인식된다 — Reveal(div) 은 li 안에 둔다. */}
            <ol className="relative z-10 mt-12">
              {guideSteps.map(({ body, details, label }, stepIndex) => (
                <li className="relative" key={label}>
                  <Reveal delay={stepIndex * 60}>
                    <div className="relative grid grid-cols-[2.5rem_1fr] gap-4 pb-8">
                      {stepIndex === guideSteps.length - 1 ? null : (
                        <span className="absolute bottom-0 left-[1.25rem] top-10 w-px -translate-x-1/2 bg-gradient-to-b from-white/[0.14] to-white/[0.03]" />
                      )}
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-semibold tabular-nums ${
                          stepIndex === 0
                            ? "bg-[#D7FF5F] text-[#0A0B0D] shadow-[0_0_28px_rgba(215,255,95,0.32)]"
                            : "border border-white/[0.12] bg-white/[0.05] text-white/70"
                        }`}
                      >
                        {stepIndex + 1}
                      </span>
                      <div className="min-w-0 pt-1.5">
                        <p className="text-[20px] font-semibold tracking-[-0.04em]">
                          {label}
                        </p>
                        <p className="mt-2 break-keep text-[14.5px] font-medium leading-[1.62] tracking-[-0.02em] text-white/50">
                          {body}
                        </p>
                        {details.length > 0 ? (
                          <ul className="mt-3 space-y-2">
                            {details.map((detail) => (
                              <li
                                className="flex gap-2 break-keep text-[14px] font-medium leading-[1.55] tracking-[-0.02em] text-white/70"
                                key={detail}
                              >
                                <span
                                  aria-hidden="true"
                                  className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-[#D7FF5F]"
                                />
                                {detail}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </section>

          <section className="relative -mt-8 rounded-t-[2.5rem] bg-white px-6 pb-28 pt-24">
            <Reveal>
              <h2 className="break-keep text-[38px] font-semibold leading-[1.18] tracking-[-0.048em]">
                열기 전에
                <br />
                꼭 알아둘 것.
              </h2>
            </Reveal>

            <div className="mt-10">
              {guideCautions.map(({ body, icon: Icon, title }, index) => (
                <Reveal delay={index * 70} key={title}>
                  <div className="flex gap-4 border-b border-[#0A0B0D]/[0.07] py-6 first:border-t">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A0B0D] text-[#D7FF5F]">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[17px] font-semibold tracking-[-0.035em]">
                        {title}
                      </p>
                      <p className="mt-2 break-keep text-[14.5px] font-medium leading-[1.66] tracking-[-0.02em] text-[#5A6069]">
                        {body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section className="intro-grain relative overflow-hidden rounded-t-[2.5rem] bg-[#0A0B0D] px-6 pb-16 pt-24 text-white">
            <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(215,255,95,0.2),transparent_66%)] blur-2xl" />
            <Reveal>
              <h2 className="relative z-10 break-keep text-[40px] font-semibold leading-[1.16] tracking-[-0.05em]">
                이제 직접
                <br />
                열어볼까요?
              </h2>
              <p className="relative z-10 mt-6 text-[16px] font-medium leading-[1.68] tracking-[-0.02em] text-white/52">
                준비만 되어 있으면 바로 열 수 있어요.
              </p>
            </Reveal>

            <Reveal className="relative z-10 mt-10" delay={100}>
              <Link
                className="flex items-center justify-center gap-1.5 rounded-full bg-[#D7FF5F] py-4 text-[16px] font-semibold tracking-[-0.02em] text-[#0A0B0D] shadow-[0_0_44px_rgba(215,255,95,0.24)]"
                href="/upload"
              >
                분철 열러 가기
                <ArrowRight />
              </Link>
              <Link
                className="mt-4 block text-center text-[13px] font-medium text-white/45 underline underline-offset-2"
                href="/intro"
              >
                분철이지가 처음이라면 서비스 소개 보기
              </Link>
            </Reveal>
          </section>

          <BusinessFooter />
        </div>
      </main>
    </IntroMotionContext.Provider>
  );
}
