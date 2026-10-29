"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ConfirmSheetDetail,
  ConfirmSheetRequest,
} from "@/components/ConfirmSheet";
import { HelpText } from "@/components/HelpText";
import { BrandSparkleIcon, CheckIcon } from "@/components/icons";
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

type AiDraftCardProps = {
  // 개최자가 직접 써서 AI 결과로 바뀔 칸. 비어 있으면 묻지 않고 보낸다.
  getFieldsToReplace: () => ConfirmSheetDetail[];
  // 채운 칸 이름을 돌려준다. 접힌 카드 요약에 쓴다. 그사이 그만두면(signal) 폼을 바꾸지 않는다.
  onApply: (draft: AiDraftForForm, signal: AbortSignal) => Promise<string[]>;
  // 확인 창은 부르는 쪽이 띄운다. 개최 폼은 transform 이 남아 있어 그 안의 fixed 시트가 폼 기준으로 놓인다.
  onConfirmRequest: (request: ConfirmSheetRequest) => void;
  onPendingChange: (isPending: boolean) => void;
};

type InputMode = "url" | "text";
type Phase = "idle" | "pending" | "done";

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

function withObjectParticle(word: string) {
  const lastCode = word.charCodeAt(word.length - 1) - 0xac00;
  const hasBatchim = lastCode >= 0 && lastCode <= 11171 && lastCode % 28 !== 0;

  return `${word}${hasBatchim ? "을" : "를"}`;
}

