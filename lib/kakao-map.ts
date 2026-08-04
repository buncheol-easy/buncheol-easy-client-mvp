// 카카오 지도 JS SDK 로더. 접수처 검색 시트에서만 쓰므로 전역 <Script> 대신
// 필요 시점에 한 번만 주입한다 (autoload=false + kakao.maps.load 콜백 방식).
// 키는 카카오 개발자 콘솔의 JavaScript 키이며, 콘솔에 사이트 도메인 등록이 필요하다.

export type KakaoLatLng = {
  getLat: () => number;
  getLng: () => number;
};

export type KakaoMarker = {
  setMap: (map: KakaoMap | null) => void;
};

export type KakaoMap = {
  relayout: () => void;
  setBounds: (bounds: unknown) => void;
  setCenter: (latlng: KakaoLatLng) => void;
  panTo: (latlng: KakaoLatLng) => void;
  setLevel: (level: number) => void;
};

type KakaoMapsSdk = {
  load: (callback: () => void) => void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => { extend: (latlng: KakaoLatLng) => void };
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  Marker: new (options: { position: KakaoLatLng; title?: string }) => KakaoMarker;
  event: {
    addListener: (
      target: unknown,
      type: string,
      handler: (...args: unknown[]) => void,
    ) => void;
  };
};

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsSdk };
  }
}

const KAKAO_MAP_SCRIPT_ID = "kakao-map-sdk";

let kakaoMapSdkPromise: Promise<KakaoMapsSdk> | null = null;

export function getKakaoMapAppKey() {
  return process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY ?? "";
}

export function loadKakaoMapSdk(): Promise<KakaoMapsSdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("카카오 지도는 브라우저에서만 사용할 수 있어요."));
  }

  if (kakaoMapSdkPromise) {
    return kakaoMapSdkPromise;
  }

  const appKey = getKakaoMapAppKey();

  if (!appKey) {
    return Promise.reject(
      new Error("카카오 지도 키가 설정되지 않았어요. (NEXT_PUBLIC_KAKAO_MAP_APP_KEY)"),
    );
  }

  kakaoMapSdkPromise = new Promise<KakaoMapsSdk>((resolve, reject) => {
    // 실패는 캐시하지 않는다 — 다음 시도에서 스크립트를 다시 주입할 수 있게 초기화 후 reject.
    const fail = (script?: HTMLScriptElement) => {
      kakaoMapSdkPromise = null;
      script?.remove();
      reject(new Error("카카오 지도를 불러오지 못했어요."));
    };

    const handleLoaded = () => {
      const sdk = window.kakao?.maps;

      if (!sdk) {
        fail();
        return;
      }

      sdk.load(() => resolve(sdk));
    };

    const existingScript = document.getElementById(
      KAKAO_MAP_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      if (window.kakao?.maps) {
        handleLoaded();
        return;
      }

      existingScript.addEventListener("load", handleLoaded);
      existingScript.addEventListener("error", () => fail(existingScript));
      return;
    }

    const script = document.createElement("script");

    script.id = KAKAO_MAP_SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.addEventListener("load", handleLoaded);
    script.addEventListener("error", () => fail(script));

    document.head.appendChild(script);
  });

  return kakaoMapSdkPromise;
}
