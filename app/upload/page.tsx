import { UploadProductForm } from "@/components/UploadProductForm";
import { blackChromeViewport } from "@/lib/system-chrome";

export const viewport = blackChromeViewport;

export default function UploadPage() {
  return <UploadProductForm />;
}
