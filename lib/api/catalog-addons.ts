import { customFetch } from "@/lib/api/fetcher";
import type {
  ProductRequest,
  QuoteResponse,
} from "@/lib/api/generated/model";

export type ParseProductFromTextRequest = {
  text: string;
  code?: string;
  price?: number;
};

export type CatalogPropertyValueRequest = {
  productId: string;
  lineId: string;
  propertyName: string;
  value: string;
};

export type CatalogPropertyValueResponse = {
  quote?: QuoteResponse;
  message?: string;
};

export type CatalogValueSuggestion = {
  productId?: string;
  lineId?: string;
  propertyName?: string;
  attemptedValue?: string;
  validValues?: string[];
};

type JsonResponse<T> = {
  data: T;
  status: number;
  headers: Headers;
};

function headersOf(h?: RequestInit["headers"]): Record<string, string> {
  if (!h) return {};
  if (h instanceof Headers) return Object.fromEntries(h.entries());
  if (Symbol.iterator in Object(h)) {
    return Object.fromEntries(
      Array.from(h as Iterable<Iterable<string>>, (entry) =>
        Array.from(entry) as [string, string],
      ),
    );
  }
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(h as Record<string, string | undefined>)) {
    if (value !== undefined) out[name] = value;
  }
  return out;
}

export async function parseProductFromText(
  body: ParseProductFromTextRequest,
  options?: RequestInit,
): Promise<JsonResponse<ProductRequest | unknown>> {
  return customFetch(`/backend/v1/products/parse-from-text`, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...headersOf(options?.headers) },
    body: JSON.stringify(body),
  });
}

export async function addQuoteCatalogPropertyValue(
  quoteId: string,
  body: CatalogPropertyValueRequest,
  options?: RequestInit,
): Promise<JsonResponse<CatalogPropertyValueResponse | unknown>> {
  return customFetch(`/backend/v1/quotes/${quoteId}/catalog-property-values`, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...headersOf(options?.headers) },
    body: JSON.stringify(body),
  });
}
