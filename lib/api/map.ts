import type {
  ProductRequest,
  ProductResponse,
  QuoteLineRequest,
  QuoteQuotedToRequest,
  QuoteRequest,
  QuoteResponse,
} from "@/lib/api/generated/model";

export function productToRequest(product: ProductResponse): ProductRequest {
  return {
    code: product.code ?? "",
    name: product.name ?? "",
    price: product.price ?? 0,
    description: product.description,
    image: product.image,
    category: product.category,
    properties: (product.properties ?? []).map((property) => ({
      name: property.name ?? "",
      type: property.type === "MULTIPLE_CHOICE" ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE",
      values: property.values ?? [],
    })),
    accessories: (product.accessories ?? []).map((accessory) => ({
      name: accessory.name ?? "",
    })),
  };
}

export function emptyProductDraft(): ProductRequest {
  return {
    code: "",
    name: "",
    price: 0,
    description: "",
    image: "",
    category: "",
    properties: [],
    accessories: [],
  };
}

export function quoteToRequest(quote: QuoteResponse): QuoteRequest {
  const quoted = quote.quotedTo;
  const quotedTo: QuoteQuotedToRequest | undefined = quoted
    ? {
        customerId: quoted.customerId,
        institutionId: quoted.institutionId,
        institution: quoted.institution,
        contactPerson: quoted.contactPerson,
        title: quoted.title,
        department: quoted.department,
        phone: quoted.phone,
        email: quoted.email,
        address: quoted.address,
        taxOffice: quoted.taxOffice,
        taxNumber: quoted.taxNumber,
      }
    : undefined;

  const lines: QuoteLineRequest[] = (quote.lines ?? []).map((line) => ({
    productId: line.productId,
    code: line.code,
    name: line.name,
    description: line.description,
    image: line.image,
    category: line.category,
    basePrice: line.basePrice,
    price: line.price,
    quantity: line.quantity ?? 1,
    properties: (line.properties ?? []).map((property) => ({
      productPropertyId: property.productPropertyId,
      name: property.name ?? "",
      values: property.values,
      price: property.price,
    })),
    accessories: (line.accessories ?? []).map((accessory) => ({
      productAccessoryId: accessory.productAccessoryId,
      name: accessory.name ?? "",
      price: accessory.price,
      quantity: accessory.quantity ?? 1,
    })),
  }));

  return {
    quotedDate: quote.quotedDate,
    currency: quote.currency ?? "TRY",
    priceDetails: quote.priceDetails ?? true,
    showImages: quote.showImages ?? false,
    quotedTo,
    discount: quote.priceSummary?.discount,
    taxRatePercent: quote.priceSummary?.taxRatePercent,
    additionalInformation: quote.additionalInformation,
    lines,
  };
}
