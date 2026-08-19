"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { SlidingFilterChips } from "@/components/SlidingTabs";
import {
  requestCvsStores,
  type CvsStore,
  type CvsStoreBrand,
} from "@/lib/auth-api";
import {
  getKakaoMapAppKey,
  loadKakaoMapSdk,
  type KakaoMap,
  type KakaoMapsSdk,
  type KakaoMarker,
  type KakaoMarkerImage,
} from "@/lib/kakao-map";

const SHEET_CLOSE_MS = 280;
const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

// 검색 결과가 없을 때 지도의 기본 중심 (서울시청)과 축척.
const DEFAULT_MAP_CENTER = { lat: 37.5665, lng: 126.978 };
const DEFAULT_MAP_LEVEL = 8;

// 브랜드별 커스텀 마커 스펙 (@2x PNG 를 절반 크기로 렌더). 줌 아웃할수록
// pin → mid → dot 로 단순해지고, 선택된 지점은 확대된 pin-selected 로 강조한다.
// offset 은 지도 좌표에 닿는 앵커 — pin 계열은 아래쪽 꼭짓점, 원형은 중심.
const CVS_MARKER_SPECS = {
  dot: { size: { width: 12, height: 12 }, offset: { x: 6, y: 6 } },
  mid: { size: { width: 28, height: 28 }, offset: { x: 14, y: 14 } },
  pin: { size: { width: 40, height: 52 }, offset: { x: 20, y: 51 } },
  "pin-selected": { size: { width: 48, height: 62 }, offset: { x: 24, y: 61 } },
} as const;

type CvsMarkerVariant = keyof typeof CVS_MARKER_SPECS;

// 지도에 올라간 마커와 외형 상태. appliedVariant 는 마지막으로 적용한 이미지로,
// 줌·선택이 바뀌어도 외형이 그대로면 setImage 를 건너뛰기 위한 캐시다.
type CvsMarkerEntry = {
  marker: KakaoMarker;
  brand: CvsStoreBrand;
  appliedVariant: CvsMarkerVariant;
};

// 기본 축척(DEFAULT_MAP_LEVEL=8)은 mid, 지점 선택 시 확대(setLevel(4))는 pin 구간에 해당한다.
function markerVariantForLevel(level: number): CvsMarkerVariant {
  if (level <= 5) {
    return "pin";
  }

  if (level <= 8) {
    return "mid";
  }

  return "dot";
}

function cvsMarkerImageSrc(brand: CvsStoreBrand, variant: CvsMarkerVariant) {
  return `/markers/${brand.toLowerCase()}-${variant}@2x.png`;
}

function createCvsMarkerImage(
  sdk: KakaoMapsSdk,
  brand: CvsStoreBrand,
  variant: CvsMarkerVariant,
) {
  const { size, offset } = CVS_MARKER_SPECS[variant];

  return new sdk.MarkerImage(
    cvsMarkerImageSrc(brand, variant),
    new sdk.Size(size.width, size.height),
    { offset: new sdk.Point(offset.x, offset.y) },
  );
}

// 줌 단계가 바뀔 때 아직 안 받은 PNG 로 setImage 하면 로드가 끝날 때까지 마커가
// 비어 보이므로, 지도를 처음 띄울 때 전 이미지(8종, 합계 ~33KB)를 미리 받아둔다.
let hasPreloadedCvsMarkerImages = false;

function preloadCvsMarkerImages() {
  if (hasPreloadedCvsMarkerImages) {
    return;
  }

  hasPreloadedCvsMarkerImages = true;

  (["GS25", "CU"] as const).forEach((brand) => {
    (Object.keys(CVS_MARKER_SPECS) as CvsMarkerVariant[]).forEach((variant) => {
      new Image().src = cvsMarkerImageSrc(brand, variant);
    });
  });
}

// 결과 좌표가 이보다 넓게 퍼져 있으면(전국 산개) setBounds 를 생략한다 — 전국 축소 뷰는
// 정보가 없고 "검색이 잘못된" 인상만 준다.
const MAX_FIT_SPAN_DEG = 0.5;

type CvsStoreBrandFilter = "all" | CvsStoreBrand;

const brandFilterTabs = [
  { label: "전체", value: "all" },
  { label: "GS25", value: "GS25" },
  { label: "CU", value: "CU" },
] as const;

