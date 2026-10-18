const allowedImageHosts = new Set([
  "buncheol-easy-bucket.s3.ap-northeast-2.amazonaws.com",
  "buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
  "staging-buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
]);
const allowedPathPrefixes = ["/idol-groups/", "/buncheols/"];
// 그룹 로고 대부분이 SVG 라 SVG 는 그룹 이미지 경로에서만 허용한다.
const vectorImagePathPrefix = "/idol-groups/";

// S3 가 형식을 비워 두거나 octet-stream 으로 줄 때만 확장자로 판단한다.
const untypedContentTypes = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
]);
const contentTypeByExtension = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["gif", "image/gif"],
  ["avif", "image/avif"],
  ["svg", "image/svg+xml"],
]);
// image/<하위형식> 한 개로 읽히는 값만 그림으로 인정한다.
const imageContentTypePattern = /^image\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

// 그림이 아닌 형식이 앱 주소에서 문서로 열리지 않게 하고, 그림이 문서로 열려도 스크립트는 돌지 않게 한다.
const imageResponseSecurityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "script-src 'none'; frame-src 'none'; sandbox;",
};

function isVectorImageType(contentType: string) {
  const subtype = contentType.slice("image/".length);
  return subtype.includes("svg") || subtype.includes("xml");
}

function getContentTypeFromExtension(pathname: string) {
  const fileName = pathname.slice(pathname.lastIndexOf("/") + 1);
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex < 0) {
    return null;
  }

  return (
    contentTypeByExtension.get(fileName.slice(dotIndex + 1).toLowerCase()) ??
    null
  );
}

function resolveImageContentType(
  upstreamContentType: string | null,
  pathname: string,
) {
  const normalizedContentType = (upstreamContentType ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  const contentType = untypedContentTypes.has(normalizedContentType)
    ? getContentTypeFromExtension(pathname)
    : imageContentTypePattern.test(normalizedContentType)
      ? normalizedContentType
      : null;

  if (
    !contentType ||
    (isVectorImageType(contentType) &&
      !pathname.startsWith(vectorImagePathPrefix))
  ) {
    return null;
  }

  return contentType;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const imageUrl = requestUrl.searchParams.get("url");

  if (!imageUrl) {
    return new Response("Missing image url", { status: 400 });
  }

  let parsedImageUrl: URL;

  try {
    parsedImageUrl = new URL(imageUrl);
  } catch {
    return new Response("Invalid image url", { status: 400 });
  }

  if (
    parsedImageUrl.protocol !== "https:" ||
    !allowedImageHosts.has(parsedImageUrl.hostname) ||
    !allowedPathPrefixes.some((prefix) =>
      parsedImageUrl.pathname.startsWith(prefix),
    )
  ) {
    return new Response("Image url is not allowed", { status: 400 });
  }

  const upstreamResponse = await fetch(parsedImageUrl, {
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    return new Response("Image not found", { status: upstreamResponse.status });
  }

  const contentType = resolveImageContentType(
    upstreamResponse.headers.get("content-type"),
    parsedImageUrl.pathname,
  );

  if (!contentType) {
    upstreamResponse.body.cancel().catch(() => undefined);

    return new Response("Unsupported image type", {
      status: 415,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new Response(upstreamResponse.body, {
    headers: {
      ...imageResponseSecurityHeaders,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "Content-Type": contentType,
    },
  });
}
