import type { ProductResponse, QuoteLineResponse, QuoteResponse } from "@/lib/api/generated/model";

/** Keeps blank lines the user entered. Drops only leading and trailing blank lines. */
export function textLines(value?: string | null): string[] {
  const normalized = (value ?? "").replace(/\r\n/g, "\n");
  if (!normalized.trim()) return [];
  const lines = normalized.split("\n");
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start += 1;
  while (end > start && lines[end - 1].trim() === "") end -= 1;
  return lines.slice(start, end);
}

export function resolveLineDescription(
  line: Pick<QuoteLineResponse, "description" | "productId">,
  productsById?: Map<string, Pick<ProductResponse, "description">>,
): string {
  if (line.description?.trim()) return line.description;
  const productId = line.productId?.trim();
  if (!productId || !productsById) return "";
  return productsById.get(productId)?.description ?? "";
}

export function quoteWithResolvedDescriptions(
  quote: QuoteResponse,
  products: ProductResponse[],
): QuoteResponse {
  const productsById = new Map(
    products
      .filter((product) => product.id)
      .map((product) => [product.id as string, product]),
  );
  return {
    ...quote,
    lines: (quote.lines ?? []).map((line) => {
      const description = resolveLineDescription(line, productsById);
      if ((line.description ?? "") === description) return line;
      return { ...line, description };
    }),
  };
}