type CvsStoreSearchSheetProps = {
  // 상품이 취급하는 브랜드로 검색·선택을 제한한다 — 미지정이면 전체 브랜드.
  allowedBrands?: CvsStoreBrand[];
  onClose: () => void;
  onSelect: (store: CvsStore) => void;
};

// 배송지 등록용 편의점 접수처 검색 바텀시트. 키워드(지점명·주소) 검색 + 브랜드 필터 +
// 카카오 지도 마커로 지점을 고른 뒤 "이 지점으로 선택"으로 확정한다.
// 시트 트랜지션은 FeedbackSheet 의 bid-sheet-backdrop/panel 컨벤션을 따른다.
export function CvsStoreSearchSheet({
  allowedBrands,
  onClose,
  onSelect,
}: CvsStoreSearchSheetProps) {
  // 허용 브랜드가 하나뿐이면 필터를 그 브랜드로 고정한다 — 다른 브랜드 지점을 등록해
  // 상품 배송 옵션과 어긋나는 것을 원천 차단 (체크아웃 내 등록 경로).
  const limitedBrand =
    allowedBrands && allowedBrands.length === 1 ? allowedBrands[0] : null;
  const visibleBrandFilterTabs = allowedBrands
    ? brandFilterTabs.filter(
        (tab) =>
          tab.value === "all" ||
          allowedBrands.includes(tab.value as CvsStoreBrand),
      )
    : brandFilterTabs;
  const [isEntered, setIsEntered] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [brandFilter, setBrandFilter] = useState<CvsStoreBrandFilter>(
    limitedBrand ?? "all",
  );
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [stores, setStores] = useState<CvsStore[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [loadMoreError, setLoadMoreError] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapNotice, setMapNotice] = useState(
    getKakaoMapAppKey() ? "" : "지도 키가 설정되지 않아 목록으로만 보여요.",
  );

  const closeTimerRef = useRef<number | null>(null);
  const relayoutTimerRef = useRef<number | null>(null);
  const searchRequestIdRef = useRef(0);
  // 새 검색 결과에 대해 아직 화면 범위를 맞추지 않았는지. SDK 로드가 "더 보기" 이후에
  // 끝나는 경우에도 첫 fit 이 누락되지 않게 append 플래그와 별도로 관리한다.
  const needsFitBoundsRef = useRef(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<Map<string, CvsMarkerEntry>>(new Map());
  // MarkerImage 는 불변·공유 가능하므로 브랜드×단계별로 한 번만 만들어 재사용한다 (최대 8개).
  const markerImagesRef = useRef<Map<string, KakaoMarkerImage>>(new Map());
  // 줌 리스너(React 밖 클로저)에서도 최신 선택값을 읽도록 상태를 미러링한다.
  const selectedStoreIdRef = useRef<string | null>(null);
  // 지도와 목록을 함께 굴리는 스크롤러. 새 검색마다 맨 위로 돌려 지도부터 다시 보여준다.
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const selectedStore = useMemo(
    () => stores.find((store) => store.id === selectedStoreId) ?? null,
    [selectedStoreId, stores],
  );

  const getCvsMarkerImage = useCallback(
    (sdk: KakaoMapsSdk, brand: CvsStoreBrand, variant: CvsMarkerVariant) => {
      const cacheKey = `${brand}-${variant}`;
      let image = markerImagesRef.current.get(cacheKey);

      if (!image) {
        image = createCvsMarkerImage(sdk, brand, variant);
        markerImagesRef.current.set(cacheKey, image);
      }

      return image;
    },
    [],
  );

  // 마커 외형(이미지·zIndex)의 단일 소유자 — 마커 생성 직후·줌 변경·선택 변경 모두
  // 여기로 모은다. 축척은 상태 미러링 대신 호출 시점에 직접 읽어, 같은 flush 안에서
  // setBounds 로 바뀐 레벨도 즉시 반영한다 (잘못된 단계로 한 프레임 그려지는 것 방지).
  const applyMarkerStyles = useCallback(() => {
    const sdk = window.kakao?.maps;
    const map = mapRef.current;

    if (!sdk || !map) {
      return;
    }

    const zoomVariant = markerVariantForLevel(map.getLevel());

    markersRef.current.forEach((entry, storeId) => {
      const variant =
        storeId === selectedStoreIdRef.current ? "pin-selected" : zoomVariant;

      if (entry.appliedVariant === variant) {
        return;
      }

      entry.marker.setImage(getCvsMarkerImage(sdk, entry.brand, variant));
      // 선택 마커가 이웃 마커에 가려지지 않게 앞으로 올린다.
      entry.marker.setZIndex(variant === "pin-selected" ? 2 : 1);
      entry.appliedVariant = variant;
    });
  }, [getCvsMarkerImage]);

  useEffect(() => {
    const enterFrame = window.requestAnimationFrame(() => {
      setIsEntered(true);
    });

    return () => {
      window.cancelAnimationFrame(enterFrame);

      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }

      if (relayoutTimerRef.current !== null) {
        window.clearTimeout(relayoutTimerRef.current);
      }
    };
  }, []);

  function closeSheet() {
    if (isClosing) {
      return;
    }

    setIsClosing(true);
    // onTransitionEnd 가 유실되는 환경(백그라운드 탭 등) 대비 타이머 fallback.
    closeTimerRef.current = window.setTimeout(onClose, SHEET_CLOSE_MS);
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedKeyword(keyword);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [keyword]);

  const searchStores = useCallback(
    async (options: { append?: boolean; cursor?: string | null } = {}) => {
      const requestId = searchRequestIdRef.current + 1;

      searchRequestIdRef.current = requestId;

      if (options.append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      if (options.append) {
        setLoadMoreError("");
      } else {
        setSearchError("");
        setLoadMoreError("");
      }

      try {
        const page = await requestCvsStores({
          brand: brandFilter === "all" ? null : brandFilter,
          cursor: options.cursor ?? null,
          keyword: debouncedKeyword,
          size: PAGE_SIZE,
        });

        if (requestId !== searchRequestIdRef.current) {
          return;
        }

        if (!options.append) {
          needsFitBoundsRef.current = true;
        }
        setStores((current) => {
          // 리스트 key 와 마커 Map 이 모두 id 기준이므로, 응답 안의 중복 id 는
          // 여기서 걸러 두 레이어가 항상 같은 목록을 보게 한다.
          const seenIds = new Set(
            options.append ? current.map((store) => store.id) : [],
          );
          const merged = options.append ? [...current] : [];

          page.items.forEach((store) => {
            if (seenIds.has(store.id)) {
              return;
            }

            seenIds.add(store.id);
            merged.push(store);
          });

          return merged;
        });
        setHasNext(page.hasNext);
        setNextCursor(page.nextCursor);
      } catch (error) {
        if (requestId !== searchRequestIdRef.current) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "지점을 검색하지 못했어요. 잠시 후 다시 시도해 주세요.";

        // 추가 로드 실패로 이미 불러온 목록을 지우지 않는다 — 버튼 자리에서 재시도.
        if (options.append) {
          setLoadMoreError(message);
        } else {
          setSearchError(message);
        }
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [brandFilter, debouncedKeyword],
  );

  // 2자 미만은 검색하지 않는다 — 빈/한 글자 키워드는 전국 목록을 쏟아 정보가 없고 부하만 만든다.
  useEffect(() => {
    setSelectedStoreId(null);
    scrollContainerRef.current?.scrollTo({ top: 0 });

    if (debouncedKeyword.trim().length < 2) {
      searchRequestIdRef.current += 1; // 진행 중이던 검색 무효화
      setStores([]);
      setHasNext(false);
      setNextCursor(null);
      setIsLoading(false);
      setSearchError("");
      return;
    }

    void searchStores();
  }, [debouncedKeyword, searchStores]);

  function loadMoreStores() {
    if (!hasNext || !nextCursor || isLoadingMore || isLoading) {
      return;
    }

    void searchStores({ append: true, cursor: nextCursor });
  }

  // 지도 초기화 — 키가 없거나 로드에 실패해도 목록 검색은 그대로 동작한다.
  useEffect(() => {
    if (!getKakaoMapAppKey()) {
      return;
    }

    let isActive = true;

    loadKakaoMapSdk()
      .then((sdk) => {
        if (!isActive || !mapContainerRef.current || mapRef.current) {
          return;
        }

        const map = new sdk.Map(mapContainerRef.current, {
          center: new sdk.LatLng(DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng),
          level: DEFAULT_MAP_LEVEL,
        });

        mapRef.current = map;
        preloadCvsMarkerImages();
        // 줌 배율이 바뀌면 마커 단계(pin/mid/dot)를 갈아끼운다. 상태를 거치지 않고
        // 직접 호출해 시트 전체 리렌더 없이 바뀐 마커만 갱신한다.
        sdk.event.addListener(map, "zoom_changed", applyMarkerStyles);
        setIsMapReady(true);

        // 시트 진입 트랜지션 종료 후 컨테이너 크기가 확정되므로 한 번 더 relayout.
        relayoutTimerRef.current = window.setTimeout(() => {
          mapRef.current?.relayout();
        }, SHEET_CLOSE_MS + 40);
      })
      .catch((error: unknown) => {
        if (isActive) {
          setMapNotice(
            error instanceof Error
              ? error.message
              : "카카오 지도를 불러오지 못했어요.",
          );
        }
      });

    return () => {
      isActive = false;

      const sdk = window.kakao?.maps;

      // 시트를 여닫을 때마다 map 이 새로 만들어지므로, 버려진 map 이 리스너
      // 클로저를 물고 남지 않게 해제한다.
      if (sdk && mapRef.current) {
        sdk.event.removeListener(
          mapRef.current,
          "zoom_changed",
          applyMarkerStyles,
        );
      }
    };
  }, [applyMarkerStyles]);

  useEffect(() => {
    const sdk = window.kakao?.maps;
    const map = mapRef.current;

    if (!isMapReady || !sdk || !map) {
      return;
    }

    markersRef.current.forEach((entry) => entry.marker.setMap(null));
    markersRef.current = new Map();

    const locatedStores = stores.filter(
      (store) => store.latitude !== null && store.longitude !== null,
    );

    if (locatedStores.length === 0) {
      return;
    }

    const bounds = new sdk.LatLngBounds();
    const zoomVariant = markerVariantForLevel(map.getLevel());

    locatedStores.forEach((store) => {
      const variant =
        store.id === selectedStoreIdRef.current ? "pin-selected" : zoomVariant;
      const position = new sdk.LatLng(store.latitude!, store.longitude!);
      const marker = new sdk.Marker({
        image: getCvsMarkerImage(sdk, store.brand, variant),
        position,
        title: store.name,
        zIndex: variant === "pin-selected" ? 2 : 1,
      });

      marker.setMap(map);
      sdk.event.addListener(marker, "click", () => {
        setSelectedStoreId(store.id);
      });
      bounds.extend(position);
      markersRef.current.set(store.id, {
        appliedVariant: variant,
        brand: store.brand,
        marker,
      });
    });

    map.relayout();

    // 새 검색 결과에 한 번만 화면 범위를 맞춘다 — 추가 로드에서 시점이 튀지 않게.
    // 결과가 전국에 산개해 있으면(span 초과) fit 을 생략하고 현재 시점을 유지한다.
    if (needsFitBoundsRef.current) {
      needsFitBoundsRef.current = false;

      const lats = locatedStores.map((store) => store.latitude!);
      const lngs = locatedStores.map((store) => store.longitude!);
      const latSpan = Math.max(...lats) - Math.min(...lats);
      const lngSpan = Math.max(...lngs) - Math.min(...lngs);

      if (latSpan <= MAX_FIT_SPAN_DEG && lngSpan <= MAX_FIT_SPAN_DEG) {
        map.setBounds(bounds);
      } else {
        // 전국 축소 뷰 대신 첫 결과 주변을 보여준다 — 마커 없는 빈 지도 방지.
        const first = locatedStores[0];

        map.setCenter(new sdk.LatLng(first.latitude!, first.longitude!));
      }
    }

    // fit 으로 축척이 바뀌었을 수 있으므로 이동이 끝난 레벨 기준으로 한 번 보정한다.
    applyMarkerStyles();

    return () => {
      markersRef.current.forEach((entry) => entry.marker.setMap(null));
      markersRef.current = new Map();
    };
  }, [applyMarkerStyles, getCvsMarkerImage, isMapReady, stores]);

  // 선택이 바뀌면 이전 선택 해제·새 선택 강조만 갱신된다 (나머지는 appliedVariant 스킵).
  useEffect(() => {
    selectedStoreIdRef.current = selectedStoreId;
    applyMarkerStyles();
  }, [applyMarkerStyles, selectedStoreId]);

  useEffect(() => {
    const sdk = window.kakao?.maps;
    const map = mapRef.current;

    if (
      !isMapReady ||
      !sdk ||
      !map ||
      !selectedStore ||
      selectedStore.latitude === null ||
      selectedStore.longitude === null
    ) {
      return;
    }

    map.setLevel(4);
    map.panTo(new sdk.LatLng(selectedStore.latitude, selectedStore.longitude));
  }, [isMapReady, selectedStore]);

  function confirmSelection() {
    if (!selectedStore) {
      return;
    }

    onSelect(selectedStore);
    closeSheet();
  }

  return (
    <div
      className={`bid-sheet-backdrop fixed inset-0 z-40 flex items-end ${
        isEntered && !isClosing ? "bid-sheet-backdrop-active" : ""
      }`}
    >
      <button
        aria-label="지점 검색 닫기"
        className="absolute inset-0 cursor-default"
        onClick={closeSheet}
        type="button"
      />
      <section
        className={`bid-sheet-panel relative mx-auto flex h-[88dvh] max-h-[calc(100%-2.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[1.4rem] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.22)] ${
          isEntered && !isClosing ? "bid-sheet-panel-active" : ""
        }`}
        onTransitionEnd={(event) => {
          if (
            isClosing &&
            event.currentTarget === event.target &&
            event.propertyName === "transform"
          ) {
            onClose();
          }
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[21px] font-semibold tracking-[-0.06em]">
              수령 지점 검색
            </h2>
            <p className="mt-1 text-[13px] font-medium text-black/45">
              배송받을 편의점 지점을 지점명이나 주소로 찾아보세요.
            </p>
          </div>
          <button
            aria-label="닫기"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
            onClick={closeSheet}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        {/*
          지도와 목록을 한 스크롤러에 담는다.
          지도를 고정해 두면 작은 화면에서 목록에 한 장 반밖에 안 남았다 (390×667 기준 약 110px).
          지도를 위로 밀어 올릴 수 있게 하되, 검색창과 브랜드 칩은 sticky 로 남긴다 —
          목록을 훑다가 브랜드를 바꾸려고 맨 위까지 되돌아가야 하면 그게 더 나쁘다.
        */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain sheet-scroll"
          ref={scrollContainerRef}
        >
          <div className="sticky top-0 z-10 bg-white pb-2.5 pt-4">
            <div className="flex items-center gap-2 rounded-full bg-[#f4f4f4] px-4 py-1 ring-1 ring-black/5 transition focus-within:ring-black/25">
              <SearchIcon className="h-[18px] w-[18px] shrink-0 text-black/35" />
              <input
                aria-label="지점 검색어"
                className="h-10 w-full bg-transparent text-[14px] font-semibold outline-none placeholder:text-black/30"
                maxLength={100}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="지점명 또는 주소 (예: 강남, 테헤란로)"
                value={keyword}
              />
              {keyword ? (
                <button
                  aria-label="검색어 지우기"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/10 text-black/45"
                  onClick={() => setKeyword("")}
                  type="button"
                >
                  <CloseIcon />
                </button>
              ) : null}
            </div>

            {limitedBrand ? (
              <p className="mt-2.5 rounded-[0.75rem] bg-[#F7FAEE] px-3 py-2 text-[12px] font-semibold text-black/55 ring-1 ring-[#E4F6A5]/60">
                이 분철은 {limitedBrand} 지점으로만 받을 수 있어요.
              </p>
            ) : (
              <div className="mt-2.5">
                <SlidingFilterChips
                  onChange={(value: CvsStoreBrandFilter) =>
                    setBrandFilter(value)
                  }
                  tabs={visibleBrandFilterTabs}
                  value={brandFilter}
                />
              </div>
            )}
          </div>

          {mapNotice ? (
            <p className="rounded-[0.85rem] bg-[#f7f7f7] px-4 py-3 text-[12.5px] font-medium text-black/45">
              {mapNotice}
            </p>
          ) : (
            // 지도는 포인터 전용 보조 수단이라 스크린리더에서는 목록을 정본으로 삼는다.
            <div
              aria-hidden="true"
              /*
               * relative z-0 은 지도가 자체 쌓임 맥락을 갖게 한다 — 카카오 SDK 가 내부 엘리먼트에
               * 큰 z-index 를 붙이는데, 맥락을 가두지 않으면 그게 sticky 검색줄 위로 올라온다.
               */
              className="relative z-0 h-[min(190px,26dvh)] w-full overflow-hidden rounded-[0.95rem] ring-1 ring-black/10"
              ref={mapContainerRef}
            />
          )}

          <div className="mt-3 pb-2">
          {searchError ? (
            <p className="rounded-[0.85rem] bg-[#fff2f2] px-4 py-3 text-[13px] font-semibold leading-5 text-[#c03131]">
              {searchError}
            </p>
          ) : debouncedKeyword.trim().length < 2 ? (
            <div className="rounded-[0.85rem] bg-[#f7f7f7] px-4 py-8 text-center">
              <p className="text-[14px] font-semibold text-black/55">
                자주 가는 편의점을 찾아보세요
              </p>
              <p className="mt-1 text-[12.5px] font-medium leading-5 text-black/40">
                지점명이나 도로명 주소를 두 글자 이상 입력하면
                <br />
                지점 위치를 지도에서 보여드려요.
              </p>
            </div>
          ) : isLoading && stores.length === 0 ? (
            <p className="rounded-[0.85rem] bg-[#f7f7f7] px-4 py-6 text-center text-[13px] font-semibold text-black/40">
              지점을 찾는 중이에요…
            </p>
          ) : stores.length === 0 ? (
            <div className="rounded-[0.85rem] bg-[#f7f7f7] px-4 py-6 text-center">
              <p className="text-[14px] font-semibold text-black/55">
                검색 결과가 없어요
              </p>
              <p className="mt-1 text-[12.5px] font-medium text-black/40">
                지점명이나 도로명 주소로 다시 검색해 보세요.
              </p>
            </div>
          ) : (
            // 재검색 중에는 이전 결과를 흐리게 유지한다 — 목록 전체가 사라졌다 나타나는 깜빡임 방지.
            <div
              className={`grid grid-cols-1 gap-2 transition-opacity ${
                isLoading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {stores.map((store) => {
                const isSelected = store.id === selectedStoreId;

                return (
                  <button
                    aria-pressed={isSelected}
                    className={`w-full rounded-[0.9rem] border px-3.5 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-[#C8D4A5] bg-[#F3F5EA]"
                        : "border-black/10 bg-[#f7f7f7]"
                    }`}
                    key={store.id}
                    onClick={() => setSelectedStoreId(store.id)}
                    type="button"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          isSelected
                            ? "bg-[#DDE7B8] text-black"
                            : "bg-white text-black/55"
                        }`}
                      >
                        {store.brand}
                      </span>
                      <p className="min-w-0 truncate text-[14.5px] font-semibold tracking-[-0.04em]">
                        {store.name}
                      </p>
                    </div>
                    {/* 도로명 주소는 끝 괄호(동·건물명)가 식별 정보라 말줄임 대신 2줄로 보여준다. */}
                    <p className="mt-1.5 line-clamp-2 text-[12.5px] font-medium leading-[1.35] text-black/45">
                      {store.address}
                    </p>
                  </button>
                );
              })}
              {loadMoreError ? (
                <p className="rounded-[0.85rem] bg-[#fff2f2] px-4 py-2.5 text-center text-[12.5px] font-semibold text-[#c03131]">
                  {loadMoreError}
                </p>
              ) : null}
              {hasNext && nextCursor ? (
                <button
                  className="h-11 w-full rounded-[0.9rem] border border-black/10 bg-white text-[13px] font-semibold text-black/50 disabled:text-black/25"
                  disabled={isLoadingMore}
                  onClick={loadMoreStores}
                  type="button"
                >
                  {isLoadingMore ? "불러오는 중…" : loadMoreError ? "다시 시도" : "더 보기"}
                </button>
              ) : null}
            </div>
          )}
          </div>
        </div>

        <div className="shrink-0 border-t border-black/10 bg-white pt-3.5">
          {selectedStore ? (
            <p className="mb-2 truncate px-1 text-[12.5px] font-medium text-black/45">
              {selectedStore.brand} {selectedStore.name} · {selectedStore.address}
            </p>
          ) : null}
          <button
            className="h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-[#D7FF5F] shadow-[0_12px_24px_rgba(0,0,0,0.18)] disabled:bg-black/20 disabled:text-white/70 disabled:shadow-none"
            disabled={!selectedStore}
            onClick={confirmSelection}
            type="button"
          >
            이 지점으로 선택
          </button>
        </div>
      </section>
    </div>
  );
}
