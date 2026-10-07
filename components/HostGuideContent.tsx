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
  ClipboardListIcon,
  UsersRoundIcon,
} from "@/components/icons";

const eventSteps = [
  {
    body: "카카오 연령대 동의(20대 이상 구간부터 확인돼요), 전화번호, 정산 계좌가 있어야 개최 화면이 열려요. 지원금도 이 정산 계좌로 보내 드려요.",
    label: "준비하기",
  },
  {
    body: "개최 화면의 배송비 칸(GS25 반값택배·CU 알뜰택배)에 0을 적어 주세요. 참여자는 무료 배송으로 신청해요.",
    label: "배송비 0원으로 열기",
  },
  {
    body: "택배를 보낸 뒤 관리 화면에 운송장 번호를 넣으면 그게 증빙이에요. 배송이 확인되면 실제 택배비를 보내 드려요.",
    label: "운송장 입력하기",
  },
] as const;

const eventTerms = [
  { label: "대상", value: "분철이지에서 처음 여는 분철 1건" },
  { label: "지원", value: "참여자에게 보낸 실제 택배비, 분철 1건에 2만 원까지" },
  { label: "지급", value: "배송이 확인되면 등록한 정산 계좌로" },
  { label: "취소되면", value: "인원 미달로 취소된 경우 다음에 여는 배송비 0원 분철에 적용" },
] as const;

const hostChapters = [
  {
    items: [
      "그룹을 고르면 멤버 수만큼 자리가 한 번에 생겨요. 가격은 한 칸만 적고 비어 있는 멤버에 같은 가격을 한 번에 넣을 수 있어요.",
      "사진과 분철 제목, 마감 기한, 배송비를 적어요. 이벤트에 참여한다면 배송비는 0원이에요.",
      "오픈채팅 링크를 넣으면 참여한 사람에게만 보여요.",
    ],
    label: "1장 열기",
    tip: "최소 진행 인원은 처음에 멤버 수 전체로 들어가 있어요. 그대로 두면 한 자리만 비어도 취소되니, 덜 모여도 진행할 거면 등록할 때 줄여 두세요.",
    title: "폼 한 장이면 오픈",
  },
  {
    items: [
      "분철 상세의 공유 버튼으로 링크를 복사해 트위터 모집글에 붙여요. 신청 순서대로 자리가 잡히고, 이때는 아무도 입금하지 않아요.",
      "마감 뒤 48시간 안에 '성사 확정하기'를 눌러요. '이제 입금 받을게요' 버튼이라, 누르면 신청자 모두에게 계좌와 24시간 입금 기한이 알림톡으로 가요.",
      "참여자가 '보냈어요'를 누르면 표시돼요. 통장의 입금자명과 금액을 대조하고 '입금 확인'을 눌러요.",
      "24시간이 지나도 입금 안 한 참여는 저절로 빠지지 않아요. '제외'로 빼고 '입금한 N자리로 진행 확정'을 눌러요. '입금한 자리로 보낼게요' 버튼이에요. 전원이 입금했다면 자동으로 넘어가요.",
    ],
    label: "2장 모으기",
    tip: null,
    title: "확정 버튼 두 번",
  },
  {
    items: [
      "참여자가 고른 편의점 배송지가 관리 화면에 보여요. 그 편의점 택배로 보내면 돼요.",
      "운송장 번호를 넣고 등록하면 참여자에게 알림톡이 가고 배송 상태가 자동으로 바뀌어요.",
      "이 운송장이 이벤트 증빙이에요. 따로 캡처해서 보내실 건 없어요.",
    ],
    label: "3장 보내기",
    tip: null,
    title: "번호만 넣으면 끝",
  },
] as const;

