const defaultApiBaseUrl = "https://buncheoleasy.com";
const legacyApiBaseUrlPattern = /^https?:\/\/13\.124\.248\.60(?:\/v1)?$/;

function getBackendApiRootUrl() {
  const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(
    /\/+$/,
    "",
  );

  if (
    !configuredApiBaseUrl ||
    legacyApiBaseUrlPattern.test(configuredApiBaseUrl)
  ) {
    return defaultApiBaseUrl;
  }

  return configuredApiBaseUrl.replace(/\/v1$/, "");
}

function getForwardHeaders(request: Request) {
  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const accept = request.headers.get("accept");
  const contentType = request.headers.get("content-type");
  const cookie = request.headers.get("cookie");

  if (authorization) {
    headers.set("authorization", authorization);
  }

  if (accept) {
    headers.set("accept", accept);
  }

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (cookie) {
    headers.set("cookie", cookie);
  }

  return headers;
}

async function proxyBackendRequest(
  request: Request,
  context: { params: Promise<{ path: string[] }> | { path: string[] } },
) {
  const params = await context.params;
  const requestUrl = new URL(request.url);
  const targetUrl = new URL(
    `/${params.path.join("/")}`,
    getBackendApiRootUrl(),
  );
  targetUrl.search = requestUrl.search;

  const init: RequestInit = {
    headers: getForwardHeaders(request),
    method: request.method,
    redirect: "manual",
  };

  const hasRequestBody =
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.body !== null;

  if (hasRequestBody) {
    init.body = await request.arrayBuffer();
  }

  const upstreamResponse = await fetch(targetUrl, init);
  const responseHeaders = new Headers(upstreamResponse.headers);

  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  responseHeaders.set("Access-Control-Allow-Origin", requestUrl.origin);
  responseHeaders.set("Vary", "Origin");

  return new Response(upstreamResponse.body, {
    headers: responseHeaders,
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
  });
}

export const GET = proxyBackendRequest;
export const POST = proxyBackendRequest;
export const PUT = proxyBackendRequest;
export const PATCH = proxyBackendRequest;
export const DELETE = proxyBackendRequest;
