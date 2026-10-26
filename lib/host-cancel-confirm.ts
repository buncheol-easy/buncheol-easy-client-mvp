import { isBuncheolCancelledStatus } from "@/lib/buncheol-states";

// 개최자 분철 취소(DELETE /v1/buncheols/{id}) 문구 — 개최 목록 카드와 상세 휴지통이 같이 쓴다.
// 이미 취소된(인원 미달) 분철은 서버가 목록에서 숨기기만 하고 참여자 알림을 다시 보내지 않아
// 「취소」가 아니라 「삭제」로 묻는다. 입금 단계가 시작된 회원 개최 분철은 개최자가 지울 수 없어
// (서버 BCH-126, 운영진 파기) 이 창이 뜨지 않는다.

type HostCancelTarget = {
  status?: string | null;
};

export type HostCancelCopy = {
  // 카드 버튼과 확인 창 확인 버튼
  actionLabel: string;
  description: string;
  // 상세 휴지통 아이콘의 aria-label
  iconLabel: string;
  successMessage: string;
  title: string;
  warnings: string[];
};

export const HOST_CANCEL_FAILURE_MESSAGE =
  "분철을 취소하지 못했어요. 잠시 후 다시 시도해 주세요.";

export function getHostCancelCopy({ status }: HostCancelTarget): HostCancelCopy {
  if (isBuncheolCancelledStatus(status)) {
    return {
      actionLabel: "삭제",
      description: "이미 취소된 분철이에요. 참여자에게 알림이 다시 가지 않아요.",
      iconLabel: "분철 삭제",
      successMessage: "목록에서 지웠어요.",
      title: "목록에서 지울까요?",
      warnings: ["지운 분철은 되돌릴 수 없어요."],
    };
  }

  return {
    actionLabel: "분철 취소",
    description:
      "신청한 참여자가 있으면 신청이 모두 취소되고, 참여자에게 취소 알림톡이 가요.",
    iconLabel: "분철 취소",
    successMessage: "분철을 취소했어요.",
    title: "분철을 취소할까요?",
    warnings: ["취소한 분철은 목록에서 사라지고 되돌릴 수 없어요."],
  };
}
