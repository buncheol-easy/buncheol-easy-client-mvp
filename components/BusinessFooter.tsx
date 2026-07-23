"use client";

import Link from "next/link";

const policyLinks = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침", strong: true },
  { href: "http://pf.kakao.com/_LqxnGX", label: "고객센터", external: true },
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
            src="https://img1.kbstar.com/img/escrow/escrowcmark.gif"
          />
        </button>
      </div>

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

      <p
        className={`border-l-2 border-black/18 pl-3 font-medium tracking-[-0.02em] text-black/50 ${
          isCompact
            ? "mt-3 text-[10px] leading-4"
            : "mt-3.5 text-[10.5px] leading-5"
        }`}
      >
        분철이지는 본 사이트에서 판매되는 분철 상품의 통신판매 당사자입니다.
        <br />
        상품·거래 정보, 청약철회·환불 등 거래에 관한 책임은 분철이지에
        있습니다.
      </p>
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
