import { OrganizedProductEditor } from "@/app/organized-products/organized-product-editor";
import type { OrganizedProductResponse } from "@/lib/api/organized-products";
import { listOrganizedProducts } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function SettingsOrganizedProductsPage() {
  const response = await listOrganizedProducts({
    page: 0,
    size: 1000,
    sort: ["name"],
  });
  const products: OrganizedProductResponse[] =
    response.status === 200
      ? ((response.data as { content?: OrganizedProductResponse[] }).content ??
        [])
      : [];

  return <OrganizedProductEditor embedded initialProducts={products} />;
}
