import { allowsMultipleChoices, groupRequirement } from "@/lib/catalog/rules";
import type { Catalog } from "@/lib/catalog/types";
import { labeledDraft } from "./apply";
import type { QuoteDraft } from "./types";

function yamlEscape(value: string): string {
  if (value === "") return '""';
  if (/[:#{}[\],&*?|<>=!%@`'"\\]/.test(value) || /^\s|\s$/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

function inlineMap(fields: Record<string, string | number | undefined>): string {
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) =>
      typeof value === "number" ? `${key}: ${value}` : `${key}: ${yamlEscape(String(value))}`,
    );
  return `{ ${parts.join(", ")} }`;
}

export function compileLlmCatalog(catalog: Catalog): string {
  const lines: string[] = ["products:"];
  if (!catalog.length) {
    lines.push("  []");
    return lines.join("\n");
  }

  for (const product of catalog) {
    lines.push(`  - id: ${yamlEscape(product.id)}`);
    lines.push(`    name: ${yamlEscape(product.name)}`);
    lines.push("    models:");
    if (!product.models.length) {
      lines.push("      []");
    } else {
      for (const model of product.models) {
        lines.push(
          `      - ${inlineMap({ id: model.id, name: model.name, price: model.price })}`,
        );
      }
    }
    lines.push("    groups:");
    if (!product.propertyGroups.length) {
      lines.push("      []");
    } else {
      for (const group of product.propertyGroups) {
        const state = groupRequirement(group);
        const pick = allowsMultipleChoices(group) ? "N" : 1;
        lines.push(`      - id: ${yamlEscape(group.id)}`);
        lines.push(`        name: ${yamlEscape(group.name)}`);
        lines.push(`        state: ${state}`);
        lines.push(`        pick: ${pick}`);
        lines.push("        props:");
        if (!group.properties.length) {
          lines.push("          []");
        } else {
          for (const property of group.properties) {
            const propReq =
              state === "required" || property.state === "required" ? 1 : 0;
            lines.push(`          - id: ${yamlEscape(property.id)}`);
            lines.push(`            name: ${yamlEscape(property.name)}`);
            lines.push(`            req: ${propReq}`);
            if (typeof property.price === "number") {
              lines.push(`            price: ${property.price}`);
            }
            if (property.choice?.length) {
              lines.push("            choices:");
              for (const choice of property.choice) {
                lines.push(
                  `              - ${inlineMap({
                    id: choice.id,
                    name: choice.name,
                    price: choice.price,
                  })}`,
                );
              }
            }
          }
        }
      }
    }
  }

  return lines.join("\n");
}

export const SYSTEM_PROMPT = [
  "Sen TeknoTip teklif asistanısın.",
  "Tek gerçeklik kaynağın verilen katalogdur. Katalog dışı ölçü, aksesuar veya özel üretim kabul etme; reddet ve izinli seçenekleri söyle.",
  "KDV, genel toplam veya aritmetik üretme. Katalogdaki sayı birim listedir. Kullanıcı farklı birim fiyat söylediyse set_price yaz.",
  "Teklif boşsa veya bu ürün teklifte yoksa add_line yaz. Mevcut satıra özellik/fiyat/adet işlemek için add_line kullanma; set_choice / set_price / set_quantity / remove_property kullan.",
  "add_line yalnız teklifte olmayan bir ürün ailesi veya farklı konfigürasyonlu ikinci bir cihaz içindir. Aynı cihazdan 2 adet (aynı özellikler) için set_quantity kullan.",
  "MFC grubundaki Adet, teklif satır adedi değildir; satır adedi set_quantity ile yazılır.",
  "Opsiyoneli kaldırmak için remove_property, satır silmek için remove_line kullan.",
  "Yeni lineId uydurma. Mevcut satırları verilen lineId ile adresle. lineId yoksa tek eşleşen satırı kastediyorsan boş bırak.",
  "Yalnızca reply ve actions döndür.",
].join(" ");

export function buildUserPrompt(
  catalogYaml: string,
  catalog: Catalog,
  draft: QuoteDraft,
  userMessage: string,
): string {
  return [
    "Katalog:",
    catalogYaml,
    "",
    `Teklif no: ${draft.quoteNumber}`,
    "Mevcut teklif:",
    labeledDraft(catalog, draft),
    "",
    "Kullanıcı:",
    userMessage,
  ].join("\n");
}
