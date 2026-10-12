import type { Metadata } from "next";
import { UploadEntry } from "@/components/UploadEntry";
import { parseAgeRangeConsentResult } from "@/lib/auth-api";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export const metadata: Metadata = {
  title: "분철 개최",
  robots: { index: false, follow: false },
};

type UploadPageProps = {
  searchParams: Promise<{
    ageRangeConsent?: string | string[];
    edit?: string | string[];
    from?: string | string[];
  }>;
};

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function UploadPage({ searchParams }: UploadPageProps) {
  const { ageRangeConsent, edit, from } = await searchParams;
  const returnSource = getFirstSearchParam(from);

  return (
    <UploadEntry
      ageRangeConsentResult={parseAgeRangeConsentResult(
        getFirstSearchParam(ageRangeConsent),
      )}
      editProductId={getFirstSearchParam(edit)}
      returnSource={
        returnSource === "home" ||
        returnSource === "profile" ||
        returnSource === "bids" ||
        returnSource === "favorites" ||
        returnSource === "upload"
          ? returnSource
          : undefined
      }
    />
  );
}
