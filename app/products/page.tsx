import { ProductEditor } from "@/components/catalog/product-editor";
import type { ProductResponse } from "@/lib/api/generated/model";
import { listProducts } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const response = await listProducts({ page: 0, size: 1000, sort: ["name"] });
  const products: ProductResponse[] =
    response.status === 200 ? (response.data.content ?? []) : [];

  return <ProductEditor initialProducts={products} />;
}
