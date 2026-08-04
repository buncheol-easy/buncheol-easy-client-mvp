import { PolicyPageContent } from "@/components/PolicyPageContent";
import { buildPageMetadata } from "@/lib/seo";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata = buildPageMetadata({
  title: "취소·환불 정책",
  description: "분철 참여 자동 취소와 청약철회·환불 처리 기준을 안내합니다.",
  path: "/refund-policy",
});

export default function RefundPolicyPage() {
  return (
    <PolicyPageContent
      title="취소/환불 정책"
      effectiveDate="2026.7.23"
      description="분철 참여 자동 취소와 청약철회·환불 처리 기준을 안내합니다."
      sections={[
        {
          title: "참여 자동 취소",
          items: [
            "참여 후 30분 이내 입금이 확인되지 않으면 참여가 자동 취소됩니다.",
            "자동 취소된 참여 건은 다시 참여 가능한 상태에서 새로 신청해야 합니다.",
          ],
        },
        {
          title: "청약철회 (수령 후 7일)",
          items: [
            "참여자는 전자상거래법에 따라 상품을 공급받은 날부터 7일 이내 청약철회를 할 수 있습니다.",
            "분철 상품은 원제품을 개봉·분배한 구성품이라는 사실을 상품 페이지에 표시하며, 이로 인해 청약철회가 제한될 수 있는 상품은 그 사실을 참여 전에 개별 고지합니다.",
            "상품 하자·오배송·미발송 등 회사 귀책 사유가 있는 경우 위 제한과 무관하게 관련 법령에 따라 환불·교환을 요구할 수 있습니다.",
          ],
        },
        {
          title: "분철 취소·무산 시 환불",
          items: [
            "최소 진행 인원 미달 등으로 분철이 취소·무산되면 이미 입금된 대금은 전액 환불됩니다.",
          ],
        },
        {
          title: "환불 처리",
          items: [
            "환불은 참여 시 등록한 환불계좌로 처리되며, 상품 반환일(공급 전이면 취소일)부터 3영업일 이내 입금을 원칙으로 합니다.",
            "환불 확인을 위해 주문 정보, 입금 내역, 배송 진행 상태 확인이 필요할 수 있습니다.",
          ],
        },
      ]}
    />
  );
}
