import { readFileSync } from "node:fs";
import path from "node:path";
import { parseCatalog } from "@/lib/catalog/normalize";
import type { Catalog, Product } from "@/lib/catalog/types";

const FIXTURE_PATH = path.resolve(process.cwd(), "fixtures/catalog.test.json");

export function testCatalogPath(): string {
  return FIXTURE_PATH;
}

export function loadTestCatalog(): Catalog {
  const parsed = parseCatalog(readFileSync(FIXTURE_PATH, "utf8"));
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.catalog;
}

export function productByName(catalog: Catalog, name: string): Product {
  const product = catalog.find((item) => item.name === name);
  if (!product) {
    throw new Error(`Fixtürde ürün yok: ${name}`);
  }
  return product;
}
