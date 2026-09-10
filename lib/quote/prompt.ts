import { allowsMultipleChoices, groupRequirement } from "@/lib/catalog/rules";
import type { Catalog } from "@/lib/catalog/types";
import { labeledDraft } from "./apply";
import type { ConversationFocus, QuoteDraft } from "./types";

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
    lines.push(`  - name: ${yamlEscape(product.name)}`);
    if (product.code) lines.push(`    code: ${yamlEscape(product.code)}`);
    if (product.aliases?.length) {
      lines.push(`    aliases: [${product.aliases.map((item) => yamlEscape(item)).join(", ")}]`);
    }
    lines.push("    models:");
    if (!product.models.length) {
      lines.push("      []");
    } else {
      for (const model of product.models) {
        lines.push(
          `      - ${inlineMap({
            name: model.name,
            code: model.code,
            price: model.price,
          })}`,
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
        lines.push(`      - name: ${yamlEscape(group.name)}`);
        lines.push(`        state: ${state}`);
        lines.push(`        pick: ${pick}`);
        lines.push("        props:");
        if (!group.properties.length) {
          lines.push("          []");
        } else {
          for (const property of group.properties) {
            const propReq =
              state === "required" || property.state === "required" ? 1 : 0;
            lines.push(`          - name: ${yamlEscape(property.name)}`);
            lines.push(`            req: ${propReq}`);
            if (typeof property.price === "number") {
              lines.push(`            price: ${property.price}`);
            }
            if (property.choice?.length) {
              lines.push("            choices:");
              for (const choice of property.choice) {
                lines.push(
                  `              - ${inlineMap({
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
  "Sen TeknoTip teklif asistanısın. Yalnız teklif hazırlarsın; teklif dışı isteği nazikçe reddet, op=clarify yaz.",
  "Tek gerçeklik kaynağın verilen katalogdur; katalog dışı ürün/ölçü/özellik uydurma.",
  "Emin değilsen veya birden çok eşleşme varsa aksiyon üretme, op=clarify ile sor.",
  "İlgili ürünler tam kataloğun alt kümesidir. Kullanıcı burada görünmeyen bir ürün adı geçirirse yine de productRef üret; yok deme.",
  "KDV, genel toplam veya aritmetik üretme. Kullanıcı birim/ürün fiyatı söylediyse set_price yaz ve sayıyı price alanına koy (ör. 25000); propertyRef yalnız bir eklenti fiyatıysa.",
  "Teklif boşsa veya ürün yoksa add_line yaz. Mevcut satıra özellik/fiyat/adet için set_value / set_price / set_quantity / remove_property kullan.",
  "Satır adedi set_quantity. Katalogdaki bir özelliğin değeri set_value (propertyRef = o özelliğin adı). Taslak satır başlığını propertyRef yapma; satır için lineRef S1, S2 kullan. Katalog ID'si yazma.",
  "Kullanıcı bekleyen soruyu cevaplamıyorsa onu yok say; yeni cümleyi yorumla.",
  "Flag opsiyon eklemek için set_value value=ekle; kaldırmak için set_value value=çıkar.",
  "multiple_choice kümesine eklemek için valueMode=add, çıkarmak için remove, yerine yazmak için set.",
  "Adet her zaman mutlak sayı. 'bir tane daha' için mevcut adet+1 yaz.",
  "Müşteri için set_customer (institution, contactPerson, title) kullan; ürünle aynı turda olabilir.",
  "Yalnız reply ve intents döndür.",
].join(" ");

export function buildUserPrompt(
  catalogYaml: string,
  catalog: Catalog,
  draft: QuoteDraft,
  userMessage: string,
  focus?: ConversationFocus,
): string {
  const pending = focus?.pending
    ? `\nBekleyen soru: ${focus.pending.question}\nAdaylar: ${focus.pending.candidates
        .map((item) => `${item.ref}=${item.label}`)
        .join("; ")}`
    : "";
  return [
    "İlgili ürünler (tam katalog daha geniştir):",
    catalogYaml,
    "",
    `Teklif no: ${draft.quoteNumber}`,
    labeledDraft(catalog, draft),
    pending,
    "",
    "Kullanıcı:",
    userMessage,
  ]
    .filter((line) => line !== "")
    .join("\n");
}
