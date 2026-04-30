"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { BackIcon, CloseIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { BottomNavigator } from "@/components/BottomNavigator";
import type { IdolGroup } from "@/lib/mock-idol-directory";
import { idolDirectory } from "@/lib/mock-idol-directory";
import type { ProductDetailItem, ProductOption } from "@/lib/mock-products";

type PhotoPreview = {
  id: string;
  name: string;
  url: string;
};

type MinimumPricePrompt = {
  memberId: string;
  price: string;
};

type ScheduleWheelProps = {
  field: ScheduleField;
  formatter?: (value: number) => string;
  label: string;
  onSelect: (field: ScheduleField, part: SchedulePart, value: number) => void;
  options: number[];
  part: SchedulePart;
  selectedValue: number;
};

type SoftPanelProps = {
  children: ReactNode;
  className?: string;
  isOpen: boolean;
};

const shippingOptions = ["GS 편의점 택배", "CU 편의점 택배"];
const maxPhotos = 5;
const scheduleYearOptionCount = 5;
const hourOptions = Array.from({ length: 24 }, (_, index) => index);
const minimumPricePromptExitDelay = 220;

type ScheduleField = "closing" | "shipping";
type SchedulePart = "year" | "month" | "day" | "hour";

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function parsePriceInput(value: string) {
  return Number(value.replace(/[^\d]/g, "")) || 0;
}

function toNumericInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getYearOptions(minimumYear: number) {
  return Array.from(
    { length: scheduleYearOptionCount },
    (_, index) => minimumYear + index,
  );
}

// 마감 기한 및 발송 기한 설정
function getDefaultScheduleParts() {
  const now = new Date();
  now.setHours(now.getHours() + 1, 0, 0, 0);

  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
  };
}

function getScheduleParts(value: string) {
  const fallback = getDefaultScheduleParts();

  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
  };
}

function buildScheduleValue(parts: ReturnType<typeof getScheduleParts>) {
  return `${parts.year}-${padNumber(parts.month)}-${padNumber(
    parts.day,
  )}T${padNumber(parts.hour)}:00`;
}

function clampScheduleValue(value: string, minimumValue: string) {
  if (
    !minimumValue ||
    new Date(value).getTime() >= new Date(minimumValue).getTime()
  ) {
    return value;
  }

  return minimumValue;
}

function addHours(value: string, hours: number) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setHours(date.getHours() + hours, 0, 0, 0);

  return buildScheduleValue({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
  });
}

function getNextAvailableScheduleValue() {
  return buildScheduleValue(getDefaultScheduleParts());
}

function formatDateTimeLabel(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const weekday = new Intl.DateTimeFormat("ko-KR", {
    weekday: "short",
  }).format(date);

  return `${date.getFullYear()}. ${padNumber(
    date.getMonth() + 1,
  )}. ${padNumber(date.getDate())} (${weekday}) ${padNumber(
    date.getHours(),
  )}:00`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      resolve(String(reader.result));
    });
    reader.addEventListener("error", () => {
      reject(reader.error);
    });
    reader.readAsDataURL(file);
  });
}

