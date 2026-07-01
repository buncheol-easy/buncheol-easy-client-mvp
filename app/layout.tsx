import type { Metadata } from "next";
import Image from "next/image";
import { DisplayModeClassSync } from "@/components/DisplayModeClassSync";
import { SystemChromeColorSync } from "@/components/SystemChromeColorSync";
import { TestAccountSwitcher } from "@/components/TestAccountSwitcher";
import { blackChromeViewport } from "@/lib/system-chrome";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "분철.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "분철.",
  },
  manifest: "/manifest.webmanifest",
  title: "분철. | 최애 포카 분철 홈",
  description: "최애 포토카드를 멤버별로 나눠 사고 모으는 모바일 웹앱 홈 화면",
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
            <Image
              alt="분철이지"
              height={72}
              priority
              src="/brand/logo-black.png"
              width={224}
            />
          </div>
          <div>
            <p className="desktop-web-brand__eyebrow">BUNCHEOL EASY</p>
            <h1 className="desktop-web-brand__title">
              최애 포카 분철을
              <br />
              더 쉽고 빠르게.
            </h1>
            <p className="desktop-web-brand__body">
              모바일 앱 흐름은 그대로 두고, 웹에서는 분철 현황과 입금 안내를
              더 안정적인 프레임 안에서 확인할 수 있어요.
            </p>
          </div>
          <div className="desktop-web-brand__chips" aria-hidden="true">
            <span>공동구매</span>
            <span>계좌이체</span>
            <span>편의점 택배</span>
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
        {children}
        <TestAccountSwitcher />
      </body>
    </html>
  );
}
