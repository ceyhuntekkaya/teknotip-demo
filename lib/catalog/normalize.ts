import { ensureCatalogIds } from "./ids";
import type {
  Catalog,
  Choice,
  GroupState,
  GroupType,
  Product,
  ProductModel,
  Property,
  PropertyGroup,
  PropertyState,
} from "./types";
import { GROUP_STATES, GROUP_TYPES, PROPERTY_STATES } from "./types";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalPrice(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalId(value: unknown): string | undefined {
  const trimmed = asString(value).trim();
  return trimmed || undefined;
}

export function normalizeGroupState(raw: unknown): GroupState {
  const trimmed = asString(raw).trim();
  if (trimmed === "optional" || trimmed === "non-required" || trimmed === "non_required") {
    return "optional";
  }
  if (
    trimmed === "required_one" ||
    trimmed === "required-one" ||
    trimmed === "required one"
  ) {
    return "required_one";
  }
  if (
    trimmed === "required_multiple" ||
    trimmed === "required-multiple" ||
    trimmed === "required multiple"
  ) {
    return "required_multiple";
  }
  if ((GROUP_STATES as readonly string[]).includes(trimmed)) {
    return trimmed as GroupState;
  }
  return "required";
}

export function normalizeGroupType(raw: unknown): GroupType {
  const trimmed = asString(raw).trim();
  if (trimmed === "single_choice" || trimmed === "single-choice") {
    return "single_choice";
  }
  if (
    trimmed === "multiple_choice" ||
    trimmed === "non-single_choice" ||
    trimmed === "non_single_choice"
  ) {
    return "multiple_choice";
  }
  if ((GROUP_TYPES as readonly string[]).includes(trimmed)) {
    return trimmed as GroupType;
  }
  return "single_choice";
}

export function normalizePropertyState(
  raw: unknown,
): PropertyState | undefined {
  const trimmed = asString(raw).trim();
  if (trimmed === "optional" || trimmed === "non-required" || trimmed === "non_required") {
    return "optional";
  }
  if ((PROPERTY_STATES as readonly string[]).includes(trimmed)) {
    return trimmed as PropertyState;
  }
  return undefined;
}

function normalizeChoice(raw: unknown): Choice {
  const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const choice: Choice = {
    id: asString(item.id),
    name: asString(item.name, "Seçenek"),
  };
  const price = optionalPrice(item.price);
  if (price !== undefined) choice.price = price;
  return choice;
}

function normalizeProperty(raw: unknown): Property {
  const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const property: Property = {
    id: asString(item.id),
    name: asString(item.name, "Özellik"),
  };
  const price = optionalPrice(item.price);
  const state = normalizePropertyState(item.state);
  if (state) property.state = state;

  if (Array.isArray(item.choice) && item.choice.length > 0) {
    property.choice = item.choice.map(normalizeChoice);
  } else if (price !== undefined) {
    property.price = price;
  }

  return property;
}

function normalizeGroup(raw: unknown): PropertyGroup {
  const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    id: asString(item.id),
    name: asString(item.name, "Grup"),
    state: normalizeGroupState(item.state),
    type: normalizeGroupType(item.type),
    properties: Array.isArray(item.properties)
      ? item.properties.map(normalizeProperty)
      : [],
  };
}

function optionalCode(value: unknown): string | undefined {
  const trimmed = asString(value).trim();
  return trimmed || undefined;
}

function optionalAliases(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const aliases = value
    .map((item) => asString(item).trim())
    .filter(Boolean);
  return aliases.length ? aliases : undefined;
}

function normalizeModel(raw: unknown): ProductModel {
  const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const model: ProductModel = {
    id: asString(item.id),
    name: asString(item.name, "Model"),
    price: asNumber(item.price, 0),
    description: asString(item.description),
    image: asString(item.image),
    category: asString(item.category),
  };
  const code = optionalCode(item.code);
  if (code) model.code = code;
  return model;
}

function readGroups(item: Record<string, unknown>): unknown[] {
  if (Array.isArray(item.propertyGroups)) return item.propertyGroups;
  if (Array.isArray(item.propertieGroups)) return item.propertieGroups;
  return [];
}

function normalizeProduct(raw: unknown): Product {
  const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const product: Product = {
    id: optionalId(item.id) ?? "",
    name: asString(item.name, "Ürün"),
    models: Array.isArray(item.models) ? item.models.map(normalizeModel) : [],
    propertyGroups: readGroups(item).map(normalizeGroup),
  };
  const code = optionalCode(item.code);
  if (code) product.code = code;
  const aliases = optionalAliases(item.aliases);
  if (aliases) product.aliases = aliases;
  return product;
}

export function normalizeCatalog(raw: unknown): Catalog {
  if (!Array.isArray(raw)) return [];
  return ensureCatalogIds(raw.map(normalizeProduct));
}

export function stringifyCatalog(catalog: Catalog): string {
  return `${JSON.stringify(catalog, null, 4)}\n`;
}

export function parseCatalog(
  text: string,
): { ok: true; catalog: Catalog } | { ok: false; error: string } {
  try {
    const data = JSON.parse(text) as unknown;
    if (!Array.isArray(data)) {
      return { ok: false, error: "Kök bir dizi olmalı." };
    }
    return { ok: true, catalog: normalizeCatalog(data) };
  } catch (error) {
    const message =
      error instanceof SyntaxError ? error.message : "Geçersiz JSON";
    return { ok: false, error: message };
  }
}