function createUploadedProductId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `uploaded-${crypto.randomUUID()}`;
  }

  return `uploaded-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function compressImageDataUrl(dataUrl: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();

    image.addEventListener("load", () => {
      const maxSize = 1280;
      const scale = Math.min(
        1,
        maxSize / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");

      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Image compression failed"));
            return;
          }

          const reader = new FileReader();

          reader.addEventListener("load", () => {
            resolve(String(reader.result));
          });
          reader.addEventListener("error", () => {
            reject(reader.error);
          });
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        0.72,
      );
    });
    image.addEventListener("error", () => {
      reject(new Error("Image load failed"));
    });
    image.src = dataUrl;
  });
}

function ScheduleWheel({
  field,
  formatter = String,
  label,
  onSelect,
  options,
  part,
  selectedValue,
}: ScheduleWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const itemHeight = 32;

  useEffect(() => {
    const selectedIndex = options.indexOf(selectedValue);

    if (selectedIndex < 0) {
      return;
    }

    wheelRef.current?.scrollTo({
      top: selectedIndex * itemHeight,
    });
  }, [options, selectedValue]);

  function handleScroll() {
    const wheel = wheelRef.current;

    if (!wheel || options.length === 0) {
      return;
    }

    const nextIndex = Math.min(
      options.length - 1,
      Math.max(0, Math.round(wheel.scrollTop / itemHeight)),
    );
    const nextValue = options[nextIndex];

    if (nextValue !== selectedValue) {
      onSelect(field, part, nextValue);
    }
  }

  return (
    <div className="min-w-0">
      <p className="text-center text-[11px] font-semibold text-black/40">
        {label}
      </p>
      <div className="relative mt-2">
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-0 h-8 -translate-y-1/2 rounded-[0.65rem] bg-black" />
        <div
          className="schedule-wheel relative z-10 max-h-[104px] snap-y snap-mandatory overflow-y-auto py-9"
          onScroll={handleScroll}
          ref={wheelRef}
        >
          {options.map((option) => {
            const isSelected = option === selectedValue;

            return (
              <button
                className={`flex h-8 w-full snap-center items-center justify-center rounded-[0.65rem] text-[13px] font-semibold [font-variant-numeric:tabular-nums] ${
                  isSelected ? "text-white" : "text-black/25"
                }`}
                key={option}
                onClick={() => onSelect(field, part, option)}
                type="button"
              >
                {formatter(option)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SoftPanel({ children, className = "", isOpen }: SoftPanelProps) {
  return (
    <div
      aria-hidden={!isOpen}
      className={`soft-panel-presence ${className} ${
        isOpen ? "soft-panel-presence--open" : "soft-panel-presence--closed"
      }`}
      inert={isOpen ? undefined : true}
    >
      {children}
    </div>
  );
}

export function UploadProductForm() {
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const photoIdSeed = useRef(0);
  const minimumPricePromptTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const memberToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [idolQuery, setIdolQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [targetMemberIds, setTargetMemberIds] = useState<string[]>([]);
  const [excludedMemberIds, setExcludedMemberIds] = useState<string[]>([]);
  const [memberMinimumPrices, setMemberMinimumPrices] = useState<
    Record<string, string>
  >({});
  const [renderedMinimumPricePrompt, setRenderedMinimumPricePrompt] =
    useState<MinimumPricePrompt | null>(null);
  const [isMinimumPricePromptOpen, setIsMinimumPricePromptOpen] =
    useState(false);
  const [closingDate, setClosingDate] = useState("");
  const [shippingDate, setShippingDate] = useState("");
  const [description, setDescription] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [memberToastMessage, setMemberToastMessage] = useState("");
  const [memberToastTargetId, setMemberToastTargetId] = useState<string | null>(
    null,
  );
  const [activeScheduleField, setActiveScheduleField] =
    useState<ScheduleField | null>(null);
  const [selectedShipping, setSelectedShipping] = useState<string[]>([]);
  const [shippingPrices, setShippingPrices] = useState<Record<string, string>>(
    {},
  );

  const selectedGroup = useMemo(() => {
    return idolDirectory.find((group) => group.id === selectedGroupId) ?? null;
  }, [selectedGroupId]);

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => index + 1),
    [],
  );

  const idolResults = useMemo(() => {
    const query = idolQuery.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return idolDirectory.filter((group) => {
      const searchable = [
        group.name,
        group.label,
        ...group.aliases,
        ...group.members.map((member) => member.name),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [idolQuery]);

  const allTargetMembers =
    selectedGroup?.members.filter((member) =>
      targetMemberIds.includes(member.id),
    ) ?? [];
  const targetMembers = allTargetMembers.filter(
    (member) => !excludedMemberIds.includes(member.id),
  );
  const coverPhoto =
    photos.find((photo) => photo.id === coverPhotoId) ?? photos[0] ?? null;
  const canSubmit =
    photos.length > 0 &&
    title.trim().length > 0 &&
    targetMembers.length > 0 &&
    targetMembers.every(
      (member) => memberMinimumPrices[member.id]?.trim().length > 0,
    ) &&
    selectedShipping.length > 0 &&
    selectedShipping.every(
      (option) => shippingPrices[option]?.trim().length > 0,
    );

  useEffect(() => {
    return () => {
      if (minimumPricePromptTimeoutRef.current) {
        clearTimeout(minimumPricePromptTimeoutRef.current);
      }

      if (memberToastTimeoutRef.current) {
        clearTimeout(memberToastTimeoutRef.current);
      }
    };
  }, []);

  function showMemberToast(memberId: string, message: string) {
    if (memberToastTimeoutRef.current) {
      clearTimeout(memberToastTimeoutRef.current);
    }

    setMemberToastTargetId(memberId);
    setMemberToastMessage(message);
    memberToastTimeoutRef.current = setTimeout(() => {
      setMemberToastMessage("");
      setMemberToastTargetId(null);
      memberToastTimeoutRef.current = null;
    }, 1800);
  }

  function showMinimumPricePrompt(prompt: MinimumPricePrompt) {
    if (minimumPricePromptTimeoutRef.current) {
      clearTimeout(minimumPricePromptTimeoutRef.current);
    }

    setRenderedMinimumPricePrompt(prompt);
    setIsMinimumPricePromptOpen(true);
  }

  const hideMinimumPricePrompt = useCallback(() => {
    if (minimumPricePromptTimeoutRef.current) {
      clearTimeout(minimumPricePromptTimeoutRef.current);
    }

    setIsMinimumPricePromptOpen(false);
    minimumPricePromptTimeoutRef.current = setTimeout(() => {
      setRenderedMinimumPricePrompt(null);
      minimumPricePromptTimeoutRef.current = null;
    }, minimumPricePromptExitDelay);
  }, []);

  useEffect(() => {
    if (!renderedMinimumPricePrompt || !isMinimumPricePromptOpen) {
      return;
    }

    const isPromptOwnerActive = targetMembers.some(
      (member) => member.id === renderedMinimumPricePrompt.memberId,
    );
    const hasEmptyActiveMembers = targetMembers.some(
      (member) =>
        member.id !== renderedMinimumPricePrompt.memberId &&
        !memberMinimumPrices[member.id]?.trim(),
    );

    if (isPromptOwnerActive && hasEmptyActiveMembers) {
      return;
    }

    const timeoutId = setTimeout(() => {
      hideMinimumPricePrompt();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [
    hideMinimumPricePrompt,
    isMinimumPricePromptOpen,
    memberMinimumPrices,
    renderedMinimumPricePrompt,
    targetMembers,
  ]);

  function selectGroup(group: IdolGroup) {
    setSelectedGroupId(group.id);
    setIdolQuery("");
    setTargetMemberIds(group.members.map((member) => member.id));
    setExcludedMemberIds([]);
    setMemberMinimumPrices({});
    setMemberToastMessage("");
    setMemberToastTargetId(null);
    hideMinimumPricePrompt();
  }

  function clearSelectedGroup() {
    setSelectedGroupId(null);
    setIdolQuery("");
    setTargetMemberIds([]);
    setExcludedMemberIds([]);
    setMemberMinimumPrices({});
    setMemberToastMessage("");
    setMemberToastTargetId(null);
    hideMinimumPricePrompt();
  }

  async function addPhotos(files: FileList | null) {
    if (!files) {
      return;
    }

    const imageFiles = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, maxPhotos - photos.length);

    const nextPhotos = await Promise.all(
      imageFiles.map(async (file) => {
        const url = await fileToDataUrl(file);
        photoIdSeed.current += 1;

        return {
          id: `${file.name}-${file.lastModified}-${photoIdSeed.current}`,
          name: file.name,
          url,
        };
      }),
    );

    setPhotos((current) => [...current, ...nextPhotos].slice(0, maxPhotos));
    setCoverPhotoId((current) => current ?? nextPhotos[0]?.id ?? null);
  }

  function removePhoto(photoId: string) {
    setPhotos((current) => {
      return current.filter((item) => item.id !== photoId);
    });
    setCoverPhotoId((current) => {
      if (current !== photoId) {
        return current;
      }

      const nextPhotos = photos.filter((photo) => photo.id !== photoId);

      return nextPhotos[0]?.id ?? null;
    });
  }

  function toggleMemberExclusion(memberId: string) {
    const prompt = renderedMinimumPricePrompt;
    const isCurrentlyExcluded = excludedMemberIds.includes(memberId);
    const nextExcludedMemberIds = isCurrentlyExcluded
      ? excludedMemberIds.filter((id) => id !== memberId)
      : [...excludedMemberIds, memberId];
    const nextActiveMemberCount = allTargetMembers.filter(
      (member) => !nextExcludedMemberIds.includes(member.id),
    ).length;

    if (!isCurrentlyExcluded && nextActiveMemberCount === 0) {
      showMemberToast(memberId, "대상 멤버는 1명 이상 필요해요");
      return;
    }

    setExcludedMemberIds(nextExcludedMemberIds);

    if (!prompt || isCurrentlyExcluded) {
      return;
    }

    const hasEmptyActiveMembers = allTargetMembers.some(
      (member) =>
        member.id !== prompt.memberId &&
        !nextExcludedMemberIds.includes(member.id) &&
        !memberMinimumPrices[member.id]?.trim(),
    );

    if (prompt.memberId === memberId || !hasEmptyActiveMembers) {
      hideMinimumPricePrompt();
    }
  }

  function updateMemberMinimumPrice(memberId: string, price: string) {
    const numericPrice = toNumericInput(price);

    setMemberMinimumPrices((current) => ({
      ...current,
      [memberId]: numericPrice,
    }));

    const trimmedPrice = numericPrice.trim();
    const hasEmptyActiveMembers = targetMembers.some(
      (member) =>
        member.id !== memberId &&
        !memberMinimumPrices[member.id]?.trim(),
    );

    if (trimmedPrice && hasEmptyActiveMembers) {
      showMinimumPricePrompt({ memberId, price: numericPrice });
    } else {
      hideMinimumPricePrompt();
    }
  }

  function applyMinimumPriceToEmptyMembers(price: string) {
    const trimmedPrice = price.trim();

    if (!trimmedPrice || targetMembers.length === 0) {
      return;
    }

    setMemberMinimumPrices((current) => {
      const nextPrices = { ...current };

      targetMembers.forEach((member) => {
        if (!nextPrices[member.id]?.trim()) {
          nextPrices[member.id] = trimmedPrice;
        }
      });

      return nextPrices;
    });
    hideMinimumPricePrompt();
  }

  function toggleShipping(option: string) {
    setSelectedShipping((current) => {
      if (current.includes(option)) {
        return current.filter((item) => item !== option);
      }

      return [...current, option];
    });
  }

  function updateShippingPrice(option: string, price: string) {
    setShippingPrices((current) => ({
      ...current,
      [option]: toNumericInput(price),
    }));
  }

  function getScheduleValue(field: ScheduleField) {
    return field === "closing" ? closingDate : shippingDate;
  }

  function updateScheduleValue(field: ScheduleField, value: string) {
    if (field === "closing") {
      setClosingDate(value);

      if (shippingDate && new Date(shippingDate).getTime() <= new Date(value).getTime()) {
        setShippingDate(addHours(value, 1));
      }

      return;
    }

    if (closingDate && new Date(value).getTime() <= new Date(closingDate).getTime()) {
      setShippingDate(addHours(closingDate, 1));
      return;
    }

    setShippingDate(value);
  }

  function selectSchedulePart(
    field: ScheduleField,
    part: SchedulePart,
    value: number,
  ) {
    const currentValue = getScheduleValue(field);
    const nextParts = getScheduleParts(currentValue);

    if (part === "year") {
      nextParts.year = value;
      nextParts.day = Math.min(
        nextParts.day,
        getDaysInMonth(nextParts.year, nextParts.month),
      );
    }

    if (part === "month") {
      nextParts.month = value;
      nextParts.day = Math.min(
        nextParts.day,
        getDaysInMonth(nextParts.year, nextParts.month),
      );
    }

    if (part === "day") {
      nextParts.day = value;
    }

    if (part === "hour") {
      nextParts.hour = value;
    }

    updateScheduleValue(
      field,
      clampScheduleValue(
        buildScheduleValue(nextParts),
        getMinimumScheduleValue(field),
      ),
    );
  }

  function getMinimumScheduleValue(field: ScheduleField) {
    if (field === "shipping" && closingDate) {
      return addHours(closingDate, 1);
    }

    return getNextAvailableScheduleValue();
  }

  function toggleScheduleField(field: ScheduleField, isActive: boolean) {
    if (isActive) {
      setActiveScheduleField(null);
      return;
    }

    const currentValue = getScheduleValue(field);
    const minimumValue = getMinimumScheduleValue(field);

    if (
      !currentValue ||
      new Date(currentValue).getTime() < new Date(minimumValue).getTime()
    ) {
      updateScheduleValue(field, minimumValue);
    }

    setActiveScheduleField(field);
  }

  async function handleSubmit() {
    if (!canSubmit || !selectedGroup || !coverPhoto) {
      return;
    }

    setSubmitError("");

    const productId = createUploadedProductId();
    const selectedShippingMethods = selectedShipping.map((name) => ({
      name,
      price: formatWon(parsePriceInput(shippingPrices[name])),
    }));
    const firstMember = targetMembers[0];
    const productOptions = targetMembers.map((member) => {
      const minimumPrice = parsePriceInput(
        memberMinimumPrices[member.id] ?? "0",
      );

      return {
        id: `uploaded-option-${member.id}`,
        label: member.name,
        price: formatWon(minimumPrice),
        startingBid: formatWon(minimumPrice),
        currentBid: formatWon(minimumPrice),
        participantCount: 0,
        topBids: ["-", "-", "-"] as [string, string, string],
        avatarInitials: member.initials,
        avatarTone: member.tone,
      };
    }) as [ProductOption, ...ProductOption[]];
    const product: ProductDetailItem = {
      id: productId,
      title: title.trim(),
      member:
        targetMembers.length > 1
          ? `${firstMember.name} 외 ${targetMembers.length - 1}명`
          : firstMember.name,
      era: selectedGroup.name,
      rating: "0.0",
      reviews: "0",
      badge: "신규",
      liked: false,
      tone: "from-zinc-950 via-zinc-700 to-zinc-300",
      courier: selectedShipping[0],
      deadline: formatDateTimeLabel(closingDate) || "일정 미정",
      imageUrl: coverPhoto.url,
      purchaseSource: selectedGroup.name,
      shippingDeadline: formatDateTimeLabel(shippingDate) || "판매자 안내",
      shippingMethods: selectedShippingMethods,
      description:
        description.trim() || "판매자가 아직 상품 설명을 작성하지 않았습니다.",
      options: productOptions,
    };

    try {
      window.sessionStorage.setItem(
        `uploaded-product:${productId}`,
        JSON.stringify(product),
      );
    } catch {
      try {
        const compressedImageUrl = await compressImageDataUrl(coverPhoto.url);

        window.sessionStorage.setItem(
          `uploaded-product:${productId}`,
          JSON.stringify({
            ...product,
            imageUrl: compressedImageUrl,
          }),
        );
      } catch {
        setSubmitError(
          "사진을 자동으로 압축했지만 임시 저장에 실패했습니다. 사진을 줄인 뒤 다시 시도해 주세요.",
        );
        return;
      }
    }

    router.push(`/products/${productId}?from=upload`);
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
          <div className="absolute inset-0 flex flex-col bg-white">
            <header className="shrink-0 border-b border-black bg-black px-4 pb-4 pt-5 text-white">
              <div className="flex h-12 items-center justify-between">
                <button
                  aria-label="이전 화면"
                  className="inline-flex h-11 w-11 items-center justify-center text-white"
                  onClick={() => router.replace("/")}
                  type="button"
                >
                  <BackIcon />
                </button>

                <div className="text-right">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Upload
                  </p>
                  <h1 className="text-[22px] tracking-[-0.05em]">
                    상품 등록
                  </h1>
                </div>
              </div>
            </header>

            <form
              className="tab-content-enter min-h-0 flex-1 overflow-y-auto pb-6"
              onSubmit={(event) => event.preventDefault()}
            >
          <section className="px-4 pt-4">
            <label className="relative z-0 flex aspect-square cursor-pointer overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-zinc-950 via-zinc-700 to-zinc-300">
              {coverPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  src={coverPhoto.url}
                />
              ) : (
                <>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_66%_22%,rgba(255,255,255,0.56),transparent_22%)]" />
                  <div className="absolute bottom-8 left-8 h-[68%] w-[48%] rotate-[-8deg] rounded-[1.2rem] border border-white/35 bg-black/75 shadow-[0_22px_50px_rgba(0,0,0,0.28)]" />
                  <div className="absolute bottom-10 right-8 h-[72%] w-[52%] rotate-[7deg] rounded-[1.2rem] border border-black/10 bg-white/90 shadow-[0_22px_50px_rgba(0,0,0,0.2)]" />
                  <div className="absolute bottom-5 left-5 right-5 rounded-[1rem] bg-white/90 px-4 py-3 backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
                      Photo Upload
                    </p>
                    <p className="mt-1 text-[19px] font-semibold tracking-[-0.05em]">
                      사진 업로드
                    </p>
                  </div>
                </>
              )}

              {coverPhoto ? (
                <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
                  대표 사진
                </span>
              ) : null}

              <span className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black text-white shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
                <PlusIcon />
              </span>
              <input
                accept="image/*"
                className="sr-only"
                multiple
                onChange={(event) => {
                  void addPhotos(event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
                type="file"
              />
            </label>

            <p className="mt-5 text-[12px] font-semibold text-black/40">
              사진을 눌러 대표 사진을 변경할 수 있어요.
            </p>
            <div className="relative z-10 mt-2 grid grid-cols-5 gap-2">
              {photos.map((photo) => {
                const isCover = photo.id === coverPhoto?.id;

                return (
                  <div
                    className="relative"
                    key={photo.id}
                  >
                    <div
                      className="relative aspect-square overflow-hidden rounded-[0.8rem] bg-[#f7f7f7]"
                    >
                      <button
                        aria-label={`${photo.name} 대표 사진으로 설정`}
                        className="h-full w-full"
                        onClick={() => setCoverPhotoId(photo.id)}
                        type="button"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt={photo.name}
                          className="h-full w-full object-cover"
                          src={photo.url}
                        />
                      </button>
                      {isCover ? (
                        <>
                          <span className="pointer-events-none absolute inset-0 rounded-[0.8rem] border-2 border-black" />
                          <span className="absolute bottom-1 left-1 rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold text-white">
                            대표
                          </span>
                        </>
                      ) : null}
                    </div>
                    <button
                      aria-label="사진 삭제"
                      className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-white shadow-[0_6px_14px_rgba(0,0,0,0.22)]"
                      onClick={() => removePhoto(photo.id)}
                      type="button"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                );
              })}

              {photos.length < maxPhotos ? (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-[0.8rem] border border-dashed border-black/15 bg-[#f7f7f7] text-black/25">
                  <PlusIcon />
                  <span className="mt-1 text-[11px] font-semibold text-black/35">
                    ({photos.length}/{maxPhotos})
                  </span>
                  <input
                    accept="image/*"
                    className="sr-only"
                    multiple
                    onChange={(event) => {
                      void addPhotos(event.currentTarget.files);
                      event.currentTarget.value = "";
                    }}
                    type="file"
                  />
                </label>
              ) : null}
            </div>
          </section>

          <section className="px-5 pt-6">
            <label className="block">
              <span className="text-[13px] font-semibold text-black/45">
                상품 제목
              </span>
              <input
                className="mt-2 h-14 w-full rounded-[0.9rem] border border-black/10 px-4 text-[17px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                onChange={(event) => setTitle(event.currentTarget.value)}
                placeholder="예: LOVE DIVE 원영 미공포 분철"
                value={title}
              />
            </label>

            <div className="mt-7 border-t border-black/10 pt-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                아이돌 선택
              </h2>
              {selectedGroup ? (
                <div
                  className="idol-selection-enter mt-3 rounded-[0.9rem] border border-black/10 px-4 py-4"
                  key="selected-idol"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-black/45">
                        선택된 아이돌
                      </span>
                      <span className="mt-1 block text-[17px] font-semibold tracking-[-0.05em]">
                        {selectedGroup.name}
                      </span>
                    </span>
                    <button
                      className="shrink-0 rounded-full bg-[#f7f7f7] px-4 py-2 text-[13px] font-semibold text-black/60 ring-1 ring-black/10"
                      onClick={clearSelectedGroup}
                      type="button"
                    >
                      변경
                    </button>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <p className="text-[16px] font-semibold tracking-[-0.04em]">
                      대상 멤버
                    </p>
                    <span className="shrink-0 text-[13px] font-semibold text-black/45">
                      {targetMembers.length}/{allTargetMembers.length}명
                    </span>
                  </div>

                  {allTargetMembers.length > 0 ? (
                    <div className="mt-4">
                      <div className="space-y-2">
                        {allTargetMembers.map((member, index) => {
                          const isExcluded = excludedMemberIds.includes(
                            member.id,
                          );
                          const shouldShowToast =
                            memberToastMessage &&
                            memberToastTargetId === member.id;
                          const isLastMember =
                            index === allTargetMembers.length - 1;
                          const shouldShowPrompt =
                            renderedMinimumPricePrompt?.memberId ===
                              member.id &&
                            isMinimumPricePromptOpen &&
                            !isExcluded;

                          return (
                            <div className="relative" key={member.id}>
                              <div
                                className={`flex min-w-0 items-center gap-3 rounded-[0.8rem] bg-[#f7f7f7] px-3 py-3 ${
                                  isExcluded ? "opacity-40" : ""
                                }`}
                              >
                                <div
                                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${member.tone} text-[12px] font-semibold tracking-[-0.04em] text-black ring-1 ring-black/10`}
                                >
                                  {member.initials}
                                </div>
                                <p className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.04em]">
                                  {member.name}
                                </p>
                                <label className="flex h-9 w-24 shrink-0 items-center rounded-[0.65rem] bg-white px-2 ring-1 ring-black/10 focus-within:ring-black">
                                  <input
                                    aria-label={`${member.name} 최소 가격`}
                                    className="min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 disabled:text-black/40"
                                    disabled={isExcluded}
                                    inputMode="numeric"
                                    onChange={(event) =>
                                      updateMemberMinimumPrice(
                                        member.id,
                                        event.currentTarget.value,
                                      )
                                    }
                                    placeholder="0"
                                    type="text"
                                    value={memberMinimumPrices[member.id] ?? ""}
                                  />
                                  <span className="ml-1 shrink-0 text-[11px] font-semibold text-black/35">
                                    원
                                  </span>
                                </label>
                                <button
                                  aria-label={
                                    isExcluded
                                      ? `${member.name} 다시 포함`
                                      : `${member.name} 제외`
                                  }
                                  className={`inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-white font-semibold ring-1 ring-black/10 ${
                                    isExcluded
                                      ? "w-8 text-black"
                                      : "w-8 text-black/55"
                                  }`}
                                  onClick={() =>
                                    toggleMemberExclusion(member.id)
                                  }
                                  type="button"
                                >
                                  {isExcluded ? <PlusIcon /> : <CloseIcon />}
                                </button>
                              </div>

                              {shouldShowToast ? (
                                <p
                                  aria-live="polite"
                                  className={`soft-panel-enter pointer-events-none absolute left-3 right-3 z-10 rounded-full bg-black px-3 py-2 text-center text-[12px] font-semibold tracking-[-0.04em] text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)] ${
                                    isLastMember
                                      ? "bottom-full mb-2"
                                      : "top-full mt-2"
                                  }`}
                                  role="status"
                                >
                                  {memberToastMessage}
                                </p>
                              ) : null}

                              {shouldShowPrompt &&
                              renderedMinimumPricePrompt ? (
                                <div
                                  className={`minimum-price-prompt mt-2 flex items-center justify-between gap-3 rounded-[0.8rem] bg-black px-3 py-2 text-white ${
                                    isMinimumPricePromptOpen
                                      ? "minimum-price-prompt--open"
                                      : "minimum-price-prompt--closed"
                                  }`}
                                >
                                  <p className="min-w-0 text-[12px] font-semibold">
                                    나머지도 같은 가격으로 채울까요?
                                  </p>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <button
                                      aria-label="최소 가격 전체 적용 취소"
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-[14px] font-semibold text-white"
                                      onClick={hideMinimumPricePrompt}
                                      type="button"
                                    >
                                      ×
                                    </button>
                                    <button
                                      aria-label="비어있는 멤버에 최소 가격 적용"
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[13px] font-semibold text-black"
                                      onClick={() =>
                                        applyMinimumPriceToEmptyMembers(
                                          renderedMinimumPricePrompt.price,
                                        )
                                      }
                                      type="button"
                                    >
                                      ✓
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 rounded-[0.8rem] bg-[#f7f7f7] px-4 py-5 text-[14px] font-medium text-black/45">
                      대상 멤버가 없습니다.
                    </p>
                  )}
                </div>
              ) : (
                <div
                  className="idol-selection-enter"
                  key="idol-search"
                >
                  <label className="mt-3 flex h-14 items-center gap-3 rounded-[0.9rem] border border-black/10 bg-[#f7f7f7] px-4 focus-within:border-black">
                    <input
                      className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/30"
                      onChange={(event) =>
                        setIdolQuery(event.currentTarget.value)
                      }
                      placeholder="아이돌, 그룹, 멤버 검색"
                      value={idolQuery}
                    />
                    <SearchIcon />
                  </label>

                  {idolQuery.trim() ? (
                    <div className="mt-3 overflow-hidden rounded-[0.9rem] border border-black/10">
                      {idolResults.length > 0 ? (
                        idolResults.map((group) => {
                          const memberPreview = group.members
                            .map((member) => member.name)
                            .slice(0, 4)
                            .join(", ");

                          return (
                            <button
                              className="flex w-full items-center justify-between gap-4 border-b border-black/10 bg-white px-4 py-3 text-left last:border-b-0"
                              key={group.id}
                              onClick={() => selectGroup(group)}
                              type="button"
                            >
                              <span className="min-w-0">
                                <span className="block text-[15px] font-semibold tracking-[-0.04em]">
                                  {group.name}
                                </span>
                                <span className="mt-1 block truncate text-[13px] font-medium text-black/45">
                                  {memberPreview}
                                </span>
                              </span>
                              <span className="shrink-0 text-[12px] font-semibold text-black/35">
                                선택
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <p className="px-4 py-5 text-[14px] font-medium text-black/45">
                          검색 결과가 없습니다.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="mt-7 border-t border-black/10 pt-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                배송 방법
              </h2>
              <div className="mt-3 space-y-2">
                {shippingOptions.map((option) => {
                  const isSelected = selectedShipping.includes(option);

                  return (
                    <div key={option}>
                      <button
                        className={`flex min-h-12 w-full items-center justify-between rounded-[0.8rem] px-4 text-left ${
                          isSelected
                            ? "bg-black text-white"
                            : "bg-[#f7f7f7] text-black"
                        }`}
                        onClick={() => toggleShipping(option)}
                        type="button"
                      >
                        <span className="text-[14px] font-semibold tracking-[-0.04em]">
                          {option}
                        </span>
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                            isSelected
                              ? "border-white bg-white text-black"
                              : "border-black/15"
                          }`}
                        >
                          {isSelected ? <CloseIcon /> : null}
                        </span>
                      </button>

                      <SoftPanel className="mt-2" isOpen={isSelected}>
                        <label className="block rounded-[0.9rem] border border-black/10 px-4 py-4">
                          <span className="text-[13px] font-semibold text-black/45">
                            배송비
                          </span>
                          <div className="mt-2 flex h-13 items-center rounded-[0.85rem] border border-black/10 bg-[#f7f7f7] px-4 focus-within:border-black">
                            <input
                              aria-label={`${option} 배송비`}
                              className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25"
                              inputMode="numeric"
                              onChange={(event) =>
                                updateShippingPrice(
                                  option,
                                  event.currentTarget.value,
                                )
                              }
                              placeholder="예: 3,000"
                              type="text"
                              value={shippingPrices[option] ?? ""}
                            />
                            <span className="shrink-0 text-[14px] font-semibold text-black/45">
                              원
                            </span>
                          </div>
                        </label>
                      </SoftPanel>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-7 border-t border-black/10 pt-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.05em]">
                일정
              </h2>
              <div className="mt-3 grid gap-3">
                {(
                  [
                    ["closing", "마감 기한", closingDate],
                    ["shipping", "발송 기한", shippingDate],
                  ] as const
                ).map(([field, label, value]) => {
                  let scheduleParts = getScheduleParts(value);
                  const minScheduleValue =
                    field === "closing"
                      ? getNextAvailableScheduleValue()
                      : closingDate
                        ? addHours(closingDate, 1)
                        : getNextAvailableScheduleValue();
                  const minScheduleParts = getScheduleParts(minScheduleValue);
                  const isBeforeMinSchedule =
                    minScheduleValue &&
                    (!value ||
                      new Date(buildScheduleValue(scheduleParts)).getTime() <
                        new Date(minScheduleValue).getTime());

                  if (isBeforeMinSchedule) {
                    scheduleParts = minScheduleParts;
                  }
                  const visibleYearOptions = getYearOptions(
                    minScheduleParts.year,
                  );
                  const visibleMonthOptions = monthOptions.filter((month) => {
                        if (scheduleParts.year > minScheduleParts.year) {
                          return true;
                        }

                        return month >= minScheduleParts.month;
                      });
                  const dayOptions = Array.from(
                    {
                      length: getDaysInMonth(
                        scheduleParts.year,
                        scheduleParts.month,
                      ),
                    },
                    (_, index) => index + 1,
                  );
                  const visibleDayOptions = dayOptions.filter((day) => {
                        const isSameMonth =
                          scheduleParts.year === minScheduleParts.year &&
                          scheduleParts.month === minScheduleParts.month;

                        return !isSameMonth || day >= minScheduleParts.day;
                      });
                  const visibleHourOptions = hourOptions.filter((hour) => {
                        const isSameDate =
                          scheduleParts.year === minScheduleParts.year &&
                          scheduleParts.month === minScheduleParts.month &&
                          scheduleParts.day === minScheduleParts.day;

                        return !isSameDate || hour >= minScheduleParts.hour;
                      });
                  const isActive = activeScheduleField === field;

                  return (
                    <div key={field}>
                      <span className="text-[13px] font-semibold text-black/45">
                        {label}
                      </span>
                      <button
                        className={`mt-2 flex h-14 w-full items-center justify-between rounded-[0.9rem] border px-4 text-left outline-none ${
                          isActive
                            ? "border-black bg-white"
                            : "border-black/10 bg-white"
                        }`}
                        onClick={() =>
                          toggleScheduleField(field, isActive)
                        }
                        type="button"
                      >
                        <span
                          className={`min-w-0 truncate text-[15px] font-semibold tracking-[-0.04em] [font-variant-numeric:tabular-nums] ${
                            value ? "text-black" : "text-black/25"
                          }`}
                        >
                          {formatDateTimeLabel(value) || "날짜와 시간 선택"}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                            isActive
                              ? "bg-black text-white"
                              : "bg-[#f7f7f7] text-black/45"
                          }`}
                        >
                          선택
                        </span>
                      </button>

                      <SoftPanel className="mt-2" isOpen={isActive}>
                        <div className="rounded-[0.95rem] border border-black/10 bg-[#f7f7f7] p-3">
                          <div className="grid grid-cols-[1.25fr_0.85fr_0.85fr_0.85fr] gap-2">
                            <ScheduleWheel
                              field={field}
                              label="연"
                              onSelect={selectSchedulePart}
                              options={visibleYearOptions}
                              part="year"
                              selectedValue={scheduleParts.year}
                            />
                            <ScheduleWheel
                              formatter={padNumber}
                              field={field}
                              label="월"
                              onSelect={selectSchedulePart}
                              options={visibleMonthOptions}
                              part="month"
                              selectedValue={scheduleParts.month}
                            />
                            <ScheduleWheel
                              formatter={padNumber}
                              field={field}
                              label="일"
                              onSelect={selectSchedulePart}
                              options={visibleDayOptions}
                              part="day"
                              selectedValue={scheduleParts.day}
                            />
                            <ScheduleWheel
                              field={field}
                              formatter={padNumber}
                              label="시"
                              onSelect={selectSchedulePart}
                              options={visibleHourOptions}
                              part="hour"
                              selectedValue={scheduleParts.hour}
                            />
                          </div>
                        </div>
                      </SoftPanel>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-7 border-t border-black/10 pt-6">
              <label className="block">
                <span className="text-[13px] font-semibold text-black/45">
                  상품 설명
                </span>
                <textarea
                  className="mt-2 min-h-28 w-full resize-none rounded-[0.9rem] border border-black/10 px-4 py-3 text-[15px] leading-6 tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                  onChange={(event) => setDescription(event.currentTarget.value)}
                  placeholder="구성, 하자, 포장 방식, 발송 예정일을 적어주세요."
                  value={description}
                />
              </label>
            </div>

            <button
              className="mt-8 h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.04em] text-white disabled:bg-black/20"
              disabled={!canSubmit}
              onClick={handleSubmit}
              type="button"
            >
              등록하기
            </button>
            {submitError ? (
              <p className="mt-3 break-keep text-center text-[13px] font-semibold leading-5 text-black/55">
                {submitError}
              </p>
            ) : null}
          </section>
            </form>
          </div>
        </div>

        <BottomNavigator activeLabel="Upload" />
      </div>
    </main>
  );
}
