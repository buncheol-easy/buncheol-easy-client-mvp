import { PolicyPageContent } from "@/components/PolicyPageContent";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export default function RefundPolicyPage() {
  return (
    <PolicyPageContent
      title="취소/환불 정책"
      description="분철 참여 취소와 결제 이후 환불 기준을 정리한 초안입니다."
      sections={[
        {
          title: "입찰 및 참여 취소",
          items: [
            "모집 중인 분철은 서비스에서 제공하는 취소 가능 조건에 따라 참여를 철회할 수 있습니다.",
            "분철이 마감되었거나 낙찰이 확정된 이후에는 임의 취소가 제한될 수 있습니다.",
          ],
        },
        {
          title: "결제 이후 환불",
          items: [
            "결제 완료 후에는 상품 구매, 정산, 배송 준비 상태에 따라 환불 가능 여부가 달라질 수 있습니다.",
            "상품 품절, 개최자 귀책, 서비스 오류 등으로 거래가 정상 진행되지 못한 경우 확인 후 환불 절차를 안내합니다.",
          ],
        },
        {
          title: "환불 처리",
          items: [
            "환불은 결제 수단 또는 별도 안내된 방식으로 진행될 수 있습니다.",
            "환불 신청 시 주문 정보, 입금 내역, 배송 진행 상태 확인이 필요할 수 있습니다.",
          ],
        },
      ]}
    />
  );
}
