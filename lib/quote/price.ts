import { Decimal } from "decimal.js";
import type { Catalog, Product, Property } from "@/lib/catalog/types";
import type { PriceSummary, QuoteDraft, QuoteLine } from "./types";

const TAX_RATE = new Decimal("20");

function money(value: Decimal): number {
  return Number(value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
}

export function propertyAddOn(property: Property, choiceIds: string[]): number {
  if (property.choice?.length) {
    let total = 0;
    for (const choiceId of choiceIds) {
      const choice = property.choice.find((item) => item.id === choiceId);
      total += choice?.price ?? 0;
    }
    return total;
  }
  return property.price ?? 0;
}

export function linePriceParts(
  product: Product,
  line: QuoteLine,
): { base: number; extras: number; unit: number; lineTotal: number } {
  const model = product.models.find((item) => item.id === line.modelId);
  const base = line.basePriceOverride ?? model?.price ?? 0;
  let extras = 0;
  for (const selection of line.selections) {
    if (typeof selection.priceOverride === "number") {
      extras += selection.priceOverride;
      continue;
    }
    const group = product.propertyGroups.find((item) => item.id === selection.groupId);
    const property = group?.properties.find((item) => item.id === selection.propertyId);
    if (!property) continue;
    extras += propertyAddOn(property, selection.choiceIds);
  }
  const unit = base + extras;
  const lineTotal = Number(
    new Decimal(unit).times(line.quantity).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
  );
  return { base, extras, unit, lineTotal };
}

export function summarizeDraft(
  catalog: Catalog,
  draft: QuoteDraft,
  taxRatePercent: Decimal = TAX_RATE,
): PriceSummary {
  let subtotal = new Decimal(0);
  for (const line of draft.items) {
    const product = catalog.find((item) => item.id === line.productId);
    if (!product) continue;
    subtotal = subtotal.plus(linePriceParts(product, line).lineTotal);
  }
  const discount = new Decimal(0);
  const totalAfterDiscount = subtotal.minus(discount);
  const tax = totalAfterDiscount
    .times(taxRatePercent)
    .dividedBy(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const totalAfterTax = totalAfterDiscount.plus(tax);
  return {
    subtotal: money(subtotal),
    discount: money(discount),
    tax: money(tax),
    taxRatePercent: Number(taxRatePercent),
    totalAfterDiscount: money(totalAfterDiscount),
    totalAfterTax: money(totalAfterTax),
  };
}
