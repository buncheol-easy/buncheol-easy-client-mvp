"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BottomNavigator } from "@/components/BottomNavigator";
import { BackIcon } from "@/components/icons";
import { requestLogout, type HostingEligibilityReason } from "@/lib/auth-api";
import { createLoginHref } from "@/lib/auth-navigation";
import {
  authProfileSetupReturnHrefStorageKey,
  readAuthState,
} from "@/lib/auth-store";
import { getHistoryIndex } from "@/lib/history-index";
import { clearUserSessionState } from "@/lib/user-session";

type HostingIneligibleNoticeProps = {
  // 서버가 모르는 사유를 내리면 null 로 떨어진다 — variant 에 따라 "차단됐다"와 "요건 안내"로 갈린다.
  reason: HostingEligibilityReason;
  // blocked = 개최가 실제로 막힌 화면(기본), requirements = 자격 요건을 알리는 안내 페이지(/upload/notice).
  // 사유를 모를 때 요건 안내 카피를 그대로 쓰면 "이제 직접 열 수 있어요 → 개최하러 가기" 가 떠서
  // 방금 막힌 사용자에게 거짓 안내 + 제자리 도는 CTA 가 된다.
  variant?: "blocked" | "requirements";
};

type NoticeCopy = {
  headline: string;
  description: string;
  sectionTitle: string;
  items: { title: string; description: string }[];
  // 링크로 끝나지 않는 CTA 가 둘 있다 — 재로그인은 카카오 동의창을 다시 띄우려 세션을 정리해야 하고,
  // 가입 정보 입력은 완료 후 개최 화면으로 돌아오도록 복귀 주소를 먼저 남겨야 한다.
  primaryAction:
    | { label: string; href: string }
    // note = 버튼을 누르면 벌어지는 일의 예고(세션이 풀리는 등).
    | { label: string; kind: "relogin" | "profile-setup"; note?: string };
};

const contactEmail = "teameasy024@gmail.com";

const hostingRequirementItems = [
  {
    title: "성인 회원만 개최할 수 있어요",
    description:
      "참여자 돈이 개최자 계좌로 바로 가는 직거래라, 카카오 연령대 정보로 성인 여부를 확인해요. 카카오는 연령대를 구간으로만 알려주는데 15~19세가 한 구간이라 성인인 만 19세를 가려낼 수 없어서, 20대 이상 구간부터 확인돼요.",
  },
  {
    title: "연락처가 필요해요",
    description:
      "참여자와 문제가 생겼을 때 연락이 닿아야 해서 가입 정보(전화번호)를 먼저 채워 주세요.",
  },
  {
    title: "정산 계좌가 필요해요",
    description:
      "참여자가 입금할 계좌라, 마이페이지에서 정산 계좌를 등록해야 개최할 수 있어요.",
  },
  {
    title: "동시에 5개까지 열 수 있어요",
    description:
      "진행 중인 분철이 마무리되면 새로 개최할 수 있어요. 참여는 개수 제한 없이 자유롭게 하실 수 있어요.",
  },
];

