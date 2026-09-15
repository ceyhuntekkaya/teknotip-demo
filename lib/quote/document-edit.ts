import type {
  CustomerResponse,
  ProductResponse,
  QuoteLineResponse,
  QuoteResponse,
} from "@/lib/api/generated/model";

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
      institution: customer.institution,
      contactPerson: customer.contactPerson,
      title: customer.title,
      department: customer.department,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      taxOffice: customer.taxOffice,
      taxNumber: customer.taxNumber,
      greetingName: customer.greetingName,
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
