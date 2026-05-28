import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "192.168.219.101",
    "172.30.6.71",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
