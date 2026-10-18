import { SkeletonGroup } from "@/components/SkeletonGroup";

// 상세 하단 참여 버튼 자리. 로그인 사용자의 개최자 여부를 받는 동안에도 같은 모양을 쓴다.
export function ProductDetailBidBarSkeleton() {
  return (
    <>
      <div className="skeleton-surface mx-auto mb-2 h-3 w-48 rounded-full bg-black/8" />
      <div className="skeleton-surface h-14 w-full rounded-full bg-black/8" />
    </>
  );
}

// 분철 상세(ProductDetail)와 같은 자리에 같은 크기로 뼈대를 그린다. 상세 레이아웃을 바꾸면 여기도 맞춘다.
export function ProductDetailSkeleton() {
  return (
    <SkeletonGroup
      aria-label="분철 정보를 불러오고 있어요"
      className="flex min-h-0 flex-1 flex-col"
      role="status"
    >
      <div className="product-detail-header shrink-0 px-4 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <div className="skeleton-surface mr-auto h-10 w-10 rounded-full bg-black/8" />
          <div className="skeleton-surface h-10 w-10 rounded-full bg-black/8" />
          <div className="skeleton-surface h-10 w-10 rounded-full bg-black/8" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="px-4">
          <div className="skeleton-surface product-hero-media rounded-[1.35rem] bg-black/8" />
        </div>
        <div className="px-5 pt-6">
          <div className="skeleton-surface h-4 w-32 rounded-full bg-black/8" />
          <div className="skeleton-surface mt-5 h-7 w-[86%] rounded-[0.6rem] bg-black/8" />
          <div className="skeleton-surface mt-2 h-7 w-[54%] rounded-[0.6rem] bg-black/8" />
          <div className="skeleton-surface mt-7 h-[156px] rounded-[1.15rem] bg-black/8" />
        </div>
      </div>
      <div className="product-detail-bid-bar absolute bottom-0 left-0 right-0 bg-white px-5 pb-5 pt-3">
        <ProductDetailBidBarSkeleton />
      </div>
    </SkeletonGroup>
  );
}
