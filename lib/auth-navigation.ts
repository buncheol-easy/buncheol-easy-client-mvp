type LoginHrefOptions = {
  cancelTo?: string;
  returnTo: string;
};

function getFirstValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

export function getSafeInternalHref(value: unknown, fallback: string) {
  const candidate = getFirstValue(value);

  return typeof candidate === "string" &&
    candidate.startsWith("/") &&
    !candidate.startsWith("//")
    ? candidate
    : fallback;
}

export function getOptionalSafeInternalHref(value: unknown) {
  const candidate = getFirstValue(value);

  return typeof candidate === "string" &&
    candidate.startsWith("/") &&
    !candidate.startsWith("//")
    ? candidate
    : undefined;
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
