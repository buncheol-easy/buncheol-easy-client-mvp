import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TestAccount = {
  accessToken: string;
  id: string;
  label: string;
  refreshToken: string;
  userId: string;
};

const testAccountDefinitions = [
  {
    accessTokenEnv: "TEST_USER1_ACCESS_TOKEN",
    id: "user1",
    label: "김판매",
    refreshTokenEnv: "TEST_USER1_REFRESH_TOKEN",
    userId: "7",
  },
  {
    accessTokenEnv: "TEST_USER2_ACCESS_TOKEN",
    id: "user2",
    label: "일구매",
    refreshTokenEnv: "TEST_USER2_REFRESH_TOKEN",
    userId: "8",
  },
  {
    accessTokenEnv: "TEST_USER3_ACCESS_TOKEN",
    id: "user3",
    label: "이구매",
    refreshTokenEnv: "TEST_USER3_REFRESH_TOKEN",
    userId: "9",
  },
  {
    accessTokenEnv: "TEST_USER4_ACCESS_TOKEN",
    id: "user4",
    label: "삼구매",
    refreshTokenEnv: "TEST_USER4_REFRESH_TOKEN",
    userId: "10",
  },
  {
    accessTokenEnv: "TEST_USER5_ACCESS_TOKEN",
    id: "user5",
    label: "박기타",
    refreshTokenEnv: "TEST_USER5_REFRESH_TOKEN",
    userId: "11",
  },
];

function isTestAccountSwitcherEnabled() {
  return process.env.TEST_ACCOUNT_SWITCHER_ENABLED === "true";
}

function getConfiguredTestAccounts(): TestAccount[] {
  if (!isTestAccountSwitcherEnabled()) {
    return [];
  }

  return testAccountDefinitions.flatMap((definition) => {
    const accessToken = process.env[definition.accessTokenEnv];
    const refreshToken = process.env[definition.refreshTokenEnv];

    if (!accessToken || !refreshToken) {
      return [];
    }

    return [
      {
        accessToken,
        id: definition.id,
        label: definition.label,
        refreshToken,
        userId: definition.userId,
      },
    ];
  });
}

function getJwtExpirationDate(token: string) {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    const normalizedPayload = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(normalizedPayload)) as {
      exp?: unknown;
    };

    return typeof parsed.exp === "number"
      ? new Date(parsed.exp * 1000)
      : null;
  } catch {
    return null;
  }
}

function setRefreshTokenCookies(response: NextResponse, refreshToken: string) {
  const expires = getJwtExpirationDate(refreshToken) ?? undefined;
  const cookieOptions = {
    expires,
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };

  response.cookies.set("refreshToken", refreshToken, cookieOptions);
  response.cookies.set("refresh_token", refreshToken, cookieOptions);
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);

  response.headers.set("Cache-Control", "no-store");

  return response;
}

export async function GET() {
  const accounts = getConfiguredTestAccounts().map(
    ({ id, label, userId }) => ({
      id,
      label,
      userId,
    }),
  );

  return jsonNoStore({
    accounts,
    enabled: accounts.length > 0,
  });
}

export async function POST(request: Request) {
  if (!isTestAccountSwitcherEnabled()) {
    return jsonNoStore(
      { message: "테스트 계정 전환이 비활성화되어 있어요." },
      { status: 404 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    accountId?: unknown;
  } | null;
  const accountId = typeof body?.accountId === "string" ? body.accountId : "";
  const account = getConfiguredTestAccounts().find(
    (item) => item.id === accountId,
  );

  if (!account) {
    return jsonNoStore(
      { message: "테스트 계정을 찾을 수 없어요." },
      { status: 404 },
    );
  }

  const response = jsonNoStore({
    accessToken: account.accessToken,
    label: account.label,
  });

  setRefreshTokenCookies(response, account.refreshToken);

  return response;
}