function getNoticeCopy(
  reason: HostingEligibilityReason,
  variant: "blocked" | "requirements",
): NoticeCopy {
  // 오픈 전은 사용자가 고칠 것이 없는 유일한 사유라, 요건 안내를 하지 않고 준비할 것만 알려준다.
  // 서버는 이 사유를 다른 자격 검사보다 먼저 판정한다(자격을 갖춰도 미오픈이 앞선다). 다만 사유는
  // 한 번에 하나만 내려오고 아래 분기는 서로 배타적이라, 여기 배치 순서는 동작에 영향이 없다.
  if (reason === "NOT_OPEN_YET") {
    return {
      headline: "회원 개최는 아직 오픈 전이에요",
      description:
        "직접 분철을 여는 기능을 준비하고 있어요. 열리면 공지사항으로 알려드릴게요.",
      sectionTitle: "먼저 알아두면 좋아요",
      items: [
        {
          title: "참여는 지금도 할 수 있어요",
          description: "열려 있는 분철은 홈에서 자유롭게 참여할 수 있어요.",
        },
        {
          title: "성인 회원만 열 수 있어요",
          description:
            "참여자 돈이 개최자 계좌로 바로 가는 직거래라, 오픈 후에도 개최는 성인 회원만 가능해요.",
        },
        {
          title: "연락처와 정산 계좌를 미리 등록해 두세요",
          description:
            "오픈되면 바로 열 수 있게, 마이페이지에서 전화번호와 정산 계좌를 채워두면 좋아요.",
        },
      ],
      // 개최 폼(/upload)으로 되돌리면 제자리를 돌지만, 준비를 권하면서 경로를 안 주면 마이페이지를
      // 찾아 헤맨다. href 가 "/" 가 아니면 "진행 중인 분철 둘러보기" 보조 버튼이 자동으로 붙는다.
      primaryAction: { label: "마이페이지에서 미리 등록하기", href: "/profile" },
    };
  }

  if (reason === "PHONE_REQUIRED") {
    return {
      headline: "가입 정보를 먼저 채워 주세요",
      description:
        "분철을 개최하려면 연락처가 필요해요. 참여자와 문제가 생겼을 때 연락이 닿아야 하거든요.",
      sectionTitle: "이렇게 하면 돼요",
      items: [
        {
          title: "무엇이 필요한가요",
          description: "닉네임과 전화번호를 등록하면 바로 개최할 수 있어요.",
        },
        {
          title: "연락처는 어디에 쓰나요",
          description:
            "거래 분쟁이 생겼을 때 확인용으로 보관하며, 참여자에게 그냥 공개되지는 않아요.",
        },
      ],
      primaryAction: { label: "가입 정보 입력하기", kind: "profile-setup" },
    };
  }

  if (reason === "AGE_UNVERIFIED") {
    return {
      headline: "카카오 연령대 확인이 필요해요",
      description:
        "개최는 성인 회원만 가능해서 연령대 정보를 확인해야 해요. 카카오 로그인에서 '연령대' 제공에 동의하면 열려요.",
      sectionTitle: "이렇게 하면 돼요",
      items: [
        {
          title: "카카오 로그인을 다시 해주세요",
          description:
            "아래 버튼을 누르면 지금 로그인이 풀리고 카카오 로그인 화면으로 이동해요. 연령대 제공에 동의하면 개최 화면이 열려요.",
        },
        {
          title: "카카오에 생년월일이 없다면",
          description:
            "동의 과정에서 카카오가 정보 입력을 안내해요. 입력을 마친 뒤 다시 로그인하면 확인돼요.",
        },
        {
          title: "그래도 열리지 않으면",
          description:
            "동의 창이 뜨지 않고 그대로 돌아온다면 아래 메일로 알려주세요. 계정 확인 후 도와드릴게요.",
        },
        {
          title: "동의하지 않아도 참여는 그대로",
          description:
            "연령대 정보는 개최 자격 확인에만 쓰고, 분철 참여에는 필요하지 않아요.",
        },
      ],
      primaryAction: {
        label: "카카오로 다시 로그인하기",
        kind: "relogin",
        note: "누르면 지금 로그인이 풀려요.",
      },
    };
  }

  if (reason === "BANK_ACCOUNT_REQUIRED") {
    return {
      headline: "정산 계좌를 먼저 등록해 주세요",
      description:
        "참여자가 입금할 계좌라 개최 전에 등록이 필요해요. 등록한 계좌는 입금 안내 화면에 그대로 보여요.",
      sectionTitle: "이렇게 하면 돼요",
      items: [
        {
          title: "어디서 등록하나요",
          description:
            "마이페이지 > 정산 계좌에서 은행·계좌번호·예금주를 등록하면 바로 개최할 수 있어요.",
        },
        {
          title: "예금주명이 중요해요",
          description:
            "참여자가 입금할 때 대조하는 이름이라, 실제 통장의 예금주와 같게 적어 주세요.",
        },
      ],
      primaryAction: {
        label: "정산 계좌 등록하기",
        // 저장 후 개최 화면으로 돌아온다 — PHONE_REQUIRED 의 복귀 규약과 맞춘다.
        href: "/profile?openAccount=1&returnTo=%2Fupload",
      },
    };
  }

  if (reason === "NOT_ADULT") {
    return {
      headline: "미성년자는 분철을 개최할 수 없어요",
      description:
        "참여자 돈이 개최자 계좌로 바로 가는 직거래라, 안전을 위해 개최는 성인 회원만 가능해요.",
      sectionTitle: "대신 이렇게 이용할 수 있어요",
      items: [
        {
          title: "참여는 그대로 할 수 있어요",
          description:
            "진행 중인 분철은 홈과 검색에서 자유롭게 참여할 수 있어요.",
        },
        {
          title: "성인이 되면 열려요",
          description:
            "카카오 연령대 정보가 바뀌면 다시 로그인했을 때 자동으로 개최 자격이 확인돼요.",
        },
      ],
      primaryAction: { label: "진행 중인 분철 둘러보기", href: "/" },
    };
  }

  if (reason === "LIMIT_EXCEEDED") {
    return {
      headline: "동시에 열 수 있는 분철을 다 채웠어요",
      description:
        "모집중·입금 수집중인 분철이 5개예요. 진행 중인 분철이 마무리되면 새로 개최할 수 있어요.",
      sectionTitle: "이렇게 하면 돼요",
      items: [
        {
          title: "지금 할 수 있는 것",
          description:
            "개최 기록에서 진행 중인 분철의 입금을 확인하거나, 마감된 분철을 확정해 정리해 주세요.",
        },
        {
          title: "왜 제한하나요",
          description:
            "관리되지 않는 분철이 쌓이면 참여자가 기다리기만 하게 돼서 개수를 제한하고 있어요.",
        },
      ],
      // /profile/bids 는 "참여한 분철" 탭으로 열리고 탭을 지정할 쿼리가 없어, 라벨을 화면 그대로 맞춘다.
      primaryAction: { label: "참여·개최 기록 보기", href: "/profile/bids" },
    };
  }

  // 사유 없는 공용 안내 — 개최 자격 요건 자체를 알린다 (docs/54 3-1·3-2 확정 문구).
  if (variant === "requirements") {
    return {
      headline: "이제 직접 분철을 열 수 있어요",
      description: "성인이고 연락처·정산 계좌를 등록했다면 바로 개최할 수 있어요.",
      sectionTitle: "개최 자격 조건",
      items: hostingRequirementItems,
      primaryAction: { label: "분철 개최하러 가기", href: "/upload" },
    };
  }

  // 차단인데 사유를 모르는 경우(서버가 사유를 추가했거나 응답이 어긋남). 요건만 알리고 개최로 되돌려보내지 않는다.
  return {
    headline: "지금은 분철을 개최할 수 없어요",
    description:
      "개최 자격을 확인했는데 조건 하나가 아직 맞지 않아요. 아래 조건을 확인하고, 계속 막히면 메일로 알려주세요.",
    sectionTitle: "개최 자격 조건",
    items: hostingRequirementItems,
    primaryAction: { label: "진행 중인 분철 둘러보기", href: "/" },
  };
}

