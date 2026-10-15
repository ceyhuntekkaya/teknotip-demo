import { ProductEditor } from "@/components/catalog/product-editor";
import type { ProductResponse } from "@/lib/api/generated/model";
import { listProducts } from "@/lib/api/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

async function loadProducts(): Promise<ProductResponse[]> {
  const products: ProductResponse[] = [];
  let page = 0;
  let totalPages = 1;
  while (page < totalPages) {
    const response = await listProducts({ page, size: PAGE_SIZE, sort: ["name"] });
    if (response.status !== 200) break;
    const content = response.data.content ?? [];
    products.push(...content);
    totalPages = response.data.totalPages ?? page + 1;
    page += 1;
    if (content.length === 0) break;
  }
  return products;
}

export default async function ProductsPage() {
  const products = await loadProducts();
  return <ProductEditor initialProducts={products} />;
}
