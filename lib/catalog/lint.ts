import type { GroupState, GroupType, PropertyState } from "./types";
import { GROUP_STATES, GROUP_TYPES, PROPERTY_STATES } from "./types";
import type { Catalog } from "./types";

export type CatalogWarning = {
  code: string;
  path: string;
  message: string;
};

const GROUP_STATE_ALIASES = new Set([
  ...GROUP_STATES,
  "non-required",
  "non_required",
  "required-one",
  "required one",
  "required-multiple",
  "required multiple",
]);

const GROUP_TYPE_ALIASES = new Set([
  ...GROUP_TYPES,
  "single-choice",
  "non-single_choice",
  "non_single_choice",
]);

const PROPERTY_STATE_ALIASES = new Set([
  ...PROPERTY_STATES,
  "non-required",
  "non_required",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readGroups(item: Record<string, unknown>): unknown[] {
  if (Array.isArray(item.propertyGroups)) return item.propertyGroups;
  if (Array.isArray(item.propertieGroups)) return item.propertieGroups;
  return [];
}

export function lintCatalogRaw(raw: unknown): CatalogWarning[] {
  const warnings: CatalogWarning[] = [];
  if (!Array.isArray(raw)) {
    warnings.push({
      code: "root_not_array",
      path: "/",
      message: "Kök bir dizi olmalı.",
    });
    return warnings;
  }

  raw.forEach((productRaw, p) => {
    const product = asRecord(productRaw);
    if (!product) return;
    const name = typeof product.name === "string" ? product.name : `ürün[${p}]`;

    const groups = readGroups(product);
    groups.forEach((groupRaw, g) => {
      const group = asRecord(groupRaw);
      if (!group) return;
      const groupName = typeof group.name === "string" ? group.name : `grup[${g}]`;
      const state = typeof group.state === "string" ? group.state.trim() : "";
      if (state && !GROUP_STATE_ALIASES.has(state as GroupState)) {
        warnings.push({
          code: "unknown_group_state",
          path: `${name}/${groupName}`,
          message: `Sözlük dışı grup state: ${state}`,
        });
      }
      const type = typeof group.type === "string" ? group.type.trim() : "";
      if (type && !GROUP_TYPE_ALIASES.has(type as GroupType)) {
        warnings.push({
          code: "unknown_group_type",
          path: `${name}/${groupName}`,
          message: `Sözlük dışı grup type: ${type}`,
        });
      }
      const properties = Array.isArray(group.properties) ? group.properties : [];
      properties.forEach((propertyRaw, pr) => {
        const property = asRecord(propertyRaw);
        if (!property) return;
        const propertyName =
          typeof property.name === "string" ? property.name : `özellik[${pr}]`;
        const pState =
          typeof property.state === "string" ? property.state.trim() : "";
        if (pState && !PROPERTY_STATE_ALIASES.has(pState as PropertyState)) {
          warnings.push({
            code: "unknown_property_state",
            path: `${name}/${groupName}/${propertyName}`,
            message: `Sözlük dışı özellik state: ${pState}`,
          });
        }
      });
    });
  });

  return warnings;
}

function foldKey(value: string): string {
  return value.trim().toLocaleLowerCase("tr");
}

export function lintCatalog(catalog: Catalog): CatalogWarning[] {
  const warnings: CatalogWarning[] = [];
  const names = new Map<string, string>();
  const codes = new Map<string, string>();

  for (const product of catalog) {
    const nameKey = foldKey(product.name);
    const existingName = names.get(nameKey);
    if (existingName) {
      warnings.push({
        code: "duplicate_product_name",
        path: product.name,
        message: `Aynı ürün adı birden fazla: ${product.name} / ${existingName}`,
      });
    } else {
      names.set(nameKey, product.name);
    }

    if (product.code?.trim()) {
      const codeKey = foldKey(product.code.replace(/[\s-]+/g, ""));
      const existingCode = codes.get(codeKey);
      if (existingCode) {
        warnings.push({
          code: "duplicate_product_code",
          path: product.code,
          message: `Aynı ürün kodu birden fazla: ${product.code} / ${existingCode}`,
        });
      } else {
        codes.set(codeKey, product.code);
      }
    }

    if (!product.models.length) {
      warnings.push({
        code: "product_without_models",
        path: product.name,
        message: `${product.name} için model yok.`,
      });
    }

    for (const group of product.propertyGroups) {
      for (const property of group.properties) {
        if (property.choice?.length) {
          const seen = new Map<string, string>();
          for (const choice of property.choice) {
            const key = foldKey(choice.name);
            const prev = seen.get(key);
            if (prev) {
              warnings.push({
                code: "duplicate_choice_name",
                path: `${product.name}/${property.name}`,
                message: `${property.name} içinde aynı seçenek: ${choice.name}`,
              });
            } else {
              seen.set(key, choice.name);
            }
          }
        }
      }
    }
  }

  return warnings;
}

export function lintCatalogInput(raw: unknown, catalog: Catalog): CatalogWarning[] {
  return [...lintCatalogRaw(raw), ...lintCatalog(catalog)];
}
