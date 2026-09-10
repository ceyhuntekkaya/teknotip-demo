import { emptyChoice, emptyGroup, emptyModel, emptyProduct, emptyProperty } from "./defaults";
import { collectIds } from "./ids";
import type { Catalog, CatalogPath, Choice, Product, Property } from "./types";

export function cloneCatalog(catalog: Catalog): Catalog {
  return structuredClone(catalog);
}

export function pathsEqual(a: CatalogPath | null, b: CatalogPath | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind || a.p !== b.p) return false;
  switch (a.kind) {
    case "product":
      return true;
    case "model":
      return b.kind === "model" && a.m === b.m;
    case "group":
      return b.kind === "group" && a.g === b.g;
    case "property":
      return b.kind === "property" && a.g === b.g && a.pr === b.pr;
    case "choice":
      return b.kind === "choice" && a.g === b.g && a.pr === b.pr && a.c === b.c;
  }
}

export function pathTouches(
  selection: CatalogPath | null,
  candidate: CatalogPath,
): boolean {
  if (!selection || selection.p !== candidate.p) return false;
  if (candidate.kind === "product") return true;
  if (selection.kind === "product") return false;
  if (candidate.kind === "model") {
    return selection.kind === "model" && selection.m === candidate.m;
  }
  if (!("g" in selection) || selection.g !== candidate.g) return false;
  if (candidate.kind === "group") return true;
  if (selection.kind === "group") return false;
  if (selection.pr !== candidate.pr) return false;
  if (candidate.kind === "property") return true;
  return selection.kind === "choice" && candidate.kind === "choice" && selection.c === candidate.c;
}

export function parentPath(path: CatalogPath): CatalogPath | null {
  switch (path.kind) {
    case "product":
      return null;
    case "model":
    case "group":
      return { kind: "product", p: path.p };
    case "property":
      return { kind: "group", p: path.p, g: path.g };
    case "choice":
      return { kind: "property", p: path.p, g: path.g, pr: path.pr };
  }
}

export function clampPath(catalog: Catalog, path: CatalogPath | null): CatalogPath | null {
  if (!path) return catalog.length ? { kind: "product", p: 0 } : null;
  if (path.p < 0 || path.p >= catalog.length) {
    return catalog.length ? { kind: "product", p: 0 } : null;
  }
  const product = catalog[path.p];
  if (path.kind === "product") return path;
  if (path.kind === "model") {
    if (path.m < 0 || path.m >= product.models.length) {
      return { kind: "product", p: path.p };
    }
    return path;
  }
  if (path.g < 0 || path.g >= product.propertyGroups.length) {
    return { kind: "product", p: path.p };
  }
  if (path.kind === "group") return path;
  const group = product.propertyGroups[path.g];
  if (path.pr < 0 || path.pr >= group.properties.length) {
    return { kind: "group", p: path.p, g: path.g };
  }
  if (path.kind === "property") return path;
  const choices = group.properties[path.pr].choice ?? [];
  if (path.c < 0 || path.c >= choices.length) {
    return { kind: "property", p: path.p, g: path.g, pr: path.pr };
  }
  return path;
}

function moveItem<T>(items: T[], from: number, dir: -1 | 1): boolean {
  const to = from + dir;
  if (to < 0 || to >= items.length) return false;
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);
  return true;
}

export function canMove(catalog: Catalog, path: CatalogPath, dir: -1 | 1): boolean {
  const product = catalog[path.p];
  if (!product) return false;
  switch (path.kind) {
    case "product":
      return path.p + dir >= 0 && path.p + dir < catalog.length;
    case "model":
      return path.m + dir >= 0 && path.m + dir < product.models.length;
    case "group":
      return path.g + dir >= 0 && path.g + dir < product.propertyGroups.length;
    case "property": {
      const group = product.propertyGroups[path.g];
      return Boolean(group && path.pr + dir >= 0 && path.pr + dir < group.properties.length);
    }
    case "choice": {
      const choices = product.propertyGroups[path.g]?.properties[path.pr]?.choice;
      return Boolean(choices && path.c + dir >= 0 && path.c + dir < choices.length);
    }
  }
}

