import type { CustomerResponse } from "@/lib/api/generated/model";

export function customerLabel(customer: CustomerResponse): string {
  const name = customer.institution?.name?.trim() ?? "";
  const person = customer.contactPerson?.trim() ?? "";
  if (name && person) return `${name} — ${person}`;
  return name || person || "Müşteri";
}
