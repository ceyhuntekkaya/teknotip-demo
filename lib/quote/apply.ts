import { newLineId } from "@/lib/catalog/ids";
import {
  canRemoveProperty,
  coerceChoiceIds,
  defaultLineSelections,
  groupRequirement,
  indexCatalog,
  type CatalogLookup,
} from "@/lib/catalog/rules";
import type { Catalog } from "@/lib/catalog/types";
import type {
  ApplyResult,
  ApplyWarning,
  ChatAction,
  QuoteDraft,
  QuoteLine,
  QuoteLineSelection,
} from "./types";

type ApplySession = {
  incoming: QuoteDraft;
  addedLineIds: string[];
};

function cloneDraft(draft: QuoteDraft): QuoteDraft {
  return structuredClone(draft);
}

function lineById(draft: QuoteDraft, lineId: string): QuoteLine | undefined {
  return draft.items.find((item) => item.lineId === lineId);
}

function actionProductId(
  action: ChatAction,
  lookup: CatalogLookup,
): string | undefined {
  if (action.productId?.trim()) return action.productId.trim();
  if (action.propertyId) {
    return lookup.properties.get(action.propertyId)?.product.id;
  }
  return undefined;
}

function resolveLine(
  draft: QuoteDraft,
  action: ChatAction,
  lookup: CatalogLookup,
  session: ApplySession,
  createIfMissing = false,
): { ok: true; line: QuoteLine } | { ok: false; reason: string } {
  if (action.lineId) {
    const line = lineById(draft, action.lineId);
    if (line) return { ok: true, line };
  }

  const productId = actionProductId(action, lookup);
  let candidates = productId
    ? draft.items.filter((item) => item.productId === productId)
    : draft.items;

  if (candidates.length === 0 && createIfMissing && productId) {
    const created = addLine(
      draft,
      { op: "add_line", productId, modelId: action.modelId, quantity: action.quantity },
      lookup,
      session,
    );
    if (created) return { ok: false, reason: created.message };
    candidates = productId
      ? draft.items.filter((item) => item.productId === productId)
      : draft.items;
  }

  if (candidates.length === 1) return { ok: true, line: candidates[0] };
  if (candidates.length === 0) {
    return { ok: false, reason: "Teklifte bu ürüne ait satır yok." };
  }

  const added = candidates.filter((item) =>
    session.addedLineIds.includes(item.lineId),
  );
  if (added.length) {
    return { ok: true, line: added[added.length - 1] };
  }

  return {
    ok: false,
    reason: "Birden fazla satır var; hangi ürün satırını kastettiğinizi belirtin.",
  };
}

function isAmendMutation(
  action: ChatAction,
  incoming: QuoteDraft,
  lookup: CatalogLookup,
): boolean {
  const productId = actionProductId(action, lookup);
  if (!productId) return false;
  if (
    action.op === "set_price" ||
    action.op === "set_quantity" ||
    action.op === "remove_property" ||
    action.op === "set_model"
  ) {
    return true;
  }
  if (action.op !== "set_choice" || !action.propertyId) return false;
  const located = lookup.properties.get(action.propertyId);
  if (!located) return false;
  const existing = incoming.items.filter((item) => item.productId === productId);
  if (existing.length !== 1) return false;
  const already = existing[0].selections.some(
    (item) => item.propertyId === action.propertyId,
  );
  if (!already) return true;
  return groupRequirement(located.group) === "optional";
}

function shouldSkipAddLine(
  action: ChatAction,
  batch: ChatAction[],
  lookup: CatalogLookup,
  incoming: QuoteDraft,
): boolean {
  const productId = action.productId?.trim();
  if (!productId) return false;
  if (!incoming.items.some((item) => item.productId === productId)) return false;
  const addCount = batch.filter(
    (item) => item.op === "add_line" && item.productId === productId,
  ).length;
  if (addCount !== 1) return false;
  return batch.some((item) => isAmendMutation(item, incoming, lookup));
}

function defaultChoiceIds(
  group: Parameters<typeof coerceChoiceIds>[0],
  property: Parameters<typeof coerceChoiceIds>[1],
  requested: string[] | undefined,
): ReturnType<typeof coerceChoiceIds> {
  if (requested?.length) {
    return coerceChoiceIds(group, property, requested);
  }
  if (property.choice?.length) {
    return { ok: true, choiceIds: [property.choice[0].id] };
  }
  return { ok: true, choiceIds: [] };
}

