import { normalizeGroupState, normalizeGroupType } from "./normalize";
import type {
  GroupPreview,
  GroupState,
  Product,
  Property,
  PropertyGroup,
} from "./types";

export function groupRequirement(group: PropertyGroup): GroupState {
  return normalizeGroupState(group.state);
}

export function allowsMultipleChoices(group: PropertyGroup): boolean {
  return normalizeGroupType(group.type) === "multiple_choice";
}

export function isPropertyRequiredInGroup(
  group: PropertyGroup,
  property: Property,
): boolean {
  const state = groupRequirement(group);
  if (state === "required") return true;
  if (state === "optional") return property.state === "required";
  return false;
}

export function initGroupPreview(group: PropertyGroup): GroupPreview {
  const state = groupRequirement(group);

  if (state === "required") {
    const choices: Record<number, number[]> = {};
    group.properties.forEach((property, index) => {
      if (property.choice?.length) choices[index] = [0];
    });
    return {
      selected: group.properties.map((_, index) => index),
      choices,
    };
  }

  if (state === "required_one" || state === "required_multiple") {
    if (!group.properties.length) return { selected: [], choices: {} };
    const choices: Record<number, number[]> = {};
    if (group.properties[0].choice?.length) choices[0] = [0];
    return { selected: [0], choices };
  }

  const selected: number[] = [];
  const choices: Record<number, number[]> = {};
  group.properties.forEach((property, index) => {
    if (property.state === "required") {
      selected.push(index);
      if (property.choice?.length) choices[index] = [0];
    }
  });
  return { selected, choices };
}

export function isPropertyLocked(
  group: PropertyGroup,
  propertyIndex: number,
  selected: number[],
): boolean {
  const state = groupRequirement(group);
  if (state === "required") return true;
  if (state === "optional") {
    return group.properties[propertyIndex]?.state === "required";
  }
  if (state === "required_multiple") {
    return selected.length === 1 && selected[0] === propertyIndex;
  }
  if (state === "required_one") {
    return selected.length === 1 && selected[0] === propertyIndex;
  }
  return false;
}

export type CatalogLookup = {
  products: Map<string, Product>;
  models: Map<string, { product: Product; modelIndex: number }>;
  groups: Map<string, { product: Product; group: PropertyGroup }>;
  properties: Map<
    string,
    { product: Product; group: PropertyGroup; property: Property }
  >;
  choices: Map<
    string,
    {
      product: Product;
      group: PropertyGroup;
      property: Property;
      choiceId: string;
    }
  >;
};

export function indexCatalog(products: Product[]): CatalogLookup {
  const lookup: CatalogLookup = {
    products: new Map(),
    models: new Map(),
    groups: new Map(),
    properties: new Map(),
    choices: new Map(),
  };

  for (const product of products) {
    lookup.products.set(product.id, product);
    product.models.forEach((model, modelIndex) => {
      lookup.models.set(model.id, { product, modelIndex });
    });
    for (const group of product.propertyGroups) {
      lookup.groups.set(group.id, { product, group });
      for (const property of group.properties) {
        lookup.properties.set(property.id, { product, group, property });
        for (const choice of property.choice ?? []) {
          lookup.choices.set(choice.id, {
            product,
            group,
            property,
            choiceId: choice.id,
          });
        }
      }
    }
  }

  return lookup;
}

export type QuoteSelectionLike = {
  groupId: string;
  propertyId: string;
  choiceIds: string[];
};

export function defaultLineSelections(product: Product): QuoteSelectionLike[] {
  const selections: QuoteSelectionLike[] = [];
  product.propertyGroups.forEach((group) => {
    const preview = initGroupPreview(group);
    for (const propertyIndex of preview.selected) {
      const property = group.properties[propertyIndex];
      if (!property) continue;
      const choiceIndexes = preview.choices[propertyIndex] ?? [];
      selections.push({
        groupId: group.id,
        propertyId: property.id,
        choiceIds: choiceIndexes
          .map((index) => property.choice?.[index]?.id)
          .filter((id): id is string => Boolean(id)),
      });
    }
  });
  return selections;
}

export type MissingSlot = {
  productId: string;
  groupId: string;
  propertyId?: string;
  label: string;
  options: string[];
};

