type LoginHrefOptions = {
  cancelTo?: string;
  returnTo: string;
};

function getFirstValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

// "/\evil.com"은 URL 해석 시 백슬래시가 슬래시로 정규화되어 "//evil.com"과
// 같은 외부 이동이 되므로, 백슬래시가 섞인 경로도 내부 경로로 취급하지 않는다.
function isSafeInternalHref(candidate: unknown): candidate is string {
  return (
    typeof candidate === "string" &&
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("\\")
  );
}

export function getSafeInternalHref(value: unknown, fallback: string) {
  const candidate = getFirstValue(value);

  return isSafeInternalHref(candidate) ? candidate : fallback;
}

export function getOptionalSafeInternalHref(value: unknown) {
  const candidate = getFirstValue(value);

  return isSafeInternalHref(candidate) ? candidate : undefined;
}

export function createLoginHref({ cancelTo, returnTo }: LoginHrefOptions) {
  const searchParams = new URLSearchParams({ returnTo });

  if (cancelTo) {
    searchParams.set("cancelTo", cancelTo);
  }

  return `/login?${searchParams.toString()}`;
}

export function getCurrentBrowserHref(fallback = "/") {
  if (typeof window === "undefined") {
    return fallback;
  }

  return getSafeInternalHref(
    `${window.location.pathname}${window.location.search}`,
    fallback,
  );
}
