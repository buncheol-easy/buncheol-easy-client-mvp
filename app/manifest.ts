import type { MetadataRoute } from "next";
import { chromeBlack } from "@/lib/system-chrome";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "분철이지",
    short_name: "분철이지",
    description: "최애 포토카드를 멤버별로 나눠 사고 모으는 분철 서비스",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: chromeBlack,
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
