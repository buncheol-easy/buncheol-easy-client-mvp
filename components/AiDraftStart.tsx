"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type {
  ConfirmSheetDetail,
  ConfirmSheetRequest,
} from "@/components/ConfirmSheet";
import { HelpText } from "@/components/HelpText";
import { BrandSparkleIcon } from "@/components/icons";
import {
  AI_DRAFT_DAILY_LIMIT_EXCEEDED_CODE,
  AI_DRAFT_DISABLED_CODE,
  AI_DRAFT_FETCH_FAILED_CODE,
  AiDraftTimeoutError,
  ApiRequestError,
  requestAiDraft,
  requestAiDraftQuota,
  type AiDraft,
  type AiDraftQuota,
  type AiDraftSource,
} from "@/lib/auth-api";
import { getFreshAccessToken } from "@/lib/auth-session";
import { trackEvent } from "@/lib/analytics";

export type AiDraftForForm = AiDraft & {
  // 폼 사진 칸에 바로 넣을 데이터 URL. 형식을 못 알아본 사진은 빠진다.
  imageUrls: string[];
};

// checking: AI 를 쓸 수 있는지 묻는 중 · start: 시작 방법 고르기 · input: 주소·설명 넣기 · form: 개최 폼
export type AiDraftStep = "checking" | "start" | "input" | "form";

type AiDraftStartProps = {
  // 개최자가 직접 써서 AI 결과로 바뀔 칸. 비어 있으면 묻지 않고 보낸다.
  getFieldsToReplace: () => ConfirmSheetDetail[];
  // 채운 칸 이름을 돌려준다. 그사이 그만두면(signal) 폼을 바꾸지 않는다.
  onApply: (draft: AiDraftForForm, signal: AbortSignal) => Promise<string[]>;
  // 시작 화면으로 돌아갈 수 있는지. 스위치가 꺼졌거나 이 API 가 없는 서버면 false 이고 폼은 지금 그대로다.
  onAvailabilityChange: (isAvailable: boolean) => void;
  // 확인 창은 부르는 쪽이 띄운다. 개최 폼은 transform 이 남아 있어 그 안의 fixed 시트가 폼 기준으로 놓인다.
  onConfirmRequest: (request: ConfirmSheetRequest) => void;
  onFilled: (filledCount: number) => void;
  onPendingChange: (isPending: boolean) => void;
  onStepChange: (step: AiDraftStep) => void;
  step: AiDraftStep;
};

type InputMode = "url" | "text";
type Phase = "idle" | "pending" | "done";

// 응답이 이보다 늦으면 폼을 먼저 연다. 이미 쓰고 있는 사람 앞에 시작 화면을 띄우지 않는다.
const aiQuotaWaitMs = 2000;

const maxRawTextLength = 5000;
const networkErrorMessage =
  "AI 결과를 받지 못했어요. 연결을 확인하고 다시 시도해 주세요.";

// 앱의 공유하기로 복사하면 "상품명 https://…" 처럼 주소 앞뒤에 글이 붙어 온다. 한글이 그대로 든 주소도
// 엔진이 받으므로 한글은 남기고, 주소 끝에 붙은 문장부호만 뗀다.
function extractUrl(input: string) {
  const match = input.match(/https?:\/\/[^\s<>"']+/i);

  if (match) {
    return match[0].replace(/[)\]}>.,!?;:'"]+$/, "");
  }

  const trimmed = input.trim();

  if (/^[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return null;
}

function getImageMimeType(base64: string) {
  if (base64.startsWith("/9j/")) {
    return "image/jpeg";
  }

  if (base64.startsWith("iVBOR")) {
    return "image/png";
  }

  if (base64.startsWith("UklGR")) {
    return "image/webp";
  }

  if (base64.startsWith("R0lGOD")) {
    return "image/gif";
  }

  return null;
}

// 등록할 때 사진을 JPEG 로 줄이면 투명한 곳이 검게 칠해진다. 넣기 전에 흰 바탕을 깐다.
function flattenOnWhite(dataUrl: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();

    image.addEventListener("load", () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Canvas unavailable"));
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    });
    image.addEventListener("error", () => {
      reject(new Error("Image load failed"));
    });
    image.src = dataUrl;
  });
}

async function toFormImageUrls(images: string[]) {
  const urls = await Promise.all(
    images.map(async (base64) => {
      const mimeType = getImageMimeType(base64);

      if (!mimeType) {
        return null;
      }

      const dataUrl = `data:${mimeType};base64,${base64}`;

      if (mimeType === "image/jpeg") {
        return dataUrl;
      }

      return flattenOnWhite(dataUrl).catch(() => null);
    }),
  );

  return urls.filter((url): url is string => url !== null);
}