export function updateProduct(
  catalog: Catalog,
  p: number,
  patch: Partial<Pick<Product, "name">>,
): Catalog {
  const next = cloneCatalog(catalog);
  next[p] = { ...next[p], ...patch };
  return next;
}

export function updateModel(
  catalog: Catalog,
  p: number,
  m: number,
  patch: Partial<Catalog[number]["models"][number]>,
): Catalog {
  const next = cloneCatalog(catalog);
  next[p].models[m] = { ...next[p].models[m], ...patch };
  return next;
}

export function updateGroup(
  catalog: Catalog,
  p: number,
  g: number,
  patch: Partial<Catalog[number]["propertyGroups"][number]>,
): Catalog {
  const next = cloneCatalog(catalog);
  next[p].propertyGroups[g] = { ...next[p].propertyGroups[g], ...patch };
  return next;
}

export function updateProperty(
  catalog: Catalog,
  p: number,
  g: number,
  pr: number,
  patch: Partial<Property>,
): Catalog {
  const next = cloneCatalog(catalog);
  const current = next[p].propertyGroups[g].properties[pr];
  const updated: Property = { ...current, ...patch };
  if (patch.state === undefined && "state" in patch) {
    delete updated.state;
  }
  if (patch.price === undefined && "price" in patch) {
    delete updated.price;
  }
  if (patch.choice === undefined && "choice" in patch) {
    delete updated.choice;
  }
  next[p].propertyGroups[g].properties[pr] = updated;
  return next;
}

export function updateChoice(
  catalog: Catalog,
  p: number,
  g: number,
  pr: number,
  c: number,
  patch: Partial<Choice>,
): Catalog {
  const next = cloneCatalog(catalog);
  const choices = next[p].propertyGroups[g].properties[pr].choice;
  if (!choices) return catalog;
  const current = choices[c];
  const updated: Choice = { ...current, ...patch };
  if (patch.price === undefined && "price" in patch) {
    delete updated.price;
  }
  choices[c] = updated;
  return next;
}

export function insertProduct(catalog: Catalog): { catalog: Catalog; path: CatalogPath } {
  const next = cloneCatalog(catalog);
  next.push(emptyProduct(collectIds(next)));
  return { catalog: next, path: { kind: "product", p: next.length - 1 } };
}

export function insertModel(
  catalog: Catalog,
  p: number,
): { catalog: Catalog; path: CatalogPath } {
  const next = cloneCatalog(catalog);
  const used = collectIds(next);
  next[p].models.push(emptyModel(used, next[p].id));
  return {
    catalog: next,
    path: { kind: "model", p, m: next[p].models.length - 1 },
  };
}

export function insertGroup(
  catalog: Catalog,
  p: number,
): { catalog: Catalog; path: CatalogPath } {
  const next = cloneCatalog(catalog);
  const used = collectIds(next);
  next[p].propertyGroups.push(emptyGroup(used, next[p].id));
  return {
    catalog: next,
    path: { kind: "group", p, g: next[p].propertyGroups.length - 1 },
  };
}

export function insertProperty(
  catalog: Catalog,
  p: number,
  g: number,
): { catalog: Catalog; path: CatalogPath } {
  const next = cloneCatalog(catalog);
  const used = collectIds(next);
  const group = next[p].propertyGroups[g];
  group.properties.push(emptyProperty(used, group.id));
  return {
    catalog: next,
    path: {
      kind: "property",
      p,
      g,
      pr: group.properties.length - 1,
    },
  };
}

export function insertChoice(
  catalog: Catalog,
  p: number,
  g: number,
  pr: number,
): { catalog: Catalog; path: CatalogPath } {
  const next = cloneCatalog(catalog);
  const used = collectIds(next);
  const property = next[p].propertyGroups[g].properties[pr];
  if (!property.choice) {
    const first = emptyChoice(used, property.id);
    if (property.price !== undefined) {
      first.price = property.price;
      delete property.price;
    }
    property.choice = [first];
  } else {
    property.choice.push(emptyChoice(used, property.id));
  }
  return {
    catalog: next,
    path: { kind: "choice", p, g, pr, c: property.choice.length - 1 },
  };
}