function upsertSelection(
  line: QuoteLine,
  groupId: string,
  propertyId: string,
  choiceIds: string[],
): QuoteLineSelection {
  const existing = line.selections.find((item) => item.propertyId === propertyId);
  if (existing) {
    existing.choiceIds = choiceIds;
    return existing;
  }
  const next: QuoteLineSelection = { groupId, propertyId, choiceIds };
  line.selections.push(next);
  return next;
}

function addLine(
  draft: QuoteDraft,
  action: ChatAction,
  lookup: CatalogLookup,
  session: ApplySession,
): ApplyWarning | null {
  const productId = action.productId?.trim();
  if (!productId) return { op: "add_line", message: "Ürün seçilmedi." };
  const product = lookup.products.get(productId);
  if (!product) return { op: "add_line", message: "Katalogda böyle bir ürün yok." };
  if (!product.models.length) {
    return { op: "add_line", message: `${product.name} için model tanımlı değil.` };
  }

  let model = action.modelId
    ? product.models.find((item) => item.id === action.modelId)
    : product.models[0];
  if (action.modelId && !model) {
    return { op: "add_line", message: "Bu modele ait kayıt yok." };
  }
  model = model ?? product.models[0];

  const quantity =
    typeof action.quantity === "number" && action.quantity >= 1
      ? Math.floor(action.quantity)
      : 1;

  const line: QuoteLine = {
    lineId: newLineId(),
    productId: product.id,
    modelId: model.id,
    quantity,
    selections: defaultLineSelections(product),
  };
  draft.items.push(line);
  session.addedLineIds.push(line.lineId);
  return null;
}

function removeLine(
  draft: QuoteDraft,
  action: ChatAction,
  lookup: CatalogLookup,
  session: ApplySession,
): ApplyWarning | null {
  const resolved = resolveLine(draft, action, lookup, session);
  if (!resolved.ok) return { op: "remove_line", message: resolved.reason };
  draft.items = draft.items.filter((item) => item.lineId !== resolved.line.lineId);
  return null;
}

function setModel(
  draft: QuoteDraft,
  action: ChatAction,
  lookup: CatalogLookup,
  session: ApplySession,
): ApplyWarning | null {
  const resolved = resolveLine(draft, action, lookup, session, true);
  if (!resolved.ok) return { op: "set_model", message: resolved.reason };
  const modelId = action.modelId?.trim();
  if (!modelId) return { op: "set_model", message: "Model seçilmedi." };
  const product = lookup.products.get(resolved.line.productId);
  if (!product) return { op: "set_model", message: "Ürün katalogda yok." };
  const model = product.models.find((item) => item.id === modelId);
  if (!model) {
    const names = product.models.map((item) => item.name).join(", ");
    return {
      op: "set_model",
      message: `${product.name} için geçerli modeller: ${names}.`,
    };
  }
  resolved.line.modelId = model.id;
  return null;
}

function setQuantity(
  draft: QuoteDraft,
  action: ChatAction,
  lookup: CatalogLookup,
  session: ApplySession,
): ApplyWarning | null {
  const resolved = resolveLine(draft, action, lookup, session, true);
  if (!resolved.ok) return { op: "set_quantity", message: resolved.reason };
  const quantity = action.quantity;
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 1) {
    return { op: "set_quantity", message: "Adet 1 veya daha büyük olmalı." };
  }
  resolved.line.quantity = Math.floor(quantity);
  return null;
}

function setCustomer(draft: QuoteDraft, action: ChatAction): ApplyWarning | null {
  const patch = action.customer;
  if (!patch) return { op: "set_customer", message: "Müşteri bilgisi yok." };
  const current = draft.quotedTo ?? {};
  draft.quotedTo = {
    ...current,
    ...(patch.institution !== undefined ? { institution: patch.institution } : {}),
    ...(patch.contactPerson !== undefined
      ? { contactPerson: patch.contactPerson }
      : {}),
    ...(patch.title !== undefined ? { title: patch.title } : {}),
  };
  return null;
}

