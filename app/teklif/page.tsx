import type {
  CustomerResponse,
  InstitutionResponse,
  ProductResponse,
} from "@/lib/api/generated/model";
import { listCustomers, listInstitutions, listProducts } from "@/lib/api/server";
import { QuoteBench } from "./quote-bench";

export const dynamic = "force-dynamic";

export default async function TeklifPage({
  searchParams,
}: {
  searchParams: Promise<{ quoteId?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const [productResponse, customerResponse, institutionResponse] = await Promise.all([
    listProducts({ page: 0, size: 100, sort: ["name"] }),
    listCustomers({ page: 0, size: 1000, sort: ["institution.name"] }),
    listInstitutions({ page: 0, size: 1000, sort: ["name"] }),
  ]);
  const products: ProductResponse[] =
    productResponse.status === 200 ? (productResponse.data.content ?? []) : [];
  const customers: CustomerResponse[] =
    customerResponse.status === 200 ? (customerResponse.data.content ?? []) : [];
  const institutions: InstitutionResponse[] =
    institutionResponse.status === 200 ? (institutionResponse.data.content ?? []) : [];

  return (
    <QuoteBench
      products={products}
      customers={customers}
      institutions={institutions}
      initialQuoteId={params.quoteId}
      openInEdit={params.edit === "1"}
    />
  );
}
