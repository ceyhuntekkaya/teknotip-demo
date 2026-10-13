import type { QuoteBrand, QuoteResponse, QuoteTerms } from "@/lib/api/generated/model";
import { getBrandTerms, isBrandTermsList, type BrandTerms } from "@/lib/api/settings";

const TEXT_KEYS: Record<QuoteBrand, (keyof QuoteTerms)[]> = {
  TEKNOTIP: ["salesConditions"],
  OPTOSENSE: ["delivery", "payment", "validation", "tradeTerms"],
  MILIMLAB: [
    "deliveryTime",
    "deliveryMode",
    "commercialTerms",
    "paymentTerms",
    "generalProvisions",
  ],
};

export function brandTermsBlank(terms: QuoteTerms | undefined, brand: QuoteBrand): boolean {
  return TEXT_KEYS[brand].every((key) => {
    const value = terms?.[key];
    return typeof value !== "string" || value.trim() === "";
  });
}

export function replaceBrandTerms(
  current: QuoteTerms | undefined,
  defaults: QuoteTerms,
  brand: QuoteBrand,
): QuoteTerms {
  const next: QuoteTerms = { ...current };
  if (brand === "TEKNOTIP") {
    next.salesConditions = defaults.salesConditions;
    next.validityDays = defaults.validityDays;
    return next;
  }
  if (brand === "OPTOSENSE") {
    next.delivery = defaults.delivery;
    next.payment = defaults.payment;
    next.validation = defaults.validation;
    next.tradeTerms = defaults.tradeTerms;
    return next;
  }
  next.deliveryTime = defaults.deliveryTime;
  next.deliveryMode = defaults.deliveryMode;
  next.commercialTerms = defaults.commercialTerms;
  next.paymentTerms = defaults.paymentTerms;
  next.generalProvisions = defaults.generalProvisions;
  return next;
}

export function quoteTermsFromBrand(defaults: BrandTerms): QuoteTerms {
  return {
    salesConditions: defaults.salesConditions,
    validityDays: defaults.validityDays,
    delivery: defaults.delivery,
    payment: defaults.payment,
    validation: defaults.validation,
    tradeTerms: defaults.tradeTerms,
    deliveryTime: defaults.deliveryTime,
    deliveryMode: defaults.deliveryMode,
    commercialTerms: defaults.commercialTerms,
    paymentTerms: defaults.paymentTerms,
    generalProvisions: defaults.generalProvisions,
  };
}

/** Marka değişince o markanın metinleri boşsa ayarlardaki varsayılanı yazar. */
export async function quoteWithBrand(
  quote: QuoteResponse,
  brand: QuoteBrand,
): Promise<QuoteResponse> {
  const next: QuoteResponse = { ...quote, brand };
  if (!brandTermsBlank(next.terms, brand)) return next;
  try {
    const response = await getBrandTerms();
    if (response.status !== 200 || !isBrandTermsList(response.data)) return next;
    const defaults = response.data.find((item) => item.brand === brand);
    if (!defaults) return next;
    return { ...next, terms: replaceBrandTerms(next.terms, quoteTermsFromBrand(defaults), brand) };
  } catch {
    return next;
  }
}