export function AiDraftStart({
  getFieldsToReplace,
  onApply,
  onAvailabilityChange,
  onConfirmRequest,
  onFilled,
  onPendingChange,
  onStepChange,
  step,
}: AiDraftStartProps) {
  // null 이면 AI 화면을 그리지 않는다 — 조회 전, 조회 실패, 이 API 가 아직 없는 서버까지 지금 폼 그대로.
  const [quota, setQuota] = useState<AiDraftQuota | null>(null);
  const [mode, setMode] = useState<InputMode>("url");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  // 객체로 감싸 effect 정리 함수가 마지막 요청을 끊게 한다.
  const pendingRef = useRef<{ controller: AbortController | null }>({
    controller: null,
  });
  const urlInputRef = useRef<HTMLInputElement | null>(null);

  function turnOff() {
    setQuota(null);
    setPhase("idle");
    onAvailabilityChange(false);
    onStepChange("form");
  }

  function refreshQuota() {
    getFreshAccessToken()
      .then((accessToken) =>
        accessToken ? requestAiDraftQuota(accessToken) : null,
      )
      .then((nextQuota) => {
        if (nextQuota?.enabled) {
          setQuota(nextQuota);
        } else {
          turnOff();
        }
      })
      .catch(() => {
        // 실패 직후 다시 세는 것이라 못 세도 지금 숫자를 둔다.
      });
  }

  const openAfterQuota = useEffectEvent((nextQuota: AiDraftQuota | null) => {
    if (!nextQuota?.enabled) {
      onStepChange("form");
      return;
    }

    setQuota(nextQuota);

    // 횟수를 다 쓴 날은 고를 것이 없으니 폼으로 바로 간다.
    if (nextQuota.remainingToday > 0) {
      onAvailabilityChange(true);
      onStepChange("start");
    } else {
      onStepChange("form");
    }
  });

  useEffect(() => {
    let isSettled = false;
    const pending = pendingRef.current;
    const timeout = window.setTimeout(() => settle(null), aiQuotaWaitMs);

    function settle(nextQuota: AiDraftQuota | null) {
      if (isSettled) {
        return;
      }

      isSettled = true;
      window.clearTimeout(timeout);
      openAfterQuota(nextQuota);
    }

    getFreshAccessToken()
      .then((accessToken) =>
        accessToken ? requestAiDraftQuota(accessToken) : null,
      )
      .then(settle)
      .catch(() => settle(null));

    return () => {
      isSettled = true;
      window.clearTimeout(timeout);
      pending.controller?.abort();
    };
  }, []);

  if (!quota) {
    return null;
  }

  const isOutOfQuota = quota.remainingToday <= 0;
  const isPending = phase === "pending";

  function getSource(): AiDraftSource | null {
    if (mode === "text") {
      const rawText = textInput.trim();

      if (!rawText) {
        setErrorMessage("판매 페이지의 상품 설명을 붙여 넣어 주세요.");
        return null;
      }

      return { rawText };
    }

    if (!urlInput.trim()) {
      setErrorMessage("판매 페이지 주소를 넣어 주세요.");
      return null;
    }

    const url = extractUrl(urlInput);

    if (!url) {
      setErrorMessage(
        "주소를 찾지 못했어요. https:// 로 시작하는 판매 페이지 주소를 넣어 주세요.",
      );
      return null;
    }

    return { url };
  }

  function handleSubmit() {
    if (isPending || isOutOfQuota) {
      return;
    }

    setNoticeMessage("");
    const source = getSource();

    if (!source) {
      return;
    }

    const fieldsToReplace = getFieldsToReplace();

    if (fieldsToReplace.length === 0) {
      void runDraft(source);
      return;
    }

    onConfirmRequest({
      cancelLabel: "취소",
      confirmLabel: "바꾸기",
      description: "직접 쓴 내용이 AI가 쓴 내용으로 바뀌어요.",
      details: fieldsToReplace,
      onConfirm: () => {
        void runDraft(source);
      },
      title: "AI 결과로 바꿀까요?",
    });
  }

  async function runDraft(source: AiDraftSource) {
    const sourceType = "url" in source ? "url" : "text";
    const controller = new AbortController();

    pendingRef.current.controller = controller;
    setErrorMessage("");
    setPhase("pending");
    onPendingChange(true);
    onStepChange("form");
    trackEvent("ai_draft_requested", { source: sourceType });

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        throw new Error("로그인이 풀렸어요. 다시 로그인한 뒤 시도해 주세요.");
      }

      const draft = await requestAiDraft(
        accessToken,
        source,
        controller.signal,
      );
      const imageUrls = await toFormImageUrls(draft.images);

      if (controller.signal.aborted) {
        return;
      }

      const labels = await onApply({ ...draft, imageUrls }, controller.signal);

      if (controller.signal.aborted) {
        return;
      }

      if (draft.remainingToday !== null) {
        const remainingToday = draft.remainingToday;
        setQuota((current) => current && { ...current, remainingToday });
      }

      trackEvent("ai_draft_succeeded", {
        group_matched: draft.group !== null,
        image_count: imageUrls.length,
        source: sourceType,
      });

      if (labels.length === 0) {
        setErrorMessage(
          "AI가 채울 내용을 찾지 못했어요. 다른 주소로 시도하거나 직접 써 주세요.",
        );
        setPhase("idle");
        onStepChange("input");
        return;
      }

      setPhase("done");
      onFilled(labels.length);
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        return;
      }

      const code = error instanceof ApiRequestError ? error.code : undefined;
      trackEvent("ai_draft_failed", {
        code:
          code ??
          (error instanceof AiDraftTimeoutError ? "timeout" : "client"),
        source: sourceType,
      });

      if (code === AI_DRAFT_DISABLED_CODE) {
        turnOff();
        return;
      }

      if (code === AI_DRAFT_FETCH_FAILED_CODE) {
        setMode("text");
      }

      setPhase("idle");
      onStepChange("input");

      if (code === AI_DRAFT_DAILY_LIMIT_EXCEEDED_CODE) {
        // 남은 횟수 자리가 같은 문장을 보인다.
        setQuota((current) => current && { ...current, remainingToday: 0 });
        return;
      }

      setErrorMessage(
        error instanceof TypeError
          ? networkErrorMessage
          : error instanceof Error && error.message
            ? error.message
            : networkErrorMessage,
      );
      refreshQuota();
    } finally {
      if (pendingRef.current.controller === controller) {
        pendingRef.current.controller = null;
        onPendingChange(false);
      }
    }
  }

  function handleCancel() {
    pendingRef.current.controller?.abort();
    pendingRef.current.controller = null;
    onPendingChange(false);
    setPhase("idle");
    onStepChange("input");
    setNoticeMessage(
      "그만뒀어요. AI가 이미 쓰기 시작했다면 오늘 횟수에서 1번 빠질 수 있어요.",
    );
    refreshQuota();
  }

  function switchMode(nextMode: InputMode) {
    setMode(nextMode);
    setErrorMessage("");
    setNoticeMessage("");
  }

  if (step === "form") {
    if (isPending) {
      return (
        <div
          aria-live="polite"
          className="flex shrink-0 items-start gap-3 border-b border-black/10 px-5 py-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tracking-[-0.045em]">
              {mode === "text"
                ? "AI가 붙여 넣은 설명을 읽고 있어요"
                : "AI가 판매 페이지를 읽고 있어요"}
            </p>
            <HelpText className="mt-0.5" size="caption">
              보통 10~15초 걸려요. 이 화면에 머물러 주세요.
            </HelpText>
          </div>
          <button
            className="shrink-0 rounded-full bg-surface-2 px-3.5 py-1.5 text-[13px] font-semibold text-black/70"
            onClick={handleCancel}
            type="button"
          >
            그만두기
          </button>
        </div>
      );
    }

    return isOutOfQuota && phase === "idle" ? (
      <p className="shrink-0 border-b border-black/10 px-5 py-2.5 text-[12px] font-semibold text-black/45">
        오늘은 AI 작성을 모두 썼어요. 내일 다시 이용해 주세요.
      </p>
    ) : null;
  }

  if (step === "start") {
    return (
      <section
        aria-label="개최 시작 방법"
        className="tab-content-enter flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-6 pt-7"
      >
        <h2 className="mb-2 text-[24px] font-semibold leading-[1.35] tracking-[-0.05em]">
          어떻게 시작할까요?
        </h2>
        <button
          className="flex w-full items-start gap-3 rounded-[1.25rem] bg-black p-5 text-left text-white"
          onClick={() => {
            trackEvent("ai_start_chosen", { choice: "ai" });
            setErrorMessage("");
            setNoticeMessage("");
            onStepChange("input");
            window.requestAnimationFrame(() => urlInputRef.current?.focus());
          }}
          type="button"
        >
          <BrandSparkleIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-strong" />
          <span className="min-w-0">
            <span className="block text-[17px] font-semibold tracking-[-0.04em]">
              판매 페이지 주소로 시작
            </span>
            <span className="mt-1 block text-[14px] tracking-[-0.03em] text-white/70">
              AI가 사진·제목·설명을 먼저 채워 드려요
            </span>
          </span>
        </button>
        <button
          className="w-full rounded-[1.25rem] bg-surface-2 p-5 text-left text-black"
          onClick={() => {
            trackEvent("ai_start_chosen", { choice: "manual" });
            onStepChange("form");
          }}
          type="button"
        >
          <span className="block text-[17px] font-semibold tracking-[-0.04em]">
            직접 쓰기
          </span>
          <span className="mt-1 block text-[14px] tracking-[-0.03em] text-black/55">
            빈 칸부터 하나씩 써요
          </span>
        </button>
      </section>
    );
  }

  if (step !== "input") {
    return null;
  }

  const quotaText = isOutOfQuota
    ? "오늘은 AI 작성을 모두 썼어요. 내일 다시 이용해 주세요."
    : `오늘 ${quota.remainingToday}번 남았어요`;

  return (
    <section
      aria-label="판매 페이지 주소로 채우기"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-7"
    >
      <h2 className="text-[24px] font-semibold leading-[1.35] tracking-[-0.05em]">
        {mode === "url" ? (
          <>
            판매 페이지 주소를
            <br />
            알려 주세요
          </>
        ) : (
          <>
            상품 설명을
            <br />
            붙여 넣어 주세요
          </>
        )}
      </h2>

      {errorMessage ? (
        <p
          className="mt-3 break-keep text-[13px] font-semibold leading-5 text-danger-base"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
      {noticeMessage ? (
        <HelpText className="mt-3" size="caption">
          {noticeMessage}
        </HelpText>
      ) : null}

      {mode === "url" ? (
        <>
          <input
            aria-label="판매 페이지 주소"
            className="mt-5 h-14 w-full shrink-0 rounded-[1rem] border border-transparent bg-surface-2 px-4 text-[16px] tracking-[-0.03em] outline-none placeholder:text-black/35 focus:border-black disabled:text-black/40"
            disabled={isOutOfQuota}
            enterKeyHint="go"
            inputMode="url"
            onChange={(event) => setUrlInput(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="https://"
            ref={urlInputRef}
            type="text"
            value={urlInput}
          />
          <p className="mt-2.5 break-keep text-[12px] font-medium leading-5 text-black/50">
            네이버 스토어·올리브영·위드뮤는{" "}
            <button
              className="underline underline-offset-2"
              onClick={() => switchMode("text")}
              type="button"
            >
              글을 붙여 넣어
            </button>{" "}
            주세요.
          </p>
        </>
      ) : (
        <>
          <textarea
            aria-label="상품 설명 붙여 넣기"
            className="mt-5 min-h-36 w-full shrink-0 resize-none break-keep rounded-[1rem] border border-transparent bg-surface-2 px-4 py-3 text-[16px] leading-6 tracking-[-0.03em] outline-none placeholder:text-black/35 focus:border-black disabled:text-black/40"
            disabled={isOutOfQuota}
            maxLength={maxRawTextLength}
            onChange={(event) => setTextInput(event.currentTarget.value)}
            placeholder="판매 페이지의 상품명·구성·특전 설명을 복사해서 붙여 넣어 주세요."
            value={textInput}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <button
              className="text-[12px] font-semibold text-black/55 underline underline-offset-2"
              onClick={() => switchMode("url")}
              type="button"
            >
              주소로 넣기
            </button>
            <span className="text-[12px] font-semibold text-black/35">
              {textInput.length}/{maxRawTextLength}자
            </span>
          </div>
        </>
      )}

      {/* 키보드가 열리면 화면 아래가 가려진다. 그때는 위 칸 바로 밑으로 올린다(globals.css). */}
      <div className="ai-start-foot mt-auto pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5">
        <button
          className="h-14 w-full rounded-full bg-black text-[16px] font-semibold tracking-[-0.04em] text-brand-strong disabled:opacity-40"
          disabled={isOutOfQuota}
          onClick={handleSubmit}
          type="button"
        >
          AI로 채우기
        </button>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <button
            className="text-[13px] font-semibold text-black/55 underline underline-offset-2"
            onClick={() => onStepChange("form")}
            type="button"
          >
            직접 쓰기로 바꾸기
          </button>
          <span className="text-[12px] font-semibold text-black/40">
            {quotaText}
          </span>
        </div>
      </div>
    </section>
  );
}
