import type { Metadata } from "next";
import { UploadProductForm } from "@/components/UploadProductForm";
import { blackChromeViewport } from "@/lib/system-chrome";

export const viewport = blackChromeViewport;

export const metadata: Metadata = {
  title: "분철 개최",
  robots: { index: false, follow: false },
};

type UploadPageProps = {
  searchParams: Promise<{
    edit?: string | string[];
    from?: string | string[];
  }>;
};

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function UploadPage({ searchParams }: UploadPageProps) {
  const { edit, from } = await searchParams;
  const returnSource = getFirstSearchParam(from);

  return (
    <UploadProductForm
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
