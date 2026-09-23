import { ReportBrowser } from "@/components/report/report-browser";
import type {
  CustomerResponse,
  InstitutionResponse,
  ProductResponse,
} from "@/lib/api/generated/model";
import { listCustomers, listInstitutions, listProducts } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [productResponse, customerResponse, institutionResponse] = await Promise.all([
    listProducts({ page: 0, size: 1000, sort: ["name"] }),
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
    <ReportBrowser
      products={products}
      customers={customers}
      institutions={institutions}
    />
  );
}
