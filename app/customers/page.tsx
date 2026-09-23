import { CustomerEditor } from "@/components/customer/customer-editor";
import type { CustomerResponse, InstitutionResponse } from "@/lib/api/generated/model";
import { listCustomers, listInstitutions } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [customerResponse, institutionResponse] = await Promise.all([
    listCustomers({
      page: 0,
      size: 1000,
      sort: ["institution.name"],
    }),
    listInstitutions({
      page: 0,
      size: 1000,
      sort: ["name"],
    }),
  ]);
  const customers: CustomerResponse[] =
    customerResponse.status === 200 ? (customerResponse.data.content ?? []) : [];
  const institutions: InstitutionResponse[] =
    institutionResponse.status === 200 ? (institutionResponse.data.content ?? []) : [];

  return (
    <CustomerEditor initialCustomers={customers} initialInstitutions={institutions} />
  );
}
