import { PolicyPageContent } from "@/components/PolicyPageContent";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export default function TermsPage() {
  return (
    <PolicyPageContent
      title="이용약관"
      description="분철이지 서비스 이용과 관련한 기본 조건을 정리한 초안입니다."
      sections={[
        {
          title: "목적",
          items: [
            "본 약관은 분철이지가 제공하는 분철 탐색, 참여, 개최 및 관련 서비스의 이용 조건을 정합니다.",
            "회원은 서비스를 이용함으로써 본 약관 및 별도 정책에 동의한 것으로 봅니다.",
          ],
        },
        {
          title: "서비스 이용",
          items: [
            "분철이지는 이용자가 분철 정보를 등록하거나 확인하고, 참여 내역을 관리할 수 있는 기능을 제공합니다.",
            "회원은 정확한 정보를 입력해야 하며, 타인의 권리 또는 서비스 운영을 침해하는 방식으로 서비스를 이용할 수 없습니다.",
          ],
        },
        {
          title: "회원 책임",
          items: [
            "회원은 본인의 계정과 인증 정보를 안전하게 관리해야 합니다.",
            "분철 참여, 결제, 배송 정보 입력으로 발생하는 책임은 회원 본인에게 있습니다.",
          ],
        },
        {
          title: "서비스 변경 및 제한",
          items: [
            "분철이지는 운영상 필요한 경우 서비스의 일부 기능을 변경하거나 일시 중단할 수 있습니다.",
            "부정 이용, 허위 정보 등록, 거래 방해 행위가 확인되면 서비스 이용이 제한될 수 있습니다.",
          ],
        },
      ]}
    />
  );
}
