"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackIcon } from "@/components/icons";

type PolicySection = {
  items: string[];
  title: string;
};

type PolicyPageContentProps = {
  description: string;
  sections: PolicySection[];
  title: string;
};

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

export function PolicyPageContent({
  description,
  sections,
  title,
}: PolicyPageContentProps) {
  const router = useRouter();

  function handleBack() {
    const historyIndex = getHistoryIndex();

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace("/profile");
  }

  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <header className="shrink-0 px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <button
              aria-label="이전 화면"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white"
              onClick={handleBack}
              type="button"
            >
              <BackIcon />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-black/35">
                Policy
              </p>
              <h1 className="mt-1 truncate text-[24px] font-semibold leading-none tracking-[-0.05em]">
                {title}
              </h1>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-2">
          <section className="border-b border-black/10 pb-5">
            <p className="inline-flex rounded-full bg-[#f7f7f7] px-2.5 py-1 text-[12px] font-semibold tracking-[-0.03em] text-black/45">
              초안
            </p>
            <p className="mt-3 text-[14px] font-medium leading-6 tracking-[-0.03em] text-black/55">
              {description}
            </p>
            <p className="mt-4 text-[13px] font-medium leading-6 tracking-[-0.03em] text-black/42">
              정식 운영 전 최종 검토 후 최신 문서로 업데이트될 예정입니다.
            </p>
          </section>

          <div className="space-y-7 py-6">
            {sections.map((section) => (
              <section
                className="border-b border-black/10 pb-6 last:border-b-0 last:pb-0"
                key={section.title}
              >
                <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                  {section.title}
                </h2>
                <ul className="mt-3 space-y-2.5">
                  {section.items.map((item) => (
                    <li
                      className="break-keep text-[14px] font-medium leading-6 tracking-[-0.03em] text-black/58"
                      key={item}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <Link
            className="mx-auto mt-5 flex w-fit items-center justify-center rounded-full px-4 py-2 text-[13px] font-semibold tracking-[-0.04em] text-black/45"
            href="/profile"
          >
            마이페이지로 이동
          </Link>
        </div>
      </div>
    </main>
  );
}