export function missingSlots(
  product: Product,
  selections: QuoteSelectionLike[],
): MissingSlot[] {
  const missing: MissingSlot[] = [];
  const selectedByGroup = new Map<string, QuoteSelectionLike[]>();
  for (const selection of selections) {
    const list = selectedByGroup.get(selection.groupId) ?? [];
    list.push(selection);
    selectedByGroup.set(selection.groupId, list);
  }

  for (const group of product.propertyGroups) {
    const state = groupRequirement(group);
    const selected = selectedByGroup.get(group.id) ?? [];
    const selectedIds = new Set(selected.map((item) => item.propertyId));

    if (state === "required") {
      for (const property of group.properties) {
        if (!selectedIds.has(property.id)) {
          missing.push(slotForProperty(product, group, property));
          continue;
        }
        const row = selected.find((item) => item.propertyId === property.id);
        if (property.choice?.length && !row?.choiceIds.length) {
          missing.push(slotForProperty(product, group, property));
        }
      }
    } else if (state === "required_one") {
      if (selected.length !== 1) {
        missing.push({
          productId: product.id,
          groupId: group.id,
          label: `${product.name} · ${group.name} (bir özellik seçin)`,
          options: group.properties.map((property) => property.name),
        });
      } else {
        pushChoiceGap(product, group, selected[0], missing);
      }
    } else if (state === "required_multiple") {
      if (selected.length < 1) {
        missing.push({
          productId: product.id,
          groupId: group.id,
          label: `${product.name} · ${group.name} (en az bir özellik)`,
          options: group.properties.map((property) => property.name),
        });
      } else {
        for (const row of selected) {
          pushChoiceGap(product, group, row, missing);
        }
      }
    } else {
      for (const property of group.properties) {
        const row = selected.find((item) => item.propertyId === property.id);
        if (property.state === "required" && !row) {
          missing.push(slotForProperty(product, group, property));
          continue;
        }
        if (row) pushChoiceGap(product, group, row, missing);
      }
    }
  }

  return missing;
}

function slotForProperty(
  product: Product,
  group: PropertyGroup,
  property: Property,
): MissingSlot {
  return {
    productId: product.id,
    groupId: group.id,
    propertyId: property.id,
    label: `${product.name} · ${group.name} · ${property.name}`,
    options: (property.choice ?? []).map((choice) => choice.name),
  };
}

function pushChoiceGap(
  product: Product,
  group: PropertyGroup,
  row: QuoteSelectionLike,
  missing: MissingSlot[],
) {
  const property = group.properties.find((item) => item.id === row.propertyId);
  if (property?.choice?.length && !row.choiceIds.length) {
    missing.push(slotForProperty(product, group, property));
  }
}

export function canRemoveProperty(
  group: PropertyGroup,
  property: Property,
  selectedPropertyIds: string[],
): { ok: true } | { ok: false; reason: string } {
  if (isPropertyRequiredInGroup(group, property)) {
    return { ok: false, reason: `${property.name} zorunlu, kaldırılamaz.` };
  }
  const state = groupRequirement(group);
  const remaining = selectedPropertyIds.filter((id) => id !== property.id);
  if (
    (state === "required_one" || state === "required_multiple") &&
    remaining.length < 1 &&
    selectedPropertyIds.includes(property.id)
  ) {
    return {
      ok: false,
      reason: `${group.name} grubunda en az bir özellik kalmalı.`,
    };
  }
  return { ok: true };
}

export function coerceChoiceIds(
  group: PropertyGroup,
  property: Property,
  choiceIds: string[],
): { ok: true; choiceIds: string[] } | { ok: false; reason: string } {
  if (!property.choice?.length) {
    return { ok: true, choiceIds: [] };
  }
  const allowed = new Set(property.choice.map((choice) => choice.id));
  const next = [...new Set(choiceIds.filter((id) => allowed.has(id)))];
  if (!next.length) {
    const labels = property.choice.map((choice) => choice.name).join(", ");
    return {
      ok: false,
      reason: `${property.name} için geçerli seçenek: ${labels}.`,
    };
  }
  if (!allowsMultipleChoices(group) && next.length > 1) {
    return { ok: true, choiceIds: [next[0]] };
  }
  return { ok: true, choiceIds: next };
}
