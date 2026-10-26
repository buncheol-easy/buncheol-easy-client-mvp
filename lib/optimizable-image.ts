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
