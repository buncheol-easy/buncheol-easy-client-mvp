import { trackAdConversion } from "@/lib/analytics";
import { addBuncheolBookmark } from "@/lib/auth-api";

// 하트로 연 로그인 화면에서 카카오 버튼을 누를 때만 남기는 일회용 값(로그인 화면에서 취소하면 남지 않는다).
// 로그인을 마친 곳에서 한 번만 읽고 지운다.
const BOOKMARK_LOGIN_RETURN_STATE_KEY = "buncheol-bookmark-login-return-state";
const BOOKMARK_LOGIN_RETURN_MAX_AGE_MS = 30 * 60 * 1000;

type BookmarkLoginReturnState = {
  buncheolId: string;
  createdAt: number;
  returnHref: string;
};

export function rememberBookmarkLoginReturnState(
  buncheolId: string,
  returnHref: string,
) {
  window.sessionStorage.setItem(
    BOOKMARK_LOGIN_RETURN_STATE_KEY,
    JSON.stringify({
      buncheolId,
      createdAt: Date.now(),
      returnHref,
    } satisfies BookmarkLoginReturnState),
  );
}

export function clearBookmarkLoginReturnState() {
  window.sessionStorage.removeItem(BOOKMARK_LOGIN_RETURN_STATE_KEY);
}

function takeBookmarkLoginReturnId(returnHref: string) {
  const rawValue = window.sessionStorage.getItem(
    BOOKMARK_LOGIN_RETURN_STATE_KEY,
  );
  clearBookmarkLoginReturnState();

  if (!rawValue) {
    return null;
  }

  const state = JSON.parse(rawValue) as Partial<BookmarkLoginReturnState>;

  if (
    typeof state.buncheolId !== "string" ||
    typeof state.createdAt !== "number" ||
    state.returnHref !== returnHref ||
    Date.now() - state.createdAt > BOOKMARK_LOGIN_RETURN_MAX_AGE_MS
  ) {
    return null;
  }

  return state.buncheolId;
}

// 로그인을 마치고 returnHref 로 보내기 직전에 기다려 부른다. 찜이 먼저 저장돼야 돌아간 화면이 채워진 하트를 받는다.
// 하트는 토글이지만 여기서는 추가만 한다 — 이미 찜한 분철은 그대로 두고 전환도 보내지 않는다.
export async function addBookmarkFromLoginReturn(
  accessToken: string,
  returnHref: string,
) {
  try {
    const buncheolId = takeBookmarkLoginReturnId(returnHref);

    if (!buncheolId) {
      return;
    }

    if (await addBuncheolBookmark(accessToken, buncheolId)) {
      trackAdConversion("add_to_wishlist", { buncheol_id: buncheolId });
    }
  } catch {
    // 찜을 못 남겨도 로그인 복귀는 막지 않는다.
  }
}
