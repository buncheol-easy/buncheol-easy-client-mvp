import { ApiProductDetail } from "@/components/ApiProductDetail";
import { UploadedProductDetail } from "@/components/UploadedProductDetail";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

type ProductDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    from?: string | string[];
    hosted?: string | string[];
    q?: string | string[];
  }>;
};

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: ProductDetailPageProps) {
  const { id } = await params;
  const { from, hosted, q } = await searchParams;
  const returnSource = getFirstSearchParam(from);
  const isHostedView = getFirstSearchParam(hosted) === "true";
  const returnQuery = getFirstSearchParam(q);

  if (id.startsWith("uploaded-")) {
    return (
      <UploadedProductDetail
        id={id}
        returnSource={
          returnSource === "home" ||
          returnSource === "bids" ||
          returnSource === "favorites" ||
          returnSource === "upload"
            ? returnSource
            : undefined
        }
      />
    );
  }

  return (
    <ApiProductDetail
      id={id}
      isHostedView={isHostedView}
      returnQuery={returnSource === "search" ? returnQuery ?? "" : undefined}
      returnSource={
        returnSource === "home" ||
        returnSource === "bids" ||
        returnSource === "favorites" ||
        returnSource === "upload"
          ? returnSource
          : undefined
      }
    />
  );
}
