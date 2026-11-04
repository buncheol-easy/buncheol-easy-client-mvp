import type { NextConfig } from "next";

// 서버 경로(사이트맵·홈 프리페치·상세 메타)는 이 값이 비면 staging 폴백을 탄다.
// 프로덕션 이미지 빌드에서 빌드 인자가 누락되면 staging 데이터가 구워지므로 경고를 남긴다.
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_API_BASE_URL) {
  console.warn(
    "[build] NEXT_PUBLIC_API_BASE_URL 이 비어 있습니다 — 서버 fetch 가 staging 폴백으로 동작합니다. 프로덕션 빌드라면 빌드 인자를 확인하세요.",
  );
}

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
    // lib/image-hosts.ts 와 같은 목록. ⚠️ 여기서 import 하지 말 것 — Docker 실행 단계가 이 파일만 복사한다.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.buncheoleasy.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "buncheol-easy-bucket.s3.ap-northeast-2.amazonaws.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