function setChoice(
  draft: QuoteDraft,
  action: ChatAction,
  lookup: CatalogLookup,
  session: ApplySession,
): ApplyWarning | null {
  const propertyId = action.propertyId?.trim();
  if (!propertyId) return { op: "set_choice", message: "Özellik seçilmedi." };
  const located = lookup.properties.get(propertyId);
  if (!located) return { op: "set_choice", message: "Katalogda böyle bir özellik yok." };

  const resolved = resolveLine(
    draft,
    { ...action, productId: action.productId || located.product.id },
    lookup,
    session,
    true,
  );
  if (!resolved.ok) return { op: "set_choice", message: resolved.reason };
  if (resolved.line.productId !== located.product.id) {
    return { op: "set_choice", message: "Bu özellik seçili ürün satırına ait değil." };
  }

  const coerced = defaultChoiceIds(
    located.group,
    located.property,
    action.choiceIds,
  );
  if (!coerced.ok) return { op: "set_choice", message: coerced.reason };

  const state = groupRequirement(located.group);
  if (state === "required_one") {
    resolved.line.selections = resolved.line.selections.filter(
      (item) => item.groupId !== located.group.id,
    );
  }

  upsertSelection(
    resolved.line,
    located.group.id,
    located.property.id,
    coerced.choiceIds,
  );
  return null;
}

function setPrice(
  draft: QuoteDraft,
  action: ChatAction,
  lookup: CatalogLookup,
  session: ApplySession,
): ApplyWarning | null {
  const price = action.price;
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    return { op: "set_price", message: "Geçerli bir birim fiyat gerekli." };
  }

  const propertyId = action.propertyId?.trim();
  if (!propertyId) {
    const resolved = resolveLine(draft, action, lookup, session, true);
    if (!resolved.ok) return { op: "set_price", message: resolved.reason };
    resolved.line.basePriceOverride = price;
    return null;
  }

  const located = lookup.properties.get(propertyId);
  if (!located) return { op: "set_price", message: "Katalogda böyle bir özellik yok." };

  const resolved = resolveLine(
    draft,
    { ...action, productId: action.productId || located.product.id },
    lookup,
    session,
    true,
  );
  if (!resolved.ok) return { op: "set_price", message: resolved.reason };
  if (resolved.line.productId !== located.product.id) {
    return { op: "set_price", message: "Bu özellik seçili ürün satırına ait değil." };
  }

  const existing = resolved.line.selections.find(
    (item) => item.propertyId === located.property.id,
  );
  const coerced = defaultChoiceIds(
    located.group,
    located.property,
    action.choiceIds ?? existing?.choiceIds,
  );
  if (!coerced.ok) return { op: "set_price", message: coerced.reason };

  const row = upsertSelection(
    resolved.line,
    located.group.id,
    located.property.id,
    coerced.choiceIds,
  );
  row.priceOverride = price;
  return null;
}

function removeProperty(
  draft: QuoteDraft,
  action: ChatAction,
  lookup: CatalogLookup,
  session: ApplySession,
): ApplyWarning | null {
  const propertyId = action.propertyId?.trim();
  if (!propertyId) return { op: "remove_property", message: "Özellik seçilmedi." };
  const located = lookup.properties.get(propertyId);
  if (!located) {
    return { op: "remove_property", message: "Katalogda böyle bir özellik yok." };
  }

  const resolved = resolveLine(
    draft,
    { ...action, productId: action.productId || located.product.id },
    lookup,
    session,
  );
  if (!resolved.ok) return { op: "remove_property", message: resolved.reason };

  const selectedIds = resolved.line.selections
    .filter((item) => item.groupId === located.group.id)
    .map((item) => item.propertyId);
  const allowed = canRemoveProperty(located.group, located.property, selectedIds);
  if (!allowed.ok) return { op: "remove_property", message: allowed.reason };

  resolved.line.selections = resolved.line.selections.filter(
    (item) => item.propertyId !== located.property.id,
  );
  return null;
}

export function lineFingerprint(line: QuoteLine): string {
  const selections = [...line.selections]
    .sort((a, b) => a.propertyId.localeCompare(b.propertyId))
    .map((selection) => ({
      groupId: selection.groupId,
      propertyId: selection.propertyId,
      choiceIds: [...selection.choiceIds].sort(),
      priceOverride: selection.priceOverride ?? null,
    }));
  return JSON.stringify({
    productId: line.productId,
    modelId: line.modelId,
    basePriceOverride: line.basePriceOverride ?? null,
    selections,
  });
}

export function mergeIdenticalLines(draft: QuoteDraft): QuoteDraft {
  const merged = new Map<string, QuoteLine>();
  const order: string[] = [];
  for (const line of draft.items) {
    const key = lineFingerprint(line);
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += line.quantity;
      continue;
    }
    merged.set(key, line);
    order.push(key);
  }
  draft.items = order.map((key) => merged.get(key)!);
  return draft;
}

