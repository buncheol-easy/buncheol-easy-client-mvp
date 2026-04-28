import type { ArtistRailItem } from "@/components/ArtistRail";
import type { ProductCardItem } from "@/components/ProductCard";
import { productDetails } from "@/lib/mock-products";

export type RecentSearch = {
  label: string;
};

export type PopularArtist = {
  rank: number;
  name: string;
  group: string;
  initials: string;
  tone: string;
};

export const favoriteIdols: ArtistRailItem[] = [
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

export const recentSearches: RecentSearch[] = [
  { label: "가을" },
  { label: "분철" },
  { label: "앨범" },
];

export const popularArtists: PopularArtist[] = [
  {
    rank: 1,
    name: "Aodu",
    group: "IVE",
    initials: "AO",
    tone: "from-stone-100 via-zinc-50 to-neutral-300",
  },
  {
    rank: 2,
    name: "Bodu",
    group: "aespa",
    initials: "BO",
    tone: "from-zinc-900 via-zinc-700 to-stone-400",
  },
  {
    rank: 3,
    name: "Codu",
    group: "NewJeans",
    initials: "CO",
    tone: "from-neutral-200 via-white to-zinc-300",
  },
  {
    rank: 4,
    name: "Dodu",
    group: "LE SSERAFIM",
    initials: "DO",
    tone: "from-black via-zinc-800 to-zinc-400",
  },
  {
    rank: 5,
    name: "Eodu",
    group: "NMIXX",
    initials: "EO",
    tone: "from-stone-300 via-zinc-100 to-white",
  },
];

export const searchResultArtists: ArtistRailItem[] = favoriteIdols.slice(0, 4);

export const homeListings: ProductCardItem[] = productDetails;

export const searchResultItems: ProductCardItem[] = [
  productDetails[0],
  productDetails[1],
  productDetails[2],
  productDetails[3],
];