const guideCautions = [
  {
    body: "확정하기 전에 마감 기한이 됐는데 최소 진행 인원이 안 찼다면 분철이 바로 자동 취소되고 신청자에게도 안내가 가요. 입금 전이라 돌려줄 돈은 없어요.",
    icon: UsersRoundIcon,
    title: "인원이 안 차면 자동 취소",
  },
  {
    body: "참여자가 보낸 돈은 분철이지를 거치지 않고 총대님 계좌로 바로 들어와요. 그래서 입금 확인은 통장을 보고 직접 해 주세요.",
    icon: BanknoteIcon,
    title: "돈은 내 계좌로 바로",
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
              {/* DM 링크로 바로 들어오는 페이지라 첫 화면 글자는 하이드레이션을 기다리지 않고 보이게 둔다(Reveal 미사용). */}
              <div>
                <span className="inline-flex items-center rounded-full border border-[#0A0B0D]/8 bg-white/85 px-3.5 py-1.5 text-[12.5px] font-semibold tracking-[-0.02em] text-[#5A6069] shadow-[0_1px_2px_rgba(10,11,13,0.04)] backdrop-blur">
                  첫 분철 배송비 지원 이벤트
                </span>

                <h1 className="mt-6 text-[50px] font-semibold leading-[1.12] tracking-[-0.05em]">
                  첫 분철,
                  <br />
                  택배비는
                  <br />
                  {/* isolate 필수 — 형광펜이 -z-10 이라 stacking context 가 없으면 섹션 배경에 덮인다. */}
                  <span className="relative isolate inline-block">
                    <span className="absolute inset-x-[-0.08em] bottom-[0.14em] top-[0.52em] -z-10 rounded-[0.1em] bg-[#d7ff5f]" />
                    저희가.
                  </span>
                </h1>

                <p className="mt-6 break-keep text-[16px] font-medium leading-[1.7] tracking-[-0.02em] text-[#5A6069]">
                  분철이지에서 처음 여는 분철을 배송비 0원으로 열면,
                  <br />
                  참여자에게 보내는 실제 택배비를
                  <br />
                  분철 1건에 2만 원까지 드려요.
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
                    href="#event"
                  >
                    참여 방법 보기
                  </a>
                </div>
              </div>

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
            className="relative -mt-8 rounded-t-[2.5rem] border-t border-[#0A0B0D]/[0.05] bg-[#F6F7F8] px-6 pb-24 pt-24"
            id="event"
          >
            <Reveal>
              <h2 className="break-keep text-[38px] font-semibold leading-[1.18] tracking-[-0.048em]">
                이벤트 참여는
                <br />
                세 단계면 돼요.
              </h2>
              <p className="mt-6 break-keep text-[16px] font-medium leading-[1.7] tracking-[-0.02em] text-[#5A6069]">
                따로 신청할 필요 없어요.
                <br />
                배송비 0원으로 열고 운송장만 넣어 주세요.
              </p>
            </Reveal>

            <ol className="mt-10 grid gap-3">
              {eventSteps.map(({ body, label }, index) => (
                <li key={label}>
                  <Reveal delay={index * 70}>
                    <div className="rounded-[1.3rem] border border-[#0A0B0D]/[0.05] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(10,11,13,0.03),0_14px_30px_-20px_rgba(10,11,13,0.3)]">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D7FF5F] text-[14px] font-semibold tabular-nums text-[#0A0B0D]">
                          {index + 1}
                        </span>
                        <p className="text-[16.5px] font-semibold tracking-[-0.035em]">
                          {label}
                        </p>
                      </div>
                      <p className="mt-3 break-keep text-[14.5px] font-medium leading-[1.62] tracking-[-0.02em] text-[#5A6069]">
                        {body}
                      </p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>

            <Reveal className="mt-6" delay={140}>
              <dl className="rounded-[1.3rem] bg-[#0A0B0D] px-5 py-5 text-white">
                {eventTerms.map(({ label, value }) => (
                  <div
                    className="grid grid-cols-[4.5rem_1fr] gap-3 border-b border-white/[0.08] py-3 first:pt-0 last:border-b-0 last:pb-0"
                    key={label}
                  >
                    <dt className="text-[13px] font-semibold text-[#D7FF5F]">
                      {label}
                    </dt>
                    <dd className="break-keep text-[14px] font-medium leading-[1.55] text-white/80">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[12.5px] font-medium leading-5 text-[#868C95]">
                이벤트는 공지 후 종료될 수 있어요.
              </p>
            </Reveal>
          </section>

          <section className="intro-grain relative overflow-hidden rounded-t-[2.5rem] bg-[#0A0B0D] px-6 pb-28 pt-24 text-white">
            <div className="pointer-events-none absolute -left-16 top-40 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(215,255,95,0.16),transparent_68%)] blur-2xl" />
            <Reveal>
              <h2 className="relative z-10 break-keep text-[38px] font-semibold leading-[1.18] tracking-[-0.048em]">
                열고, 모으고,
                <br />
                보내면 끝.
              </h2>
              <p className="relative z-10 mt-6 break-keep text-[16px] font-medium leading-[1.7] tracking-[-0.02em] text-white/52">
                계좌 안내도, 입금 연락도, 운송장 공지도
                <br />
                알림톡이 대신 전해 줘요.
              </p>
            </Reveal>

            <div className="relative z-10 mt-12 grid gap-10">
              {hostChapters.map(({ items, label, tip, title }, chapterIndex) => (
                <Reveal delay={chapterIndex * 60} key={label}>
                  <div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
                          chapterIndex === 0
                            ? "bg-[#D7FF5F] text-[#0A0B0D]"
                            : "border border-white/[0.14] text-white/75"
                        }`}
                      >
                        {label}
                      </span>
                      <p className="text-[20px] font-semibold tracking-[-0.04em]">
                        {title}
                      </p>
                    </div>
                    <ul className="mt-4 space-y-3">
                      {items.map((item) => (
                        <li
                          className="flex gap-2.5 break-keep text-[14.5px] font-medium leading-[1.62] tracking-[-0.02em] text-white/70"
                          key={item}
                        >
                          <span
                            aria-hidden="true"
                            className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-[#D7FF5F]"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                    {tip ? (
                      <div className="mt-4 rounded-[1rem] border border-[#D7FF5F]/25 bg-[#D7FF5F]/[0.07] px-4 py-3.5">
                        <p className="text-[12.5px] font-semibold text-[#D7FF5F]">
                          Tip
                        </p>
                        <p className="mt-1 break-keep text-[14px] font-medium leading-[1.6] text-white/80">
                          {tip}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section className="relative -mt-8 rounded-t-[2.5rem] bg-white px-6 pb-24 pt-24">
            <Reveal>
              <h2 className="break-keep text-[38px] font-semibold leading-[1.18] tracking-[-0.048em]">
                외워 둘 숫자는
                <br />
                두 개예요.
              </h2>
            </Reveal>

            <Reveal className="mt-10" delay={100}>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative overflow-hidden rounded-[1.4rem] bg-[#0A0B0D] px-5 py-6 text-white shadow-[0_20px_44px_-18px_rgba(10,11,13,0.55)]">
                  <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(215,255,95,0.32),transparent_65%)] blur-xl" />
                  <p className="relative text-[13px] font-semibold tracking-[-0.02em] text-[#D7FF5F]">
                    마감 뒤
                  </p>
                  <p className="relative mt-4 text-[40px] font-semibold leading-none tracking-[-0.05em]">
                    48<span className="ml-1 text-[18px]">시간</span>
                  </p>
                  <p className="relative mt-4 break-keep text-[13.5px] font-medium leading-[1.5] text-white/60">
                    안에 성사 확정. 넘기면 자동 취소돼요.
                  </p>
                </div>
                <div className="rounded-[1.4rem] border border-[#0A0B0D]/[0.06] bg-[#F6F7F8] px-5 py-6">
                  <p className="text-[13px] font-semibold tracking-[-0.02em] text-[#868C95]">
                    확정 뒤
                  </p>
                  <p className="mt-4 text-[40px] font-semibold leading-none tracking-[-0.05em]">
                    24<span className="ml-1 text-[18px]">시간</span>
                  </p>
                  <p className="mt-4 break-keep text-[13.5px] font-medium leading-[1.5] text-[#5A6069]">
                    입금 기한. 지나도 자동으로 안 빠지니 직접 제외해요.
                  </p>
                </div>
              </div>
            </Reveal>

            <div className="mt-12">
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
                첫 분철,
                <br />
                지금 열어볼까요?
              </h2>
              <p className="relative z-10 mt-6 break-keep text-[16px] font-medium leading-[1.68] tracking-[-0.02em] text-white/52">
                처음 여는 분철의 배송비 칸에 0을 적으면 이벤트 참여예요.
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
