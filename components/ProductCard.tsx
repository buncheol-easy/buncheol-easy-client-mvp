import { HeartIcon, StarIcon } from "@/components/icons";

export type ProductCardItem = {
  id: string;
  title: string;
  member: string;
  era: string;
  price: string;
  rating: string;
  reviews: string;
  badge: string;
  tone: string;
  liked?: boolean;
};

type ProductCardProps = {
  item: ProductCardItem;
};

export function ProductCard({ item }: ProductCardProps) {
  return (
    <article className="space-y-3">
      <div
        className={`relative aspect-square overflow-hidden rounded-[1.2rem] bg-gradient-to-br ${item.tone}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_22%,rgba(255,255,255,0.5),transparent_22%)]" />
        <div className="absolute left-3 top-3 rounded-full bg-black px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-white">
          {item.badge}
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-3 pb-3 pt-12 text-white">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">
            {item.era}
          </p>
          <p className="mt-1 text-[16px] font-semibold tracking-[-0.04em]">
            {item.member}
          </p>
        </div>
        <button
          aria-label={item.liked ? "찜 해제" : "찜하기"}
          className={`absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 ${
            item.liked ? "bg-black text-white" : "bg-white/95 text-black/45"
          }`}
        >
          <HeartIcon filled={item.liked} />
        </button>
      </div>

      <div>
        <p className="line-clamp-2 text-[15px] leading-6 tracking-[-0.04em] text-black">
          {item.title}
        </p>
        <p className="mt-3 text-[15px] font-semibold tracking-[-0.04em]">
          {item.price}
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-[13px] text-black/55">
          <span className="inline-flex items-center justify-center rounded-[0.35rem] bg-black p-1 text-white">
            <StarIcon />
          </span>
          <span>{item.rating}</span>
          <span>({item.reviews})</span>
        </div>
      </div>
    </article>
  );
}
