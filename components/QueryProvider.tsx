"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

// 루트 레이아웃에 상주하는 React Query 클라이언트. 레이아웃은 페이지 이동에도 유지되므로
// 쿼리 캐시가 화면 마운트 수명과 분리된다 — 뒤로가기 복귀 시 첫 렌더부터 캐시 데이터가 있어
// 스켈레톤이 생기지 않고, staleTime 내에는 재요청도 없다.
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 뒤로가기·탭 전환으로 화면을 오가는 동안 캐시가 살아있도록 넉넉히 잡는다.
            gcTime: 30 * 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
