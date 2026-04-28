"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductGrid } from "@/components/ProductGrid";
import { favoriteIdols } from "@/lib/mock-home-search";
import { productDetails } from "@/lib/mock-products";

type FavoriteFilter = "all" | "favoriteArtist";
type FavoriteSort = "deadline" | "recent";

// Deadline strings are entered as Korea-local cutoff times.
const kstOffsetHours = 9;
const favoriteProducts = productDetails
  .filter((product) => product.liked)
  .map((product, index) => ({
    ...product,
    favoritedOrder: index,
  }));
const favoriteArtistNames = new Set(
  favoriteIdols.map((artist) => artist.name),
);

function parseDeadline(deadline: string) {
  const match = deadline
    .trim()
    .match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})\s+(\d{1,2})(?::00)?$/);

  if (!match) {
    return new Date(Number.NaN);
  }

  const [, year, month, day, hour] = match;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - kstOffsetHours,
    ),
  );
}

function isClosed(deadline: string, now: Date) {
  const deadlineDate = parseDeadline(deadline);

  if (Number.isNaN(deadlineDate.getTime())) {
    return false;
  }

  return deadlineDate.getTime() <= now.getTime();
}

export function FavoritesContent() {
  const [filter, setFilter] = useState<FavoriteFilter>("all");
  const [sort, setSort] = useState<FavoriteSort>("recent");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [hideClosed, setHideClosed] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const filteredProducts = useMemo(() => {
    return favoriteProducts
      .filter((product) => {
        if (
          filter === "favoriteArtist" &&
          !favoriteArtistNames.has(product.member)
        ) {
          return false;
        }

        if (hideClosed && isClosed(product.deadline, now)) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        if (sort === "recent") {
          return right.favoritedOrder - left.favoritedOrder;
        }

        return (
          parseDeadline(left.deadline).getTime() -
          parseDeadline(right.deadline).getTime()
        );
      });
  }, [filter, hideClosed, now, sort]);

  return (
    <div className="tab-content-enter flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-4 pb-5 pt-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-black/35">
          Favorites
        </p>
        <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.06em]">
          찜한 상품
        </h1>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-[0.95rem] bg-[#f7f7f7] p-1.5">
          {(
            [
              ["all", "전체"],
              ["favoriteArtist", "최애 아티스트"],
            ] as const
          ).map(([value, label]) => {
            const isActive = filter === value;

            return (
              <button
                className={`h-11 rounded-[0.8rem] text-[14px] font-semibold tracking-[-0.04em] ${
                  isActive
                    ? "bg-black text-white"
                    : "text-black/45"
                }`}
                key={value}
                onClick={() => setFilter(value)}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="relative mt-3 flex items-center justify-between gap-3">
          <div className="relative">
            <button
              className="flex h-9 items-center gap-1.5 rounded-full bg-[#f7f7f7] px-3 text-[12px] font-semibold text-black/55 ring-1 ring-black/10"
              onClick={() => setIsSortOpen((current) => !current)}
              type="button"
            >
              <span>{sort === "recent" ? "최근 찜한 순" : "마감 임박순"}</span>
              <span
                className={`h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-current transition-transform ${
                  isSortOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isSortOpen ? (
              <div className="absolute right-[-1.5rem] top-11 z-20 w-32 overflow-hidden rounded-[0.8rem] border border-black/10 bg-white shadow-[0_14px_28px_rgba(0,0,0,0.12)]">
                {(
                  [
                    ["recent", "최근 찜한 순"],
                    ["deadline", "마감 임박순"],
                  ] as const
                ).map(([value, label]) => {
                  const isActive = sort === value;

                  return (
                    <button
                      className={`h-10 w-full px-3 text-left text-[13px] font-semibold tracking-[-0.04em] ${
                        isActive ? "bg-black text-white" : "text-black/55"
                      }`}
                      key={value}
                      onClick={() => {
                        setSort(value);
                        setIsSortOpen(false);
                      }}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="mr-1 flex items-center gap-2">
            <span className="text-[12px] font-semibold text-black/45">
              마감 숨김
            </span>
            <button
              aria-pressed={hideClosed}
              className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors ${
                hideClosed ? "bg-black" : "bg-black/10"
              }`}
              onClick={() => setHideClosed((current) => !current)}
              type="button"
            >
              <span
                className={`h-5 w-5 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition-transform ${
                  hideClosed ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <div
          className="tab-content-enter"
          key={`${filter}-${hideClosed}-${sort}`}
        >
          {filteredProducts.length > 0 ? (
            <ProductGrid items={filteredProducts} />
          ) : (
            <div className="rounded-[0.9rem] bg-[#f7f7f7] px-4 py-6">
              <p className="text-[14px] font-medium text-black/45">
                조건에 맞는 찜 상품이 없습니다.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
