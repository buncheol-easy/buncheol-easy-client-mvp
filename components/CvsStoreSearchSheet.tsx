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
  type KakaoMarker,
} from "@/lib/kakao-map";

const SHEET_CLOSE_MS = 280;
const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

// 검색 결과가 없을 때 지도의 기본 중심 (서울시청).
const DEFAULT_MAP_CENTER = { lat: 37.5665, lng: 126.978 };

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
  onClose: () => void;
  onSelect: (store: CvsStore) => void;
};

// 배송지 등록용 편의점 접수처 검색 바텀시트. 키워드(지점명·주소) 검색 + 브랜드 필터 +
// 카카오 지도 마커로 지점을 고른 뒤 "이 지점으로 선택"으로 확정한다.
// 시트 트랜지션은 FeedbackSheet 의 bid-sheet-backdrop/panel 컨벤션을 따른다.
export function CvsStoreSearchSheet({
  onClose,
  onSelect,
}: CvsStoreSearchSheetProps) {
  const [isEntered, setIsEntered] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [brandFilter, setBrandFilter] = useState<CvsStoreBrandFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [stores, setStores] = useState<CvsStore[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapNotice, setMapNotice] = useState(
    getKakaoMapAppKey() ? "" : "지도 키가 설정되지 않아 목록으로만 보여요.",
  );

  const closeTimerRef = useRef<number | null>(null);
  const relayoutTimerRef = useRef<number | null>(null);
  const searchRequestIdRef = useRef(0);
  // "더 보기" 추가 로드에서는 사용자가 만진 지도 시점을 유지한다 (setBounds 재적용 스킵).
  const isAppendResultRef = useRef(false);
  // 새 검색 결과에 대해 아직 화면 범위를 맞추지 않았는지. SDK 로드가 "더 보기" 이후에
  // 끝나는 경우에도 첫 fit 이 누락되지 않게 append 플래그와 별도로 관리한다.
  const needsFitBoundsRef = useRef(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<KakaoMarker[]>([]);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  const selectedStore = useMemo(
    () => stores.find((store) => store.id === selectedStoreId) ?? null,
    [selectedStoreId, stores],
  );

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

      setSearchError("");

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

        isAppendResultRef.current = Boolean(options.append);
        if (!options.append) {
          needsFitBoundsRef.current = true;
        }
        setStores((current) => {
          if (!options.append) {
            return page.items;
          }

          const seenIds = new Set(current.map((store) => store.id));

          return [
            ...current,
            ...page.items.filter((store) => !seenIds.has(store.id)),
          ];
        });
        setHasNext(page.hasNext);
        setNextCursor(page.nextCursor);
      } catch (error) {
        if (requestId !== searchRequestIdRef.current) {
          return;
        }

        setSearchError(
          error instanceof Error
            ? error.message
            : "지점을 검색하지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [brandFilter, debouncedKeyword],
  );

  // 빈 키워드는 검색하지 않는다 — 전국 목록을 id 순으로 쏟는 초기 화면은 정보가 없다.
  useEffect(() => {
    setSelectedStoreId(null);
    listContainerRef.current?.scrollTo({ top: 0 });

    if (!debouncedKeyword.trim()) {
      searchRequestIdRef.current += 1; // 진행 중이던 검색 무효화
      isAppendResultRef.current = false;
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

        mapRef.current = new sdk.Map(mapContainerRef.current, {
          center: new sdk.LatLng(DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng),
          level: 8,
        });
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
    };
  }, []);

  useEffect(() => {
    const sdk = window.kakao?.maps;
    const map = mapRef.current;

    if (!isMapReady || !sdk || !map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const locatedStores = stores.filter(
      (store) => store.latitude !== null && store.longitude !== null,
    );

    if (locatedStores.length === 0) {
      return;
    }

    const bounds = new sdk.LatLngBounds();

    locatedStores.forEach((store) => {
      const position = new sdk.LatLng(store.latitude!, store.longitude!);
      const marker = new sdk.Marker({ position, title: store.name });

      marker.setMap(map);
      sdk.event.addListener(marker, "click", () => {
        setSelectedStoreId(store.id);
      });
      bounds.extend(position);
      markersRef.current.push(marker);
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
      }
    }

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [isMapReady, stores]);

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

        <div className="mt-4 flex items-center gap-2 rounded-full bg-[#f4f4f4] px-4 py-1 ring-1 ring-black/5 transition focus-within:ring-black/25">
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

        <div className="mt-2.5">
          <SlidingFilterChips
            onChange={(value: CvsStoreBrandFilter) => setBrandFilter(value)}
            tabs={brandFilterTabs}
            value={brandFilter}
          />
        </div>

        {mapNotice ? (
          <p className="mt-2 rounded-[0.85rem] bg-[#f7f7f7] px-4 py-3 text-[12.5px] font-medium text-black/45">
            {mapNotice}
          </p>
        ) : (
          <div
            aria-label="지점 지도"
            className="mt-2 h-[190px] w-full shrink-0 overflow-hidden rounded-[0.95rem] ring-1 ring-black/10"
            ref={mapContainerRef}
            role="application"
          />
        )}

        <div
          className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          ref={listContainerRef}
        >
          {searchError ? (
            <p className="rounded-[0.85rem] bg-[#fff2f2] px-4 py-3 text-[13px] font-semibold leading-5 text-[#c03131]">
              {searchError}
            </p>
          ) : !debouncedKeyword.trim() ? (
            <div className="rounded-[0.85rem] bg-[#f7f7f7] px-4 py-8 text-center">
              <p className="text-[14px] font-semibold text-black/55">
                자주 가는 편의점을 찾아보세요
              </p>
              <p className="mt-1 text-[12.5px] font-medium leading-5 text-black/40">
                지점명이나 도로명 주소로 검색하면
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
              {hasNext && nextCursor ? (
                <button
                  className="h-11 w-full rounded-[0.9rem] border border-black/10 bg-white text-[13px] font-semibold text-black/50 disabled:text-black/25"
                  disabled={isLoadingMore}
                  onClick={loadMoreStores}
                  type="button"
                >
                  {isLoadingMore ? "불러오는 중…" : "더 보기"}
                </button>
              ) : null}
            </div>
          )}
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
