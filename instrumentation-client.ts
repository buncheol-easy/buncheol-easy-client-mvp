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
    // 🔴 로그인 콜백은 액세스 토큰을 URL 프래그먼트(#accessToken=…)로 받는다. 초기 페이지뷰는
    // 콜백 컴포넌트의 replaceState 보다 먼저 캡처될 수 있으므로, 발송 직전에 어느 속성에든 실린
    // 토큰 값을 지운다. 프래그먼트 전체를 자르면 제목 해시태그(#멤버명)까지 다치므로 토큰만 겨냥한다.
    before_send: (event) => {
      if (event?.properties) {
        for (const key of Object.keys(event.properties)) {
          const value = event.properties[key];
          if (typeof value === "string" && value.includes("accessToken")) {
            event.properties[key] = value.replace(
              /accessToken=[^&#\s]+/g,
              "accessToken=REDACTED",
            );
          }
        }
      }
      return event;
    },
  });
}
