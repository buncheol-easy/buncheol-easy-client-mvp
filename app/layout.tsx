import type { Metadata } from "next";
import { DisplayModeClassSync } from "@/components/DisplayModeClassSync";
import { SystemChromeColorSync } from "@/components/SystemChromeColorSync";
import { blackChromeViewport } from "@/lib/system-chrome";
import Script from "next/script";
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

const displayModeInitScript = `
(function () {
  try {
    var isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.navigator.standalone === true;
    var root = document.documentElement;
    var viewportHeight = Math.max(
      window.innerHeight || 0,
      (window.visualViewport && window.visualViewport.height) || 0
    );

    root.classList.toggle("is-pwa-standalone", isStandalone);
    root.classList.toggle("is-browser-tab", !isStandalone);

    if (viewportHeight > 0) {
      root.style.setProperty("--app-viewport-height", viewportHeight + "px");
    }
  } catch (error) {
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Script
          id="display-mode-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: displayModeInitScript }}
        />
        <DisplayModeClassSync />
        <Suspense fallback={null}>
          <SystemChromeColorSync />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
