// next.config.ts images.remotePatterns 와 같은 목록이어야 한다. next.config.ts 는 이 파일을 import 할 수
// 없어서(Dockerfile runner 단계가 그 파일만 복사) 두 곳에 따로 적는다. 목록 밖 주소를 next/image 로
// 최적화하면 개발에서는 throw, 프로덕션에서는 400 이 나므로, 밖이면 원본을 그대로 그린다.
const OPTIMIZABLE_IMAGE_HOSTS = new Set([
  "buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
  "staging-buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
]);
const OPTIMIZABLE_IMAGE_PATH_PREFIXES = ["/buncheols/", "/notices/", "/idol-groups/"];

// 넓은 카드와 상세 캐러셀은 같은 값이어야 한다 — 같은 변환 주소를 받아야 목록에서 상세로 들어갈 때
// 첫 사진이 브라우저 캐시에서 바로 뜬다. 398px 상한의 근거는 HomeContent 의 HOME_BANNER_IMAGE_SIZES.
export const PRODUCT_WIDE_IMAGE_SIZES =
  "(min-width: 462px) 398px, calc(100vw - 2rem)";
export const PRODUCT_GRID_IMAGE_SIZES =
  "(min-width: 462px) 191px, calc(50vw - 1.5rem)";

function isSvgPath(pathname: string) {
  return pathname.toLowerCase().endsWith(".svg");
}

export function isOptimizableImageSrc(src: string) {
  if (src.startsWith("/") && !src.startsWith("//")) {
    return !src.includes("?") && !isSvgPath(src);
  }

  let url: URL;

  try {
    url = new URL(src);
  } catch {
    return false;
  }

  return (
    url.protocol === "https:" &&
    url.port === "" &&
    url.search === "" &&
    OPTIMIZABLE_IMAGE_HOSTS.has(url.hostname) &&
    OPTIMIZABLE_IMAGE_PATH_PREFIXES.some((prefix) =>
      url.pathname.startsWith(prefix),
    ) &&
    !isSvgPath(url.pathname)
  );
}

const GROUP_IMAGE_RELAY_PATHNAME = "/api/group-image";
const GROUP_IMAGE_PATH_PREFIX = "/idol-groups/";
const RELAY_PARSE_BASE = "http://relay.invalid";

// 멤버 사진은 auth-api 가 `/api/group-image?url=<S3>` 중계 주소로 바꿔 준다. 쿼리가 url 하나뿐인 그 주소만 풀어 준다.
function unwrapGroupImageRelaySrc(src: string) {
  if (!src.startsWith("/") || src.startsWith("//")) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(src, RELAY_PARSE_BASE);
  } catch {
    return null;
  }

  const queryKeys = [...url.searchParams.keys()];

  if (
    url.origin !== RELAY_PARSE_BASE ||
    url.pathname !== GROUP_IMAGE_RELAY_PATHNAME ||
    url.hash !== "" ||
    queryKeys.length !== 1 ||
    queryKeys[0] !== "url"
  ) {
    return null;
  }

  return url.searchParams.get("url");
}

function isGroupImageSrc(src: string) {
  try {
    return new URL(src).pathname.startsWith(GROUP_IMAGE_PATH_PREFIX);
  } catch {
    return false;
  }
}

/**
 * next/image 로 변환해 받을 주소. null 이면 받은 주소를 원본 그대로 그린다.
 * 중계를 건너뛰어도 #259 의 보호는 유지된다 — 변환기는 그림이 아니거나 svg 인 응답을 400 으로 거절한다.
 */
export function getOptimizedImageSrc(src: string) {
  const relayedSrc = unwrapGroupImageRelaySrc(src);

  if (relayedSrc !== null) {
    return isGroupImageSrc(relayedSrc) && isOptimizableImageSrc(relayedSrc)
      ? relayedSrc
      : null;
  }

  return isOptimizableImageSrc(src) ? src : null;
}
