import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { DesktopBrandPanel } from "@/components/DesktopBrandPanel";
import { DisplayModeClassSync } from "@/components/DisplayModeClassSync";
import { JsonLd } from "@/components/JsonLd";
import { QueryProvider } from "@/components/QueryProvider";
import { SystemChromeColorSync } from "@/components/SystemChromeColorSync";
import { TestAccountSwitcher } from "@/components/TestAccountSwitcher";
import { SITE_URL, X_PROFILE_URL } from "@/lib/site";
import { blackChromeViewport } from "@/lib/system-chrome";
import { Suspense } from "react";
import "./globals.css";

const siteDescription =
  "최애 포토카드, 멤버별로 나눠 사는 분철을 쉽고 안전하게. 분철이지에서 진행 중인 분철에 참여하고 입금 확인부터 편의점 택배 수령까지 한 화면에서 확인하세요.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "분철이지",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "분철이지",
  },
  manifest: "/manifest.webmanifest",
  title: {
    default: "분철이지 | 최애 포카 분철 모집부터 입금·배송까지 한 번에",
    template: "%s | 분철이지",
  },
  description: siteDescription,
  openGraph: {
    type: "website",
    siteName: "분철이지",
    locale: "ko_KR",
    title: "분철이지 | 최애 포카 분철 모집부터 입금·배송까지 한 번에",
    description: siteDescription,
    images: ["/brand/logo-black.png"],
  },
  twitter: {
    card: "summary_large_image",
  },
  verification: {
    // 네이버 서치어드바이저 소유확인 (2026-08-06)
    other: {
      "naver-site-verification": "99016790832a49d51e3ae3f91a69e31883816655",
    },
  },
};

// 사업자 정보는 components/BusinessFooter.tsx 의 표기와 동일하게 유지한다.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "분철이지",
      alternateName: "Buncheol Easy",
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/brand/logo-black.png`,
      description:
        "K-POP 앨범·굿즈 분철(멤버별 나눔구매) 신청과 관리를 돕는 서비스. 분철이지가 직접 개최하는 분철은 분철이지가 통신판매 당사자로서 거래·청약철회·환불 책임을 부담하며, 회원이 개최하는 분철은 분철이지가 통신판매중개자로서 거래 당사자가 아닙니다.",
      taxID: "731-62-00820",
      identifier: {
        "@type": "PropertyValue",
        name: "통신판매업 신고번호",
        value: "2026-대전서구-0940",
      },
      address: {
        "@type": "PostalAddress",
        streetAddress: "문정로90번길 65, 6층 602-S109호",
        addressLocality: "대전광역시 서구",
        addressCountry: "KR",
      },
      email: "teameasy024@gmail.com",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        email: "teameasy024@gmail.com",
        areaServed: "KR",
        availableLanguage: ["Korean"],
      },
      sameAs: ["https://pf.kakao.com/_LqxnGX", X_PROFILE_URL],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: "분철이지",
      inLanguage: "ko",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export const viewport = blackChromeViewport;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <body
        className="desktop-web-shell min-h-full flex flex-col"
        suppressHydrationWarning
      >
        <DisplayModeClassSync />
        <Suspense fallback={null}>
          <SystemChromeColorSync />
        </Suspense>
        <QueryProvider>{children}</QueryProvider>
        {/* 장식 패널이지만 X 링크가 포커스를 받으므로 main 뒤에 둔다 — 앞에 두면 모든
            라우트의 첫 Tab 이 이 링크에 걸린다. 화면상 위치는 grid-column 으로 되돌린다. */}
        <DesktopBrandPanel />
        <TestAccountSwitcher />
        <JsonLd data={organizationJsonLd} />
      </body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  );
}
