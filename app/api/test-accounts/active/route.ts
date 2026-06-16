import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const testAccountDefinitions = [
  {
    accessTokenEnv: "TEST_USER1_ACCESS_TOKEN",
    id: "user1",
  },
  {
    accessTokenEnv: "TEST_USER2_ACCESS_TOKEN",
    id: "user2",
  },
  {
    accessTokenEnv: "TEST_USER3_ACCESS_TOKEN",
    id: "user3",
  },
  {
    accessTokenEnv: "TEST_USER4_ACCESS_TOKEN",
    id: "user4",
  },
  {
    accessTokenEnv: "TEST_USER5_ACCESS_TOKEN",
    id: "user5",
  },
];

function isTestAccountSwitcherEnabled() {
  return process.env.TEST_ACCOUNT_SWITCHER_ENABLED === "true";
}

function jsonNoStore(body: unknown) {
  const response = NextResponse.json(body);

  response.headers.set("Cache-Control", "no-store");

  return response;
}

export async function GET(request: Request) {
  if (!isTestAccountSwitcherEnabled()) {
    return jsonNoStore({ accountId: null });
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const matchedAccount = testAccountDefinitions.find(
    (definition) => process.env[definition.accessTokenEnv] === accessToken,
  );

  return jsonNoStore({
    accountId: matchedAccount?.id ?? null,
  });
}
