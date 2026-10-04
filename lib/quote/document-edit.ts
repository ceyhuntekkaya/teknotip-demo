import type {
  CustomerResponse,
  InstitutionResponse,
  ProductResponse,
  QuoteLineResponse,
  QuoteResponse,
} from "@/lib/api/generated/model";

export function isManualLine(line: QuoteLineResponse): boolean {
  return !line.productId;
}

export function nextFreeCode(lines: QuoteLineResponse[] | undefined): string {
  const used = new Set(
    (lines ?? [])
      .map((line) => (line.code ?? "").trim())
      .filter((code) => code.length > 0),
  );
  let n = 1;
  while (used.has(String(n)) || used.has(String(n).padStart(3, "0"))) {
    n += 1;
  }
  return String(n).padStart(3, "0");
}

export function addProductLine(
  quote: QuoteResponse,
  product: ProductResponse,
): QuoteResponse {
  const line: QuoteLineResponse = {
    productId: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    image: product.image,
    category: product.category,
    basePrice: product.price,
    price: product.price,
    quantity: 1,
    properties: (product.properties ?? []).map((property) => ({
      productPropertyId: property.id,
      name: property.name,
      values: "",
      price: undefined,
    })),
    accessories: [],
  };
  return { ...quote, lines: [...(quote.lines ?? []), line] };
}

export function addFreeLine(
  quote: QuoteResponse,
  input: {
    code?: string;
    name: string;
    quantity?: number;
    price?: number;
  },
): QuoteResponse {
  const name = input.name.trim();
  if (!name) return quote;
  const quantity = Math.max(1, Math.trunc(input.quantity ?? 1) || 1);
  const price = Number.isFinite(input.price) && (input.price ?? 0) >= 0 ? Number(input.price) : 0;
  const code = input.code?.trim() || undefined;
  const line: QuoteLineResponse = {
    code,
    name,
    quantity,
    price,
    basePrice: price,
    lineTotal: undefined,
    properties: [],
    accessories: [],
  };
  return { ...quote, lines: [...(quote.lines ?? []), line] };
}

export function moveLine(
  quote: QuoteResponse,
  index: number,
  direction: -1 | 1,
): QuoteResponse {
  const lines = [...(quote.lines ?? [])];
  const target = index + direction;
  if (target < 0 || target >= lines.length) return quote;
  const [item] = lines.splice(index, 1);
  lines.splice(target, 0, item);
  return {
    ...quote,
    lines: lines.map((line, sortOrder) => ({ ...line, sortOrder })),
  };
}

export function replaceLine(
  quote: QuoteResponse,
  index: number,
  line: QuoteLineResponse,
): QuoteResponse {
  const lines = [...(quote.lines ?? [])];
  lines[index] = line;
  return { ...quote, lines };
}

export function removeLine(quote: QuoteResponse, index: number): QuoteResponse {
  return {
    ...quote,
    lines: (quote.lines ?? []).filter((_, itemIndex) => itemIndex !== index),
  };
}

export function greetingName(
  title?: string,
  contactPerson?: string,
): string | undefined {
  const value = [title, contactPerson]
    .map((part) => part?.trim())
    .filter((part) => part)
    .join(" ");
  return value || undefined;
}

export function applyCustomer(
  quote: QuoteResponse,
  customer: CustomerResponse | null,
): QuoteResponse {
  if (!customer) {
    return {
      ...quote,
      quotedTo: {
        ...quote.quotedTo,
        customerId: undefined,
      },
    };
  }
  return {
    ...quote,
    quotedTo: {
      customerId: customer.id,
      institutionId: customer.institution?.id,
      institution: customer.institution?.name,
      contactPerson: customer.contactPerson,
      title: customer.title,
      department: customer.department,
      phone: customer.phone,
      email: customer.email,
      address: customer.institution?.address,
      taxOffice: customer.institution?.taxOffice,
      taxNumber: customer.institution?.taxNumber,
      greetingName:
        customer.greetingName ?? greetingName(customer.title, customer.contactPerson),
    },
  };
}

export function applyInstitution(
  quote: QuoteResponse,
  institution: InstitutionResponse | null,
): QuoteResponse {
  if (!institution) {
    return {
      ...quote,
      quotedTo: {
        ...quote.quotedTo,
        institutionId: undefined,
        customerId: undefined,
      },
    };
  }
  const sameInstitution = quote.quotedTo?.institutionId === institution.id;
  return {
    ...quote,
    quotedTo: {
      ...quote.quotedTo,
      // Kurum değişince o kuruma ait olmayan kişi ve adres/vergi bilgisi taşınmaz.
      customerId: sameInstitution ? quote.quotedTo?.customerId : undefined,
      institutionId: institution.id,
      institution: institution.name,
      address: institution.address,
      taxOffice: institution.taxOffice,
      taxNumber: institution.taxNumber,
    },
  };
}

export type CustomerLinkState = "contact" | "institution" | "none";

/** Teklifin katalogla ne kadar eşleştiği; raporlarda bulunabilmesi buna bağlı. */
export function customerLinkState(quote: QuoteResponse): CustomerLinkState {
  if (quote.quotedTo?.customerId) return "contact";
  if (quote.quotedTo?.institutionId) return "institution";
  return "none";
}

export function patchQuotedTo(
  quote: QuoteResponse,
  patch: Partial<NonNullable<QuoteResponse["quotedTo"]>>,
): QuoteResponse {
  const quoted = { ...quote.quotedTo, ...patch };
  return {
    ...quote,
    quotedTo: {
      ...quoted,
      greetingName: greetingName(quoted.title, quoted.contactPerson),
    },
  };
}

export function catalogForLine(
  products: ProductResponse[],
  line: QuoteLineResponse,
): ProductResponse | undefined {
  if (!line.productId) return undefined;
  return products.find((item) => item.id === line.productId);
}

/** Elle satırı yeni oluşturulan katalog ürününe bağlar; adet ve birim fiyat korunur. */
export function linkManualLineToProduct(
  line: QuoteLineResponse,
  product: ProductResponse,
): QuoteLineResponse {
  const quantity = Math.max(1, Math.trunc(line.quantity ?? 1) || 1);
  const price =
    Number.isFinite(line.price) && (line.price ?? 0) >= 0
      ? Number(line.price)
      : Number.isFinite(line.basePrice) && (line.basePrice ?? 0) >= 0
        ? Number(line.basePrice)
        : (product.price ?? 0);
  return {
    ...line,
    productId: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    image: product.image,
    category: product.category,
    basePrice: product.price,
    price,
    quantity,
    lineTotal: undefined,
    properties: (product.properties ?? []).map((property) => {
      const options = property.values ?? [];
      return {
        productPropertyId: property.id,
        name: property.name,
        values: options.length === 1 ? options[0] : "",
        price: undefined,
      };
    }),
    accessories: [],
  };
}
