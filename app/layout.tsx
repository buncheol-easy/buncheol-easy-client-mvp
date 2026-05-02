import type { Metadata } from "next";
import { DisplayModeClassSync } from "@/components/DisplayModeClassSync";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <DisplayModeClassSync />
        {children}
      </body>
    </html>
  );
}
