const defaultApiBaseUrl = "http://13.124.248.60";

type AccessTokenResponse = {
  accessToken: string;
};

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
    defaultApiBaseUrl
  );
}

export function getKakaoAuthorizationUrl() {
  return `${getApiBaseUrl()}/oauth2/authorization/kakao`;
}

async function parseErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: unknown };

    return typeof body.message === "string" ? body.message : response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function requestLogout(accessToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/logout`, {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    method: "POST",
  });

  if (!response.ok && response.status !== 401) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function requestTokenReissue() {
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/reissue-token`, {
    credentials: "include",
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as AccessTokenResponse;
}