export function AiDraftCard({
  getFieldsToReplace,
  onApply,
  onConfirmRequest,
  onPendingChange,
}: AiDraftCardProps) {
  // null 이면 카드를 그리지 않는다 — 조회 전, 조회 실패, 이 API 가 아직 없는 서버까지 지금 폼 그대로.
  const [quota, setQuota] = useState<AiDraftQuota | null>(null);
  const [mode, setMode] = useState<InputMode>("url");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [filledLabels, setFilledLabels] = useState<string[]>([]);
  // 객체로 감싸 effect 정리 함수가 마지막 요청을 끊게 한다.
  const pendingRef = useRef<{ controller: AbortController | null }>({
    controller: null,
  });

  function refreshQuota() {
    getFreshAccessToken()
      .then((accessToken) =>
        accessToken ? requestAiDraftQuota(accessToken) : null,
      )
      .then((nextQuota) => {
        setQuota(nextQuota?.enabled ? nextQuota : null);
      })
      .catch(() => {
        // 실패 직후 다시 세는 것이라 못 세도 지금 숫자를 둔다.
      });
  }

  useEffect(() => {
    let isActive = true;
    const pending = pendingRef.current;

    getFreshAccessToken()
      .then((accessToken) =>
        accessToken ? requestAiDraftQuota(accessToken) : null,
      )
      .then((nextQuota) => {
        if (isActive && nextQuota?.enabled) {
          setQuota(nextQuota);
        }
      })
      .catch(() => {});

    return () => {
      isActive = false;
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
        return;
      }

      setFilledLabels(labels);
      setPhase("done");
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
        setQuota(null);
        return;
      }

      if (code === AI_DRAFT_FETCH_FAILED_CODE) {
        setMode("text");
      }

      if (code === AI_DRAFT_DAILY_LIMIT_EXCEEDED_CODE) {
        // 남은 횟수 자리가 같은 문장을 보인다.
        setQuota((current) => current && { ...current, remainingToday: 0 });
        setPhase("idle");
        return;
      }

      setErrorMessage(
        error instanceof TypeError
          ? networkErrorMessage
          : error instanceof Error && error.message
            ? error.message
            : networkErrorMessage,
      );
      setPhase("idle");
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

  const quotaText = isOutOfQuota
    ? "오늘은 AI 작성을 모두 썼어요. 내일 다시 이용해 주세요."
    : `오늘 ${quota.remainingToday}번 남았어요 (하루 ${quota.dailyLimit}번)`;

  return (
    <section aria-label="판매 페이지 주소로 채우기" className="px-4 pt-4">
      <div className="rounded-[1rem] border border-[#CDEB55] bg-[#F7FBEA] px-4 py-4">
        {phase === "done" ? (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#CFE86B] text-black">
              <CheckIcon />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-5 tracking-[-0.04em]">
                AI가 {withObjectParticle(filledLabels.join("·"))} 채웠어요.
              </p>
              <HelpText className="mt-1" size="caption">
                등록 전에 꼭 확인해 주세요.
              </HelpText>
              <button
                className="mt-3 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black/70 ring-1 ring-black/10"
                onClick={() => {
                  setPhase("idle");
                  setErrorMessage("");
                }}
                type="button"
              >
                다른 주소로 다시
              </button>
            </div>
          </div>
        ) : isPending ? (
          <div aria-live="polite">
            <p className="text-[15px] font-semibold tracking-[-0.045em]">
              {mode === "text"
                ? "AI가 붙여 넣은 설명을 읽고 있어요"
                : "AI가 판매 페이지를 읽고 있어요"}
            </p>
            <HelpText className="mt-1" size="caption">
              보통 10~15초 걸려요. 이 화면에 머물러 주세요.
            </HelpText>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10">
              <div className="ai-draft-wait-bar h-full w-2/5 rounded-full bg-[#9DBF2A]" />
            </div>
            <button
              className="mt-3 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black/60 ring-1 ring-black/10"
              onClick={handleCancel}
              type="button"
            >
              그만두기
            </button>
          </div>
        ) : (
          // 개최 폼(<form>) 안에 놓이므로 form 을 쓰지 않는다. 버튼도 submit 이면 폼의 다른 칸에서
          // 엔터를 쳤을 때 이 버튼이 눌린다.
          <div>
            <p className="flex items-center gap-1.5 text-[15px] font-semibold tracking-[-0.045em]">
              <BrandSparkleIcon className="h-4 w-4 text-brand-ink" />
              판매 페이지 주소로 채우기
            </p>
            <HelpText className="mt-1" size="caption">
              AI가 사진·제목·구매처·아이돌·설명을 채워 줘요. 가격·배송·마감은
              직접 정해 주세요.
            </HelpText>

            {mode === "url" ? (
              <>
                <div className="mt-3 flex gap-2">
                  <input
                    aria-label="판매 페이지 주소"
                    className="h-12 min-w-0 flex-1 rounded-[0.9rem] border border-black/10 bg-white px-4 text-[15px] tracking-[-0.04em] outline-none placeholder:text-black/30 focus:border-black disabled:text-black/40"
                    disabled={isOutOfQuota}
                    enterKeyHint="go"
                    inputMode="url"
                    onChange={(event) => setUrlInput(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder="https://"
                    type="text"
                    value={urlInput}
                  />
                  <button
                    className="h-12 shrink-0 rounded-full bg-[#CFE86B] px-4 text-[14px] font-semibold tracking-[-0.04em] text-black disabled:opacity-50"
                    disabled={isOutOfQuota}
                    onClick={handleSubmit}
                    type="button"
                  >
                    AI로 채우기
                  </button>
                </div>
                <HelpText className="mt-2" size="caption">
                  네이버 스토어·올리브영·위드뮤는 주소로 읽지 못해요. 상품 설명을
                  붙여 넣어 주세요.
                </HelpText>
              </>
            ) : (
              <>
                <textarea
                  aria-label="상품 설명 붙여 넣기"
                  className="mt-3 min-h-32 w-full resize-none rounded-[0.9rem] border border-black/10 bg-white px-4 py-3 text-[14px] leading-6 tracking-[-0.04em] outline-none placeholder:text-black/30 focus:border-black disabled:text-black/40"
                  disabled={isOutOfQuota}
                  maxLength={maxRawTextLength}
                  onChange={(event) => setTextInput(event.currentTarget.value)}
                  placeholder="판매 페이지의 상품명·구성·특전 설명을 복사해서 붙여 넣어 주세요."
                  value={textInput}
                />
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-[12px] font-semibold text-black/35">
                    {textInput.length}/{maxRawTextLength}자
                  </span>
                  <button
                    className="h-11 shrink-0 rounded-full bg-[#CFE86B] px-4 text-[14px] font-semibold tracking-[-0.04em] text-black disabled:opacity-50"
                    disabled={isOutOfQuota}
                    onClick={handleSubmit}
                    type="button"
                  >
                    AI로 채우기
                  </button>
                </div>
              </>
            )}

            {errorMessage ? (
              <p
                className="mt-3 text-[13px] font-semibold leading-5 text-[#c03131]"
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

            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <button
                className="text-[12px] font-semibold text-black/55 underline underline-offset-2"
                onClick={() => switchMode(mode === "url" ? "text" : "url")}
                type="button"
              >
                {mode === "url"
                  ? "주소 대신 상품 설명 붙여 넣기"
                  : "판매 페이지 주소로 넣기"}
              </button>
              <span className="text-[12px] font-semibold text-black/40">
                {quotaText}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
