import type { Catalog, Product } from "./types";

export type IdPrefix = "p" | "m" | "g" | "pr" | "c";

const TR_MAP: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  I: "i",
  İ: "i",
  i: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
};

export function slugify(name: string): string {
  const mapped = name.replace(/[çÇğĞıIİiöÖşŞüÜ]/g, (ch) => TR_MAP[ch] ?? ch);
  return mapped
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function allocateId(base: string, used: Set<string>): string {
  const root = base.replace(/_+$/g, "") || "item";
  if (!used.has(root)) {
    used.add(root);
    return root;
  }
  let n = 2;
  let next = `${root}_${n}`;
  while (used.has(next)) {
    n += 1;
    next = `${root}_${n}`;
  }
  used.add(next);
  return next;
}

export function makeNodeId(
  prefix: IdPrefix,
  name: string,
  parentId: string | null,
  used: Set<string>,
): string {
  const slug = slugify(name) || "item";
  const base = parentId ? `${prefix}_${parentId}_${slug}` : `${prefix}_${slug}`;
  return allocateId(base, used);
}

export function takeId(
  existing: string | undefined,
  prefix: IdPrefix,
  name: string,
  parentId: string | null,
  used: Set<string>,
): string {
  const trimmed = existing?.trim() ?? "";
  if (trimmed) {
    if (!used.has(trimmed)) {
      used.add(trimmed);
      return trimmed;
    }
    return allocateId(trimmed, used);
  }
  return makeNodeId(prefix, name, parentId, used);
}

export function collectIds(catalog: Catalog): Set<string> {
  const used = new Set<string>();
  for (const product of catalog) {
    if (product.id) used.add(product.id);
    for (const model of product.models) {
      if (model.id) used.add(model.id);
    }
    for (const group of product.propertyGroups) {
      if (group.id) used.add(group.id);
      for (const property of group.properties) {
        if (property.id) used.add(property.id);
        for (const choice of property.choice ?? []) {
          if (choice.id) used.add(choice.id);
        }
      }
    }
  }
  return used;
}

export function ensureCatalogIds(catalog: Catalog): Catalog {
  const used = new Set<string>();
  return catalog.map((product) => ensureProductIds(product, used));
}

function ensureProductIds(product: Product, used: Set<string>): Product {
  const id = takeId(product.id, "p", product.name, null, used);
  return {
    ...product,
    id,
    models: product.models.map((model) => ({
      ...model,
      id: takeId(model.id, "m", model.name, id, used),
    })),
    propertyGroups: product.propertyGroups.map((group) => {
      const groupId = takeId(group.id, "g", group.name, id, used);
      return {
        ...group,
        id: groupId,
        properties: group.properties.map((property) => {
          const propertyId = takeId(property.id, "pr", property.name, groupId, used);
          return {
            ...property,
            id: propertyId,
            choice: property.choice?.map((choice) => ({
              ...choice,
              id: takeId(choice.id, "c", choice.name, propertyId, used),
            })),
          };
        }),
      };
    }),
  };
}

export function newLineId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `ln_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function newQuoteNumber(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `T-${y}${m}${d}-${suffix}`;
}
