import posthog from "posthog-js";

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
  });
}
