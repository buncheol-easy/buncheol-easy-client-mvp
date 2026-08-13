"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { BackIcon, CheckIcon, ProfileIcon } from "@/components/icons";
import { createLoginHref } from "@/lib/auth-navigation";
import { getFreshAccessToken } from "@/lib/auth-session";
import {
  isUserProfileComplete,
  deleteUserProfile,
  requestMyParticipations,
  requestNicknameDuplicate,
  requestUserProfile,
  updateUserProfile,
  type UserProfile,
} from "@/lib/auth-api";
import {
  authProfileSetupReturnHrefStorageKey,
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import { FEATURES } from "@/lib/feature-flags";
import { clearUserSessionState } from "@/lib/user-session";

type ProfileAccountContentProps = {
  onBack?: () => void;
};

export const PROFILE_ACCOUNT_LOGIN_RETURN_KEY =
  "profile-account-login-return";

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

function getEmptyProfileForm() {
  return {
    name: "",
    nickname: "",
    phoneNumber: "",
  };
}

function getProfileForm(profile: UserProfile | null) {
  return {
    name: profile?.name ?? "",
    nickname: profile?.nickname ?? "",
    phoneNumber: profile?.phoneNumber ?? "",
  };
}

function sanitizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function getProviderLabel(provider: string | undefined) {
  const kind = getProviderKind(provider);

  if (kind === "kakao") {
    return "카카오";
  }

  if (kind === "google") {
    return "구글";
  }

  if (kind === "naver") {
    return "네이버";
  }

  return provider?.trim() || "확인 필요";
}

function getProviderKind(provider: string | undefined) {
  const normalized = provider?.trim().toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  if (normalized.includes("kakao")) {
    return "kakao";
  }

  if (normalized.includes("google")) {
    return "google";
  }

  if (normalized.includes("naver")) {
    return "naver";
  }

  return "unknown";
}

function clearSessionState() {
  clearUserSessionState();
}

function ProviderIconBadge({ provider }: { provider: string | undefined }) {
  const providerKind = getProviderKind(provider);

  if (providerKind === "kakao") {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FEE500] text-[#191919]">
        <svg
          aria-hidden="true"
          className="h-7 w-7"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 4.2c-4.7 0-8.5 2.9-8.5 6.5 0 2.3 1.6 4.4 4 5.5l-.8 3.1a.5.5 0 0 0 .8.5l3.7-2.5h.8c4.7 0 8.5-2.9 8.5-6.5S16.7 4.2 12 4.2Z" />
        </svg>
      </div>
    );
  }

  if (providerKind === "google") {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[20px] font-bold text-black ring-1 ring-black/10">
        G
      </div>
    );
  }

  if (providerKind === "naver") {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#03C75A] text-[20px] font-bold text-white">
        N
      </div>
    );
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-black ring-1 ring-black/10">
      <ProfileIcon />
    </div>
  );
}

