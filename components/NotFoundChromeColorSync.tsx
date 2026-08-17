"use client";

import { useEffect } from "react";
import { applyChromeColors } from "@/components/SystemChromeColorSync";

// SystemChromeColorSync 는 pathname 기준이라 404 여부를 모른다 — 검은 크롬 경로의 하위
// 미매칭 URL(/search/없는경로 등)에서 404 가 뜨면 흰 화면 위에 검은 주소창/상태바가 남는다.
// 404 화면이 마운트되면 흰색으로 강제한다. (형제인 SystemChromeColorSync 의 effect 가
// 문서 순서상 먼저 실행되므로 이 값이 최종 적용된다)
export function NotFoundChromeColorSync() {
  useEffect(() => {
    applyChromeColors("#ffffff", "#ffffff");
  }, []);

  return null;
}
