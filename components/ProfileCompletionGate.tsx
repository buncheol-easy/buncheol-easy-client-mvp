"use client";

import { useProfileCompletionGuard } from "@/lib/use-profile-completion-guard";

// 루트 레이아웃에서 전역으로 가입 미완료 가드를 실행하는 렌더리스 컴포넌트.
// 제외 경로 판단은 훅 내부(EXCLUDED_PATH_PREFIXES)에서 한다.
export function ProfileCompletionGate() {
  useProfileCompletionGuard();

  return null;
}
