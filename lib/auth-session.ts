import { ApiRequestError, requestTokenReissue } from "@/lib/auth-api";
import {
  clearAuthCookies,
  clearAuthState,
  readAuthState,
  writeAuthTokens,
} from "@/lib/auth-store";

let tokenReissuePromise: Promise<string | null> | null = null;

export function isJwtExpired(token: string) {
  const [, payload] = token.split(".");

  if (!payload) {
    return false;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      "=",
    );
    const atobValue =
      typeof window === "undefined" ? globalThis.atob : window.atob;
    const parsed = JSON.parse(atobValue(paddedPayload)) as {
      exp?: unknown;
    };

    return (
      typeof parsed.exp === "number" &&
      parsed.exp * 1000 <= Date.now() + 30_000
    );
  } catch {
    return false;
  }
}

export async function getFreshAccessToken() {
  const authState = readAuthState();

  if (!authState.isLoggedIn || !authState.accessToken) {
    return null;
  }

  if (!isJwtExpired(authState.accessToken)) {
    return authState.accessToken;
  }

  if (!tokenReissuePromise) {
    const reissueSourceToken = authState.accessToken;

    tokenReissuePromise = requestTokenReissue()
      .then(({ accessToken }) => {
        const latestAuthState = readAuthState();

        if (latestAuthState.accessToken !== reissueSourceToken) {
          return latestAuthState.isLoggedIn ? latestAuthState.accessToken : null;
        }

        writeAuthTokens({ accessToken });
        return accessToken;
      })
      .catch((error: unknown) => {
        if (
          error instanceof ApiRequestError &&
          [400, 401, 403].includes(error.status)
        ) {
          const latestAuthState = readAuthState();

          if (latestAuthState.accessToken === reissueSourceToken) {
            clearAuthCookies();
            clearAuthState();
          }

          return null;
        }

        throw error;
      })
      .finally(() => {
        tokenReissuePromise = null;
      });
  }

  return tokenReissuePromise;
}
