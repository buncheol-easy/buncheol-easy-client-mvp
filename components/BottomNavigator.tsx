import { HeartIcon, HomeIcon, PlusIcon, ProfileIcon } from "@/components/icons";

type NavItem = {
  label: string;
  active?: boolean;
};

const navItems: NavItem[] = [
  { label: "Home", active: true },
  { label: "Upload" },
  { label: "Favorites" },
  { label: "Profile" },
];

export function BottomNavigator() {
  return (
    <nav className="shrink-0 bg-black px-5 pb-4 pt-3 text-white">
      <div className="flex items-start justify-between">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`flex min-w-[60px] flex-col items-center gap-1.5 text-[12px] ${
              item.active ? "text-white" : "text-white/55"
            }`}
          >
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                item.active ? "bg-white text-black" : "bg-transparent"
              }`}
            >
              {item.label === "Home" ? (
                <HomeIcon />
              ) : item.label === "Upload" ? (
                <PlusIcon />
              ) : item.label === "Favorites" ? (
                <HeartIcon />
              ) : (
                <ProfileIcon />
              )}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
