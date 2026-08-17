"use client";

import Link from "next/link";

const policyLinks = [
  { href: "/intro", label: "서비스 소개" },
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침", strong: true },
  { href: "/broker-notice", label: "통신판매중개자 고지" },
  { href: "https://pf.kakao.com/_LqxnGX", label: "고객센터", external: true },
];

const businessInfoRows = [
  { label: "상호", value: "분철이지" },
  { label: "대표자", value: "신동운" },
  { label: "사업자등록번호", value: "731-62-00820" },
  { label: "통신판매업 신고번호", value: "2026-대전서구-0940" },
  { label: "개인정보보호책임자", value: "신동운" },
  { label: "호스팅", value: "Amazon Web Services" },
  {
    full: true,
    label: "주소",
    value: "대전광역시 서구 문정로90번길 65, 6층 602-S109호",
  },
  {
    full: true,
    label: "고객문의",
    value: "teameasy024@gmail.com · 010-8678-2427",
  },
];

type BusinessFooterProps = {
  variant?: "full" | "compact";
};

function openKbEscrowAuth() {
  const params = new URLSearchParams({
    cc: "b034066:b035526",
    mHValue: "3497ba47b0c3849fe9e0df09700e1fed",
    page: "C021590",
  });

  window.open(
    `https://okbfex.kbstar.com/quics?${params.toString()}`,
    "KB_AUTHMARK",
    "height=604,width=648,status=yes,toolbar=no,menubar=no,location=no",
  );
}

export function BusinessFooter({ variant = "compact" }: BusinessFooterProps) {
  const isCompact = variant === "compact";

  return (
    <footer
      className={`border-t border-black/10 bg-[#f7f7f7] text-black ${
        isCompact ? "px-4 pb-7 pt-4" : "px-5 pb-9 pt-5"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-[15px] font-semibold tracking-[-0.04em]">분철이지</p>
        <button
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[-0.02em] text-black/38"
          onClick={openKbEscrowAuth}
          type="button"
        >
          <span>구매안전서비스 확인</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="h-4 w-4 object-contain opacity-60"
            decoding="async"
            height={16}
            loading="lazy"
            referrerPolicy="no-referrer"
            src="https://img1.kbstar.com/img/escrow/escrowcmark.gif"
            width={16}
          />
        </button>
      </div>

      {/* 구매안전서비스는 회사가 대금을 직접 수취하는 분철에만 적용된다.
          인증마크가 전역 노출이라 C2C 거래에도 적용되는 것처럼 오인될 소지가
          있어 마크 바로 아래에 적용 범위를 붙인다. */}
      <p className="mt-1.5 text-[10px] font-medium leading-4 tracking-[-0.02em] text-black/40">
        구매안전서비스(KB에스크로)는 분철이지가 직접 개최하는 분철에 적용되며,
        대금이 개최자 계좌로 직접 입금되는 회원 개최 분철에는 적용되지 않습니다.
      </p>

      <nav
        aria-label="정책 링크"
        className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${
          isCompact ? "mt-3" : "mt-4"
        }`}
      >
        {policyLinks.map((link) => (
          <Link
            className={`text-[11px] tracking-[-0.03em] text-black/62 underline-offset-4 hover:underline ${
              link.strong ? "font-bold" : "font-semibold"
            }`}
            href={link.href}
            key={link.href}
            rel={link.external ? "noopener noreferrer" : undefined}
            target={link.external ? "_blank" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div
        className={`border-t border-black/10 ${
          isCompact ? "mt-3 pt-3" : "mt-4 pt-3.5"
        }`}
      >
        <dl
          className={`grid grid-cols-2 gap-x-4 font-medium tracking-[-0.02em] ${
            isCompact
              ? "gap-y-1 text-[10px] leading-[0.9rem]"
              : "gap-y-1.5 text-[10.5px] leading-4"
          }`}
        >
          {businessInfoRows.map((row) => (
            <div
              className={row.full ? "col-span-2" : "min-w-0"}
              key={row.label}
            >
              <dt className="text-[9px] font-bold tracking-[0.02em] text-black/50">
                {row.label}
              </dt>
              <dd className="mt-1 min-w-0 break-keep text-black/58">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div
        className={`space-y-1.5 border-l-2 border-black/18 pl-3 font-medium tracking-[-0.02em] text-black/50 ${
          isCompact
            ? "mt-3 text-[10px] leading-4"
            : "mt-3.5 text-[10.5px] leading-5"
        }`}
      >
        <p>
          분철이지가 직접 개최하는 분철은 분철이지가 통신판매 당사자이며,
          상품·거래 정보와 청약철회·환불 등 거래에 관한 책임은 분철이지에
          있습니다.
        </p>
        <p>
          회원이 개최하는 분철은 분철이지가 통신판매중개자로서 거래 당사자가
          아니며, 대금은 개최자 계좌로 직접 입금됩니다. 상품·거래에 관한 책임은
          개최자에게 있습니다.
        </p>
        <p>
          회원 개최 분철에는 그 사실이 해당 분철 화면에 표시되며, 표시가 없는
          분철은 분철이지가 직접 개최하는 분철입니다. 자세한 내용은{" "}
          <Link className="underline underline-offset-2" href="/broker-notice">
            통신판매중개자 고지
          </Link>
          에서 확인할 수 있습니다.
        </p>
      </div>
      <p
        className={`text-[10px] font-medium tracking-[-0.02em] text-black/36 ${
          isCompact ? "mt-3" : "mt-3.5"
        }`}
      >
        © 2026 분철이지
      </p>
    </footer>
  );
}
