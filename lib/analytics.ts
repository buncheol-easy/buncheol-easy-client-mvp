import { sendGAEvent } from "@next/third-parties/google";
import posthog from "posthog-js";

// ⚠️ PII 금지: 이벤트 속성에는 id·수량 등 비민감 값만 담는다.
// 계좌번호·주소·전화번호·이름 등은 절대 넣지 않는다.

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: {
      page: () => void;
      track: (event: string, properties?: Record<string, unknown>) => void;
    };
  }
}

const isAnalyticsEnabled =
  typeof window !== "undefined" && Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

type AdConversion = "sign_up" | "add_to_wishlist" | "join_buncheol";

// 광고 플랫폼은 표준 이벤트 이름이어야 그 이벤트로 광고를 최적화할 수 있다.
const adConversionEventNames: Record<
  AdConversion,
  { meta: string; tiktok: string }
> = {
  sign_up: { meta: "CompleteRegistration", tiktok: "CompleteRegistration" },
  add_to_wishlist: { meta: "AddToWishlist", tiktok: "AddToWishlist" },
  join_buncheol: { meta: "InitiateCheckout", tiktok: "InitiateCheckout" },
};

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

/** 가입 완료를 PostHog 와 광고 전환에 함께 남긴다. 로그인 콜백과 추가정보 화면 중 가입이 끝난 한 곳에서만 부른다. */
export function trackSignupCompleted(properties: { profile_form: boolean }) {
  trackEvent("signup_completed", properties);
  trackAdConversion("sign_up");
}

/** 광고 성과 측정용 전환을 GA4·메타·틱톡에 함께 보낸다. 태그가 없는 곳은 건너뛴다. */
export function trackAdConversion(
  conversion: AdConversion,
  properties?: Record<string, string | number>,
) {
  if (typeof window === "undefined") {
    return;
  }

  const eventNames = adConversionEventNames[conversion];

  if (process.env.NEXT_PUBLIC_GA_ID) {
    sendGAEvent("event", conversion, properties ?? {});
  }

  window.fbq?.("track", eventNames.meta);
  window.ttq?.track(eventNames.tiktok);
}
