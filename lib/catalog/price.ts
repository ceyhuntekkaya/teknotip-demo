import { initGroupPreview } from "./rules";
import type { Catalog, GroupPreview, PreviewState } from "./types";

export { initGroupPreview };

export function formatTry(value: number): string {
  const rounded = Math.round(value);
  const grouped = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = rounded < 0 ? "-" : "";
  return `${sign}${grouped} ₺`;
}

export function formatAddOn(value: number | undefined): string | null {
  if (value === undefined) return null;
  const grouped = String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `+${grouped} ₺`;
}

export function initPreview(
  catalog: Catalog,
  productIndex = 0,
  modelIndex = 0,
): PreviewState {
  const product = catalog[productIndex];
  return {
    productIndex,
    modelIndex: product?.models.length
      ? Math.min(modelIndex, product.models.length - 1)
      : 0,
    groups: product?.propertyGroups.map(initGroupPreview) ?? [],
  };
}

export function alignPreview(catalog: Catalog, preview: PreviewState): PreviewState {
  if (!catalog.length) {
    return { productIndex: 0, modelIndex: 0, groups: [] };
  }
  const productIndex = Math.min(preview.productIndex, catalog.length - 1);
  const product = catalog[productIndex];
  const modelIndex = product.models.length
    ? Math.min(preview.modelIndex, product.models.length - 1)
    : 0;

  if (productIndex !== preview.productIndex) {
    return initPreview(catalog, productIndex, modelIndex);
  }

  const groups = product.propertyGroups.map((group, groupIndex) => {
    const previous = preview.groups[groupIndex];
    if (!previous) return initGroupPreview(group);
    const selected = previous.selected.filter((index) => index < group.properties.length);
    const choices: Record<number, number[]> = {};
    for (const [key, value] of Object.entries(previous.choices)) {
      const index = Number(key);
      const property = group.properties[index];
      if (!property?.choice?.length) continue;
      const list = property.choice;
      const asArray = Array.isArray(value) ? value : [value];
      const next = asArray.filter(
        (choiceIndex) =>
          typeof choiceIndex === "number" &&
          choiceIndex >= 0 &&
          choiceIndex < list.length,
      );
      choices[index] = next.length ? next : [0];
    }
    return { selected, choices };
  });

  return { productIndex, modelIndex, groups };
}

export function previewTotal(catalog: Catalog, preview: PreviewState): {
  base: number;
  extras: number;
  total: number;
} {
  const product = catalog[preview.productIndex];
  const model = product?.models[preview.modelIndex];
  const base = model?.price ?? 0;
  if (!product) return { base: 0, extras: 0, total: 0 };

  let extras = 0;
  product.propertyGroups.forEach((group, groupIndex) => {
    const groupPreview = preview.groups[groupIndex];
    if (!groupPreview) return;
    for (const propertyIndex of groupPreview.selected) {
      const property = group.properties[propertyIndex];
      if (!property) continue;
      if (property.choice?.length) {
        const choiceIndexes = groupPreview.choices[propertyIndex] ?? [0];
        for (const choiceIndex of choiceIndexes) {
          extras += property.choice[choiceIndex]?.price ?? 0;
        }
      } else {
        extras += property.price ?? 0;
      }
    }
  });

  return { base, extras, total: base + extras };
}

export function isPropertySelected(preview: GroupPreview, index: number): boolean {
  return preview.selected.includes(index);
}
