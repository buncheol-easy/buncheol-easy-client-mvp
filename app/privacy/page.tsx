import { PolicyPageContent } from "@/components/PolicyPageContent";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export default function PrivacyPage() {
  return (
    <PolicyPageContent
      title="개인정보처리방침"
      description="분철이지의 개인정보 수집 및 이용 기준을 정리한 초안입니다."
      sections={[
        {
          title: "수집 항목",
          items: [
            "회원 가입 및 로그인 과정에서 이메일, 닉네임, 프로필 정보 등 계정 식별 정보가 처리될 수 있습니다.",
            "분철 참여 및 배송을 위해 연락처, 배송지, 편의점 지점명, 결제 및 참여 내역이 처리될 수 있습니다.",
          ],
        },
        {
          title: "이용 목적",
          items: [
            "회원 식별, 서비스 제공, 분철 참여 관리, 배송 및 고객 문의 응대에 개인정보를 이용합니다.",
            "부정 이용 방지, 서비스 품질 개선, 공지 전달을 위해 필요한 범위에서 정보를 이용할 수 있습니다.",
          ],
        },
        {
          title: "보관 및 파기",
          items: [
            "개인정보는 수집 및 이용 목적 달성 후 지체 없이 파기하는 것을 원칙으로 합니다.",
            "관련 법령에 따라 보관이 필요한 정보는 정해진 기간 동안 별도로 보관될 수 있습니다.",
          ],
        },
        {
          title: "문의",
          items: [
            "개인정보 관련 문의는 teameasy024@gmail.com으로 접수할 수 있습니다.",
          ],
        },
      ]}
    />
  );
}
