type LoginHrefOptions = {
  cancelTo?: string;
  returnTo: string;
};

function getFirstValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

const internalHrefProbeOrigin = "https://internal-href-check.invalid";

// "/\evil.com"이나 "/\t/evil.com"은 URL 해석 시 백슬래시·제어문자가 정규화되어
// "//evil.com" 같은 외부 이동이 되므로, 문자열 검사에 더해 실제 URL 파서로
// 원점(origin)이 유지되는지까지 확인한다.
function isSafeInternalHref(candidate: unknown): candidate is string {
  if (
    typeof candidate !== "string" ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return false;
  }

  try {
    return (
      new URL(candidate, internalHrefProbeOrigin).origin ===
      internalHrefProbeOrigin
    );
  } catch {
    return false;
  }
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
