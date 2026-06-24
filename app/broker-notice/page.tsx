import { PolicyPageContent } from "@/components/PolicyPageContent";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export default function BrokerNoticePage() {
  return (
    <PolicyPageContent
      title="통신판매중개자 고지"
      description="분철이지의 통신판매중개 서비스 성격과 책임 범위를 정리한 초안입니다."
      sections={[
        {
          title: "중개 서비스 고지",
          items: [
            "분철이지는 이용자 간 분철 정보 등록, 참여 및 거래 관리를 돕는 플랫폼입니다.",
            "개별 분철 상품의 내용, 가격, 진행, 배송 등은 해당 분철 개최자와 참여자 사이의 거래 조건에 따라 달라질 수 있습니다.",
          ],
        },
        {
          title: "거래 책임",
          items: [
            "분철이지는 플랫폼 운영자로서 서비스 이용 환경을 제공하며, 개별 거래의 당사자가 아닌 경우 거래 자체에 대한 책임이 제한될 수 있습니다.",
            "다만 서비스 오류, 신고, 분쟁 접수 등 운영상 필요한 경우 사실 확인 및 조치를 지원할 수 있습니다.",
          ],
        },
        {
          title: "사업자 정보",
          items: [
            "상호명: 분철이지",
            "대표자명: 신동운",
            "사업자등록번호: 731-62-00820",
            "이메일: teameasy024@gmail.com",
          ],
        },
      ]}
    />
  );
}
