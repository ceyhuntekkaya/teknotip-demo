import type { Catalog, Product, Property } from "@/lib/catalog/types";
import type { CatalogLookup } from "@/lib/catalog/rules";
import { allowsMultipleChoices } from "@/lib/catalog/rules";
import {
  flagIntent,
  isIncrementPhrase,
  measureKey,
  normalizeCode,
  normalizeText,
  parseLineOrdinal,
  parseMeasure,
  similarity,
  squeezeSpaces,
} from "./resolve/text";
import type {
  ChatAction,
  ChatIntent,
  ClarifyCandidate,
  ClarifyResult,
  ConversationFocus,
  QuoteDraft,
  QuoteLine,
  ResolveClarify,
  ResolveOutcome,
  ValueMode,
} from "./types";

const PRODUCT_ACCEPT = 0.86;
const PRODUCT_CANDIDATE = 0.74;
const PROPERTY_ACCEPT = 0.82;
const CHOICE_ACCEPT = 0.9;

function clarify(
  kind: ClarifyResult["kind"],
  question: string,
  candidates: ClarifyCandidate[] = [],
): ResolveClarify {
  return { clarify: { kind, question, candidates } };
}

export function labeledLineRef(index: number): string {
  return `S${index + 1}`;
}

export function draftLineRefs(draft: QuoteDraft): { ref: string; line: QuoteLine }[] {
  return draft.items.map((line, index) => ({ ref: labeledLineRef(index), line }));
}

function productScore(product: Product, query: string): number {
  const q = normalizeText(query);
  if (!q) return 0;
  const code = product.code ? normalizeCode(product.code) : "";
  if (code && normalizeCode(query) === code) return 1;
  const names = [product.name, ...(product.aliases ?? [])].map(normalizeText);
  let best = 0;
  for (const name of names) {
    if (name === q) best = Math.max(best, 1);
    else if (name.includes(q) || q.includes(name)) {
      const ratio = Math.min(q.length, name.length) / Math.max(q.length, name.length);
      best = Math.max(best, 0.8 + 0.2 * ratio);
    } else {
      best = Math.max(best, similarity(name, q));
    }
  }
  return best;
}

function matchProducts(catalog: Catalog, query: string): Product[] {
  const scored = catalog
    .map((product) => ({ product, score: productScore(product, query) }))
    .filter((item) => item.score >= PRODUCT_CANDIDATE)
    .sort((a, b) => b.score - a.score);
  const accepted = scored.filter((item) => item.score >= PRODUCT_ACCEPT);
  if (accepted.length === 1) return [accepted[0].product];
  if (accepted.length > 1) return accepted.map((item) => item.product);
  if (scored.length === 1 && scored[0].score >= PRODUCT_ACCEPT) return [scored[0].product];
  return scored.map((item) => item.product);
}

function productCandidates(products: Product[]): ClarifyCandidate[] {
  return products.map((product) => ({
    label: product.name,
    ref: product.code || product.name,
  }));
}

function matchModel(product: Product, query: string) {
  const q = normalizeText(query);
  const codeQ = normalizeCode(query);
  const scored = product.models.map((model) => {
    let score = similarity(model.name, q);
    if (normalizeText(model.name) === q) score = 1;
    if (model.code && normalizeCode(model.code) === codeQ) score = 1;
    if (normalizeText(model.name).includes(q) && q.length >= 4) {
      score = Math.max(score, 0.88);
    }
    return { model, score };
  });
  const hits = scored.filter((item) => item.score >= PRODUCT_ACCEPT);
  if (hits.length === 1) return { ok: true as const, model: hits[0].model };
  if (hits.length > 1 || scored.filter((item) => item.score >= PRODUCT_CANDIDATE).length > 1) {
    return { ok: false as const, many: scored.filter((item) => item.score >= PRODUCT_CANDIDATE) };
  }
  if (hits.length === 0) return { ok: false as const, many: [] };
  return { ok: true as const, model: hits[0].model };
}

function choiceMeasureKey(name: string): string | null {
  return measureKey(parseMeasure(name));
}

