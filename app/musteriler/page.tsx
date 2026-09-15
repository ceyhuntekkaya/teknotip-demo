import { CustomerEditor } from "@/components/customer/customer-editor";
import type { CustomerResponse } from "@/lib/api/generated/model";
import { listCustomers } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function MusterilerPage() {
  const response = await listCustomers({
    page: 0,
    size: 100,
    sort: ["institution"],
  });
  const customers: CustomerResponse[] =
    response.status === 200 ? (response.data.content ?? []) : [];

  return <CustomerEditor initialCustomers={customers} />;
}
