import type {
  CustomerResponse,
  ProductResponse,
} from "@/lib/api/generated/model";
import type { OrganizedProductResponse } from "@/lib/api/organized-products";

export function matchesQuery(
  values: Array<string | number | undefined | null>,
  query: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase("tr-TR");
  if (!needle) return true;
  return values.some((value) => {
    if (value === undefined || value === null || value === "") return false;
    return String(value).toLocaleLowerCase("tr-TR").includes(needle);
  });
}

export function customerSearchValues(
  customer: CustomerResponse,
): Array<string | undefined> {
  const institution = customer.institution;
  return [
    customer.contactPerson,
    customer.title,
    customer.department,
    customer.phone,
    customer.extension,
    customer.mobile,
    customer.email,
    customer.notes,
    institution?.name,
    institution?.code,
    institution?.city,
    institution?.district,
    institution?.address,
    institution?.taxNumber,
    institution?.taxOffice,
  ];
}

function catalogSearchValues(item: {
  code?: string | null;
  name?: string | null;
  category?: string | null;
  description?: string | null;
  properties?: Array<{ name?: string; values?: string[] }>;
  accessories?: Array<{ name?: string }>;
}): Array<string | undefined | null> {
  return [
    item.code,
    item.name,
    item.category,
    item.description,
    ...(item.properties ?? []).flatMap((property) => [
      property.name,
      ...(property.values ?? []),
    ]),
    ...(item.accessories ?? []).map((accessory) => accessory.name),
  ];
}

export function productSearchValues(
  product: ProductResponse,
): Array<string | undefined | null> {
  return catalogSearchValues(product);
}

export function organizedProductSearchValues(
  product: OrganizedProductResponse,
): Array<string | undefined | null> {
  return catalogSearchValues(product);
}
