import { newQuoteNumber } from "@/lib/catalog/ids";
import type { QuoteDocument, QuoteDraft } from "./types";

export function emptyDraft(date = new Date()): QuoteDraft {
  return {
    quoteNumber: newQuoteNumber(date),
    items: [],
  };
}

export function emptyDocument(quoteNumber = ""): QuoteDocument {
  return {
    quotedTo: {
      id: "",
      name: "",
      institution: "",
      contactPerson: "",
      date: "",
      quoteNumber,
    },
    products: [],
    priceSummary: {
      subtotal: 0,
      discount: 0,
      tax: 0,
      taxRatePercent: 20,
      totalAfterDiscount: 0,
      totalAfterTax: 0,
    },
    preparedBy: "",
  };
}
