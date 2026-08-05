// 카카오 지도 JS SDK 로더. 접수처 검색 시트에서만 쓰므로 전역 <Script> 대신
// 필요 시점에 한 번만 주입한다 (autoload=false + kakao.maps.load 콜백 방식).
// 키는 카카오 개발자 콘솔의 JavaScript 키이며, 콘솔에 사이트 도메인 등록이 필요하다.

export type KakaoLatLng = {
  getLat: () => number;
  getLng: () => number;
};

// Size/Point/MarkerImage 는 생성해서 SDK 에 되넘기기만 하므로 형태 없는 불투명 타입으로 둔다.
export type KakaoSize = { __kakaoSize?: never };
export type KakaoPoint = { __kakaoPoint?: never };
export type KakaoMarkerImage = { __kakaoMarkerImage?: never };

export type KakaoMarker = {
  setMap: (map: KakaoMap | null) => void;
  setImage: (image: KakaoMarkerImage) => void;
  setZIndex: (zIndex: number) => void;
};

export type KakaoMap = {
  relayout: () => void;
  setBounds: (bounds: unknown) => void;
  setCenter: (latlng: KakaoLatLng) => void;
  panTo: (latlng: KakaoLatLng) => void;
  setLevel: (level: number) => void;
  getLevel: () => number;
};

export type KakaoMapsSdk = {
  load: (callback: () => void) => void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => { extend: (latlng: KakaoLatLng) => void };
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  Size: new (width: number, height: number) => KakaoSize;
  Point: new (x: number, y: number) => KakaoPoint;
  MarkerImage: new (
    src: string,
    size: KakaoSize,
    options?: { offset?: KakaoPoint },
  ) => KakaoMarkerImage;
  Marker: new (options: {
    position: KakaoLatLng;
    title?: string;
    image?: KakaoMarkerImage;
  }) => KakaoMarker;
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
const LOAD_TIMEOUT_MS = 10000;

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
    // 성공하면 스크립트와 promise 가 캐시로 남고, 실패하면 둘 다 치워 다음 시도에서 재주입한다.
    // (성공 캐시 덕분에 기존 스크립트 태그를 재활용하는 분기는 필요 없다)
    const script = document.createElement("script");
    // load/error 이벤트가 모두 유실되는 환경(응답을 물고 있는 프록시 등)에서
    // 지도 영역이 영영 빈 채로 남지 않게 검색 API 와 동일하게 타임아웃을 건다.
    const timeoutId = window.setTimeout(() => fail(), LOAD_TIMEOUT_MS);

    const fail = () => {
      window.clearTimeout(timeoutId);
      kakaoMapSdkPromise = null;
      script.remove();
      reject(new Error("카카오 지도를 불러오지 못했어요."));
    };

    const handleLoaded = () => {
      const sdk = window.kakao?.maps;

      if (!sdk) {
        fail();
        return;
      }

      window.clearTimeout(timeoutId);
      sdk.load(() => resolve(sdk));
    };

    script.id = KAKAO_MAP_SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.addEventListener("load", handleLoaded);
    script.addEventListener("error", () => fail());

    document.head.appendChild(script);
  });

  return kakaoMapSdkPromise;
}
