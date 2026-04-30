import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/ProductDetail";
import { UploadedProductDetail } from "@/components/UploadedProductDetail";
import { getProductById } from "@/lib/mock-products";

type ProductDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    from?: string | string[];
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
  const { from, q } = await searchParams;
  const returnSource = getFirstSearchParam(from);
  const returnQuery = getFirstSearchParam(q);
  const product = getProductById(id);

  if (!product) {
    if (id.startsWith("uploaded-")) {
      return <UploadedProductDetail id={id} />;
    }

    notFound();
  }

  return (
    <ProductDetail
      backHref={
        returnSource === "upload"
          ? "/"
            : undefined
      }
      product={product}
      initialReturnSource={
        returnSource === "home" ||
        returnSource === "profile" ||
        returnSource === "bids" ||
        returnSource === "favorites"
          ? returnSource
          : undefined
      }
      initialReturnQuery={
        returnSource === "search" ? returnQuery ?? "" : undefined
      }
    />
  );
}