function hoistFirstAddLines(
  actions: ChatAction[],
  incoming: QuoteDraft,
  lookup: CatalogLookup,
): ChatAction[] {
  const firstAdd = new Map<string, ChatAction>();
  for (const action of actions) {
    if (action.op !== "add_line") continue;
    const productId = action.productId?.trim();
    if (!productId || firstAdd.has(productId)) continue;
    if (incoming.items.some((item) => item.productId === productId)) continue;
    firstAdd.set(productId, action);
  }
  if (!firstAdd.size) return actions;

  const used = new Set<ChatAction>();
  const next: ChatAction[] = [];

  const hoist = (productId: string | undefined) => {
    if (!productId) return;
    const action = firstAdd.get(productId);
    if (!action || used.has(action)) return;
    used.add(action);
    next.push(action);
  };

  for (const action of actions) {
    if (used.has(action)) continue;
    const productId = actionProductId(action, lookup);
    if (productId && firstAdd.has(productId) && action !== firstAdd.get(productId)) {
      hoist(productId);
    }
    if (firstAdd.get(action.productId?.trim() ?? "") === action) {
      hoist(action.productId?.trim());
      continue;
    }
    next.push(action);
  }
  return next;
}

export function applyActions(
  catalog: Catalog,
  draft: QuoteDraft,
  actions: ChatAction[],
  lookup = indexCatalog(catalog),
): ApplyResult {
  const next = cloneDraft(draft);
  const warnings: ApplyWarning[] = [];
  const session: ApplySession = { incoming: draft, addedLineIds: [] };
  const ordered = hoistFirstAddLines(actions, draft, lookup);

  for (const action of ordered) {
    let warning: ApplyWarning | null = null;
    switch (action.op) {
      case "add_line":
        if (shouldSkipAddLine(action, actions, lookup, session.incoming)) {
          break;
        }
        warning = addLine(next, action, lookup, session);
        break;
      case "remove_line":
        warning = removeLine(next, action, lookup, session);
        break;
      case "set_model":
        warning = setModel(next, action, lookup, session);
        break;
      case "set_choice":
        warning = setChoice(next, action, lookup, session);
        break;
      case "set_price":
        warning = setPrice(next, action, lookup, session);
        break;
      case "remove_property":
        warning = removeProperty(next, action, lookup, session);
        break;
      case "set_quantity":
        warning = setQuantity(next, action, lookup, session);
        break;
      case "set_customer":
        warning = setCustomer(next, action);
        break;
      default:
        warning = { op: "add_line", message: "Bilinmeyen işlem." };
    }
    if (warning) warnings.push(warning);
  }

  mergeIdenticalLines(next);
  return { draft: next, warnings };
}

export function labeledDraft(catalog: Catalog, draft: QuoteDraft): string {
  const customer = draft.quotedTo;
  const customerLine = customer
    ? `Müşteri: ${[customer.institution, customer.title, customer.contactPerson]
        .filter(Boolean)
        .join(" · ") || "(boş)"}`
    : "Müşteri: (yok)";
  if (!draft.items.length) {
    return `${customerLine}\n(boş teklif)`;
  }
  const lines = draft.items.map((line, index) => {
    const product = catalog.find((item) => item.id === line.productId);
    const model = product?.models.find((item) => item.id === line.modelId);
    const selections = line.selections.map((selection) => {
      const group = product?.propertyGroups.find((item) => item.id === selection.groupId);
      const property = group?.properties.find((item) => item.id === selection.propertyId);
      const values = selection.choiceIds.length
        ? selection.choiceIds
            .map((id) => property?.choice?.find((choice) => choice.id === id)?.name ?? id)
            .join(", ")
        : "seçildi";
      const override =
        typeof selection.priceOverride === "number"
          ? ` fiyat=${selection.priceOverride}`
          : "";
      return `    - ${property?.name ?? "özellik"}: ${values}${override}`;
    });
    const base =
      typeof line.basePriceOverride === "number"
        ? ` taban=${line.basePriceOverride}`
        : "";
    return [
      `- S${index + 1}: ${product?.name ?? "ürün"} / ${model?.name ?? "model"} x${line.quantity}${base}`,
      ...selections,
    ].join("\n");
  });
  return [customerLine, "Mevcut teklif:", ...lines].join("\n");
}
