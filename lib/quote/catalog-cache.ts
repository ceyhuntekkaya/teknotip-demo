import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import { parseCatalog } from "@/lib/catalog/normalize";
import { indexCatalog, type CatalogLookup } from "@/lib/catalog/rules";
import type { Catalog } from "@/lib/catalog/types";

export type CachedCatalog = {
  catalog: Catalog;
  lookup: CatalogLookup;
  mtimeMs: number;
  path: string;
};

const caches = new Map<string, CachedCatalog>();

export function catalogDataPath(): string {
  return path.join(process.cwd(), "app/data/product.json");
}

export async function loadCatalogCached(
  filePath = catalogDataPath(),
): Promise<CachedCatalog> {
  const info = await stat(filePath);
  const mtimeMs = info.mtimeMs;
  const existing = caches.get(filePath);
  if (existing && existing.mtimeMs === mtimeMs) {
    return existing;
  }
  const file = await readFile(filePath, "utf8");
  const parsed = parseCatalog(file);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const next: CachedCatalog = {
    catalog: parsed.catalog,
    lookup: indexCatalog(parsed.catalog),
    mtimeMs,
    path: filePath,
  };
  caches.set(filePath, next);
  return next;
}

export function resetCatalogCache(): void {
  caches.clear();
}

export function peekCatalogCache(filePath = catalogDataPath()): CachedCatalog | undefined {
  return caches.get(filePath);
}
