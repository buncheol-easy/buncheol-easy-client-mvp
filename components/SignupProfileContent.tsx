"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ProfileIcon } from "@/components/icons";
import { requestNicknameDuplicate, updateUserProfile } from "@/lib/auth-api";
import {
  authProfileSetupReturnHrefStorageKey,
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";

function getSafeReturnHref(value: string | null | undefined) {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    value === "/signup/profile" ||
    value.startsWith("/signup/profile?") ||
    value.startsWith("/signup/profile#")
  ) {
    return "/profile";
  }

  return value;
}

function sanitizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function SignupProfileContent() {
  const router = useRouter();
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const [nickname, setNickname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canSave =
    /^[가-힣A-Za-z0-9]{1,20}$/.test(nickname.trim()) &&
    /^01\d{8,9}$/.test(phoneNumber.trim());

  useEffect(() => {
    if (!authState.isLoggedIn && !authState.accessToken) {
      router.replace("/login?returnTo=/profile");
    }
  }, [authState.accessToken, authState.isLoggedIn, router]);

  async function saveProfile() {
    const accessToken = authState.accessToken;

    if (!accessToken || !canSave || isSaving) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const { isDuplicate } = await requestNicknameDuplicate(
        accessToken,
        nickname.trim(),
      );

      if (isDuplicate) {
        setMessage("이미 사용 중인 닉네임이에요.");
        return;
      }

      await updateUserProfile(accessToken, {
        nickname: nickname.trim(),
        phoneNumber: phoneNumber.trim(),
      });

      const returnHref = getSafeReturnHref(
        window.sessionStorage.getItem(authProfileSetupReturnHrefStorageKey),
      );

      window.sessionStorage.removeItem(authProfileSetupReturnHrefStorageKey);
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
    <main className="system-chrome-white system-chrome-bottom-black h-[100dvh] bg-white px-5 text-[#111111]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col items-center justify-center">
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
