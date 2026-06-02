"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { BackIcon, CheckIcon, ProfileIcon } from "@/components/icons";
import { getFreshAccessToken } from "@/lib/auth-session";
import {
  deleteUserProfile,
  requestNicknameDuplicate,
  requestUserProfile,
  updateUserProfile,
  type UserProfile,
} from "@/lib/auth-api";
import {
  clearAuthCookies,
  clearAuthState,
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import { clearDeliveryAddressState } from "@/lib/delivery-address-store";
import { clearHostedProducts } from "@/lib/hosted-products-store";
import { clearSettlementAccountState } from "@/lib/settlement-account-store";

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
    nickname: "",
    phoneNumber: "",
  };
}

function getProfileForm(profile: UserProfile | null) {
  return {
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
  clearAuthCookies();
  clearAuthState();
  clearDeliveryAddressState();
  clearHostedProducts();
  clearSettlementAccountState();
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
  const [isSaveFeedbackVisible, setIsSaveFeedbackVisible] = useState(false);
  const [message, setMessage] = useState("");
  const canSave =
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
  }, [authState.accessToken, authState.isLoggedIn]);

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

      await updateUserProfile(accessToken, nextProfile);
      setProfile((current) => ({
        bankAccount: current?.bankAccount ?? null,
        email: current?.email ?? "",
        provider: current?.provider ?? "",
        ...nextProfile,
      }));
      setForm(nextProfile);
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

  async function deleteProfile() {
    if (!authState.isLoggedIn || isDeleting) {
      return;
    }

    const shouldDelete = window.confirm("회원 탈퇴를 진행할까요?");

    if (!shouldDelete) {
      return;
    }

    setIsDeleting(true);
    setMessage("");

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        return;
      }

      await deleteUserProfile(accessToken);
      clearSessionState();
      router.replace("/profile");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error ? error.message : "회원 탈퇴를 처리하지 못했어요.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="shrink-0 px-6 pb-4 pt-6">
        <div className="flex items-start justify-between gap-4">
          <button
            aria-label="뒤로가기"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black text-white"
            onClick={handleBack}
            type="button"
          >
            <BackIcon />
          </button>
          <div className="min-w-0 text-right">
            <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.2em] text-black/35">
              Account
            </p>
            <h1 className="mt-1 text-[28px] font-semibold leading-none tracking-[-0.07em]">
              회원 정보
            </h1>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
        {!authState.isLoggedIn ? (
          <div className="mt-6 rounded-[1.1rem] bg-[#f7f7f7] px-5 py-6">
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
                router.push("/login?returnTo=/profile/account");
              }}
              type="button"
            >
              로그인하기
            </button>
          </div>
        ) : (
          <>
            <section className="rounded-[1.15rem] bg-[#f7f7f7] px-5 py-4">
              <div className="flex items-center gap-4">
                <ProviderIconBadge provider={profile?.provider} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-black/40">
                    연결된 계정
                  </p>
                  <p className="mt-1 truncate text-[18px] font-semibold tracking-[-0.05em] text-black">
                    {isLoading
                      ? "회원 정보 확인 중"
                      : `${getProviderLabel(profile?.provider)} 로그인`}
                  </p>
                  <p className="mt-1 truncate text-[13px] font-medium text-black/40">
                    {profile?.email || "이메일 정보 없음"}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-[1.1rem] border border-black/10 px-4 py-4">
              <p className="text-[13px] font-semibold text-black/40">
                기본 정보
              </p>
              <div className="mt-4 grid gap-3">
                <label className="block">
                  <span className="text-[13px] font-semibold text-black/45">
                    닉네임
                  </span>
                  <input
                    className="mt-2 h-12 w-full rounded-[0.85rem] border border-black/10 bg-[#f7f7f7] px-4 text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                    disabled={isLoading}
                    maxLength={20}
                    onChange={(event) =>
                      updateForm("nickname", event.currentTarget.value)
                    }
                    placeholder="분철이지"
                    value={form.nickname}
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-semibold text-black/45">
                    휴대폰 번호
                  </span>
                  <input
                    className="mt-2 h-12 w-full rounded-[0.85rem] border border-black/10 bg-[#f7f7f7] px-4 text-[15px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
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
                className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-black text-[15px] font-semibold text-white transition-colors disabled:bg-black/20"
                disabled={!canSave || isSaving || isLoading}
                onClick={saveProfile}
                type="button"
              >
                {isSaving ? (
                  "저장 중"
                ) : isSaveFeedbackVisible ? (
                  <span className="flex h-6 w-6 scale-125 items-center justify-center rounded-full bg-white text-black transition-transform">
                    <CheckIcon />
                  </span>
                ) : (
                  "저장"
                )}
              </button>
            </section>

            {message ? (
              <p className="mt-3 text-[13px] font-semibold text-black/45">
                {message}
              </p>
            ) : null}

            <section className="mt-6 rounded-[1rem] bg-[#f7f7f7] px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold tracking-[-0.04em] text-black/45">
                    계정 탈퇴
                  </p>
                  <p className="mt-1 break-keep text-[12px] font-medium leading-5 text-black/30">
                    계정 정보가 삭제되고 다시 되돌릴 수 없어요.
                  </p>
                </div>
                <button
                  className="h-9 shrink-0 rounded-full border border-black/10 bg-white px-3 text-[12px] font-semibold text-black/45 disabled:text-black/15"
                  disabled={isDeleting}
                  onClick={deleteProfile}
                  type="button"
                >
                  {isDeleting ? "처리 중" : "탈퇴"}
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
