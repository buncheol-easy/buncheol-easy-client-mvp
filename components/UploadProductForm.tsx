"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { BackIcon, CloseIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { BottomNavigator } from "@/components/BottomNavigator";
import {
  readUploadedProduct,
  writeUploadedProduct,
} from "@/lib/hosted-products-store";
import {
  createBuncheol,
  requestBuncheolDetail,
  requestGroupMembers,
  requestGroups,
  requestMyHostedBuncheols,
  toProductDetailItem,
  updateBuncheol,
} from "@/lib/auth-api";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import { rankGroupSearchResults } from "@/lib/group-presenters";
import type { IdolGroup } from "@/lib/mock-idol-directory";
import { idolDirectory } from "@/lib/mock-idol-directory";
import type { ProductDetailItem, ProductOption } from "@/lib/mock-products";

type PhotoPreview = {
  file?: File;
  id: string;
  name: string;
  url: string;
  existingImageId?: number;
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

type UploadProductFormProps = {
  editProductId?: string;
  returnSource?: "home" | "profile" | "bids" | "favorites" | "upload";
};

const shippingOptions = ["GS25 반값택배", "CU 알뜰택배"];
const maxPhotos = 5;
const scheduleYearOptionCount = 5;
const hourOptions = Array.from({ length: 24 }, (_, index) => index);
const minimumPricePromptExitDelay = 220;

type ScheduleField = "closing";
type SchedulePart = "year" | "month" | "day" | "hour";

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function parsePriceInput(value: string) {
  return Number(value.replace(/[^\d]/g, "")) || 0;
}

function isHundredWonAmount(value: number) {
  return Number.isInteger(value) && value > 0 && value % 100 === 0;
}

function isValidMinHeadcount(value: string, maxHeadcount: number) {
  const parsedValue = Number(value);

  return (
    Number.isInteger(parsedValue) &&
    parsedValue >= 1 &&
    parsedValue <= maxHeadcount
  );
}

function toNumericInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getMemberTone(seed: string) {
  const tones = [
    "from-zinc-950 via-zinc-600 to-zinc-200",
    "from-neutral-200 via-white to-zinc-500",
    "from-zinc-300 via-zinc-50 to-neutral-500",
    "from-black via-zinc-700 to-stone-300",
  ];
  const hash = [...seed].reduce((sum, character) => sum + character.charCodeAt(0), 0);

  return tones[hash % tones.length];
}

function getStoreShippingFee(
  selectedShipping: string[],
  shippingPrices: Record<string, string>,
  store: "CU" | "GS",
) {
  const shippingName = selectedShipping.find((name) =>
    name.toUpperCase().includes(store),
  );

  return shippingName ? parsePriceInput(shippingPrices[shippingName] ?? "") : 0;
}

function getUploadShippingOptionName(name: string) {
  const upperName = name.toUpperCase();

  if (upperName.includes("GS25") || upperName.includes("GS")) {
    return shippingOptions[0];
  }

  if (upperName.includes("CU")) {
    return shippingOptions[1];
  }

  return name;
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

// 마감 기한 설정
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

function toScheduleInputValue(value: string) {
  const match = value
    .trim()
    .match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})(?:\D+(\d{1,2})(?::\d{2})?)?/);

  if (!match) {
    return "";
  }

  const [, year, month, day, hour = "0"] = match;

  return `${year}-${padNumber(Number(month))}-${padNumber(
    Number(day),
  )}T${padNumber(Number(hour))}:00`;
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

async function dataUrlToFile(dataUrl: string, fileName: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  return new File([blob], fileName, {
    type: blob.type || "image/jpeg",
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      resolve(String(reader.result));
    });
    reader.addEventListener("error", () => {
      reject(reader.error);
    });
    reader.readAsDataURL(blob);
  });
}

