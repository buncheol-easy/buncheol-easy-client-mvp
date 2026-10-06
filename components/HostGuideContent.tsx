"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BusinessFooter } from "@/components/BusinessFooter";
import { BackIcon } from "@/components/icons";
import { getHistoryIndex } from "@/lib/history-index";

type GuideItem = {
  body: string;
  title: string;
};

const preparations: GuideItem[] = [
  {
    title: "카카오 로그인 · 연령대 동의",
    body: "개최는 성인 회원만 할 수 있어요. 카카오 로그인 때 '연령대' 제공에 동의해 주세요. 카카오는 연령대를 구간으로만 알려줘서 20대 이상 구간부터 확인돼요.",
  },
  {
    title: "닉네임 · 전화번호",
    body: "참여자와 문제가 생겼을 때 연락이 닿아야 해서 필요해요. 전화번호는 참여자에게 그냥 공개되지 않아요.",
  },
  {
    title: "정산 계좌",
    body: "참여자가 총대님 계좌로 직접 입금해요. 마이페이지 > 정산 계좌에서 등록하고, 예금주명은 실제 통장과 같게 적어 주세요.",
  },
];

const steps: GuideItem[] = [
  {
    title: "분철 등록하기",
    body: "사진, 분철 제목, 그룹과 멤버별 가격, 최소 진행 인원, 마감 기한, 배송비(GS25 반값택배·CU 알뜰택배)를 적어요. 오픈채팅 링크를 넣으면 참여한 사람에게만 보여요.",
  },
  {
    title: "신청 받기",
    body: "분철 상세의 공유 버튼으로 링크를 복사해 트위터에 올려요. 신청 순서대로 자리가 잡혀서 같은 자리에 두 명이 겹치지 않아요.",
  },
  {
    title: "성사 확정하기",
    body: "신청이 모이면 관리 화면에서 '성사 확정하기'를 눌러요. 신청자 전원에게 입금 계좌와 24시간 입금 기한이 알림톡으로 가요.",
  },
  {
    title: "입금 확인하고 보내기",
    body: "참여자가 송금 후 '보냈어요'를 누르면 표시돼요. 통장에서 입금자명을 확인하고 '입금 확인'을 눌러 주세요. 택배를 보낸 뒤 운송장 번호를 등록하면 참여자에게 알림이 가고 배송 상태도 자동으로 바뀌어요.",
  },
];

const faqs: GuideItem[] = [
  {
    title: "수수료가 있나요?",
    body: "지금은 수수료가 없어요.",
  },
  {
    title: "인원이 안 차면 어떻게 되나요?",
    body: "확정하기 전에 마감 기한이 됐는데 최소 진행 인원이 안 찼다면 분철이 바로 자동 취소되고 신청자에게도 안내가 가요. 입금은 확정한 뒤에 받으니 돌려줄 돈이 생기지 않아요.",
  },
  {
    title: "확정을 깜빡하면요?",
    body: "인원이 찼더라도 모집 기한이 지나고 2일(48시간) 안에 확정하지 않으면 분철이 자동으로 취소돼요.",
  },
  {
    title: "입금 확인도 자동인가요?",
    body: "아니요. 참여자가 총대님 계좌로 직접 보내는 직거래라, 통장을 보고 직접 확인해 주세요. 입금 기한이 지난 참여는 '제외'로 정리할 수 있어요.",
  },
];

export function HostGuideContent() {
  const router = useRouter();

  // DM 링크로 바로 들어오면 돌아갈 화면이 없어 홈으로 보낸다.
  function handleBack() {
    const historyIndex = getHistoryIndex();

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace("/");
  }

  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <header className="shrink-0 px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <button
              aria-label="이전 화면"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white"
              onClick={handleBack}
              type="button"
            >
              <BackIcon />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[24px] font-semibold leading-none tracking-[-0.05em]">
                처음 분철 여는 법
              </h1>
            </div>
          </div>
        </header>

        <div className="app-page-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-2">
          <div className="flex min-h-full flex-col">
            <section className="border-b border-black/10 pb-5">
              <p className="break-keep text-[14px] font-medium leading-6 tracking-[-0.03em] text-black/55">
                신청 받기부터 입금 확인, 운송장 알림까지 분철이지 한 화면에서 관리해요.
                처음 여는 분이라면 이 순서대로 따라 하면 돼요.
              </p>
            </section>

            <section className="border-b border-black/10 py-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                열기 전에 준비할 것
              </h2>
              <ul className="mt-4 space-y-4">
                {preparations.map((item) => (
                  <li className="rounded-[18px] bg-[#f7f7f7] px-4 py-3.5" key={item.title}>
                    <p className="text-[15px] font-semibold tracking-[-0.04em]">
                      {item.title}
                    </p>
                    <p className="mt-1 break-keep text-[14px] font-medium leading-6 tracking-[-0.03em] text-black/58">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="border-b border-black/10 py-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                이렇게 열어요
              </h2>
              <ol className="mt-4 space-y-5">
                {steps.map((step, index) => (
                  <li className="flex gap-3" key={step.title}>
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-[13px] font-semibold text-[#D7FF5F]">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold leading-7 tracking-[-0.04em]">
                        {step.title}
                      </p>
                      <p className="mt-0.5 break-keep text-[14px] font-medium leading-6 tracking-[-0.03em] text-black/58">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="py-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                자주 묻는 것
              </h2>
              <dl className="mt-4 space-y-4">
                {faqs.map((faq) => (
                  <div key={faq.title}>
                    <dt className="text-[15px] font-semibold tracking-[-0.04em]">
                      {faq.title}
                    </dt>
                    <dd className="mt-1 break-keep text-[14px] font-medium leading-6 tracking-[-0.03em] text-black/58">
                      {faq.body}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <div className="pb-2 pt-2">
              <Link
                className="flex h-14 w-full items-center justify-center rounded-full bg-black text-[16px] font-semibold tracking-[-0.04em] text-[#D7FF5F]"
                href="/upload"
              >
                분철 열러 가기
              </Link>
              <Link
                className="mt-3 block text-center text-[13px] font-medium text-black/45 underline underline-offset-2"
                href="/intro"
              >
                분철이지가 처음이라면 서비스 소개 보기
              </Link>
            </div>

            <div className="-mx-4 -mb-8 mt-auto pt-8">
              <BusinessFooter />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
