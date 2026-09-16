import { ReportBrowser } from "@/components/report/report-browser";
import type { CustomerResponse, ProductResponse } from "@/lib/api/generated/model";
import { listCustomers, listProducts } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [productResponse, customerResponse] = await Promise.all([
    listProducts({ page: 0, size: 1000, sort: ["name"] }),
    listCustomers({ page: 0, size: 1000, sort: ["institution"] }),
  ]);
  const products: ProductResponse[] =
    productResponse.status === 200 ? (productResponse.data.content ?? []) : [];
  const customers: CustomerResponse[] =
    customerResponse.status === 200 ? (customerResponse.data.content ?? []) : [];

  return <ReportBrowser products={products} customers={customers} />;
}
