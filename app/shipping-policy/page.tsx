import { PolicyPageContent } from "@/components/PolicyPageContent";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export default function ShippingPolicyPage() {
  return (
    <PolicyPageContent
      title="배송 정책"
      description="분철 상품 수령과 배송 방식 기준을 정리한 초안입니다."
      sections={[
        {
          title: "배송 방식",
          items: [
            "분철이지는 개최자가 설정한 배송 방식에 따라 GS25 반값택배, CU 알뜰택배 등 편의점 택배 수령을 지원할 수 있습니다.",
            "참여자는 분철 참여 시 상품 수령이 가능한 배송지를 정확히 선택해야 합니다.",
          ],
        },
        {
          title: "배송비",
          items: [
            "배송비는 분철별로 개최자가 등록한 금액을 기준으로 표시됩니다.",
            "낙찰가와 배송비가 함께 결제 또는 입금 안내될 수 있습니다.",
          ],
        },
        {
          title: "배송 지연 및 오류",
          items: [
            "상품 입고 지연, 편의점 택배 사정, 주소 정보 오류 등으로 배송이 지연될 수 있습니다.",
            "잘못된 배송지 선택 또는 수령 지연으로 발생하는 문제는 이용자에게 책임이 있을 수 있습니다.",
          ],
        },
      ]}
    />
  );
}
