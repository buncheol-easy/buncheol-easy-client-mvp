import type { NextConfig } from "next";

// 서버 경로(사이트맵·홈 프리페치·상세 메타)는 이 값이 비면 staging 폴백을 탄다.
// 프로덕션 이미지 빌드에서 빌드 인자가 누락되면 staging 데이터가 구워지므로 경고를 남긴다.
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_API_BASE_URL) {
  console.warn(
    "[build] NEXT_PUBLIC_API_BASE_URL 이 비어 있습니다 — 서버 fetch 가 staging 폴백으로 동작합니다. 프로덕션 빌드라면 빌드 인자를 확인하세요.",
  );
}

// lib/optimizable-image.ts 의 판정 목록과 같아야 한다 — 어긋나면 next/image 가 개발에서 throw, 프로덕션에서 400 을 낸다.
// 이 파일은 다른 파일을 import 하지 않는다: Dockerfile runner 단계가 next.config.ts 한 파일만 복사하고 런타임에도 이 파일을 읽는다.
// 같은 이유로 환경별로 버킷을 나누지 않는다(런타임 컨테이너에는 빌드 env 가 없다).
const OPTIMIZED_IMAGE_HOSTS = [
  "buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
  "staging-buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
];
const OPTIMIZED_IMAGE_PATHNAMES = ["/buncheols/**", "/notices/**", "/idol-groups/**"];

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "50mb",
  },
  allowedDevOrigins: [
    "127.0.0.1",
    "192.168.219.101",
    "172.30.6.71",
    "*.trycloudflare.com",
  ],
  images: {
    remotePatterns: OPTIMIZED_IMAGE_HOSTS.flatMap((hostname) =>
      OPTIMIZED_IMAGE_PATHNAMES.map((pathname) => ({
        protocol: "https" as const,
        hostname,
        port: "",
        pathname,
        // 비워 두지 않으면 `?x=1`·`?x=2` 처럼 쿼리만 바꾼 주소마다 새로 변환·저장된다.
        search: "",
      })),
    ),
    // 기본값은 기동 때 남은 디스크의 50% 다. 서버 디스크를 다른 컨테이너와 같이 쓰므로 상한을 고정한다.
    maximumDiskCacheSize: 256_000_000,
  },
};

export default nextConfig;
