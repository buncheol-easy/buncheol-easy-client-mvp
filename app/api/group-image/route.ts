const allowedImageHosts = new Set([
  "buncheol-easy-bucket.s3.ap-northeast-2.amazonaws.com",
  "buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
  "staging-buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
]);
const allowedPathPrefix = "/idol-groups/";

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
    !parsedImageUrl.pathname.startsWith(allowedPathPrefix)
  ) {
    return new Response("Image url is not allowed", { status: 400 });
  }

  const upstreamResponse = await fetch(parsedImageUrl, {
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    return new Response("Image not found", { status: upstreamResponse.status });
  }

  return new Response(upstreamResponse.body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "Content-Type":
        upstreamResponse.headers.get("content-type") ?? "image/svg+xml",
    },
  });
}
