import posthog from "posthog-js";

// ⚠️ PII 금지: 이벤트 속성에는 id·수량 등 비민감 값만 담는다.
// 계좌번호·주소·전화번호·이름 등은 절대 넣지 않는다.

const isAnalyticsEnabled =
  typeof window !== "undefined" && Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

function decodeUserIdFromToken(token: string): string | null {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      "=",
    );
    const parsed = JSON.parse(window.atob(paddedPayload)) as { sub?: unknown };

    if (typeof parsed.sub === "string") {
      return parsed.sub;
    }

    if (typeof parsed.sub === "number") {
      return String(parsed.sub);
    }

    return null;
  } catch {
    return null;
  }
}

/** 로그인 시 accessToken의 sub(유저 ID)로 PostHog identify. 서버 이벤트와 distinct_id를 통일한다. */
export function identifyAnalyticsUser(accessToken: string) {
  if (!isAnalyticsEnabled) {
    return;
  }

  const userId = decodeUserIdFromToken(accessToken);

  if (userId) {
    posthog.identify(userId);
  }
}

/** 로그아웃 시 익명 세션으로 리셋. */
export function resetAnalyticsUser() {
  if (!isAnalyticsEnabled) {
    return;
  }

  posthog.reset();
}

/** 커스텀 이벤트 캡처. properties에는 비민감 값만 전달할 것. */
export function trackEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
) {
  if (!isAnalyticsEnabled) {
    return;
  }

  posthog.capture(event, properties);
}
