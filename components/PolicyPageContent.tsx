"use client";

import { useRouter } from "next/navigation";
import { BusinessFooter } from "@/components/BusinessFooter";
import { BackIcon } from "@/components/icons";

type PolicySection = {
  items: string[];
  title: string;
};

type PolicyPageContentProps = {
  description: string;
  effectiveDate?: string;
  sections: PolicySection[];
  title: string;
};

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

export function PolicyPageContent({
  description,
  effectiveDate,
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
          <div className="flex min-h-full flex-col">
          <section className="border-b border-black/10 pb-5">
            {effectiveDate ? (
              <p className="inline-flex rounded-full bg-[#f7f7f7] px-2.5 py-1 text-[12px] font-semibold tracking-[-0.03em] text-black/45">
                시행일 {effectiveDate}
              </p>
            ) : null}
            <p className="mt-3 text-[14px] font-medium leading-6 tracking-[-0.03em] text-black/55">
              {description}
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

          <div className="-mx-4 -mb-8 mt-auto pt-8">
            <BusinessFooter />
          </div>
          </div>
        </div>
      </div>
    </main>
  );
}
