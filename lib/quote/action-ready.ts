import type { QuoteResponse } from "@/lib/api/generated/model";

export const QUOTE_ACTION_READY_HINT =
  "Kurum, ilgili kişi ve en az bir ürün gerekli.";

function filled(value?: string | null): boolean {
  return Boolean(value?.trim());
}

export function isQuoteActionReady(quote?: QuoteResponse | null): boolean {
  if (!quote) return false;
  const institution = filled(quote.quotedTo?.institution);
  const contactPerson = filled(quote.quotedTo?.contactPerson);
  const hasProduct = (quote.lines ?? []).some(
    (line) => Boolean(line.productId) || filled(line.name),
  );
  return institution && contactPerson && hasProduct;
}
