import Link from "next/link";

const policyLinks = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/refund-policy", label: "취소/환불 정책" },
  { href: "/shipping-policy", label: "배송 정책" },
  { href: "/broker-notice", label: "통신판매중개자 고지" },
];

const businessInfoRows = [
  ["상호명: 분철이지", "대표자명: 신동운"],
  ["사업자등록번호: 731-62-00820"],
  ["사업장 주소: 대전광역시 서구 문정로90번길 65, 6층 602-S109호(탄방동)"],
  ["연락처: 010-8678-2427", "이메일: teameasy024@gmail.com"],
  ["통신판매업 신고번호: 신고 완료 후 반영 예정"],
];

export function BusinessFooter() {
  return (
    <footer className="border-t border-black/10 bg-[#f7f7f7] px-4 pb-10 pt-6 text-black">
      <nav aria-label="정책 링크" className="flex flex-wrap gap-x-3 gap-y-2">
        {policyLinks.map((link) => (
          <Link
            className="text-[12px] font-semibold tracking-[-0.03em] text-black/72 underline-offset-4 hover:underline"
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="mt-5 space-y-1.5 text-[11px] font-medium leading-5 tracking-[-0.03em] text-black/42">
        {businessInfoRows.map((row) => (
          <p className="flex flex-wrap gap-x-3 gap-y-0.5" key={row.join("|")}>
            {row.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </p>
        ))}
      </div>
    </footer>
  );
}
