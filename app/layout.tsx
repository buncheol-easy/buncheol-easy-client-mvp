import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import Image from "next/image";
import { DisplayModeClassSync } from "@/components/DisplayModeClassSync";
import { JsonLd } from "@/components/JsonLd";
import { QueryProvider } from "@/components/QueryProvider";
import { SystemChromeColorSync } from "@/components/SystemChromeColorSync";
import { TestAccountSwitcher } from "@/components/TestAccountSwitcher";
import { SITE_URL } from "@/lib/site";
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
        "K-POP 앨범·굿즈 분철(멤버별 나눔구매) 신청과 관리를 돕는 서비스. 분철이지는 통신판매 당사자로서 판매되는 분철 상품의 거래·청약철회·환불 책임을 직접 부담합니다.",
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
      sameAs: ["https://pf.kakao.com/_LqxnGX"],
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
        <aside className="desktop-web-brand" aria-label="분철이지 웹 소개">
          <div className="desktop-web-brand__logo">
            {/* 데스크톱 전용 장식 로고 — priority 를 주면 모바일에서도 preload 되어 LCP 대역폭을 뺏는다. */}
            <Image
              alt="분철이지"
              height={72}
              src="/brand/logo-black.png"
              width={224}
            />
          </div>
          <div>
            <p className="desktop-web-brand__eyebrow">BUNCHEOL EASY</p>
            {/* 페이지별 h1 과 중복되지 않도록 데스크톱 장식 태그라인은 제목 요소를 쓰지 않는다. */}
            <p className="desktop-web-brand__title">
              최애 포카 분철,
              <br />
              이제 분철이지.
            </p>
            <p className="desktop-web-brand__body">
              멤버별 모집부터 입금 안내, 편의점 배송까지 복잡한 분철을
              한 화면에서 깔끔하게 관리해요.
            </p>
          </div>
          <div className="desktop-web-brand__chips" aria-hidden="true">
            <span>빠른 모집</span>
            <span>안심 입금</span>
            <span>편의점 배송</span>
            <span>분철 관리</span>
          </div>
          <div className="desktop-web-brand__visual" aria-hidden="true">
            <div className="desktop-web-brand__card desktop-web-brand__card--dark">
              <span>LIVE</span>
              <strong>IVE · 안유진</strong>
            </div>
            <div className="desktop-web-brand__thumb desktop-web-brand__thumb--front">
              <Image
                alt=""
                fill
                sizes="180px"
                src="/intro-products/ive-main.png"
              />
            </div>
            <div className="desktop-web-brand__thumb desktop-web-brand__thumb--back">
              <Image
                alt=""
                fill
                sizes="160px"
                src="/intro-products/riize-main.png"
              />
            </div>
          </div>
        </aside>
        <QueryProvider>{children}</QueryProvider>
        <TestAccountSwitcher />
        <JsonLd data={organizationJsonLd} />
      </body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  );
}