function choiceMatches(query: string, choiceName: string): number {
  const q = squeezeSpaces(query);
  const n = squeezeSpaces(choiceName);
  if (normalizeText(q) === normalizeText(n)) return 1;
  const qKey = measureKey(parseMeasure(q));
  const nKey = choiceMeasureKey(n);
  if (qKey && nKey) {
    const qMeas = parseMeasure(q);
    const nMeas = parseMeasure(n);
    if (qMeas.numbers.join(",") === nMeas.numbers.join(",")) {
      if (!qMeas.unit || !nMeas.unit || qMeas.unit === nMeas.unit) return 0.97;
    }
  }
  const sim = similarity(q, n);
  return sim >= CHOICE_ACCEPT ? sim : 0;
}

function matchChoices(property: Property, values: string[]): { ids: string[] } | ResolveClarify {
  if (!property.choice?.length) {
    return { ids: [] };
  }
  const ids: string[] = [];
  for (const value of values) {
    const hits = property.choice
      .map((choice) => ({ choice, score: choiceMatches(value, choice.name) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
    if (hits.length === 1) {
      ids.push(hits[0].choice.id);
      continue;
    }
    if (hits.length === 0) {
      return clarify(
        "which_value",
        `${property.name} için geçerli seçenekler nedir?`,
        property.choice.map((choice) => ({ label: choice.name, ref: choice.name })),
      );
    }
    const top = hits[0].score;
    const tied = hits.filter((item) => item.score >= top - 0.02);
    if (tied.length > 1) {
      return clarify(
        "which_value",
        `"${value}" birden fazla seçeneğe uyuyor. Hangisi?`,
        tied.map((item) => ({ label: item.choice.name, ref: item.choice.name })),
      );
    }
    ids.push(hits[0].choice.id);
  }
  return { ids: [...new Set(ids)] };
}

function propertyNameScore(property: Property, query: string): number {
  const q = normalizeText(query);
  const name = normalizeText(property.name);
  if (name === q) return 1;
  if (name.includes(q) || q.includes(name)) {
    return Math.min(q.length, name.length) / Math.max(q.length, name.length) + 0.5;
  }
  return similarity(name, q);
}

function matchPropertiesByName(product: Product, query: string): Property[] {
  return product.propertyGroups
    .flatMap((group) => group.properties)
    .map((property) => ({ property, score: propertyNameScore(property, query) }))
    .filter((item) => item.score >= PROPERTY_ACCEPT)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.property);
}

function propertiesMatchingValue(product: Product, values: string[]): Property[] {
  const hits: Property[] = [];
  for (const property of product.propertyGroups.flatMap((group) => group.properties)) {
    if (!property.choice?.length) {
      if (values.some((value) => propertyNameScore(property, value) >= PROPERTY_ACCEPT)) {
        hits.push(property);
      }
      continue;
    }
    const matched = matchChoices(property, values);
    if ("ids" in matched && matched.ids.length) hits.push(property);
  }
  return hits;
}

function findProperty(
  product: Product,
  intent: ChatIntent,
): { property: Property } | ResolveClarify | { none: true } {
  const values = intentValues(intent);
  if (intent.propertyRef?.trim()) {
    const named = matchPropertiesByName(product, intent.propertyRef);
    if (named.length === 1) return { property: named[0] };
    if (named.length > 1) {
      return clarify(
        "which_value",
        "Hangi özelliği kastediyorsunuz?",
        named.map((property) => ({ label: property.name, ref: property.name })),
      );
    }
    return clarify(
      "which_value",
      `"${intent.propertyRef}" adlı özellik bulunamadı. Hangisini seçelim?`,
      product.propertyGroups.flatMap((group) =>
        group.properties.map((property) => ({ label: property.name, ref: property.name })),
      ),
    );
  }
  if (!values.length) return { none: true };
  const byValue = propertiesMatchingValue(product, values);
  if (byValue.length === 1) return { property: byValue[0] };
  if (byValue.length > 1) {
    return clarify(
      "which_value",
      "Bu değer birden fazla özelliğe uyuyor. Hangisini değiştirelim?",
      byValue.map((property) => ({ label: property.name, ref: property.name })),
    );
  }
  return { none: true };
}

function intentValues(intent: ChatIntent): string[] {
  if (intent.values?.length) return intent.values.map((item) => item.trim()).filter(Boolean);
  if (intent.value?.trim()) {
    return intent.value
      .split(/\s*(?:,| ve | ile )\s*/i)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function resolveProduct(
  catalog: Catalog,
  intent: ChatIntent,
  draft: QuoteDraft,
  line: QuoteLine | undefined,
): { product: Product } | ResolveClarify | { none: true } {
  if (intent.productRef?.trim()) {
    const matches = matchProducts(catalog, intent.productRef);
    if (matches.length === 1) return { product: matches[0] };
    if (matches.length === 0) {
      return clarify("which_product", "Bu ürünü bulamadım, biraz daha açar mısınız?");
    }
    return clarify(
      "which_product",
      "Birden fazla ürün uyuyor. Hangisini kastediyorsunuz?",
      productCandidates(matches),
    );
  }
  if (line) {
    const product = catalog.find((item) => item.id === line.productId);
    if (product) return { product };
  }
  if (draft.items.length === 1) {
    const product = catalog.find((item) => item.id === draft.items[0].productId);
    if (product) return { product };
  }
  return { none: true };
}

function resolveLineFromRef(
  draft: QuoteDraft,
  lineRef: string,
  productId?: string,
): { line: QuoteLine } | ResolveClarify {
  const pool = productId
    ? draft.items.filter((item) => item.productId === productId)
    : draft.items;
  const labeled = draftLineRefs({ ...draft, items: pool.length ? pool : draft.items });
  const folded = normalizeText(lineRef);
  const byRef = labeled.find((item) => normalizeText(item.ref) === folded);
  if (byRef) return { line: byRef.line };
  const byId = draft.items.find((item) => item.lineId === lineRef);
  if (byId) return { line: byId };
  const ordinal = parseLineOrdinal(lineRef);
  if (ordinal !== null && labeled.length) {
    const index = ordinal < 0 ? labeled.length - 1 : ordinal;
    if (labeled[index]) return { line: labeled[index].line };
  }
    return clarify(
      "which_line",
      "Hangi satır? İlk mi ikinci mi?",
      labeled.map((item, index) => ({
        label: `${item.ref} (${index + 1}. satır)`,
        ref: item.ref,
      })),
    );
}

function resolveLine(
  draft: QuoteDraft,
  intent: ChatIntent,
  product: Product | undefined,
  focus?: ConversationFocus,
): { line?: QuoteLine } | ResolveClarify {
  const productId = product?.id;
  if (intent.lineRef?.trim()) {
    const resolved = resolveLineFromRef(draft, intent.lineRef, productId);
    if ("line" in resolved) return { line: resolved.line };
    return resolved;
  }
  const pool = productId
    ? draft.items.filter((item) => item.productId === productId)
    : draft.items;
  if (pool.length === 1) return { line: pool[0] };
  if (pool.length === 0) return {};
  if (
    focus?.lastTouchedLineId &&
    pool.some((item) => item.lineId === focus.lastTouchedLineId)
  ) {
    return { line: pool.find((item) => item.lineId === focus.lastTouchedLineId) };
  }
  return clarify(
    "which_line",
    "Hangi satır? İlk mi ikinci mi?",
    draftLineRefs({ ...draft, items: pool }).map((item) => ({
      label: item.ref,
      ref: item.ref,
    })),
  );
}

function applyValueMode(
  existing: string[] | undefined,
  incoming: string[],
  mode: ValueMode | null | undefined,
  multiple: boolean,
): string[] {
  const current = existing ?? [];
  if (!multiple) return incoming.slice(0, 1);
  if (mode === "add") return [...new Set([...current, ...incoming])];
  if (mode === "remove") return current.filter((id) => !incoming.includes(id));
  return incoming;
}

function customerAction(intent: ChatIntent): ResolveOutcome {
  if (!intent.customer) {
    return clarify("which_value", "Kurum, kişi veya unvan bilgisi gerekli.");
  }
  return {
    action: {
      op: "set_customer",
      customer: intent.customer,
    },
  };
}

export function resolveIntent(
  intent: ChatIntent,
  catalog: Catalog,
  lookup: CatalogLookup,
  draft: QuoteDraft,
  focus?: ConversationFocus,
  options?: { confirmed?: boolean },
): ResolveOutcome {
  if (intent.op === "clarify") {
    return clarify(
      "which_value",
      "Bu asistan yalnızca teklif hazırlar. Ürün, özellik veya müşteri bilgisi söyleyebilirsiniz.",
    );
  }
  if (intent.op === "set_customer") {
    return customerAction(intent);
  }

  const productResult = resolveProduct(catalog, intent, draft, undefined);
  if ("clarify" in productResult) return productResult;

  let product = "product" in productResult ? productResult.product : undefined;
  const linePack = resolveLine(draft, intent, product, focus);
  if ("clarify" in linePack) return linePack;
  const line = linePack.line;
  if (!product && line) {
    product = lookup.products.get(line.productId);
  }

  if (intent.op === "add_line") {
    if (!product) {
      return clarify("which_product", "Hangi ürünü ekleyeyim?");
    }
    if (!product.models.length) {
      return clarify("which_value", `${product.name} için model tanımlı değil.`);
    }
    let modelId: string | undefined;
    if (intent.modelRef?.trim()) {
      const model = matchModel(product, intent.modelRef);
      if (!model.ok) {
        return clarify(
          "which_value",
          `${product.name} için geçerli modeller: ${product.models.map((item) => item.name).join(", ")}`,
          product.models.map((item) => ({ label: item.name, ref: item.name })),
        );
      }
      modelId = model.model.id;
    }
    const quantity =
      typeof intent.quantity === "number" && intent.quantity >= 1
        ? Math.floor(intent.quantity)
        : 1;
    return {
      action: {
        op: "add_line",
        productId: product.id,
        modelId,
        quantity,
      },
    };
  }

  if (!product) {
    if (draft.items.length > 1) {
      return clarify(
        "which_line",
        "Hangi satır? İlk mi ikinci mi?",
        draftLineRefs(draft).map((item) => ({ label: item.ref, ref: item.ref })),
      );
    }
    return clarify("which_product", "Hangi ürünü kastediyorsunuz?");
  }

  if (intent.op === "remove_line") {
    if (!line) {
      return clarify(
        "which_line",
        "Hangi satırı kaldıralım?",
        draftLineRefs(draft).map((item) => ({ label: item.ref, ref: item.ref })),
      );
    }
    if (!options?.confirmed) {
      return clarify(
        "confirm_remove",
        "Bu satırı silmek istiyor musunuz?",
        [{ label: product.name, ref: line.lineId }],
      );
    }
    return {
      action: {
        op: "remove_line",
        productId: product.id,
        lineId: line.lineId,
      },
    };
  }

  if (intent.op === "set_model") {
    if (!intent.modelRef?.trim()) {
      return clarify(
        "which_value",
        `${product.name} için geçerli modeller: ${product.models.map((item) => item.name).join(", ")}`,
        product.models.map((item) => ({ label: item.name, ref: item.name })),
      );
    }
    const model = matchModel(product, intent.modelRef);
    if (!model.ok) {
      return clarify(
        "which_value",
        `${product.name} için geçerli modeller: ${product.models.map((item) => item.name).join(", ")}`,
        product.models.map((item) => ({ label: item.name, ref: item.name })),
      );
    }
    return {
      action: {
        op: "set_model",
        productId: product.id,
        lineId: line?.lineId,
        modelId: model.model.id,
      },
    };
  }

  if (intent.op === "set_quantity") {
    const increment =
      isIncrementPhrase(intent.value ?? "") || isIncrementPhrase(intent.productRef ?? "");
    const current = line?.quantity ?? 1;
    const quantity = increment
      ? current + 1
      : typeof intent.quantity === "number"
        ? intent.quantity
        : Number.parseInt(intent.value ?? "", 10);
    if (!Number.isFinite(quantity) || quantity < 1) {
      return clarify("which_value", "Kaç adet olsun?");
    }
    return {
      action: {
        op: "set_quantity",
        productId: product.id,
        lineId: line?.lineId,
        quantity: Math.floor(quantity),
      },
    };
  }

  if (intent.op === "set_price") {
    if (typeof intent.price !== "number") {
      return clarify("which_value", "Hangi fiyatı yazayım?");
    }
    const located = findProperty(product, intent);
    if ("clarify" in located) return located;
    if ("property" in located) {
      return {
        action: {
          op: "set_price",
          productId: product.id,
          lineId: line?.lineId,
          propertyId: located.property.id,
          price: intent.price,
        },
      };
    }
    return {
      action: {
        op: "set_price",
        productId: product.id,
        lineId: line?.lineId,
        price: intent.price,
      },
    };
  }

  if (intent.op === "remove_property") {
    const located = findProperty(product, intent);
    if ("clarify" in located) return located;
    if (!("property" in located)) {
      return clarify("which_value", "Hangi özelliği kaldıralım?");
    }
    return {
      action: {
        op: "remove_property",
        productId: product.id,
        lineId: line?.lineId,
        propertyId: located.property.id,
      },
    };
  }

  if (intent.op === "set_value") {
    const located = findProperty(product, intent);
    if ("clarify" in located) return located;
    if (!("property" in located)) {
      return clarify(
        "which_value",
        "Bu değeri hangi özelliğe yazayım?",
        product.propertyGroups.flatMap((group) =>
          group.properties.map((property) => ({ label: property.name, ref: property.name })),
        ),
      );
    }
    const property = located.property;
    const group = product.propertyGroups.find((item) =>
      item.properties.some((row) => row.id === property.id),
    );
    const values = intentValues(intent);
    const flag = values.length === 1 ? flagIntent(values[0]) : null;
    if (!property.choice?.length) {
      if (flag === "remove") {
        return {
          action: {
            op: "remove_property",
            productId: product.id,
            lineId: line?.lineId,
            propertyId: property.id,
          },
        };
      }
      return {
        action: {
          op: "set_choice",
          productId: product.id,
          lineId: line?.lineId,
          propertyId: property.id,
          choiceIds: [],
        },
      };
    }
    if (flag === "remove") {
      return {
        action: {
          op: "remove_property",
          productId: product.id,
          lineId: line?.lineId,
          propertyId: property.id,
        },
      };
    }
    const matched = matchChoices(property, values);
    if ("clarify" in matched) return matched;
    const existing = line?.selections.find((item) => item.propertyId === property.id);
    const multiple = group ? allowsMultipleChoices(group) : false;
    const choiceIds = applyValueMode(
      existing?.choiceIds,
      matched.ids,
      intent.valueMode,
      multiple,
    );
    if (!choiceIds.length && flag !== "add") {
      return {
        action: {
          op: "remove_property",
          productId: product.id,
          lineId: line?.lineId,
          propertyId: property.id,
        },
      };
    }
    return {
      action: {
        op: "set_choice",
        productId: product.id,
        lineId: line?.lineId,
        propertyId: property.id,
        choiceIds,
      },
    };
  }

  return clarify("which_value", "Anlayamadım, tekrar eder misiniz?");
}

export function resolveIntents(
  intents: ChatIntent[],
  catalog: Catalog,
  lookup: CatalogLookup,
  draft: QuoteDraft,
  focus?: ConversationFocus,
  options?: { confirmed?: boolean },
): { actions: ChatAction[]; clarifications: ClarifyResult[] } {
  const actions: ChatAction[] = [];
  const clarifications: ClarifyResult[] = [];
  let impliedProductRef: string | undefined;
  for (const intent of intents) {
    const patched: ChatIntent = {
      ...intent,
      productRef: intent.productRef ?? impliedProductRef,
    };
    const outcome = resolveIntent(patched, catalog, lookup, draft, focus, options);
    if ("action" in outcome) {
      actions.push(outcome.action);
      if (patched.productRef?.trim()) impliedProductRef = patched.productRef;
      if (outcome.action.op === "add_line" && outcome.action.productId) {
        impliedProductRef = patched.productRef ?? impliedProductRef;
      }
    } else {
      clarifications.push({ ...outcome.clarify, resume: patched });
    }
  }
  return { actions, clarifications };
}

export function pickPending(clarifications: ClarifyResult[]): ClarifyResult | undefined {
  const order: ClarifyResult["kind"][] = [
    "confirm_remove",
    "which_line",
    "which_product",
    "which_value",
  ];
  for (const kind of order) {
    const hit = clarifications.find((item) => item.kind === kind);
    if (hit) return hit;
  }
  return clarifications[0];
}
