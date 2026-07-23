"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProfileIcon } from "@/components/icons";
import {
  isUserProfileComplete,
  requestNicknameDuplicate,
  requestUserProfile,
  requestUserProfileStatus,
  updateUserProfile,
} from "@/lib/auth-api";
import { getFreshAccessToken } from "@/lib/auth-session";
import {
  createLoginHref,
  getOptionalSafeInternalHref,
} from "@/lib/auth-navigation";
import {
  authProfileSetupReturnHrefStorageKey,
  authSignupProfileDraftStorageKey,
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";

type SignupProfileDraft = {
  isAgeConfirmed?: boolean;
  isMarketingAgreed?: boolean;
  isPrivacyAgreed?: boolean;
  isTermsAgreed?: boolean;
  name?: string;
  nickname?: string;
  phoneNumber?: string;
};

function getSafeReturnHref(value: string | null | undefined) {
  const safeValue = getOptionalSafeInternalHref(value);

  if (
    !safeValue ||
    safeValue === "/signup/profile" ||
    safeValue.startsWith("/signup/profile?") ||
    safeValue.startsWith("/signup/profile#")
  ) {
    return "/profile";
  }

  return safeValue;
}

function sanitizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function readSignupProfileDraft(): SignupProfileDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(
      authSignupProfileDraftStorageKey,
    );

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<SignupProfileDraft>;

    return {
      isAgeConfirmed: parsed.isAgeConfirmed === true,
      isMarketingAgreed: parsed.isMarketingAgreed === true,
      isPrivacyAgreed: parsed.isPrivacyAgreed === true,
      isTermsAgreed: parsed.isTermsAgreed === true,
      name: typeof parsed.name === "string" ? parsed.name : "",
      nickname: typeof parsed.nickname === "string" ? parsed.nickname : "",
      phoneNumber:
        typeof parsed.phoneNumber === "string"
          ? sanitizePhoneNumber(parsed.phoneNumber)
          : "",
    };
  } catch {
    return null;
  }
}

function writeSignupProfileDraft(draft: SignupProfileDraft) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      authSignupProfileDraftStorageKey,
      JSON.stringify(draft),
    );
  } catch {
    // 세션 저장소가 막힌 환경에서는 화면 상태만 유지한다.
  }
}

function clearSignupProfileDraft() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(authSignupProfileDraftStorageKey);
}

