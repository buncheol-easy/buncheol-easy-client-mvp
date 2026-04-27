import { PlusIcon, ProfileIcon } from "@/components/icons";

export type ArtistRailItem = {
  id: string;
  name: string;
  group?: string;
  initials: string;
  tone: string;
};

type ArtistRailLeadingItem = {
  label: string;
  subLabel?: string;
  icon?: "plus" | "all";
  active?: boolean;
};

type ArtistRailProps = {
  items: ArtistRailItem[];
  leadingItem?: ArtistRailLeadingItem;
  selectedId?: string;
};

export function ArtistRail({
  items,
  leadingItem,
  selectedId,
}: ArtistRailProps) {
  return (
    <div className="flex items-start gap-3">
      {leadingItem ? (
        <>
          <div className="flex-shrink-0">
            <button className="min-w-[65px]">
              <div
                className={`flex aspect-square items-center justify-center rounded-[1.25rem] border text-black/35 ${
                  leadingItem.active
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-[#ededeb]"
                }`}
              >
                {leadingItem.icon === "all" ? (
                  <span className="text-[18px] font-semibold tracking-[-0.06em]">
                    All
                  </span>
                ) : (
                  <div className="relative h-10 w-10">
                    <ProfileIcon />
                    <div className="absolute -bottom-1 -right-2">
                      <PlusIcon />
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-2 text-[14px] font-medium tracking-[-0.03em]">
                {leadingItem.label}
              </p>
              {leadingItem.subLabel ? (
                <p className="text-[12px] text-black/45">
                  {leadingItem.subLabel}
                </p>
              ) : null}
            </button>
          </div>

          <div className="my-2 w-px self-stretch bg-black/10" />
        </>
      ) : null}

      <div className="flex gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const isSelected = item.id === selectedId;

          return (
            <button key={item.id} className="min-w-[65px] text-left">
              <div
                className={`flex aspect-square items-center justify-center rounded-[1.1rem] border bg-gradient-to-br ${item.tone} text-[22px] font-semibold tracking-[-0.06em] text-black ${
                  isSelected
                    ? "border-black ring-2 ring-black"
                    : "border-black/8"
                }`}
              >
                {item.initials}
              </div>
              <p className="mt-2 text-[13px] font-medium tracking-[-0.03em]">
                {item.name}
              </p>
              {item.group ? (
                <p className="text-[12px] text-black/45">{item.group}</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