export function enableChoices(
  catalog: Catalog,
  p: number,
  g: number,
  pr: number,
): Catalog {
  const next = cloneCatalog(catalog);
  const property = next[p].propertyGroups[g].properties[pr];
  if (property.choice?.length) return next;
  const first = emptyChoice(collectIds(next), property.id);
  if (property.price !== undefined) {
    first.price = property.price;
    delete property.price;
  }
  property.choice = [first];
  return next;
}

export function disableChoices(
  catalog: Catalog,
  p: number,
  g: number,
  pr: number,
): Catalog {
  const next = cloneCatalog(catalog);
  const property = next[p].propertyGroups[g].properties[pr];
  if (!property.choice?.length) {
    delete property.choice;
    return next;
  }
  const priced = property.choice.find((choice) => choice.price !== undefined);
  if (priced?.price !== undefined) property.price = priced.price;
  delete property.choice;
  return next;
}

export function removeAt(
  catalog: Catalog,
  path: CatalogPath,
): { catalog: Catalog; path: CatalogPath | null } {
  const next = cloneCatalog(catalog);
  const parent = parentPath(path);

  switch (path.kind) {
    case "product":
      next.splice(path.p, 1);
      if (!next.length) return { catalog: next, path: null };
      return {
        catalog: next,
        path: { kind: "product", p: Math.min(path.p, next.length - 1) },
      };
    case "model":
      next[path.p].models.splice(path.m, 1);
      return { catalog: next, path: parent };
    case "group":
      next[path.p].propertyGroups.splice(path.g, 1);
      return { catalog: next, path: parent };
    case "property":
      next[path.p].propertyGroups[path.g].properties.splice(path.pr, 1);
      return { catalog: next, path: parent };
    case "choice": {
      const property = next[path.p].propertyGroups[path.g].properties[path.pr];
      property.choice?.splice(path.c, 1);
      if (!property.choice?.length) {
        delete property.choice;
        return { catalog: next, path: parent };
      }
      return { catalog: next, path: parent };
    }
  }
}

export function moveAt(
  catalog: Catalog,
  path: CatalogPath,
  dir: -1 | 1,
): { catalog: Catalog; path: CatalogPath } {
  if (!canMove(catalog, path, dir)) return { catalog, path };
  const next = cloneCatalog(catalog);

  switch (path.kind) {
    case "product":
      moveItem(next, path.p, dir);
      return { catalog: next, path: { kind: "product", p: path.p + dir } };
    case "model":
      moveItem(next[path.p].models, path.m, dir);
      return { catalog: next, path: { ...path, m: path.m + dir } };
    case "group":
      moveItem(next[path.p].propertyGroups, path.g, dir);
      return { catalog: next, path: { ...path, g: path.g + dir } };
    case "property":
      moveItem(next[path.p].propertyGroups[path.g].properties, path.pr, dir);
      return { catalog: next, path: { ...path, pr: path.pr + dir } };
    case "choice": {
      const choices = next[path.p].propertyGroups[path.g].properties[path.pr].choice;
      if (!choices) return { catalog, path };
      moveItem(choices, path.c, dir);
      return { catalog: next, path: { ...path, c: path.c + dir } };
    }
  }
}

export function breadcrumbLabels(catalog: Catalog, path: CatalogPath): string[] {
  const product = catalog[path.p];
  if (!product) return [];
  if (path.kind === "product") return [product.name];
  if (path.kind === "model") {
    return [product.name, product.models[path.m]?.name ?? "Model"];
  }
  const group = product.propertyGroups[path.g];
  if (path.kind === "group") return [product.name, group?.name ?? "Grup"];
  const property = group?.properties[path.pr];
  if (path.kind === "property") {
    return [product.name, group?.name ?? "Grup", property?.name ?? "Özellik"];
  }
  return [
    product.name,
    group?.name ?? "Grup",
    property?.name ?? "Özellik",
    property?.choice?.[path.c]?.name ?? "Seçenek",
  ];
}
