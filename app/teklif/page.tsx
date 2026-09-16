import type { CustomerResponse, ProductResponse } from "@/lib/api/generated/model";
import { listCustomers, listProducts } from "@/lib/api/server";
import { QuoteBench } from "./quote-bench";

export const dynamic = "force-dynamic";

export default async function TeklifPage() {
  const [productResponse, customerResponse] = await Promise.all([
    listProducts({ page: 0, size: 100, sort: ["name"] }),
    listCustomers({ page: 0, size: 1000, sort: ["institution"] }),
  ]);
  const products: ProductResponse[] =
    productResponse.status === 200 ? (productResponse.data.content ?? []) : [];
  const customers: CustomerResponse[] =
    customerResponse.status === 200 ? (customerResponse.data.content ?? []) : [];

  return <QuoteBench products={products} customers={customers} />;
}
