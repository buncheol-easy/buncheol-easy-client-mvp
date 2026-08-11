import { PolicyPageContent } from "@/components/PolicyPageContent";
import { buildPageMetadata } from "@/lib/seo";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata = buildPageMetadata({
  title: "배송 정책",
  description:
    "분철 상품의 편의점 택배 수령 방식과 배송비 기준, 회원 개최(중개) 분철의 배송 이행 주체를 안내합니다.",
  path: "/shipping-policy",
});

export default function ShippingPolicyPage() {
  return (
    <PolicyPageContent
      title="배송 정책"
      effectiveDate="2026.8.18 (시행 예정)"
      description="분철 상품 수령과 배송 방식 기준을 정리한 초안입니다. 회원 개최(중개) 분철 관련 내용은 2026년 8월 18일 개정 약관 시행과 함께 적용되며, 시행일 전까지는 2026년 6월 16일자 기준이 적용됩니다."
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
            "상품 금액와 배송비가 함께 결제 또는 입금 안내될 수 있습니다.",
          ],
        },
        {
          title: "배송 지연 및 오류",
          items: [
            "상품 입고 지연, 편의점 택배 사정, 주소 정보 오류 등으로 배송이 지연될 수 있습니다.",
            "잘못된 배송지 선택 또는 수령 지연으로 발생하는 문제는 이용자에게 책임이 있을 수 있습니다.",
          ],
        },
        {
          title: "회원 개최(중개) 분철",
          items: [
            "분철이지가 직접 개최하는 분철은 발송·배송 의무가 분철이지에 있습니다. 회원이 개최하는 분철에서 분철이지는 통신판매중개자로서 거래 당사자가 아니며, 상품의 발송·배송 의무는 개최자에게 있습니다.",
            "회원 개최 분철의 배송 방식·배송비·발송 시기는 개최자가 등록한 내용을 기준으로 하며, 참여 전에 분철 상세 화면에서 확인해 주세요.",
            "배송 지연·오배송·미발송이 발생한 경우 먼저 개최자에게 문의해 주세요. 분철이지는 통신판매중개자로서 개최자에게 이행을 요구하고 분쟁 해결을 조력합니다.",
            "운송장 등록·배송 조회·수령 확인 기능은 개최 주체와 관계없이 분철이지가 제공합니다.",
            "이 기준은 2026년 8월 18일 시행되는 개정 이용약관과 함께 적용됩니다.",
          ],
        },
      ]}
    />
  );
}
