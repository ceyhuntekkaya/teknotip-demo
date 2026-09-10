import { readFile } from "fs/promises";
import path from "path";
import { parseCatalog } from "@/lib/catalog/normalize";
import { CatalogEditor } from "./catalog-editor";

export const dynamic = "force-dynamic";

export default async function DataJsonPage() {
  const file = await readFile(
    path.join(process.cwd(), "app/data/product.json"),
    "utf8",
  );
  const parsed = parseCatalog(file);

  return (
    <CatalogEditor initialCatalog={parsed.ok ? parsed.catalog : []} />
  );
}