export function SignupProfileContent() {
  const router = useRouter();
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const [initialDraft] = useState(readSignupProfileDraft);
  const [name, setName] = useState(initialDraft?.name ?? "");
  const [nickname, setNickname] = useState(initialDraft?.nickname ?? "");
  const [phoneNumber, setPhoneNumber] = useState(
    initialDraft?.phoneNumber ?? "",
  );
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(
    initialDraft?.isAgeConfirmed ?? false,
  );
  const [isTermsAgreed, setIsTermsAgreed] = useState(
    initialDraft?.isTermsAgreed ?? false,
  );
  const [isPrivacyAgreed, setIsPrivacyAgreed] = useState(
    initialDraft?.isPrivacyAgreed ?? false,
  );
  const [isMarketingAgreed, setIsMarketingAgreed] = useState(
    initialDraft?.isMarketingAgreed ?? false,
  );
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canSave =
    /^[가-힣A-Za-z]{1,30}$/.test(name.trim()) &&
    /^[가-힣A-Za-z0-9]{1,20}$/.test(nickname.trim()) &&
    /^01\d{8,9}$/.test(phoneNumber.trim()) &&
    isAgeConfirmed &&
    isTermsAgreed &&
    isPrivacyAgreed;

  useEffect(() => {
    if (!authState.isLoggedIn || !authState.accessToken) {
      const returnHref = getSafeReturnHref(
        window.sessionStorage.getItem(authProfileSetupReturnHrefStorageKey),
      );

      window.sessionStorage.setItem(
        authProfileSetupReturnHrefStorageKey,
        returnHref,
      );
      router.replace(
        createLoginHref({ cancelTo: "/profile", returnTo: returnHref }),
      );
    }
  }, [authState.accessToken, authState.isLoggedIn, router]);

  useEffect(() => {
    if (!authState.isLoggedIn || !authState.accessToken) {
      return;
    }

    let isActive = true;

    getFreshAccessToken()
      .then((accessToken) => {
        if (!isActive || !accessToken) {
          return;
        }

        return requestUserProfileStatus(accessToken).then(
          async ({ isProfileComplete }) => {
            if (!isActive || !isProfileComplete) {
              return;
            }

            const profile = await requestUserProfile(accessToken);

            if (!isActive || !isUserProfileComplete(profile)) {
              return;
            }

            const returnHref = getSafeReturnHref(
              window.sessionStorage.getItem(
                authProfileSetupReturnHrefStorageKey,
              ),
            );

            window.sessionStorage.removeItem(
              authProfileSetupReturnHrefStorageKey,
            );
            clearSignupProfileDraft();
            router.replace(returnHref);
          },
        );
      })
      .catch(() => {
        // 프로필 완료 여부 확인이 실패하면 가입 입력을 계속 진행하게 둔다.
      });

    return () => {
      isActive = false;
    };
  }, [authState.accessToken, authState.isLoggedIn, router]);

  useEffect(() => {
    if (!authState.isLoggedIn || !authState.accessToken) {
      return;
    }

    writeSignupProfileDraft({
      isAgeConfirmed,
      isMarketingAgreed,
      isPrivacyAgreed,
      isTermsAgreed,
      name,
      nickname,
      phoneNumber,
    });
  }, [
    authState.accessToken,
    authState.isLoggedIn,
    isAgeConfirmed,
    isMarketingAgreed,
    isPrivacyAgreed,
    isTermsAgreed,
    name,
    nickname,
    phoneNumber,
  ]);

  async function saveProfile() {
    if (!canSave || isSaving) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const accessToken = await getFreshAccessToken();

      if (!accessToken) {
        const returnHref = getSafeReturnHref(
          window.sessionStorage.getItem(authProfileSetupReturnHrefStorageKey),
        );

        router.replace(
          createLoginHref({ cancelTo: "/profile", returnTo: returnHref }),
        );
        return;
      }

      const { isDuplicate } = await requestNicknameDuplicate(
        accessToken,
        nickname.trim(),
      );

      if (isDuplicate) {
        setMessage("이미 사용 중인 닉네임이에요.");
        return;
      }

      await updateUserProfile(accessToken, {
        name: name.trim(),
        nickname: nickname.trim(),
        phoneNumber: phoneNumber.trim(),
        marketingAgreed: isMarketingAgreed,
      });

      const returnHref = getSafeReturnHref(
        window.sessionStorage.getItem(authProfileSetupReturnHrefStorageKey),
      );

      window.sessionStorage.removeItem(authProfileSetupReturnHrefStorageKey);
      clearSignupProfileDraft();
      router.replace(returnHref);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "회원 정보를 저장하지 못했어요.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="system-chrome-white system-chrome-bottom-black flex h-[100dvh] overflow-y-auto bg-white px-5 text-[#111111]">
      {/* m-auto: 콘텐츠가 뷰포트보다 짧으면 수직 중앙, 길면(PC 등) 잘림 없이 스크롤 — justify-center 는 위쪽이 잘린다 */}
      <div className="m-auto flex w-full max-w-[430px] flex-col items-center py-8">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-black text-white shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <ProfileIcon />
        </div>

        <section className="mt-8 w-full">
          <h1 className="text-center text-[25px] font-semibold leading-tight tracking-[-0.06em]">
            프로필 정보를 입력해 주세요
          </h1>
          <p className="mt-2 text-center text-[14px] font-medium text-black/45">
            분철 참여에 필요한 기본 정보예요.
          </p>

          <div className="mt-7 grid gap-3">
            <label className="block">
              <span className="text-[13px] font-semibold text-black/45">
                이름
              </span>
              <input
                className="mt-2 h-13 w-full rounded-[0.9rem] border border-black/10 bg-[#f7f7f7] px-4 text-[16px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                maxLength={30}
                onChange={(event) => setName(event.currentTarget.value)}
                placeholder="홍길동"
                value={name}
              />
              <span className="mt-1.5 block text-[12px] font-medium text-black/35">
                입금 확인과 배송 연락에 사용돼요.
              </span>
            </label>

            <label className="block">
              <span className="text-[13px] font-semibold text-black/45">
                닉네임
              </span>
              <input
                className="mt-2 h-13 w-full rounded-[0.9rem] border border-black/10 bg-[#f7f7f7] px-4 text-[16px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                maxLength={20}
                onChange={(event) => setNickname(event.currentTarget.value)}
                placeholder="에이지"
                value={nickname}
              />
            </label>

            <label className="block">
              <span className="text-[13px] font-semibold text-black/45">
                휴대폰 번호
              </span>
              <input
                className="mt-2 h-13 w-full rounded-[0.9rem] border border-black/10 bg-[#f7f7f7] px-4 text-[16px] font-semibold tracking-[-0.04em] outline-none placeholder:text-black/25 focus:border-black"
                inputMode="numeric"
                onChange={(event) =>
                  setPhoneNumber(sanitizePhoneNumber(event.currentTarget.value))
                }
                placeholder="01012345678"
                value={phoneNumber}
              />
            </label>
          </div>

          <div className="mt-5 rounded-[1rem] bg-[#f7f7f7] px-4 py-4">
            <div className="space-y-3">
              <label className="flex items-start gap-3">
                <input
                  checked={isAgeConfirmed}
                  className="mt-0.5 h-4 w-4 accent-black"
                  onChange={(event) =>
                    setIsAgeConfirmed(event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                <span className="text-[13px] font-semibold tracking-[-0.03em] text-black/65">
                  [필수] 만 14세 이상입니다
                </span>
              </label>

              <label className="flex items-start gap-3">
                <input
                  checked={isTermsAgreed}
                  className="mt-0.5 h-4 w-4 accent-black"
                  onChange={(event) =>
                    setIsTermsAgreed(event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                <span className="text-[13px] font-semibold tracking-[-0.03em] text-black/65">
                  [필수]{" "}
                  <Link className="underline underline-offset-2" href="/terms">
                    이용약관
                  </Link>
                  에 동의합니다
                </span>
              </label>

              <label className="flex items-start gap-3">
                <input
                  checked={isPrivacyAgreed}
                  className="mt-0.5 h-4 w-4 accent-black"
                  onChange={(event) =>
                    setIsPrivacyAgreed(event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                <span className="text-[13px] font-semibold tracking-[-0.03em] text-black/65">
                  [필수]{" "}
                  <Link className="underline underline-offset-2" href="/privacy">
                    개인정보 수집·이용
                  </Link>
                  에 동의합니다
                </span>
              </label>
            </div>

            <div className="mt-4 space-y-3 border-t border-black/10 pt-4">
              <label className="flex items-start gap-3">
                <input
                  checked={isMarketingAgreed}
                  className="mt-0.5 h-4 w-4 accent-black"
                  onChange={(event) =>
                    setIsMarketingAgreed(event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                <span className="text-[13px] font-medium tracking-[-0.03em] text-black/45">
                  [선택] 마케팅 정보 수신에 동의합니다
                </span>
              </label>

            </div>
          </div>

          {message ? (
            <p className="mt-3 text-center text-[13px] font-semibold text-black/45">
              {message}
            </p>
          ) : null}

          <button
            className="mt-6 h-14 w-full rounded-full bg-black text-[16px] font-semibold text-white disabled:bg-black/20"
            disabled={!canSave || isSaving}
            onClick={saveProfile}
            type="button"
          >
            {isSaving ? "저장 중" : "시작하기"}
          </button>
        </section>
      </div>
    </main>
  );
}
