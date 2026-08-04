import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // 로그인 전용 경로는 disallow 대신 각 페이지의 noindex 메타로 막는다.
  // (robots.txt 로 크롤링을 막으면 크롤러가 noindex 태그 자체를 못 본다.)
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
    sitemap: "https://buncheoleasy.com/sitemap.xml",
  };
}
