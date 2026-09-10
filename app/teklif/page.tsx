import { readFile } from "fs/promises";
import path from "path";
import { parseCatalog } from "@/lib/catalog/normalize";
import type { Catalog } from "@/lib/catalog/types";
import { QuoteBench } from "./quote-bench";

export const dynamic = "force-dynamic";

export default async function TeklifPage() {
  let catalog: Catalog = [];
  try {
    const file = await readFile(
      path.join(process.cwd(), "app/data/product.json"),
      "utf8",
    );
    const parsed = parseCatalog(file);
    if (parsed.ok) catalog = parsed.catalog;
  } catch {
    catalog = [];
  }

  return <QuoteBench catalog={catalog} />;
}
