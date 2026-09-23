import { QuoteBrowser } from "@/components/quote/quote-browser";
import type {
  CustomerResponse,
  InstitutionResponse,
  ProductResponse,
  QuoteSummaryResponse,
} from "@/lib/api/generated/model";
import {
  listCustomers,
  listInstitutions,
  listProducts,
  listQuotes,
} from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const [quoteResponse, productResponse, customerResponse, institutionResponse] =
    await Promise.all([
      listQuotes({ page: 0, size: 10, sort: ["createdAt,desc"] }),
      listProducts({ page: 0, size: 100, sort: ["name"] }),
      listCustomers({ page: 0, size: 1000, sort: ["institution.name"] }),
      listInstitutions({ page: 0, size: 1000, sort: ["name"] }),
    ]);

  const quotes: QuoteSummaryResponse[] =
    quoteResponse.status === 200 ? (quoteResponse.data.content ?? []) : [];
  const products: ProductResponse[] =
    productResponse.status === 200 ? (productResponse.data.content ?? []) : [];
  const customers: CustomerResponse[] =
    customerResponse.status === 200 ? (customerResponse.data.content ?? []) : [];
  const institutions: InstitutionResponse[] =
    institutionResponse.status === 200 ? (institutionResponse.data.content ?? []) : [];

  return (
    <QuoteBrowser
      initialQuotes={quotes}
      products={products}
      customers={customers}
      institutions={institutions}
    />
  );
}
