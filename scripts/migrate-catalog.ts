import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseCatalog, stringifyCatalog } from "../lib/catalog/normalize";

const file = path.join(process.cwd(), "app/data/product.json");
const parsed = parseCatalog(readFileSync(file, "utf8"));
if (!parsed.ok) {
  throw new Error(parsed.error);
}
writeFileSync(file, stringifyCatalog(parsed.catalog));
console.log(`Migrated ${parsed.catalog.length} products.`);