function createUploadedProductId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `uploaded-${crypto.randomUUID()}`;
  }

  return `uploaded-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function compressImageDataUrl(
  dataUrl: string,
  { maxSize = 900, quality = 0.66 } = {},
) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();

    image.addEventListener("load", () => {
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
        quality,
      );
    });
    image.addEventListener("error", () => {
      reject(new Error("Image load failed"));
    });
    image.src = dataUrl;
  });
}

function canExportImageThroughCanvas(imageUrl: string) {
  return imageUrl.startsWith("data:") || imageUrl.startsWith("blob:");
}

const editableImageProxyHosts = new Set([
  "buncheol-easy-bucket.s3.ap-northeast-2.amazonaws.com",
  "buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
  "staging-buncheoleasy-bucket.s3.ap-northeast-2.amazonaws.com",
]);

function getEditableImageFetchUrl(imageUrl: string) {
  try {
    const parsedImageUrl = new URL(imageUrl);

    if (
      parsedImageUrl.protocol === "https:" &&
      editableImageProxyHosts.has(parsedImageUrl.hostname) &&
      parsedImageUrl.pathname.startsWith("/buncheols/")
    ) {
      return `/api/group-image?url=${encodeURIComponent(imageUrl)}`;
    }
  } catch {
    return imageUrl;
  }

  return imageUrl;
}

async function imageUrlToUploadFile(imageUrl: string, fileName: string) {
  if (canExportImageThroughCanvas(imageUrl)) {
    return dataUrlToFile(imageUrl, fileName);
  }

  const response = await fetch(getEditableImageFetchUrl(imageUrl));

  if (!response.ok) {
    throw new Error("Image fetch failed");
  }

  const blob = await response.blob();
  const dataUrl = await blobToDataUrl(blob);
  const compressedDataUrl = await compressImageDataUrl(dataUrl);

  return dataUrlToFile(compressedDataUrl, fileName);
}

async function writeApiProductPreview(product: ProductDetailItem) {
  try {
    writeUploadedProduct(product);
    return;
  } catch {
    // Retry below with smaller images so the API-created page keeps a preview.
  }

  const imageUrls = product.imageUrls?.length
    ? product.imageUrls
    : product.imageUrl
      ? [product.imageUrl]
      : [];

  if (imageUrls.length === 0) {
    return;
  }

  try {
    const compressedImageUrls = await Promise.all(
      imageUrls.map((imageUrl) =>
        canExportImageThroughCanvas(imageUrl)
          ? compressImageDataUrl(imageUrl, { maxSize: 560, quality: 0.5 })
          : Promise.resolve(imageUrl),
      ),
    );

    writeUploadedProduct({
      ...product,
      imageUrl: compressedImageUrls[0] ?? product.imageUrl,
      imageUrls: compressedImageUrls,
    });
  } catch {
    // API save succeeded; the preview cache is best-effort.
  }
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

export function UploadProductForm({
  editProductId,
  returnSource,
}: UploadProductFormProps) {
  const router = useRouter();
  const isEditMode = Boolean(editProductId);
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [photoLimitToast, setPhotoLimitToast] = useState("");
  const photoIdSeed = useRef(0);
  const formScrollRef = useRef<HTMLFormElement | null>(null);
  const photoLimitToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const minimumPricePromptTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const memberToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [purchaseSource, setPurchaseSource] = useState("");
  const [idolQuery, setIdolQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [targetMemberIds, setTargetMemberIds] = useState<string[]>([]);
  const [excludedMemberIds, setExcludedMemberIds] = useState<string[]>([]);
  const [memberMinimumPrices, setMemberMinimumPrices] = useState<
    Record<string, string>
  >({});
  const [minHeadcount, setMinHeadcount] = useState("");
  const [renderedMinimumPricePrompt, setRenderedMinimumPricePrompt] =
    useState<MinimumPricePrompt | null>(null);
  const [isMinimumPricePromptOpen, setIsMinimumPricePromptOpen] =
    useState(false);
  const [closingDate, setClosingDate] = useState("");
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
  const [editingProduct, setEditingProduct] =
    useState<ProductDetailItem | null>(null);
  const [isApiEditLoading, setIsApiEditLoading] = useState(false);
  const [remoteGroups, setRemoteGroups] = useState<IdolGroup[]>([]);
  const [isGroupSearchLoading, setIsGroupSearchLoading] = useState(false);
  const [didGroupSearchFail, setDidGroupSearchFail] = useState(false);
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );

  const selectedGroup = useMemo(() => {
    return (
      [...remoteGroups, ...idolDirectory].find(
        (group) => group.id === selectedGroupId,
      ) ?? null
    );
  }, [remoteGroups, selectedGroupId]);

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => index + 1),
    [],
  );

  const idolResults = useMemo(() => {
    const query = idolQuery.trim().toLowerCase();

    if (!query) {
      return [];
    }

    const remoteResults = rankGroupSearchResults(remoteGroups, idolQuery, 3);

    if (
      remoteResults.length > 0 ||
      isGroupSearchLoading ||
      !didGroupSearchFail
    ) {
      return remoteResults;
    }

    const localResults = idolDirectory.filter((group) => {
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
    const uniqueResults = localResults.filter(
      (group, index, groups) =>
        groups.findIndex((candidate) => candidate.id === group.id) === index,
    );
    return rankGroupSearchResults(uniqueResults, idolQuery, 3);
  }, [didGroupSearchFail, idolQuery, isGroupSearchLoading, remoteGroups]);

  const allTargetMembers =
    selectedGroup?.members.filter((member) =>
      targetMemberIds.includes(member.id),
    ) ?? [];
  const targetMembers = allTargetMembers.filter(
    (member) => !excludedMemberIds.includes(member.id),
  );
  const coverPhoto =
    photos.find((photo) => photo.id === coverPhotoId) ?? photos[0] ?? null;
  const isApiEditMode =
    Boolean(editProductId) && !String(editProductId).startsWith("uploaded-");
  const submitBlockReason = (() => {
    if (photos.length === 0) {
      return "사진을 1장 이상 올려 주세요.";
    }

    if (!title.trim()) {
      return "상품명을 입력해 주세요.";
    }

    if (isApiEditMode) {
      return "";
    }

    if (!purchaseSource.trim()) {
      return "구매처를 입력해 주세요.";
    }

    if (targetMembers.length === 0) {
      return "그룹과 멤버를 선택해 주세요.";
    }

    if (
      targetMembers.some(
        (member) =>
          !isHundredWonAmount(
            parsePriceInput(memberMinimumPrices[member.id] ?? ""),
          ),
      )
    ) {
      return "옵션 가격을 100원 단위로 입력해 주세요.";
    }

    if (!isValidMinHeadcount(minHeadcount, targetMembers.length)) {
      return `최소 진행 인원을 1-${targetMembers.length}명으로 입력해 주세요.`;
    }

    if (selectedShipping.length === 0) {
      return "배송 방법을 선택해 주세요.";
    }

    if (
      selectedShipping.some(
        (option) =>
          !isHundredWonAmount(parsePriceInput(shippingPrices[option] ?? "")),
      )
    ) {
      return "배송비를 100원 단위로 입력해 주세요.";
    }

    return "";
  })();
  const canSubmit = submitBlockReason === "";
  useEffect(() => {
    return () => {
      if (photoLimitToastTimeoutRef.current) {
        clearTimeout(photoLimitToastTimeoutRef.current);
      }

      if (minimumPricePromptTimeoutRef.current) {
        clearTimeout(minimumPricePromptTimeoutRef.current);
      }

      if (memberToastTimeoutRef.current) {
        clearTimeout(memberToastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const query = idolQuery.trim();
    let isActive = true;
    let stateFrame: number | null = null;

    if (!query) {
      stateFrame = window.requestAnimationFrame(() => {
        if (!isActive) {
          return;
        }

        setIsGroupSearchLoading(false);
        setDidGroupSearchFail(false);
      });

      return () => {
        isActive = false;
        if (stateFrame !== null) {
          window.cancelAnimationFrame(stateFrame);
        }
      };
    }

    stateFrame = window.requestAnimationFrame(() => {
      if (!isActive) {
        return;
      }

      setIsGroupSearchLoading(true);
      setDidGroupSearchFail(false);
    });

    requestGroups(query)
      .then(async (groups) => {
        const nextGroups = await Promise.all(
          rankGroupSearchResults(groups, query, 3).map(async (group) => {
            const members = await requestGroupMembers(group.id);

            return {
              id: group.id,
              name: group.name,
              label: group.name,
              aliases: [group.name],
              members: members.map((member) => ({
                id: member.id,
                imageUrl: member.imageUrl,
                name: member.name,
                initials: getInitials(member.name),
                tone: getMemberTone(member.id),
              })),
            } satisfies IdolGroup;
          }),
        );

        if (!isActive) {
          return;
        }

        setRemoteGroups((current) => {
          const mergedGroups = [...nextGroups, ...current];

          return mergedGroups.filter(
            (group, index, groups) =>
              groups.findIndex((candidate) => candidate.id === group.id) ===
              index,
          );
        });
        setIsGroupSearchLoading(false);
        setDidGroupSearchFail(false);
      })
      .catch(() => {
        if (isActive) {
          setRemoteGroups((current) => current);
          setIsGroupSearchLoading(false);
          setDidGroupSearchFail(true);
        }
      });

    return () => {
      isActive = false;
      if (stateFrame !== null) {
        window.cancelAnimationFrame(stateFrame);
      }
    };
  }, [idolQuery]);

  useEffect(() => {
    if (!editProductId) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const product = readUploadedProduct(editProductId);

      if (!product) {
        const accessToken = authState.accessToken;

        if (!editProductId.startsWith("uploaded-")) {
          if (!accessToken) {
            setIsApiEditLoading(false);
            setSubmitError("로그인 후 수정할 수 있어요.");
            return;
          }

          setIsApiEditLoading(true);
          setSubmitError("");
          requestBuncheolDetail(accessToken, editProductId)
            .then((detail) => {
              const apiProduct = toProductDetailItem(detail);
              const apiGroup: IdolGroup = {
                id: `api-edit-${editProductId}`,
                name: apiProduct.era,
                label: apiProduct.era,
                aliases: [apiProduct.era],
                members: apiProduct.options.map((option) => ({
                  id: option.buncheolMemberId ?? option.id,
                  imageUrl: option.imageUrl,
                  name: option.label,
                  initials: getInitials(option.label),
                  tone: getMemberTone(option.id),
                })),
              };

              setRemoteGroups((current) => [apiGroup, ...current]);
              setEditingProduct(apiProduct);
              setTitle(apiProduct.title);
              setPurchaseSource(apiProduct.purchaseSource ?? "");
              setSelectedGroupId(apiGroup.id);
              setIdolQuery("");
              setTargetMemberIds(apiGroup.members.map((member) => member.id));
              setExcludedMemberIds([]);
              setMinHeadcount(
                apiProduct.minHeadcount
                  ? String(apiProduct.minHeadcount)
                  : String(apiGroup.members.length),
              );
              setMemberMinimumPrices(
                apiGroup.members.reduce<Record<string, string>>(
                  (prices, member) => {
                    const option = apiProduct.options.find(
                      (option) => option.label === member.name,
                    );

                    prices[member.id] = toNumericInput(
                      option?.startingBid ??
                        option?.price ??
                        option?.currentBid ??
                        "",
                    );

                    return prices;
                  },
                  {},
                ),
              );
              setClosingDate(toScheduleInputValue(apiProduct.deadline));
              setSelectedShipping(
                apiProduct.shippingMethods?.map((method) =>
                  getUploadShippingOptionName(method.name),
                ) ?? [],
              );
              setShippingPrices(
                (apiProduct.shippingMethods ?? []).reduce<
                  Record<string, string>
                >((prices, method) => {
                  prices[getUploadShippingOptionName(method.name)] =
                    toNumericInput(method.price);

                  return prices;
                }, {}),
              );
              setDescription(apiProduct.description);

              const restoredPhotos = (apiProduct.imageUrls?.length
                ? apiProduct.imageUrls
                : apiProduct.imageUrl
                  ? [apiProduct.imageUrl]
                  : []
              )
                .slice(0, maxPhotos)
                .map((imageUrl, index) => ({
                  id: `existing-photo-${index}`,
                  name: index === 0 ? "기존 대표 사진" : `기존 사진 ${index + 1}`,
                  url: imageUrl,
                  existingImageId: apiProduct.imageIds?.[index],
                }));

              setPhotos(restoredPhotos);
              setCoverPhotoId(restoredPhotos[0]?.id ?? null);
            })
            .catch((error: unknown) => {
              setSubmitError(
                error instanceof Error
                  ? error.message
                  : "수정할 분철 정보를 찾을 수 없습니다.",
              );
            })
            .finally(() => {
              setIsApiEditLoading(false);
            });
          return;
        }

        setSubmitError("수정할 분철 정보를 찾을 수 없습니다.");
        return;
      }

      const group =
        idolDirectory.find((group) => group.name === product.era) ??
        idolDirectory.find((group) => {
          const memberNames = product.targetMembers ?? [product.member];

          return group.members.some((member) =>
            memberNames.includes(member.name),
          );
        }) ??
        null;
      const optionLabels = new Set(
        product.options.map((option) => option.label),
      );
      const targetMemberNames =
        product.targetMembers ?? product.options.map((option) => option.label);
      const selectedMembers =
        group?.members.filter((member) => {
          return (
            targetMemberNames.includes(member.name) ||
            optionLabels.has(member.name)
          );
        }) ?? [];
      const minimumPrices = selectedMembers.reduce<Record<string, string>>(
        (prices, member) => {
          const option = product.options.find(
            (option) => option.label === member.name,
          );

          prices[member.id] = toNumericInput(
            option?.startingBid ?? option?.price ?? option?.currentBid ?? "",
          );

          return prices;
        },
        {},
      );
      const shippingMethods = product.shippingMethods?.length
        ? product.shippingMethods
        : [{ name: product.courier, price: "" }];

      setEditingProduct(product);
      setTitle(product.title);
      setPurchaseSource(product.purchaseSource ?? "");
      setSelectedGroupId(group?.id ?? null);
      setIdolQuery("");
      setTargetMemberIds(selectedMembers.map((member) => member.id));
      setMinHeadcount(String(product.minHeadcount ?? Math.max(1, selectedMembers.length)));
      setExcludedMemberIds(
        selectedMembers
          .filter((member) => !optionLabels.has(member.name))
          .map((member) => member.id),
      );
      setMemberMinimumPrices(minimumPrices);
      setClosingDate(toScheduleInputValue(product.deadline));
      setSelectedShipping(
        shippingMethods.map((method) => getUploadShippingOptionName(method.name)),
      );
      setShippingPrices(
        shippingMethods.reduce<Record<string, string>>((prices, method) => {
          prices[getUploadShippingOptionName(method.name)] = toNumericInput(
            method.price,
          );

          return prices;
        }, {}),
      );
      setDescription(product.description);

      const storedImageUrls = product.imageUrls?.length
        ? product.imageUrls
        : product.imageUrl
          ? [product.imageUrl]
          : [];

      if (storedImageUrls.length > 0) {
        const restoredPhotos = storedImageUrls
          .slice(0, maxPhotos)
          .map((imageUrl, index) => ({
            id: `existing-photo-${index}`,
            name: index === 0 ? "기존 대표 사진" : `기존 사진 ${index + 1}`,
            url: imageUrl,
            existingImageId: product.imageIds?.[index],
          }));

        setPhotos(restoredPhotos);
        setCoverPhotoId(restoredPhotos[0]?.id ?? null);
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [authState.accessToken, editProductId]);

  function showPhotoLimitToast(message: string) {
    setPhotoLimitToast(message);

    if (photoLimitToastTimeoutRef.current) {
      clearTimeout(photoLimitToastTimeoutRef.current);
    }

    photoLimitToastTimeoutRef.current = setTimeout(() => {
      setPhotoLimitToast("");
      photoLimitToastTimeoutRef.current = null;
    }, 2200);
  }

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
    setMinHeadcount(String(group.members.length));
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
    setMinHeadcount("");
    setMemberMinimumPrices({});
    setMemberToastMessage("");
    setMemberToastTargetId(null);
    hideMinimumPricePrompt();
  }

  async function addPhotos(files: FileList | null) {
    if (!files) {
      return;
    }

    const allImageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    const remainingSlots = Math.max(0, maxPhotos - photos.length);
    const imageFiles = allImageFiles.slice(0, remainingSlots);

    if (allImageFiles.length > remainingSlots) {
      showPhotoLimitToast("사진은 최대 5장까지 업로드할 수 있어요.");
    }

    if (imageFiles.length === 0) {
      return;
    }

    const nextPhotos = await Promise.all(
      imageFiles.map(async (file) => {
        const url = await fileToDataUrl(file);
        photoIdSeed.current += 1;

        return {
          file,
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
    setMinHeadcount((current) => {
      const parsedValue = Number(current);

      if (!Number.isInteger(parsedValue) || parsedValue < 1) {
        return String(nextActiveMemberCount);
      }

      return String(Math.min(parsedValue, nextActiveMemberCount));
    });

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

  function updateMinHeadcount(value: string) {
    const numericValue = toNumericInput(value);

    if (!numericValue) {
      setMinHeadcount("");
      return;
    }

    setMinHeadcount(
      String(Math.min(Number(numericValue), Math.max(1, targetMembers.length))),
    );
  }

  function updateShippingPrice(option: string, price: string) {
    setShippingPrices((current) => ({
      ...current,
      [option]: toNumericInput(price),
    }));
  }
  function getScheduleValue(field: ScheduleField) {
    void field;
    return closingDate;
  }

  function updateScheduleValue(field: ScheduleField, value: string) {
    void field;
    setClosingDate(value);
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
    void field;
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

    const productId = editingProduct?.id ?? createUploadedProductId();
    const selectedShippingMethods = selectedShipping.map((name) => ({
      name,
      price: formatWon(parsePriceInput(shippingPrices[name])),
    }));
    const orderedPhotos = [
      coverPhoto,
      ...photos.filter((photo) => photo.id !== coverPhoto.id),
    ];
    const orderedPhotoUrls = orderedPhotos.map((photo) => photo.url);
    const accessToken = authState.accessToken;
    const apiGroupId = Number(selectedGroup.id);
    const apiMembers = targetMembers.map((member) => ({
      price: parsePriceInput(memberMinimumPrices[member.id] ?? "0"),
      memberId: Number(member.id),
    }));
    const isApiEditMode = isEditMode && !productId.startsWith("uploaded-");
    const parsedMinHeadcount = Number(minHeadcount);
    const hasInvalidAmount =
      apiMembers.some((member) => !isHundredWonAmount(member.price)) ||
      selectedShipping.some(
        (option) =>
          !isHundredWonAmount(parsePriceInput(shippingPrices[option] ?? "")),
      );
    let storedPhotoUrls: string[];

    try {
      storedPhotoUrls = await Promise.all(
        orderedPhotoUrls.map((imageUrl) => {
          if (isApiEditMode && !canExportImageThroughCanvas(imageUrl)) {
            return Promise.resolve(imageUrl);
          }

          return compressImageDataUrl(imageUrl);
        }),
      );
    } catch {
      setSubmitError(
        "사진을 임시 저장용으로 압축하지 못했습니다. 사진을 줄인 뒤 다시 시도해 주세요.",
      );
      return;
    }

    const firstMember = targetMembers[0];
    const productOptions = targetMembers.map((member) => {
      const minimumPrice = parsePriceInput(
        memberMinimumPrices[member.id] ?? "0",
      );
      const previousOption = editingProduct?.options.find(
        (option) => option.label === member.name,
      );
      const hasExistingBids =
        (previousOption?.participantCount ?? 0) > 0 ||
        (previousOption?.topBids?.some((bid) => bid !== "-") ?? false);
      const formattedMinimumPrice = formatWon(minimumPrice);

      return {
        id: `uploaded-option-${member.id}`,
        label: member.name,
        price: formattedMinimumPrice,
        startingBid: formattedMinimumPrice,
        currentBid:
          hasExistingBids && previousOption
            ? previousOption.currentBid
            : formattedMinimumPrice,
        participantCount: previousOption?.participantCount ?? 0,
        topBids: previousOption?.topBids ?? (["-", "-", "-"] as [
          string,
          string,
          string,
        ]),
        avatarInitials: member.initials,
        avatarTone: member.tone,
        imageUrl: member.imageUrl,
      };
    }) as [ProductOption, ...ProductOption[]];
    const product: ProductDetailItem = {
      id: productId,
      title: title.trim(),
      member:
        targetMembers.length > 1
          ? `${firstMember.name} 외 ${targetMembers.length - 1}명`
          : firstMember.name,
      minHeadcount: parsedMinHeadcount,
      targetMembers: targetMembers.map((member) => member.name),
      uploadedAt:
        editingProduct?.uploadedAt ?? formatDateTimeLabel(new Date().toISOString()),
      era: selectedGroup.name,
      rating: "0.0",
      reviews: "0",
      badge: "신규",
      liked: editingProduct?.liked ?? false,
      tone: editingProduct?.tone ?? "from-zinc-950 via-zinc-700 to-zinc-300",
      courier: selectedShipping[0],
      deadline: formatDateTimeLabel(closingDate) || "일정 미정",
      imageUrl: storedPhotoUrls[0] ?? coverPhoto.url,
      imageUrls: storedPhotoUrls,
      purchaseSource: purchaseSource.trim(),
      shippingMethods: selectedShippingMethods,
      description:
        description.trim() || "판매자가 아직 상품 설명을 작성하지 않았습니다.",
      options: productOptions,
    };
    const canUseBuncheolApi =
      authState.isLoggedIn &&
      Boolean(accessToken) &&
      (isApiEditMode ||
        (Number.isFinite(apiGroupId) &&
          apiMembers.every(
            (member) =>
              Number.isFinite(member.memberId) && isHundredWonAmount(member.price),
          )));

    if (!isApiEditMode && hasInvalidAmount) {
      setSubmitError("금액은 100원 단위로 입력해 주세요.");
      return;
    }

    if (!isApiEditMode && !isValidMinHeadcount(minHeadcount, targetMembers.length)) {
      setSubmitError("최소 진행 인원을 대상 멤버 수 안에서 입력해 주세요.");
      return;
    }

    if (
      !isApiEditMode &&
      authState.isLoggedIn &&
      accessToken &&
      !canUseBuncheolApi
    ) {
      setSubmitError("가격과 대상 멤버 정보를 다시 확인해 주세요.");
      return;
    }

    if (canUseBuncheolApi && accessToken) {
      const deadlineDate = new Date(closingDate);

      if (Number.isNaN(deadlineDate.getTime())) {
        setSubmitError("마감 기한을 다시 확인해 주세요.");
        return;
      }

      const keepImageIds = isApiEditMode
        ? orderedPhotos
            .map((photo) => photo.existingImageId)
            .filter((imageId): imageId is number => typeof imageId === "number")
        : undefined;

      let imageFiles: File[];

      try {
        const uploadablePhotos = orderedPhotos
          .map((photo, index) => ({
            imageUrl: storedPhotoUrls[index] ?? photo.url,
            photo,
          }))
          .filter(
            ({ imageUrl, photo }) =>
              !isApiEditMode ||
              (typeof photo.existingImageId !== "number" && Boolean(imageUrl)),
          );

        imageFiles = await Promise.all(
          uploadablePhotos.map(({ imageUrl }, index) =>
            imageUrlToUploadFile(imageUrl, `buncheol-${index + 1}.jpg`),
          ),
        );
      } catch {
        setSubmitError("사진 파일을 업로드 형식으로 변환하지 못했어요.");
        return;
      }

      if (((keepImageIds?.length ?? 0) + imageFiles.length) === 0) {
        setSubmitError("사진을 1장 이상 등록해 주세요.");
        return;
      }

      try {
        if (isApiEditMode) {
          await updateBuncheol(
            accessToken,
            productId,
            {
              description: product.description,
              keepImageIds,
              title: product.title,
            },
            imageFiles,
          );

          await writeApiProductPreview({
            ...product,
            isApiProduct: true,
          });

          const returnSourceQuery = returnSource ? `?from=${returnSource}` : "";
          router.replace(`/products/${productId}${returnSourceQuery}`);
          return;
        }

        if (!isEditMode) {
          const createdBuncheolId = await createBuncheol(
            accessToken,
            {
              buncheolMembers: apiMembers,
              cuShippingFee:
                getStoreShippingFee(selectedShipping, shippingPrices, "CU") ||
                undefined,
              deadline: deadlineDate.toISOString(),
              description: product.description,
              groupId: apiGroupId,
              minHeadcount: parsedMinHeadcount,
              gs25ShippingFee:
                getStoreShippingFee(selectedShipping, shippingPrices, "GS") ||
                undefined,
              purchaseSite: purchaseSource.trim(),
              title: title.trim(),
            },
            imageFiles,
          );
          let nextProductId = createdBuncheolId;

          if (!nextProductId) {
            const hostedProducts = await requestMyHostedBuncheols(accessToken);
            nextProductId =
              hostedProducts.find((hostedProduct) => {
                return (
                  hostedProduct.title === title.trim() &&
                  hostedProduct.groupName === selectedGroup.name
                );
              })?.id ?? "";
          }

          if (nextProductId) {
            await writeApiProductPreview({
              ...product,
              buncheolId: nextProductId,
              id: nextProductId,
              isApiProduct: true,
              productId: nextProductId,
            });

            router.push(`/products/${nextProductId}?from=upload`);
            return;
          }

          router.push("/profile/bids");
          return;
        }
      } catch (error) {
        setSubmitError(
          error instanceof Error ? error.message : "분철 저장에 실패했어요.",
        );
        return;
      }
    }

    try {
      writeUploadedProduct(product);
    } catch {
      try {
        const compressedImageUrls = await Promise.all(
          orderedPhotoUrls.map((imageUrl) =>
            compressImageDataUrl(imageUrl, { maxSize: 720, quality: 0.58 }),
          ),
        );

        writeUploadedProduct({
          ...product,
          imageUrl: compressedImageUrls[0] ?? product.imageUrl,
          imageUrls: compressedImageUrls,
        });
      } catch {
        setSubmitError(
          "사진을 자동으로 압축했지만 임시 저장에 실패했습니다. 사진을 줄인 뒤 다시 시도해 주세요.",
        );
        return;
      }
    }

    if (isEditMode) {
      const returnSourceQuery = returnSource ? `?from=${returnSource}` : "";

      router.replace(`/products/${productId}${returnSourceQuery}`);
      return;
    }

    router.push(`/products/${productId}?from=upload`);
  }

  const apiEditIsWaiting =
    isApiEditMode && (isApiEditLoading || (!editingProduct && !submitError));

  useEffect(() => {
    formScrollRef.current?.scrollTo({ left: 0, top: 0 });
  }, [apiEditIsWaiting, editProductId, isApiEditMode]);

  const apiEditShippingRows = selectedShipping.map((option) => {
    const price = shippingPrices[option] ?? "";

    return {
      label: option,
      priceLabel: price.trim()
        ? formatWon(parsePriceInput(price))
        : "배송비 정보 없음",
    };
  });
  const apiEditMemberRows = allTargetMembers.map((member) => {
    const price = memberMinimumPrices[member.id] ?? "";

    return {
      ...member,
      priceLabel: price.trim()
        ? formatWon(parsePriceInput(price))
        : "가격 정보 없음",
    };
  });

  if (isApiEditMode) {
    return (
      <main className="system-chrome-black h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]">
        <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
          <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
            <div className="absolute inset-0 flex flex-col bg-white">
              <header className="upload-header shrink-0 border-b border-black bg-black px-4 py-3 text-white">
                <div className="upload-header__inner flex h-10 items-center justify-between">
                  <button
                    aria-label="이전 화면"
                    className="upload-header__back inline-flex h-10 w-10 items-center justify-center text-white"
                    onClick={() => {
                      if (editProductId) {
                        const returnSourceQuery = returnSource
                          ? `?from=${returnSource}`
                          : "";

                        router.replace(
                          `/products/${editProductId}${returnSourceQuery}`,
                        );
                        return;
                      }

                      router.replace("/");
                    }}
                    type="button"
                  >
                    <BackIcon />
                  </button>

                  <div className="upload-header__copy translate-y-0.5 text-right">
                    <p className="upload-header__eyebrow text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-white/45">
                      Edit
                    </p>
                    <h1 className="upload-header__title mt-1 text-[20px] leading-none tracking-[-0.05em]">
                      분철 수정
                    </h1>
                  </div>
                </div>
              </header>

              <form
                className="tab-content-enter min-h-0 flex-1 overflow-y-auto pb-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSubmit();
                }}
                ref={formScrollRef}
              >
                {apiEditIsWaiting ? (
                  <div className="flex min-h-[52vh] flex-col items-center justify-center px-6 text-center">
                    <p className="text-[18px] font-semibold tracking-[-0.05em]">
                      수정할 분철을 불러오는 중이에요
                    </p>
                    <p className="mt-2 text-[13px] font-semibold text-black/40">
                      기존 값을 채운 뒤 수정 가능한 항목만 열어둘게요.
                    </p>
                  </div>
                ) : (
                  <>
                    <section className="px-4 pt-4">
                      <label className="product-hero-media relative z-0 flex cursor-pointer overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-zinc-950 via-zinc-700 to-zinc-300">
                        {coverPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt=""
                            className="h-full w-full object-cover"
                            src={coverPhoto.url}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[15px] font-semibold text-white/70">
                            사진 추가
                          </div>
                        )}

                        <span className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black text-white shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
                          <PlusIcon />
                        </span>
                        {photoLimitToast ? (
                          <p
                            aria-live="polite"
                            className="soft-panel-enter pointer-events-none absolute bottom-4 left-4 right-4 z-20 rounded-full bg-black/92 px-4 py-3 text-center text-[12px] font-semibold tracking-[-0.04em] text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
                            role="status"
                          >
                            {photoLimitToast}
                          </p>
                        ) : null}
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

                      <div className="relative z-10 mt-3 grid grid-cols-5 gap-2">
                        {photos.map((photo) => {
                          const isCover = photo.id === coverPhoto?.id;

                          return (
                            <div
                              className="relative"
                              key={photo.id}
                            >
                              <button
                                aria-label={`${photo.name} 대표 사진으로 설정`}
                                className="relative aspect-square w-full overflow-hidden rounded-[0.8rem] bg-[#f7f7f7]"
                                onClick={() => setCoverPhotoId(photo.id)}
                                type="button"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  alt={photo.name}
                                  className="h-full w-full object-cover"
                                  src={photo.url}
                                />
                                {isCover ? (
                                  <span className="pointer-events-none absolute inset-0 rounded-[0.8rem] border-2 border-black" />
                                ) : null}
                              </button>
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
                          제목
                        </span>
                        <input
                          className="mt-2 h-14 w-full rounded-[0.9rem] border border-black/10 px-4 text-[17px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                          onChange={(event) =>
                            setTitle(event.currentTarget.value)
                          }
                          placeholder="분철 제목"
                          value={title}
                        />
                      </label>

                      <div className="mt-7">
                        <p className="text-[20px] font-semibold tracking-[-0.06em]">
                          잠긴 정보
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="rounded-[0.9rem] bg-[#f7f7f7] px-4 py-4">
                            <p className="text-[12px] font-semibold text-black/35">
                              구매처
                            </p>
                            <p className="mt-2 text-[16px] font-semibold tracking-[-0.05em]">
                              {purchaseSource || "-"}
                            </p>
                          </div>
                          <div className="rounded-[0.9rem] bg-[#f7f7f7] px-4 py-4">
                            <p className="text-[12px] font-semibold text-black/35">
                              아이돌 그룹
                            </p>
                            <p className="mt-2 text-[16px] font-semibold tracking-[-0.05em]">
                              {selectedGroup?.name ?? editingProduct?.era ?? "-"}
                            </p>
                          </div>
                          <div className="col-span-2 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-4">
                            <p className="text-[12px] font-semibold text-black/35">
                              참여 기한
                            </p>
                            <p className="mt-2 text-[16px] font-semibold tracking-[-0.05em]">
                              {formatDateTimeLabel(closingDate) || "-"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-7">
                        <p className="text-[20px] font-semibold tracking-[-0.06em]">
                          배송 방법
                        </p>
                        <div className="mt-3 space-y-2">
                          {apiEditShippingRows.length > 0 ? (
                            apiEditShippingRows.map((option) => (
                              <div
                                className="flex items-center justify-between rounded-[0.9rem] bg-[#f7f7f7] px-4 py-4"
                                key={option.label}
                              >
                                <span className="text-[15px] font-semibold tracking-[-0.04em]">
                                  {option.label}
                                </span>
                                <span className="text-[15px] font-semibold text-black/55">
                                  {option.priceLabel}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-[0.9rem] bg-[#f7f7f7] px-4 py-4 text-[15px] font-semibold text-black/45">
                              배송 정보 없음
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-7">
                        <p className="text-[20px] font-semibold tracking-[-0.06em]">
                          대상 멤버
                        </p>
                        <div className="mt-3 space-y-2">
                          {apiEditMemberRows.map((member) => (
                            <div
                              className="flex items-center gap-3 rounded-[0.9rem] bg-[#f7f7f7] px-4 py-3"
                              key={member.id}
                            >
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-zinc-950 via-zinc-600 to-zinc-200">
                                {member.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    alt=""
                                    className="h-full w-full object-cover"
                                    src={member.imageUrl}
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-[12px] font-semibold text-white">
                                    {member.initials}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[16px] font-semibold tracking-[-0.05em]">
                                  {member.name}
                                </p>
                                <p className="mt-0.5 text-[12px] font-semibold text-black/35">
                                  가격
                                </p>
                              </div>
                              <p className="shrink-0 text-[14px] font-semibold text-black/55">
                                {member.priceLabel}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <label className="mt-7 block">
                        <span className="text-[13px] font-semibold text-black/45">
                          설명
                        </span>
                        <textarea
                          className="mt-2 min-h-[150px] w-full resize-none rounded-[0.9rem] border border-black/10 px-4 py-4 text-[15px] font-semibold leading-6 tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                          onChange={(event) =>
                            setDescription(event.currentTarget.value)
                          }
                          placeholder="분철 설명"
                          value={description}
                        />
                      </label>

                      {submitError ? (
                        <p className="mt-4 rounded-[0.9rem] bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600">
                          {submitError}
                        </p>
                      ) : null}

                      <button
                        className="mt-6 h-14 w-full rounded-full bg-black text-[17px] font-semibold tracking-[-0.05em] text-white disabled:bg-black/20 disabled:text-white"
                        disabled={!canSubmit}
                        type="submit"
                      >
                        수정 완료
                      </button>
                    </section>
                  </>
                )}
              </form>
            </div>
          </div>

          <BottomNavigator />
        </div>
      </main>
    );
  }

  return (
    <main className="system-chrome-black h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
          <div className="absolute inset-0 flex flex-col bg-white">
            <header className="upload-header shrink-0 border-b border-black bg-black px-4 py-3 text-white">
              <div className="upload-header__inner flex h-10 items-center justify-between">
                <button
                  aria-label="이전 화면"
                  className="upload-header__back inline-flex h-10 w-10 items-center justify-center text-white"
                  onClick={() => {
                    if (editProductId) {
                      const returnSourceQuery = returnSource
                        ? `?from=${returnSource}`
                        : "";

                      router.replace(
                        `/products/${editProductId}${returnSourceQuery}`,
                      );
                      return;
                    }

                    router.replace("/");
                  }}
                  type="button"
                >
                  <BackIcon />
                </button>

                <div className="upload-header__copy translate-y-0.5 text-right">
                  <p className="upload-header__eyebrow text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-white/45">
                    {isEditMode ? "Edit" : "Upload"}
                  </p>
                  <h1 className="upload-header__title mt-1 text-[20px] leading-none tracking-[-0.05em]">
                    {isEditMode ? "분철 수정" : "상품 등록"}
                  </h1>
                </div>
              </div>
            </header>

            <form
              className="tab-content-enter min-h-0 flex-1 overflow-y-auto pb-6"
              onSubmit={(event) => event.preventDefault()}
              ref={formScrollRef}
            >
          <section className="px-4 pt-4">
            <label className="product-hero-media relative z-0 flex cursor-pointer overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-zinc-950 via-zinc-700 to-zinc-300">
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
              {photoLimitToast ? (
                <p
                  aria-live="polite"
                  className="soft-panel-enter pointer-events-none absolute bottom-4 left-4 right-4 z-20 rounded-full bg-black/92 px-4 py-3 text-center text-[12px] font-semibold tracking-[-0.04em] text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
                  role="status"
                >
                  {photoLimitToast}
                </p>
              ) : null}
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

            <label className="mt-5 block">
              <span className="text-[13px] font-semibold text-black/45">
                구매처
              </span>
              <input
                className="mt-2 h-14 w-full rounded-[0.9rem] border border-black/10 px-4 text-[17px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black disabled:bg-[#f7f7f7] disabled:text-black/55"
                disabled={isApiEditMode}
                onChange={(event) =>
                  setPurchaseSource(event.currentTarget.value)
                }
                placeholder="위버스샵, 스타쉽 스퀘어, 양도자 구매처 등"
                value={purchaseSource}
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
                      disabled={isApiEditMode}
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
                                  className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${member.tone} text-[12px] font-semibold tracking-[-0.04em] text-black ring-1 ring-black/10`}
                                >
                                  {member.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      alt={member.name}
                                      className="h-full w-full object-cover"
                                      src={member.imageUrl}
                                    />
                                  ) : (
                                    member.initials
                                  )}
                                </div>
                                <p className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.04em]">
                                  {member.name}
                                </p>
                                <label className="flex h-9 w-24 shrink-0 items-center rounded-[0.65rem] bg-white px-2 ring-1 ring-black/10 focus-within:ring-black">
                                  <input
                                    aria-label={`${member.name} 가격`}
                                    className="min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 disabled:text-black/40"
                                    disabled={isApiEditMode || isExcluded}
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
                                  disabled={isApiEditMode}
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
                                      aria-label="가격 전체 적용 취소"
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-[14px] font-semibold text-white"
                                      onClick={hideMinimumPricePrompt}
                                      type="button"
                                    >
                                      ×
                                    </button>
                                    <button
                                      aria-label="비어있는 멤버에 가격 적용"
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
                {targetMembers.length > 0 ? (
                  <label className="mt-4 block rounded-[0.9rem] border border-black/10 px-4 py-4">
                    <span className="text-[13px] font-semibold text-black/45">
                      최소 진행 인원
                    </span>
                    <div className="mt-2 flex h-13 items-center rounded-[0.85rem] border border-black/10 bg-[#f7f7f7] px-4 focus-within:border-black">
                      <input
                        aria-label="최소 진행 인원"
                        className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 disabled:text-black/55"
                        disabled={isApiEditMode}
                        inputMode="numeric"
                        max={targetMembers.length}
                        min={1}
                        onChange={(event) => updateMinHeadcount(event.currentTarget.value)}
                        placeholder={String(targetMembers.length)}
                        type="text"
                        value={minHeadcount}
                      />
                      <span className="shrink-0 text-[13px] font-semibold text-black/45">
                        / {targetMembers.length}명
                      </span>
                    </div>
                  </label>
                ) : null}
                </div>
              ) : (
                <div
                  className="idol-selection-enter"
                  key="idol-search"
                >
                  <label className="mt-3 flex h-14 items-center gap-3 rounded-[0.9rem] border border-black/10 bg-[#f7f7f7] px-4 focus-within:border-black">
                    <input
                      className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/30"
                      disabled={isApiEditMode}
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
                          const memberPreview = `총 ${group.members.length}명`;

                          return (
                            <button
                              className="flex w-full items-center justify-between gap-4 border-b border-black/10 bg-white px-4 py-3 text-left last:border-b-0"
                              disabled={isApiEditMode}
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
                        disabled={isApiEditMode}
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
                              className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 disabled:text-black/55"
                              disabled={isApiEditMode}
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
                  [["closing", "마감 기한", closingDate]] as const
                ).map(([field, label, value]) => {
                  let scheduleParts = getScheduleParts(value);
                  const minScheduleValue = getNextAvailableScheduleValue();
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
                        disabled={isApiEditMode}
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
                  placeholder="구성, 하자, 포장 방식 등을 적어주세요."
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
              {isEditMode ? "수정 완료" : "등록하기"}
            </button>
            {!canSubmit && submitBlockReason ? (
              <p className="mt-3 break-keep text-center text-[13px] font-semibold leading-5 text-black/45">
                {submitBlockReason}
              </p>
            ) : null}
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
