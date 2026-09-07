import posthog from "posthog-js";
import { AUTH_TOKEN_REDACT_PATTERN } from "@/lib/auth-token-param";

function redactTokens(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(AUTH_TOKEN_REDACT_PATTERN, "accessToken=REDACTED");
  }
  if (Array.isArray(value)) {
    return value.map(redactTokens);
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      (value as Record<string, unknown>)[key] = redactTokens(child);
    }
  }
  return value;
}

// Next.js 16 client instrumentation: runs once after the document loads and
// before hydration, so PostHog is ready before any user interaction.
// Pageviews (initial + SPA route changes) are captured automatically via
// `capture_pageview: "history_change"`, so no provider/Suspense wiring is needed.
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    person_profiles: "identified_only",
    // PII 보호: DOM 폼(계좌·주소·연락처) 자동수집을 끄고, 필요한 이벤트만 수동 capture.
    autocapture: false,
    // App Router의 history API 변경마다 자동으로 $pageview 캡처(초기 로드 포함).
    capture_pageview: "history_change",
    // 🔴 로그인 콜백은 액세스 토큰을 URL 프래그먼트(#accessToken=…)로 받는다. 초기 페이지뷰와
    // identify($set_once 의 초기 URL)는 콜백의 replaceState 보다 먼저 나갈 수 있으므로, 발송
    // 직전에 페이로드 전체를 재귀로 훑어 토큰 값을 지운다 — $set/$set_once 는 properties 의
    // 형제이고 $initial_person_info 같은 중첩 객체에도 URL 이 실린다. 프래그먼트 전체를 자르면
    // 제목 해시태그(#멤버명)까지 다치므로 토큰만 겨냥한다.
    before_send: (event) => (event ? (redactTokens(event) as typeof event) : event),
  });
}
