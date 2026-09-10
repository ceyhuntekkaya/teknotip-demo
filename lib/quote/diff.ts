import type { Catalog } from "@/lib/catalog/types";
import { lineFingerprint } from "./apply";
import type {
  ApplyWarning,
  ClarifyResult,
  QuoteDraft,
  QuoteLine,
} from "./types";

function lineLabel(catalog: Catalog, line: QuoteLine): string {
  const product = catalog.find((item) => item.id === line.productId);
  const model = product?.models.find((item) => item.id === line.modelId);
  return `${product?.name ?? "Ürün"}${model ? ` / ${model.name}` : ""}`;
}

export function summarizeTurn(input: {
  catalog: Catalog;
  before: QuoteDraft;
  after: QuoteDraft;
  warnings: ApplyWarning[];
  clarifications: ClarifyResult[];
}): string {
  const parts: string[] = [];
  const beforeIds = new Map(input.before.items.map((item) => [item.lineId, item]));
  const afterIds = new Map(input.after.items.map((item) => [item.lineId, item]));

  for (const line of input.after.items) {
    const prev = beforeIds.get(line.lineId);
    const label = lineLabel(input.catalog, line);
    if (!prev) {
      parts.push(`${label} eklendi (${line.quantity} adet).`);
      continue;
    }
    if (prev.quantity !== line.quantity) {
      parts.push(`${label} adedi ${line.quantity} yapıldı.`);
    }
    if (prev.modelId !== line.modelId) {
      const model = input.catalog
        .find((item) => item.id === line.productId)
        ?.models.find((item) => item.id === line.modelId);
      parts.push(`${label} modeli ${model?.name ?? "yeni model"} olarak güncellendi.`);
    }
    if (prev.basePriceOverride !== line.basePriceOverride && line.basePriceOverride != null) {
      parts.push(`${label} birim fiyatı ${line.basePriceOverride} olarak yazıldı.`);
    }
    if (JSON.stringify(prev.selections) !== JSON.stringify(line.selections)) {
      parts.push(`${label} özellikleri güncellendi.`);
    }
  }

  for (const line of input.before.items) {
    if (!afterIds.has(line.lineId)) {
      const still = [...afterIds.values()].find(
        (item) => lineFingerprint(item) === lineFingerprint(line),
      );
      if (!still) parts.push(`${lineLabel(input.catalog, line)} kaldırıldı.`);
    }
  }

  const beforeCustomer = JSON.stringify(input.before.quotedTo ?? {});
  const afterCustomer = JSON.stringify(input.after.quotedTo ?? {});
  if (beforeCustomer !== afterCustomer && input.after.quotedTo) {
    const who = [
      input.after.quotedTo.institution,
      input.after.quotedTo.title,
      input.after.quotedTo.contactPerson,
    ]
      .filter(Boolean)
      .join(" · ");
    parts.push(`Müşteri bilgisi güncellendi${who ? `: ${who}` : "."}`);
  }

  for (const warning of input.warnings) {
    parts.push(`Uyarı: ${warning.message}`);
  }
  for (const item of input.clarifications) {
    parts.push(item.question);
    if (item.candidates.length) {
      parts.push(item.candidates.map((candidate) => candidate.label).join(", "));
    }
  }

  if (!parts.length) {
    return "Teklifte değişiklik yok. Ürün, özellik veya müşteri bilgisi söyleyebilirsiniz.";
  }
  return parts.join("\n");
}
