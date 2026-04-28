import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/ProductDetail";
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
    notFound();
  }

  return (
    <ProductDetail
      product={product}
      initialReturnSource={returnSource === "home" ? "home" : undefined}
      initialReturnQuery={
        returnSource === "search" ? returnQuery ?? "" : undefined
      }
    />
  );
}
