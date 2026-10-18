import type { Viewport } from "next";

// 완전한 검정(#000) 대신 쓰는 거의 검정. globals.css 의 --color-black 과 같은 값이어야 헤더와 시스템 바 사이에 경계가 안 보인다.
export const chromeBlack = "#111111";

export const blackChromeViewport: Viewport = {
  themeColor: chromeBlack,
  viewportFit: "cover",
};

export const whiteChromeViewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
};
