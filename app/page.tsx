import { AppHeader } from "@/components/AppHeader";
import { ArtistRail, type ArtistRailItem } from "@/components/ArtistRail";
import { BottomNavigator } from "@/components/BottomNavigator";
import { ProductGrid } from "@/components/ProductGrid";
import type { ProductCardItem } from "@/components/ProductCard";

const favoriteIdols: ArtistRailItem[] = [
  {
    id: "wonyoung",
    name: "장원영",
    group: "IVE",
    initials: "WY",
    tone: "from-zinc-100 via-white to-zinc-300",
  },
  {
    id: "yujin",
    name: "안유진",
    group: "IVE",
    initials: "YJ",
    tone: "from-stone-200 via-zinc-50 to-neutral-300",
  },
  {
    id: "karina",
    name: "카리나",
    group: "aespa",
    initials: "KR",
    tone: "from-neutral-200 via-stone-100 to-zinc-200",
  },
  {
    id: "winter",
    name: "윈터",
    group: "aespa",
    initials: "WR",
    tone: "from-neutral-200 via-stone-100 to-zinc-200",
  },
  {
    id: "giselle",
    name: "지젤",
    group: "aespa",
    initials: "JR",
    tone: "from-neutral-200 via-stone-100 to-zinc-200",
  },
];

const listings: ProductCardItem[] = [
  {
    id: "love-dive-wonyoung-1st",
    title: "러브다이브 미공포 1차 분철",
    member: "장원영",
    era: "IVE LOVE DIVE",
    price: "3,000원",
    rating: "4.8",
    reviews: "41",
    badge: "인기",
    liked: true,
    tone: "from-black via-zinc-800 to-zinc-500",
  },
  {
    id: "drama-karina-fansign",
    title: "드라마 팬싸 포카 분철",
    member: "카리나",
    era: "aespa DRAMA",
    price: "6,000원",
    rating: "4.6",
    reviews: "87",
    badge: "마감임박",
    tone: "from-zinc-300 via-zinc-100 to-neutral-400",
  },
  {
    id: "season-greeting-yujin-special",
    title: "시즌그리팅 특전 공구",
    member: "안유진",
    era: "2026 SG",
    price: "4,500원",
    rating: "4.7",
    reviews: "29",
    badge: "신규",
    tone: "from-zinc-900 via-zinc-700 to-zinc-300",
  },
  {
    id: "favorite-cut-wonyoung-small",
    title: "최애컷 셀카 포카 소량 분철",
    member: "장원영",
    era: "팬콘 MD",
    price: "5,500원",
    rating: "4.9",
    reviews: "63",
    badge: "추천",
    liked: true,
    tone: "from-zinc-700 via-zinc-500 to-zinc-100",
  },
  {
    id: "fan-meeting-karina-limited",
    title: "팬미팅 한정 포카 분철",
    member: "카리나",
    era: "FAN MEET",
    price: "4,000원",
    rating: "4.5",
    reviews: "18",
    badge: "소량",
    tone: "from-zinc-950 via-zinc-700 to-stone-300",
  },
  {
    id: "comeback-week-yujin-special",
    title: "컴백 주간 특전 묶음",
    member: "안유진",
    era: "COMEBACK WEEK",
    price: "7,500원",
    rating: "4.9",
    reviews: "72",
    badge: "인기",
    tone: "from-neutral-300 via-zinc-100 to-zinc-500",
  },
];

export default function Home() {
  return (
    <main className="h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <AppHeader />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="px-4 pt-4">
            <div className="grid grid-cols-[1fr_1.15fr] overflow-hidden rounded-[1.35rem] border border-black bg-black">
              <div className="flex items-center p-5">
                <div>
                  <p className="text-[14px] uppercase tracking-[0.24em] text-white/45">
                    For your bias
                  </p>
                  <h2 className="mt-3 text-[22px] font-semibold leading-[1.18] tracking-[-0.06em] text-white">
                    당신의
                    <br />
                    최애를 쉽게.
                  </h2>
                </div>
              </div>
              <div className="relative min-h-[140px] overflow-hidden border-l border-white/10 bg-[linear-gradient(135deg,#1a1a1a_0%,#6c6c6c_48%,#efefef_100%)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_28%,rgba(255,255,255,0.7),transparent_22%)]" />
                <div className="absolute bottom-5 left-5 h-[110px] w-[82px] rotate-[-10deg] rounded-[1rem] border border-white/25 bg-black shadow-[0_15px_35px_rgba(0,0,0,0.28)]" />
                <div className="absolute bottom-6 left-[6.1rem] h-[126px] w-[92px] rotate-[7deg] rounded-[1rem] border border-white/40 bg-white/85 shadow-[0_15px_35px_rgba(0,0,0,0.18)]" />
                <div className="absolute right-5 top-5 rounded-full bg-black px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-white">
                  PICK
                </div>
                <div className="absolute bottom-4 right-4 rounded-2xl border border-black/10 bg-white/90 px-3 py-2 backdrop-blur">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/45">
                    Bias Match
                  </p>
                  <p className="mt-1 text-[13px] font-semibold tracking-[-0.03em]">
                    원영 · 유진 · 카리나
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 pb-5">
              <span className="h-2 w-2 rounded-full bg-black" />
              <span className="h-2 w-2 rounded-full bg-zinc-300" />
              <span className="h-2 w-2 rounded-full bg-zinc-300" />
              <span className="h-2 w-2 rounded-full bg-zinc-300" />
              <span className="h-2 w-2 rounded-full bg-zinc-300" />
            </div>
          </section>

          <section className="px-4">
            <ArtistRail
              items={favoriteIdols}
              leadingItem={{ label: "최애 추가", icon: "plus" }}
            />

            <div className="border-t border-black/10 pt-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-[19px] font-semibold tracking-[-0.05em]">
                    나를 위한 추천 상품
                  </h3>
                </div>
                <button className="text-[13px] font-medium text-black/55">
                  전체보기
                </button>
              </div>

              <ProductGrid items={listings} />
            </div>
          </section>
        </div>

        <BottomNavigator />
      </div>
    </main>
  );
}