export function ProfileAccountContent({ onBack }: ProfileAccountContentProps) {
  const router = useRouter();
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const saveFeedbackTimerRef = useRef<number | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState(() => getEmptyProfileForm());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [hasUnclaimedPayback, setHasUnclaimedPayback] = useState(false);
  const [isSaveFeedbackVisible, setIsSaveFeedbackVisible] = useState(false);
  const [message, setMessage] = useState("");
  // 이름은 기존 회원 호환을 위해 빈 값을 허용한다 (값이 있으면 형식 검증, 서버는 미전송 시 기존 값 유지).
  const canSave =
    (form.name.trim() === "" || /^[가-힣A-Za-z]{1,30}$/.test(form.name.trim())) &&
    /^[가-힣A-Za-z0-9]{1,20}$/.test(form.nickname.trim()) &&
    /^01\d{8,9}$/.test(form.phoneNumber.trim());

  useEffect(() => {
    let isActive = true;

    if (!authState.isLoggedIn || !authState.accessToken) {
      const frame = window.requestAnimationFrame(() => {
        if (!isActive) {
          return;
        }

        setProfile(null);
        setForm(getEmptyProfileForm());
        setMessage("");
      });

      return () => {
        isActive = false;
        window.cancelAnimationFrame(frame);
      };
    }

    setIsLoading(true);
    setMessage("");

    getFreshAccessToken()
      .then((accessToken) =>
        accessToken ? requestUserProfile(accessToken) : null,
      )
      .then((nextProfile) => {
        if (!isActive || !nextProfile) {
          return;
        }

        if (!isUserProfileComplete(nextProfile)) {
          window.sessionStorage.setItem(
            authProfileSetupReturnHrefStorageKey,
            "/profile/account",
          );
          router.replace("/signup/profile");
          return;
        }

        setProfile(nextProfile);
        setForm(getProfileForm(nextProfile));
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "회원 정보를 불러오지 못했어요.",
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, authState.isLoggedIn, router]);

  useEffect(() => {
    return () => {
      if (saveFeedbackTimerRef.current !== null) {
        window.clearTimeout(saveFeedbackTimerRef.current);
      }
    };
  }, []);

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }

    const historyIndex = getHistoryIndex();

    if (
      window.sessionStorage.getItem(PROFILE_ACCOUNT_LOGIN_RETURN_KEY) === "true"
    ) {
      window.sessionStorage.removeItem(PROFILE_ACCOUNT_LOGIN_RETURN_KEY);
      router.replace("/profile");
      return;
    }

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace("/profile");
  }

  function updateForm(
    field: keyof ReturnType<typeof getEmptyProfileForm>,
    value: string,
  ) {
    setIsSaveFeedbackVisible(false);

    if (saveFeedbackTimerRef.current !== null) {
      window.clearTimeout(saveFeedbackTimerRef.current);
      saveFeedbackTimerRef.current = null;
    }

    setForm((current) => ({
      ...current,
      [field]: field === "phoneNumber" ? sanitizePhoneNumber(value) : value,
    }));
  }

  async function saveProfile() {
    if (!authState.isLoggedIn || !canSave || isSaving) {
      return;
    }

    const nextName = form.name.trim();
    const nextProfile = {
      nickname: form.nickname.trim(),
      phoneNumber: form.phoneNumber.trim(),
    };

    setIsSaving(true);
    setMessage("");

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        return;
      }

      if (nextProfile.nickname !== profile?.nickname?.trim()) {
        const { isDuplicate } = await requestNicknameDuplicate(
          accessToken,
          nextProfile.nickname,
        );

        if (isDuplicate) {
          setMessage("이미 사용 중인 닉네임이에요.");
          return;
        }
      }

      // 이름은 비워서 저장하면 서버가 기존 값을 유지하므로, 값이 있을 때만 전송한다.
      await updateUserProfile(accessToken, {
        ...nextProfile,
        ...(nextName ? { name: nextName } : {}),
      });
      setProfile((current) => ({
        bankAccount: current?.bankAccount ?? null,
        email: current?.email ?? "",
        name: nextName || (current?.name ?? ""),
        provider: current?.provider ?? "",
        ...nextProfile,
      }));
      setForm({ ...nextProfile, name: nextName });
      setIsSaveFeedbackVisible(true);

      if (saveFeedbackTimerRef.current !== null) {
        window.clearTimeout(saveFeedbackTimerRef.current);
      }

      saveFeedbackTimerRef.current = window.setTimeout(() => {
        setIsSaveFeedbackVisible(false);
        saveFeedbackTimerRef.current = null;
      }, 1200);
    } catch (error: unknown) {
      setMessage(
        error instanceof Error ? error.message : "회원 정보를 저장하지 못했어요.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  // 탈퇴하면 아직 신청할 수 있는 배송비 돌려받기를 조용히 포기하게 되므로, 확인 모달에 경고를
  // 띄우기 위해 참여 내역을 조회한다. 신청 가능 판정은 참여 내역 카드의 CTA 노출 조건과 동일하게
  // ELIGIBLE(미신청) + REJECTED(반려 후 재신청 가능)를 본다. 신청 후 검수 중(REQUESTED)은 서버가
  // 탈퇴 자체를 거부하고(USR-029), 완료/만료는 포기할 것이 없다.
  async function checkUnclaimedPayback() {
    if (!FEATURES.shippingFeePayback) {
      return;
    }

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        return;
      }

      const participations = await requestMyParticipations(accessToken);

      setHasUnclaimedPayback(
        participations.some(
          (participation) =>
            participation.payback?.status === "ELIGIBLE" ||
            participation.payback?.status === "REJECTED",
        ),
      );
    } catch {
      // 경고 배너용 조회라 실패해도 탈퇴 진행을 막지 않는다 (경고만 생략).
    }
  }

  async function deleteProfile() {
    if (!authState.isLoggedIn || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setMessage("");

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        throw new Error("로그인이 만료됐어요. 다시 로그인한 뒤 탈퇴해 주세요.");
      }

      await deleteUserProfile(accessToken);
      setIsDeleteConfirmOpen(false);
      clearSessionState();
      router.replace("/profile");
    } catch (error: unknown) {
      setIsDeleteConfirmOpen(false);
      setMessage(
        error instanceof Error ? error.message : "회원 탈퇴를 처리하지 못했어요.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f7f7f7]">
      <header className="shrink-0 bg-white px-6 pb-4 pt-6">
        <div className="flex items-start justify-between gap-4">
          <button
            aria-label="뒤로가기"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black text-white"
            onClick={handleBack}
            type="button"
          >
            <BackIcon />
          </button>
          <div className="min-w-0 flex-1 self-center text-left">
            <h1 className="text-[24px] font-semibold leading-none tracking-[-0.06em]">
              회원 정보
            </h1>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4">
        {!authState.isLoggedIn ? (
          <div className="rounded-[1.15rem] bg-white px-5 py-6 shadow-[0_14px_34px_rgba(0,0,0,0.04)]">
            <p className="text-[17px] font-semibold tracking-[-0.05em]">
              로그인 후 확인할 수 있어요.
            </p>
            <button
              className="mt-4 h-11 rounded-full bg-black px-5 text-[14px] font-semibold text-white"
              onClick={() => {
                window.sessionStorage.setItem(
                  PROFILE_ACCOUNT_LOGIN_RETURN_KEY,
                  "true",
                );
                router.push(
                  createLoginHref({
                    cancelTo: "/profile",
                    returnTo: "/profile/account",
                  }),
                );
              }}
              type="button"
            >
              로그인하기
            </button>
          </div>
        ) : (
          <>
            <section className="rounded-[1.2rem] bg-black px-5 py-5 text-white shadow-[0_18px_42px_rgba(0,0,0,0.18)] ring-1 ring-[#AAB67C]/35">
              <div className="flex items-center gap-4">
                <ProviderIconBadge provider={profile?.provider} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#DDE7B8]">
                    연결된 계정
                  </p>
                  <p className="mt-1 truncate text-[18px] font-semibold tracking-[-0.05em] text-white">
                    {isLoading
                      ? "회원 정보 확인 중"
                      : `${getProviderLabel(profile?.provider)} 로그인`}
                  </p>
                  <p className="mt-1 truncate text-[13px] font-medium text-white/40">
                    {profile?.email || "이메일 정보 없음"}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-[1.2rem] border border-black/10 bg-white px-4 py-4 shadow-[0_14px_34px_rgba(0,0,0,0.04)]">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                    기본 정보
                  </h2>
                  <p className="mt-1 text-[13px] font-medium text-black/45">
                    서비스에 표시될 이름과 연락처를 관리해요.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="block rounded-[0.95rem] bg-[#f7f7f7] px-3 py-3 ring-1 ring-black/10 transition focus-within:bg-white focus-within:ring-black/35">
                  <span className="text-[13px] font-semibold text-black/45">
                    이름
                  </span>
                  <input
                    className="mt-1 h-8 w-full bg-transparent text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25"
                    disabled={isLoading}
                    maxLength={30}
                    onChange={(event) =>
                      updateForm("name", event.currentTarget.value)
                    }
                    placeholder="홍길동"
                    value={form.name}
                  />
                </label>
                <label className="block rounded-[0.95rem] bg-[#f7f7f7] px-3 py-3 ring-1 ring-black/10 transition focus-within:bg-white focus-within:ring-black/35">
                  <span className="text-[13px] font-semibold text-black/45">
                    닉네임
                  </span>
                  <input
                    className="mt-1 h-8 w-full bg-transparent text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25"
                    disabled={isLoading}
                    maxLength={20}
                    onChange={(event) =>
                      updateForm("nickname", event.currentTarget.value)
                    }
                    placeholder="분철이지"
                    value={form.nickname}
                  />
                </label>
                <label className="block rounded-[0.95rem] bg-[#f7f7f7] px-3 py-3 ring-1 ring-black/10 transition focus-within:bg-white focus-within:ring-black/35">
                  <span className="text-[13px] font-semibold text-black/45">
                    휴대폰 번호
                  </span>
                  <input
                    className="mt-1 h-8 w-full bg-transparent text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25"
                    disabled={isLoading}
                    inputMode="numeric"
                    onChange={(event) =>
                      updateForm("phoneNumber", event.currentTarget.value)
                    }
                    placeholder="01012345678"
                    value={form.phoneNumber}
                  />
                </label>
              </div>
              <button
                aria-label={isSaveFeedbackVisible ? "저장 완료" : undefined}
                className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-[#CFE86B] text-[15px] font-semibold text-black shadow-[0_10px_24px_rgba(120,132,82,0.22)] transition-colors disabled:bg-black/20 disabled:text-white"
                disabled={!canSave || isSaving || isLoading}
                onClick={saveProfile}
                type="button"
              >
                {isSaving ? (
                  "저장 중"
                ) : isSaveFeedbackVisible ? (
                  <span className="flex h-6 w-6 scale-125 items-center justify-center rounded-full bg-black text-[#DDE7B8] transition-transform">
                    <CheckIcon />
                  </span>
                ) : (
                  "저장"
                )}
              </button>
            </section>

            {message ? (
              <p className="mt-3 rounded-full bg-white px-3 py-2 text-[13px] font-semibold text-black/45 shadow-[0_10px_24px_rgba(0,0,0,0.04)]">
                {message}
              </p>
            ) : null}

            <section className="mt-4 rounded-[1.1rem] border border-black/10 bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold tracking-[-0.04em] text-black/45">
                    계정 탈퇴
                  </p>
                  <p className="mt-1 break-keep text-[12px] font-medium leading-5 text-black/30">
                    계정 정보가 삭제되고 다시 되돌릴 수 없어요.
                  </p>
                </div>
                {/*
                  솔리드 빨강 + 빨간 글로우는 이 화면에서 가장 강한 시각 강조라,
                  바로 위 "저장"(라임 CTA)보다 탈퇴가 더 눈에 띄었다.
                  되돌릴 수 없는 행동은 낮은 강조로 두고, 경고는 확인 모달이 맡는다.
                */}
                <button
                  className="h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold text-danger-base underline underline-offset-4 transition-colors hover:bg-danger-soft disabled:text-black/25 disabled:no-underline"
                  disabled={isDeleting}
                  onClick={() => {
                    setMessage("");
                    setHasUnclaimedPayback(false);
                    setIsDeleteConfirmOpen(true);
                    void checkUnclaimedPayback();
                  }}
                  type="button"
                >
                  {isDeleting ? "처리 중" : "탈퇴"}
                </button>
              </div>
            </section>

            {isDeleteConfirmOpen ? (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-4 backdrop-blur-[2px]">
                <section
                  aria-modal="true"
                  className="w-full max-w-[398px] rounded-[1.2rem] bg-white p-5 shadow-[0_24px_72px_rgba(0,0,0,0.28)] ring-1 ring-[#E53935]/20"
                  role="dialog"
                >
                  <div className="inline-flex rounded-full bg-[#FFF1F0] px-3 py-1 text-[12px] font-semibold text-[#D32F2F]">
                    중요 확인
                  </div>
                  <h2 className="mt-3 text-[23px] font-semibold tracking-[-0.06em] text-[#D32F2F]">
                    정말 탈퇴할까요?
                  </h2>
                  <p className="mt-2 break-keep text-[14px] font-semibold leading-6 text-black/65">
                    탈퇴하면 계정 정보가 삭제되고 다시 되돌릴 수 없어요. 진행
                    중인 분철이나 결제 내역이 있다면 확인이 어려워질 수 있어요.
                  </p>
                  {hasUnclaimedPayback ? (
                    <div className="mt-4 rounded-[0.9rem] bg-[#FFF8E1] px-4 py-3 text-[13px] font-semibold leading-6 text-[#8D6708]">
                      아직 신청할 수 있는 배송비 돌려받기가 남아 있어요.
                      탈퇴하면 배송비를 돌려받을 수 없어요.
                    </div>
                  ) : null}
                  <div className="mt-4 rounded-[0.9rem] bg-[#FFF5F4] px-4 py-3 text-[13px] font-semibold leading-6 text-[#B3261E]">
                    이 작업은 취소할 수 없어요. 정말로 계정을 삭제할 때만
                    탈퇴를 눌러 주세요.
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      className="h-12 rounded-full bg-[#f4f4f4] text-[15px] font-semibold text-black/55 disabled:text-black/25"
                      disabled={isDeleting}
                      onClick={() => setIsDeleteConfirmOpen(false)}
                      type="button"
                    >
                      취소
                    </button>
                    <button
                      className="h-12 rounded-full bg-[#D32F2F] text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(211,47,47,0.28)] transition-colors hover:bg-[#B3261E] disabled:bg-[#F3B5B3]"
                      disabled={isDeleting}
                      onClick={deleteProfile}
                      type="button"
                    >
                      {isDeleting ? "탈퇴 처리 중" : "탈퇴할게요"}
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
