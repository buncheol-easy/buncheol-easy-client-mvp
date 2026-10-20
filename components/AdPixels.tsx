"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const tiktokPixelId = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;

const metaPixelScript = (pixelId: string) => `
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(pixelId)});
fbq('track', 'PageView');
`;

const tiktokPixelScript = (pixelId: string) => `
!function (w, d, t) {
w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
ttq.load(${JSON.stringify(pixelId)});
ttq.page();
}(window, document, 'ttq');
`;

/** 메타·틱톡 픽셀. 픽셀 ID 가 등록된 빌드(prod)에서만 불러온다. */
export function AdPixels() {
  const pathname = usePathname();
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    // 첫 화면의 페이지 조회는 기본 코드가 보낸다. 클라이언트 이동은 픽셀이 모르므로 여기서 보낸다.
    if (previousPathnameRef.current === null) {
      previousPathnameRef.current = pathname;
      return;
    }

    if (previousPathnameRef.current === pathname) {
      return;
    }

    previousPathnameRef.current = pathname;
    window.fbq?.("track", "PageView");
    window.ttq?.page();
  }, [pathname]);

  return (
    <>
      {metaPixelId ? (
        <Script id="meta-pixel" strategy="afterInteractive">
          {metaPixelScript(metaPixelId)}
        </Script>
      ) : null}
      {tiktokPixelId ? (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {tiktokPixelScript(tiktokPixelId)}
        </Script>
      ) : null}
    </>
  );
}