export function HostingIneligibleNotice({
  reason,
  variant = "blocked",
}: HostingIneligibleNoticeProps) {
  const router = useRouter();
  const [isRelogging, setIsRelogging] = useState(false);
  const copy = getNoticeCopy(reason, variant);
  // 좁힌 타입이 콜백 안에서도 유지되도록 지역 상수로 뽑는다.
  const primaryAction = copy.primaryAction;

  function handleBack() {
    const historyIndex = getHistoryIndex();

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace("/");
  }

  // 연령대 재동의는 카카오 동의창을 다시 거쳐야 갱신된다 — 현재 세션을 정리하고 로그인부터 다시 태운다.
  async function handleRelogin() {
    if (isRelogging) {
      return;
    }

    setIsRelogging(true);

    const accessToken = readAuthState().accessToken;

    try {
      if (accessToken) {
        await requestLogout(accessToken);
      }
    } catch {
      // 서버 로그아웃 실패는 무시한다 — 로컬 세션만 정리해도 재로그인 흐름은 성립한다.
    } finally {
      // 토큰만 지우면 정산 계좌·배송지 같은 계정 스코프 캐시가 남아, 다른 카카오 계정으로 갈아탔을 때
      // 이전 사용자 정보가 화면에 보인다 — 연령대 미동의 계정은 계정 전환이 잦은 경로다.
      clearUserSessionState();
      router.replace(createLoginHref({ cancelTo: "/", returnTo: "/upload" }));
    }
  }

  // 가입 정보 입력 후 개최 화면으로 돌아오게 한다 — 공용 가드(useProfileCompletionGuard)가 쓰는 복귀 주소와 같은 규약.
  function handleProfileSetup() {
    try {
      window.sessionStorage.setItem(
        authProfileSetupReturnHrefStorageKey,
        "/upload",
      );
    } catch {
      // 세션 저장 실패는 무시한다 — 복귀만 홈으로 떨어질 뿐 입력 자체는 진행된다.
    }

    router.push("/signup/profile");
  }

  return (
    <main className="system-chrome-white system-chrome-bottom-black h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
          <div className="absolute inset-0 flex flex-col bg-white">
            <header className="upload-header shrink-0 border-b border-black/10 bg-white px-4 py-3 text-black">
              <div className="upload-header__inner flex h-10 items-center gap-2">
                <button
                  aria-label="이전 화면"
                  className="upload-header__back -ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center text-black"
                  onClick={handleBack}
                  type="button"
                >
                  <BackIcon />
                </button>

                <div className="upload-header__copy min-w-0 flex-1">
                  <h1 className="upload-header__title text-[20px] font-semibold leading-none tracking-[-0.05em]">
                    분철 개최 안내
                  </h1>
                </div>
              </div>
            </header>

            <div className="tab-content-enter app-page-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4">
              <section className="relative overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-[#10110D] via-[#222719] to-[#D7FF5F] px-5 py-7 text-white shadow-[0_18px_42px_rgba(120,132,82,0.18)] ring-1 ring-[#D7FF5F]/45">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_20%,rgba(215,255,95,0.5),transparent_26%),radial-gradient(circle_at_14%_82%,rgba(255,255,255,0.18),transparent_30%)]" />
                <div className="relative">
                  <h2 className="break-keep text-[22px] font-semibold leading-[1.25] tracking-[-0.05em]">
                    {copy.headline}
                  </h2>
                  <p className="mt-3 break-keep text-[14px] font-medium leading-6 tracking-[-0.03em] text-white/75">
                    {copy.description}
                  </p>
                </div>
              </section>

              <section className="mt-7">
                <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                  {copy.sectionTitle}
                </h2>
                <ul className="mt-4 space-y-3">
                  {copy.items.map((item) => (
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
                <p className="text-[12px] font-semibold leading-none text-black/35">
                  문의
                </p>
                <a
                  className="mt-2 inline-block text-[15px] font-semibold tracking-[-0.03em] underline underline-offset-4"
                  href={`mailto:${contactEmail}`}
                >
                  {contactEmail}
                </a>
                <p className="mt-1.5 break-keep text-[13px] font-medium leading-5 tracking-[-0.03em] text-black/45">
                  안내가 실제와 다르거나 도움이 필요하면 메일로 알려주세요.
                </p>
              </section>

              <div className="mt-8 space-y-3">
                {"href" in primaryAction ? (
                  <Link
                    className="flex h-14 w-full items-center justify-center rounded-full bg-[#CFE86B] text-[17px] font-semibold tracking-[-0.04em] text-black shadow-[0_12px_28px_rgba(120,132,82,0.24)]"
                    href={primaryAction.href}
                  >
                    {primaryAction.label}
                  </Link>
                ) : (
                  <button
                    className="flex h-14 w-full items-center justify-center rounded-full bg-[#CFE86B] text-[17px] font-semibold tracking-[-0.04em] text-black shadow-[0_12px_28px_rgba(120,132,82,0.24)] disabled:bg-black/20 disabled:text-white"
                    disabled={isRelogging}
                    onClick={() => {
                      if (primaryAction.kind === "relogin") {
                        void handleRelogin();
                        return;
                      }

                      handleProfileSetup();
                    }}
                    type="button"
                  >
                    {isRelogging ? "이동 중..." : primaryAction.label}
                  </button>
                )}
                {"kind" in primaryAction && primaryAction.note ? (
                  <p className="break-keep text-center text-[13px] font-medium leading-5 tracking-[-0.03em] text-black/45">
                    {primaryAction.note}
                  </p>
                ) : null}
                {"href" in primaryAction && primaryAction.href === "/" ? null : (
                  <Link
                    className="flex h-14 w-full items-center justify-center rounded-full border border-black/15 text-[16px] font-semibold tracking-[-0.04em] text-black/70"
                    href="/"
                  >
                    진행 중인 분철 둘러보기
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        <BottomNavigator activeLabel="Upload" />
      </div>
    </main>
  );
}
