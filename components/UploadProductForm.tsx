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
import {
  ConfirmSheet,
  type ConfirmSheetRequest,
} from "@/components/ConfirmSheet";
import { useQueryClient } from "@tanstack/react-query";
import { buncheolsQueryKey } from "@/lib/query-keys";
import {
  BackIcon,
  CameraIcon,
  CheckIcon,
  CloseIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/icons";
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
import { getFreshAccessToken } from "@/lib/auth-session";
import { createLoginHref } from "@/lib/auth-navigation";
import { useProfileCompletionGuard } from "@/lib/use-profile-completion-guard";
import { getSafeOpenChatHref } from "@/lib/open-chat-url";

// 카카오에서 복사한 주소는 스킴 없이 오는 경우가 흔하다("open.kakao.com/o/...") —
// 스킴이 없으면 https:// 를 붙여 한 번 더 검증한다.
function getNormalizedOpenChatUrl(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return (
    getSafeOpenChatHref(trimmedValue) ??
    getSafeOpenChatHref(`https://${trimmedValue}`)
  );
}
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
// 제목 길이 상한(docs/56 H-02): 200자는 어느 화면에서도 전부 볼 수 없어 64자로 축소.
// 서버 검증(@Size)도 같은 값으로 맞춘다 — FE 가 더 엄격해야 서버 400 이 나지 않는다.
const maxTitleLength = 64;
const maxDescriptionLength = 700;
const scheduleYearOptionCount = 5;
const hourOptions = Array.from({ length: 24 }, (_, index) => index);
const memberPriceUnitWon = 100;
const minimumPricePromptExitDelay = 220;
const emptyProductDescriptionText =
  "판매자가 상품 설명을 작성하지 않았습니다.";
const emptyProductDescriptionPlaceholders = new Set([
  emptyProductDescriptionText,
  "판매자가 아직 상품 설명을 작성하지 않았습니다.",
  "상품 설명이 없어요.",
]);

type ScheduleField = "closing";
type SchedulePart = "year" | "month" | "day" | "hour";

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function parsePriceInput(value: string) {
  return Number(value.replace(/[^\d]/g, "")) || 0;
}

// 배송비 0원은 개최자가 배송비를 받지 않는 무료 배송으로 허용한다 (서버 ShippingFeePolicy 와 동일 규칙).
// parsePriceInput 이 빈 문자열도 0으로 만들기 때문에 raw 입력에 숫자가 있는지 함께 확인한다.
function isShippingFeeInput(rawInput: string) {
  const digits = rawInput.replace(/[^\d]/g, "");

  return digits !== "" && Number(digits) % 100 === 0;
}

// 0원은 오픈 이벤트 무료 분철(운영진 발행) 슬롯으로 허용한다 (서버 BCH-027 과 동일 규칙).
function isMemberMinimumPriceAmount(value: number) {
  return (
    Number.isInteger(value) && value >= 0 && value % memberPriceUnitWon === 0
  );
}

// parsePriceInput 이 빈 문자열도 0으로 만들기 때문에, 제출 검증에서는 빈 입력이 0원으로 통과하지
// 않도록 raw 입력에 숫자가 있는지 함께 확인한다.
function isMemberMinimumPriceInput(rawInput: string) {
  const digits = rawInput.replace(/[^\d]/g, "");

  return digits !== "" && isMemberMinimumPriceAmount(Number(digits));
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

function getMemberLookupKey(value: string) {
  return value.trim().toLowerCase();
}

function getEditableDescription(value: string | undefined) {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue || emptyProductDescriptionPlaceholders.has(trimmedValue)) {
    return "";
  }

  return value ?? "";
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

  const rawPrice = shippingName ? (shippingPrices[shippingName] ?? "") : "";

  // 미선택(undefined)과 0원(무료 배송)을 구분해야 0원이 페이로드에서 탈락하지 않는다.
  // "빈 입력 = 무효" 규칙은 제출 가드와 별개로 여기서도 보장해, 가드가 느슨해져도
  // 빈 입력이 조용히 무료 배송으로 전송되지 않게 한다.
  return isShippingFeeInput(rawPrice) ? parsePriceInput(rawPrice) : undefined;
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
  const queryClient = useQueryClient();
  const isEditMode = Boolean(editProductId);
  const loginReturnHref = (() => {
    const loginReturnParams = new URLSearchParams();

    if (editProductId && !editProductId.startsWith("uploaded-")) {
      loginReturnParams.set("edit", editProductId);
    }

    if (returnSource) {
      loginReturnParams.set("from", returnSource);
    }

    const loginReturnQuery = loginReturnParams.toString();

    return loginReturnQuery ? `/upload?${loginReturnQuery}` : "/upload";
  })();
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  /*
   * 작성 중 이탈 가드.
   *
   * 개최 폼은 사진·멤버·멤버별 금액까지 다 채우는 데 몇 분이 걸리는데, 지금까지는
   * 뒤로가기 한 번에 아무 확인 없이 전부 사라졌다. 되돌릴 방법도 없다.
   * 폼에 손댄 흔적이 있을 때만 확인 시트를 띄운다 — 빈 폼에서 나가는 건 그냥 보내준다.
   *
   * window.confirm 대신 ConfirmSheet 를 쓰는 이유는 카카오·네이버 인앱 브라우저가
   * confirm 을 억제하고 즉시 false 를 반환하기 때문이다 (ConfirmSheet 주석 참고).
   */
  const [exitConfirmRequest, setExitConfirmRequest] =
    useState<ConfirmSheetRequest | null>(null);
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
  const [openChatUrl, setOpenChatUrl] = useState("");
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

  /*
   * 폼에 사용자가 손댔는지 판정한다.
   *
   * 등록 모드는 빈 폼에서 시작하므로 "값이 하나라도 들어있으면 손댄 것"이다.
   * 수정 모드는 처음부터 채워져 있어 같은 기준을 못 쓴다 — 불러오기가 끝난 시점의
   * 값을 기준선으로 잡아 두고 그것과 달라졌을 때만 손댄 것으로 본다.
   * (기준선은 아래 effect 에서 갱신한다. 렌더 중 ref 를 읽으므로 불러오기 직후 한 프레임은
   *  dirty 로 보일 수 있는데, 이 값은 뒤로가기를 눌렀을 때만 읽혀서 화면에 드러나지 않는다.)
   */
  const formSignature = JSON.stringify({
    closingDate,
    description,
    excludedMemberIds,
    memberMinimumPrices,
    minHeadcount,
    openChatUrl,
    photoIds: photos.map((photo) => photo.id),
    purchaseSource,
    selectedGroupId,
    selectedShipping,
    shippingPrices,
    targetMemberIds,
    title,
  });
  const emptyFormSignatureRef = useRef(formSignature);
  const baselineFormSignatureRef = useRef<string | null>(null);
  const isFormDirty = isEditMode
    ? baselineFormSignatureRef.current !== null &&
      formSignature !== baselineFormSignatureRef.current
    : formSignature !== emptyFormSignatureRef.current;

  // 수정 모드 기준선 — 불러오기가 끝나 editingProduct 가 채워진 시점의 폼 값을 기억한다.
  useEffect(() => {
    if (!isEditMode || !editingProduct) {
      return;
    }

    baselineFormSignatureRef.current = formSignature;
    // formSignature 를 의존성에 넣으면 입력할 때마다 기준선이 갱신돼 영영 dirty 가 되지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingProduct, isEditMode]);

  /*
   * 이탈 요청 — 폼에 손댄 흔적이 없으면 그대로 보내고, 있으면 확인 시트를 띄운다.
   * 확인 시트의 기본 액션은 "계속 작성"(취소)이고, 파괴적인 쪽이 확인 버튼이다.
   */
  function requestExit(navigate: () => void) {
    if (!isFormDirty) {
      navigate();
      return;
    }

    setExitConfirmRequest({
      confirmLabel: "나가기",
      description: isEditMode
        ? "수정한 내용은 저장되지 않아요."
        : "지금까지 작성한 사진과 내용이 모두 사라져요.",
      onConfirm: () => {
        setExitConfirmRequest(null);
        navigate();
      },
      title: isEditMode ? "수정을 그만둘까요?" : "작성을 그만둘까요?",
    });
  }
  // 가입 미완료(전화번호 미등록) 유저를 /upload 직접 진입에서도 보완 화면으로 보낸다(공용 가드,
  // 홈 경유와 동일 동작). 개최 자격(연령대·상한)은 서버 게이트가 제출 시 판정한다.
  useProfileCompletionGuard();

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
  const numericMinHeadcount = Number(minHeadcount);
  const selectedMinHeadcount =
    Number.isFinite(numericMinHeadcount) && numericMinHeadcount > 0
      ? Math.min(numericMinHeadcount, Math.max(1, targetMembers.length))
      : targetMembers.length;
  const canDecreaseMinHeadcount = !isApiEditMode && selectedMinHeadcount > 1;
  const canIncreaseMinHeadcount =
    !isApiEditMode && selectedMinHeadcount < targetMembers.length;
  // maxLength 로 막히지 않는 경로(기존 제목 불러오기)로 상한을 넘길 수 있어,
  // 카운터에서 초과 상태를 색으로 구분한다.
  const isTitleOverLimit = title.trim().length > maxTitleLength;
  const submitBlockReason = (() => {
    if (photos.length === 0) {
      return "사진을 1장 이상 올려 주세요.";
    }

    if (!title.trim()) {
      return "상품명을 입력해 주세요.";
    }

    // input 의 maxLength 는 타이핑만 막고, 서버에서 불러온 기존 제목에는 적용되지 않는다.
    // 상한을 넘긴 제목을 수정 저장하면 서버 검증에서 400 이 나므로 제출 자체를 막는다.
    if (isTitleOverLimit) {
      return `상품명은 ${maxTitleLength}자까지 입력할 수 있어요.`;
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
          !isMemberMinimumPriceInput(memberMinimumPrices[member.id] ?? ""),
      )
    ) {
      return "멤버 가격을 100원 단위로 입력해 주세요. (무료 분철은 0)";
    }

    // 서버(BUNCHEOL_MEMBER_FREE_PRICE_MIXED)와 동일 규칙: 0원(무료) 슬롯은 무료 분철 전용이라
    // 하나라도 0원이면 전 슬롯이 0원이어야 한다. 혼합되면 이벤트 배지·환급 대상 판정이 어긋난다.
    const memberPriceValues = targetMembers.map((member) =>
      parsePriceInput(memberMinimumPrices[member.id] ?? ""),
    );

    if (
      memberPriceValues.some((value) => value === 0) &&
      memberPriceValues.some((value) => value > 0)
    ) {
      return "무료(0원) 멤버와 유료 멤버는 함께 구성할 수 없어요.";
    }

    if (!isValidMinHeadcount(minHeadcount, targetMembers.length)) {
      return `최소 진행 인원을 1-${targetMembers.length}명으로 입력해 주세요.`;
    }

    if (selectedShipping.length === 0) {
      return "배송 방법을 선택해 주세요.";
    }

    if (
      selectedShipping.some(
        (option) => !isShippingFeeInput(shippingPrices[option] ?? ""),
      )
    ) {
      return "배송비를 100원 단위로 입력해 주세요.";
    }

    // 선택 입력(생성 모드 전용) — 값이 있으면 카카오 오픈채팅 주소만 허용한다.
    if (
      !isEditMode &&
      openChatUrl.trim() &&
      !getNormalizedOpenChatUrl(openChatUrl)
    ) {
      return "https://로 시작하는 open.kakao.com 주소만 입력할 수 있어요.";
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
    const currentAuthState = readAuthState();

    if (currentAuthState.isLoggedIn && currentAuthState.accessToken) {
      return;
    }

    if (
      editProductId?.startsWith("uploaded-") &&
      readUploadedProduct(editProductId)
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      router.replace(
        createLoginHref({ cancelTo: "/", returnTo: loginReturnHref }),
      );
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    authState.accessToken,
    authState.isLoggedIn,
    editProductId,
    loginReturnHref,
    router,
  ]);

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
              // 서버 별칭을 그대로 실어야 한다. 아래 idolResults 가 rankGroupSearchResults 로 한 번 더
              // 거르기 때문에, 여기서 버리면 별칭으로만 걸린 그룹이 무매치 처리돼 조용히 사라진다.
              aliases: group.aliases ?? [],
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
      const product = editProductId.startsWith("uploaded-")
        ? readUploadedProduct(editProductId)
        : null;

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
            .then(async (detail) => {
              const apiProduct = toProductDetailItem(detail);
              const memberPresentationByName = new Map<
                string,
                { imageUrl?: string; initials: string; tone: string }
              >();

              try {
                const [matchedGroup] = rankGroupSearchResults(
                  await requestGroups(apiProduct.era),
                  apiProduct.era,
                  1,
                );

                if (matchedGroup) {
                  const groupMembers = await requestGroupMembers(matchedGroup.id);

                  groupMembers.forEach((member) => {
                    memberPresentationByName.set(
                      getMemberLookupKey(member.name),
                      {
                        imageUrl: member.imageUrl,
                        initials: getInitials(member.name),
                        tone: getMemberTone(member.id),
                      },
                    );
                  });
                }
              } catch {
                memberPresentationByName.clear();
              }

              const apiGroup: IdolGroup = {
                id: `api-edit-${editProductId}`,
                name: apiProduct.era,
                label: apiProduct.era,
                aliases: [apiProduct.era],
                members: apiProduct.options.map((option) => {
                  const presentation = memberPresentationByName.get(
                    getMemberLookupKey(option.label),
                  );

                  return {
                    id: option.buncheolMemberId ?? option.id,
                    imageUrl: option.imageUrl ?? presentation?.imageUrl,
                    name: option.label,
                    initials:
                      presentation?.initials ?? getInitials(option.label),
                    tone: presentation?.tone ?? getMemberTone(option.id),
                  };
                }),
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
              setDescription(getEditableDescription(apiProduct.description));

              // 이미지는 등록 순 그대로 복원하고, 대표사진은 항목별 thumbnail 플래그로 찾는다(없으면 첫 장).
              const restoredImages = apiProduct.images?.length
                ? apiProduct.images
                : (apiProduct.imageUrls?.length
                    ? apiProduct.imageUrls
                    : apiProduct.imageUrl
                      ? [apiProduct.imageUrl]
                      : []
                  ).map((url) => ({ url }) as { id?: number; thumbnail?: boolean; url: string });
              const thumbnailPhotoIndex = restoredImages.findIndex(
                (image) => image.thumbnail,
              );
              const coverIndex = thumbnailPhotoIndex >= 0 ? thumbnailPhotoIndex : 0;
              const restoredPhotos = restoredImages
                .slice(0, maxPhotos)
                .map((image, index) => ({
                  id: `existing-photo-${index}`,
                  name:
                    index === coverIndex
                      ? "기존 대표 사진"
                      : `기존 사진 ${index + 1}`,
                  url: image.url,
                  existingImageId: image.id,
                }));

              setPhotos(restoredPhotos);
              setCoverPhotoId(
                (restoredPhotos[coverIndex] ?? restoredPhotos[0])?.id ?? null,
              );
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

        if (authState.isLoggedIn && authState.accessToken) {
          router.replace(returnSource ? `/upload?from=${returnSource}` : "/upload");
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
      setDescription(getEditableDescription(product.description));

      const storedImageUrls = product.imageUrls?.length
        ? product.imageUrls
        : product.imageUrl
          ? [product.imageUrl]
          : [];

      if (storedImageUrls.length > 0) {
        // 로컬 캐시 데이터는 imageUrl(대표사진 URL)로 대표사진 위치를 복원한다(없으면 첫 장).
        const thumbnailUrlIndex = product.imageUrl
          ? storedImageUrls.indexOf(product.imageUrl)
          : -1;
        const coverIndex = thumbnailUrlIndex >= 0 ? thumbnailUrlIndex : 0;
        const restoredPhotos = storedImageUrls
          .slice(0, maxPhotos)
          .map((imageUrl, index) => ({
            id: `existing-photo-${index}`,
            name:
              index === coverIndex ? "기존 대표 사진" : `기존 사진 ${index + 1}`,
            url: imageUrl,
            existingImageId: product.images?.[index]?.id,
          }));

        setPhotos(restoredPhotos);
        setCoverPhotoId(
          (restoredPhotos[coverIndex] ?? restoredPhotos[0])?.id ?? null,
        );
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [
    authState.accessToken,
    authState.isLoggedIn,
    editProductId,
    returnSource,
    router,
  ]);

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

    if (
      trimmedPrice &&
      isMemberMinimumPriceAmount(parsePriceInput(trimmedPrice)) &&
      hasEmptyActiveMembers
    ) {
      showMinimumPricePrompt({ memberId, price: numericPrice });
    } else {
      hideMinimumPricePrompt();
    }
  }

  function validateMemberMinimumPrice(memberId: string) {
    const parsedPrice = parsePriceInput(memberMinimumPrices[memberId] ?? "");

    if (parsedPrice > 0 && !isMemberMinimumPriceAmount(parsedPrice)) {
      showMemberToast(memberId, "가격은 100원 단위로 입력해 주세요");
    }
  }

  function applyMinimumPriceToEmptyMembers(price: string) {
    const trimmedPrice = price.trim();

    if (
      !trimmedPrice ||
      !isMemberMinimumPriceAmount(parsePriceInput(trimmedPrice)) ||
      targetMembers.length === 0
    ) {
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

    const isLocalDraftEdit = Boolean(
      editingProduct?.id.startsWith("uploaded-"),
    );

    // 진입 시 선차단 제거로 이 파일의 유일한 토큰 갱신 지점이 사라졌다 — 폼을 다 채운 뒤
    // 만료 토큰으로 401 나지 않게 액션 시점에 갱신한다(레포 관례: HostedBuncheolManage 등).
    const accessToken = isLocalDraftEdit ? null : await getFreshAccessToken();

    if (!isLocalDraftEdit && !accessToken) {
      router.push(
        createLoginHref({ cancelTo: "/", returnTo: loginReturnHref }),
      );
      return;
    }

    setSubmitError("");

    const productId = editingProduct?.id ?? createUploadedProductId();
    const selectedShippingMethods = selectedShipping.map((name) => ({
      name,
      price: formatWon(parsePriceInput(shippingPrices[name])),
    }));
    // 이미지는 업로드한 순서 그대로 보내고, 대표사진은 인덱스/ID로만 지정한다(순서 재배치 금지).
    const coverPhotoIndex = Math.max(
      0,
      photos.findIndex((photo) => photo.id === coverPhoto.id),
    );
    const orderedPhotos = photos;
    const orderedPhotoUrls = orderedPhotos.map((photo) => photo.url);
    const apiGroupId = Number(selectedGroup.id);
    const apiMembers = targetMembers.map((member) => ({
      price: parsePriceInput(memberMinimumPrices[member.id] ?? "0"),
      memberId: Number(member.id),
    }));
    const isApiEditMode = isEditMode && !productId.startsWith("uploaded-");
    const parsedMinHeadcount = Number(minHeadcount);
    const hasInvalidMemberAmount = apiMembers.some(
      (member) => !isMemberMinimumPriceAmount(member.price),
    );
    const hasInvalidShippingAmount = selectedShipping.some(
      (option) => !isShippingFeeInput(shippingPrices[option] ?? ""),
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
      imageUrl: storedPhotoUrls[coverPhotoIndex] ?? coverPhoto.url,
      imageUrls: storedPhotoUrls,
      purchaseSource: purchaseSource.trim(),
      shippingMethods: selectedShippingMethods,
      description: description.trim(),
      options: productOptions,
    };
    const canUseBuncheolApi =
      authState.isLoggedIn &&
      Boolean(accessToken) &&
      (isApiEditMode ||
        (Number.isFinite(apiGroupId) &&
          apiMembers.every(
            (member) =>
              Number.isFinite(member.memberId) &&
              isMemberMinimumPriceAmount(member.price),
          )));

    if (!isApiEditMode && hasInvalidMemberAmount) {
      setSubmitError("멤버 가격은 100원 단위로 입력해 주세요.");
      return;
    }

    if (!isApiEditMode && hasInvalidShippingAmount) {
      setSubmitError("배송비는 100원 단위로 입력해 주세요.");
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
      // 대표사진이 신규 업로드 사진일 때 images 파트 내 위치 (아니면 -1)
      let newPhotoThumbnailIndex = -1;

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

        newPhotoThumbnailIndex = uploadablePhotos.findIndex(
          ({ photo }) => photo.id === coverPhoto.id,
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

      // 대표사진 지정은 필수 — 기존 이미지면 thumbnailImageId, 신규 업로드 이미지면 thumbnailIndex 로
      // 정확히 하나를 보낸다. 대표사진은 항상 유지 이미지(id 보유)거나 신규 업로드 목록에 포함되므로 둘 중 하나는 반드시 정해진다.
      const coverExistingImageId =
        typeof coverPhoto.existingImageId === "number"
          ? coverPhoto.existingImageId
          : undefined;

      try {
        if (isApiEditMode) {
          await updateBuncheol(
            accessToken,
            productId,
            {
              description: product.description,
              keepImageIds,
              thumbnailImageId: coverExistingImageId,
              thumbnailIndex:
                coverExistingImageId === undefined
                  ? Math.max(0, newPhotoThumbnailIndex)
                  : undefined,
              title: product.title,
            },
            imageFiles,
          );

          // 수정된 제목·이미지가 홈 목록에 바로 반영되도록 목록 쿼리를 무효화한다.
          void queryClient.invalidateQueries({ queryKey: buncheolsQueryKey });

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
              cuShippingFee: getStoreShippingFee(
                selectedShipping,
                shippingPrices,
                "CU",
              ),
              deadline: deadlineDate.toISOString(),
              description: product.description || undefined,
              groupId: apiGroupId,
              minHeadcount: parsedMinHeadcount,
              // 검증을 통과한 정규화 값(스킴 보정·호스트 소문자화)을 전송한다.
              openChatUrl: getNormalizedOpenChatUrl(openChatUrl) ?? undefined,
              gs25ShippingFee: getStoreShippingFee(
                selectedShipping,
                shippingPrices,
                "GS",
              ),
              purchaseSite: purchaseSource.trim(),
              thumbnailIndex: coverPhotoIndex,
              title: title.trim(),
            },
            imageFiles,
          );
          // 새로 개최한 분철이 홈 목록에 바로 뜨도록 목록 쿼리를 무효화한다.
          void queryClient.invalidateQueries({ queryKey: buncheolsQueryKey });

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

    if (!isLocalDraftEdit) {
      setSubmitError("수정할 분철 정보를 찾을 수 없습니다.");
      return;
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

    const returnSourceQuery = returnSource ? `?from=${returnSource}` : "";

    router.replace(`/products/${productId}${returnSourceQuery}`);
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

  // 비로그인 직접 진입(딥링크·PWA) 시 로그인 리다이렉트(rAF 이후)가 돌기 전까지
  // 조작 가능한 폼이 한 프레임 그려지는 것을 가린다.
  if (!isEditMode && !authState.isLoggedIn) {
    return null;
  }

  if (isApiEditMode) {
    return (
      <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]">
        <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
          <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
            <div className="absolute inset-0 flex flex-col bg-white">
              <header className="upload-header shrink-0 border-b border-black/10 bg-white px-4 py-3 text-black">
                <div className="upload-header__inner flex h-10 items-center gap-2">
                  <button
                    aria-label="이전 화면"
                    className="upload-header__back -ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center text-black"
                    onClick={() =>
                      requestExit(() => {
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
                      })
                    }
                    type="button"
                  >
                    <BackIcon />
                  </button>

                  <div className="upload-header__copy min-w-0 flex-1">
                    <h1 className="upload-header__title text-[20px] font-semibold leading-none tracking-[-0.05em]">
                      분철 수정
                    </h1>
                  </div>
                </div>
              </header>

              <form
                className="tab-content-enter min-h-0 flex-1 overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
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
                      {photos.length === 0 ? (
                        <>
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-[14px] font-semibold tracking-[-0.045em]">
                              사진
                              <span className="ml-1.5 text-[13px] text-black/30">
                                0/{maxPhotos}
                              </span>
                            </p>
                            <p className="text-[12px] font-semibold text-black/40">
                              최대 {maxPhotos}장
                            </p>
                          </div>
                          <label className="mt-2.5 flex h-[76px] w-[76px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[0.8rem] border border-[#CDEB55] bg-[#F7FBEA]">
                            <CameraIcon className="h-6 w-6 text-[#4d6117]" />
                            <span className="text-[11px] font-semibold text-[#4d6117]">
                              0/{maxPhotos}
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
                          <p className="mt-3 text-[12px] font-semibold text-black/40">
                            대표 사진은 올린 뒤 고를 수 있어요. 포카 실물과
                            구성품이 잘 보이는 사진이 좋아요.
                          </p>
                        </>
                      ) : (
                        <>
                          <label className="product-hero-media relative z-0 flex cursor-pointer overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-[#10110D] via-[#222719] to-[#D7FF5F] shadow-[0_18px_42px_rgba(120,132,82,0.18)] ring-1 ring-[#D7FF5F]/45">
                            {coverPhoto ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                alt=""
                                className="h-full w-full object-cover"
                                src={coverPhoto.url}
                              />
                            ) : null}

                            {coverPhoto ? (
                              <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
                                대표 사진
                              </span>
                            ) : null}

                            <span className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#D7FF5F] text-black shadow-[0_12px_30px_rgba(120,132,82,0.28)]">
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
                                  <div className="relative aspect-square overflow-hidden rounded-[0.8rem] bg-[#f7f7f7]">
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
                              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-[0.8rem] border border-dashed border-[#CDEB55] bg-[#F7FBEA] text-black/45 shadow-[0_8px_18px_rgba(120,132,82,0.08)]">
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
                        </>
                      )}
                    </section>

                    <section className="px-5 pt-6">
                      <label className="block">
                        <span className="text-[13px] font-semibold text-black/45">
                          제목
                        </span>
                        <input
                          className="mt-2 h-14 w-full rounded-[0.9rem] border border-black/10 px-4 text-[17px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                          maxLength={maxTitleLength}
                          onChange={(event) =>
                            setTitle(event.currentTarget.value)
                          }
                          placeholder="분철 제목"
                          value={title}
                        />
                        <span
                          className={`mt-1.5 block text-right text-[12px] font-semibold ${
                            isTitleOverLimit ? "text-[#c03131]" : "text-black/35"
                          }`}
                        >
                          {title.length}/{maxTitleLength}자
                        </span>
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
                          maxLength={maxDescriptionLength}
                          onChange={(event) =>
                            setDescription(event.currentTarget.value)
                          }
                          placeholder="분철 설명"
                          value={description}
                        />
                        <span className="mt-1.5 block text-right text-[12px] font-semibold text-black/35">
                          {description.length}/{maxDescriptionLength}자
                        </span>
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
                      {/* 수정 모드에도 제출 차단 사유를 노출한다. 제목 길이 가드는
                          서버에서 불러온 기존 제목을 겨냥하므로, 사유가 없으면
                          개최자는 버튼이 왜 죽었는지 알 수 없다. */}
                      {!canSubmit && submitBlockReason ? (
                        <p className="mt-3 break-keep text-center text-[13px] font-semibold leading-5 text-black/45">
                          {submitBlockReason}
                        </p>
                      ) : null}
                    </section>
                  </>
                )}
              </form>
            </div>
          </div>
        </div>

          <ConfirmSheet
            cancelLabel="계속 작성"
            onCancel={() => setExitConfirmRequest(null)}
            request={exitConfirmRequest}
          />
      </main>
    );
  }

  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-white">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
          <div className="absolute inset-0 flex flex-col bg-white">
            <header className="upload-header shrink-0 border-b border-black/10 bg-white px-4 py-3 text-black">
              <div className="upload-header__inner flex h-10 items-center gap-2">
                <button
                  aria-label="이전 화면"
                  className="upload-header__back -ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center text-black"
                  onClick={() =>
                    requestExit(() => {
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
                    })
                  }
                  type="button"
                >
                  <BackIcon />
                </button>

                {/* "상품 등록" → "분철 개최": 하단 탭·안내 화면·페이지 타이틀이 모두 "개최"인데
                    이 헤더만 "상품 등록"이라 같은 화면을 다른 이름으로 부르고 있었다. */}
                <div className="upload-header__copy min-w-0 flex-1">
                  <h1 className="upload-header__title text-[20px] font-semibold leading-none tracking-[-0.05em]">
                    {isEditMode ? "분철 수정" : "분철 개최"}
                  </h1>
                </div>
              </div>
            </header>

            <form
              className="tab-content-enter min-h-0 flex-1 overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
              onSubmit={(event) => event.preventDefault()}
              ref={formScrollRef}
            >
          <section className="px-4 pt-4">
            {/* 사진이 없을 때 4:3 히어로를 띄우면 첫 화면을 전부 먹어 폼이 "사진 올리는 화면"으로만
                읽힌다. 0장은 카메라 타일 한 칸으로 줄이고, 대표 사진이 생긴 뒤에만 히어로를 연다. */}
            {photos.length === 0 ? (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[14px] font-semibold tracking-[-0.045em]">
                    사진
                    <span className="ml-1.5 text-[13px] text-black/30">
                      0/{maxPhotos}
                    </span>
                  </p>
                  <p className="text-[12px] font-semibold text-black/40">
                    최대 {maxPhotos}장
                  </p>
                </div>
                <label className="mt-2.5 flex h-[76px] w-[76px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[0.8rem] border border-[#CDEB55] bg-[#F7FBEA]">
                  <CameraIcon className="h-6 w-6 text-[#4d6117]" />
                  <span className="text-[11px] font-semibold text-[#4d6117]">
                    0/{maxPhotos}
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
                <p className="mt-3 text-[12px] font-semibold text-black/40">
                  대표 사진은 올린 뒤 고를 수 있어요. 포카 실물과 구성품이 잘
                  보이는 사진이 좋아요.
                </p>
              </>
            ) : (
              <>
                <label className="product-hero-media relative z-0 flex cursor-pointer overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-[#10110D] via-[#222719] to-[#D7FF5F] shadow-[0_18px_42px_rgba(120,132,82,0.18)] ring-1 ring-[#D7FF5F]/45">
                  {coverPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={coverPhoto.url}
                    />
                  ) : null}

                  {coverPhoto ? (
                    <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
                      대표 사진
                    </span>
                  ) : null}

                  <span className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#D7FF5F] text-black shadow-[0_12px_30px_rgba(120,132,82,0.28)]">
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
                    <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-[0.8rem] border border-dashed border-[#CDEB55] bg-[#F7FBEA] text-black/45">
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
              </>
            )}
          </section>

          <section className="px-5 pt-6">
            <label className="block">
              <span className="text-[13px] font-semibold text-black/45">
                상품 제목
              </span>
              <input
                className="mt-2 h-14 w-full rounded-[0.9rem] border border-black/10 px-4 text-[17px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                maxLength={maxTitleLength}
                onChange={(event) => setTitle(event.currentTarget.value)}
                placeholder="예: LOVE DIVE 원영 미공포 분철"
                value={title}
              />
              <span
                className={`mt-1.5 block text-right text-[12px] font-semibold ${
                  isTitleOverLimit ? "text-[#c03131]" : "text-black/35"
                }`}
              >
                {title.length}/{maxTitleLength}자
              </span>
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
                                    onBlur={() =>
                                      validateMemberMinimumPrice(member.id)
                                    }
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
                                      <CloseIcon className="h-3.5 w-3.5" />
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
                                      <CheckIcon />
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
                  <label className="mt-4 block rounded-[0.9rem] border border-black/10 bg-white px-4 py-4">
                    <span className="text-[13px] font-semibold text-black/45">
                      최소 진행 인원
                    </span>
                    <div className="mt-4 grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-3 rounded-[0.85rem] bg-[#f7f7f7] p-2">
                      <button
                        aria-label="최소 진행 인원 줄이기"
                        className="motion-icon-button flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-[0_4px_12px_rgba(0,0,0,0.08)] disabled:bg-transparent disabled:text-black/20 disabled:shadow-none"
                        disabled={!canDecreaseMinHeadcount}
                        onClick={() =>
                          updateMinHeadcount(String(selectedMinHeadcount - 1))
                        }
                        type="button"
                      >
                        <MinusIcon />
                      </button>
                      <div className="min-w-0 text-center">
                        <p className="text-[24px] font-bold leading-none tracking-[-0.04em] text-black">
                          {selectedMinHeadcount}
                          <span className="ml-1 text-[15px] font-semibold text-black/45">
                            명
                          </span>
                        </p>
                        <p className="mt-1 text-[12px] font-semibold text-black/35">
                          최대 {targetMembers.length}명
                        </p>
                      </div>
                      <button
                        aria-label="최소 진행 인원 늘리기"
                        className="motion-icon-button flex h-11 w-11 items-center justify-center rounded-full bg-[#F3FFC6] text-black shadow-[0_4px_12px_rgba(190,230,70,0.2)] ring-1 ring-[#CDEB55] disabled:bg-transparent disabled:text-black/20 disabled:shadow-none disabled:ring-0"
                        disabled={!canIncreaseMinHeadcount}
                        onClick={() =>
                          updateMinHeadcount(String(selectedMinHeadcount + 1))
                        }
                        type="button"
                      >
                        <PlusIcon />
                      </button>
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
                      // 그룹명·별칭으로만 매칭한다. 멤버명은 0건이니 문구에 "멤버" 를 넣지 말 것.
                      placeholder="어떤 그룹의 분철인가요?"
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
                            ? "bg-black text-white ring-2 ring-[#CDEB55]"
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
                              ? "border-[#D7FF5F] bg-[#D7FF5F] text-black"
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
                  maxLength={maxDescriptionLength}
                  onChange={(event) => setDescription(event.currentTarget.value)}
                  placeholder="구성, 하자, 포장 방식 등을 적어주세요."
                  value={description}
                />
                <span className="mt-1.5 block text-right text-[12px] font-semibold text-black/35">
                  {description.length}/{maxDescriptionLength}자
                </span>
              </label>

              {/* 수정 요청(BuncheolModifyRequest)은 이 필드를 받지 않는다 — 입력이 조용히
                  버려지지 않도록 생성 모드에서만 노출한다 (docs/46 §4.7-E4 서버 후속). */}
              {isEditMode ? null : (
                <label className="mt-6 block">
                  <span className="text-[13px] font-semibold text-black/45">
                    오픈채팅 링크 (선택)
                  </span>
                  <input
                    className="mt-2 h-12 w-full rounded-[0.9rem] border border-black/10 px-4 text-[15px] tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                    inputMode="url"
                    maxLength={200}
                    onChange={(event) =>
                      setOpenChatUrl(event.currentTarget.value)
                    }
                    placeholder="https://open.kakao.com/o/..."
                    type="url"
                    value={openChatUrl}
                  />
                  <span className="mt-1.5 block text-[12px] font-medium leading-5 text-black/35">
                    참여자와 소통할 카카오 오픈채팅 링크예요. 분철 상세와 입금
                    안내 화면에 노출돼요.
                  </span>
                </label>
              )}
            </div>

            <button
              className="mt-8 h-14 w-full rounded-full bg-[#CFE86B] text-[17px] font-semibold tracking-[-0.04em] text-black shadow-[0_12px_28px_rgba(120,132,82,0.24)] disabled:bg-black/20 disabled:text-white"
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
      </div>

          <ConfirmSheet
            cancelLabel="계속 작성"
            onCancel={() => setExitConfirmRequest(null)}
            request={exitConfirmRequest}
          />
    </main>
  );
}
