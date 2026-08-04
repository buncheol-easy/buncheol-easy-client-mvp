import type { Metadata } from "next";
import { UploadNoticeContent } from "@/components/UploadNoticeContent";
import { blackChromeViewport } from "@/lib/system-chrome";

export const viewport = blackChromeViewport;

export const metadata: Metadata = {
  title: "분철 개최 안내",
  alternates: { canonical: "/upload/notice" },
};

export default function UploadNoticePage() {
  return <UploadNoticeContent />;
}
