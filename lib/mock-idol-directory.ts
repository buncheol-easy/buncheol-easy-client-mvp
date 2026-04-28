export type IdolMember = {
  id: string;
  name: string;
  initials: string;
  tone: string;
};

export type IdolGroup = {
  id: string;
  name: string;
  label: string;
  aliases: string[];
  members: IdolMember[];
};

export const idolDirectory: IdolGroup[] = [
  {
    id: "ive",
    name: "IVE",
    label: "아이브",
    aliases: ["ive", "아이브", "jang wonyoung", "안유진", "원영"],
    members: [
      {
        id: "wonyoung",
        name: "장원영",
        initials: "WY",
        tone: "from-zinc-950 via-zinc-600 to-zinc-200",
      },
      {
        id: "yujin",
        name: "안유진",
        initials: "YJ",
        tone: "from-neutral-200 via-white to-zinc-500",
      },
      {
        id: "rei",
        name: "레이",
        initials: "RE",
        tone: "from-zinc-300 via-zinc-50 to-neutral-500",
      },
      {
        id: "liz",
        name: "리즈",
        initials: "LZ",
        tone: "from-black via-zinc-700 to-stone-300",
      },
    ],
  },
  {
    id: "aespa",
    name: "aespa",
    label: "에스파",
    aliases: ["aespa", "에스파", "karina", "winter", "카리나", "윈터"],
    members: [
      {
        id: "karina",
        name: "카리나",
        initials: "KR",
        tone: "from-zinc-200 via-white to-neutral-500",
      },
      {
        id: "winter",
        name: "윈터",
        initials: "WT",
        tone: "from-zinc-900 via-zinc-500 to-white",
      },
      {
        id: "giselle",
        name: "지젤",
        initials: "GZ",
        tone: "from-stone-300 via-zinc-100 to-white",
      },
      {
        id: "ningning",
        name: "닝닝",
        initials: "NN",
        tone: "from-neutral-700 via-zinc-300 to-white",
      },
    ],
  },
  {
    id: "newjeans",
    name: "NewJeans",
    label: "뉴진스",
    aliases: ["newjeans", "뉴진스", "민지", "하니", "해린"],
    members: [
      {
        id: "minji",
        name: "민지",
        initials: "MJ",
        tone: "from-neutral-200 via-zinc-50 to-zinc-600",
      },
      {
        id: "hani",
        name: "하니",
        initials: "HN",
        tone: "from-zinc-950 via-zinc-500 to-stone-200",
      },
      {
        id: "danielle",
        name: "다니엘",
        initials: "DN",
        tone: "from-zinc-100 via-white to-neutral-400",
      },
      {
        id: "haerin",
        name: "해린",
        initials: "HR",
        tone: "from-black via-zinc-800 to-zinc-400",
      },
    ],
  },
];
