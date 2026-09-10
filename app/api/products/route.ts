import { writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { parseCatalog, stringifyCatalog } from "@/lib/catalog/normalize";
import { lintCatalogInput } from "@/lib/catalog/lint";

const DATA_PATH = path.join(process.cwd(), "app/data/product.json");

export async function PUT(request: Request) {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return NextResponse.json({ error: "Gövde okunamadı." }, { status: 400 });
  }

  const parsed = parseCatalog(text);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const warnings = lintCatalogInput(JSON.parse(text) as unknown, parsed.catalog);

  try {
    await writeFile(DATA_PATH, stringifyCatalog(parsed.catalog), "utf8");
  } catch {
    return NextResponse.json(
      { error: "Dosya yazılamadı." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, warnings });
}
