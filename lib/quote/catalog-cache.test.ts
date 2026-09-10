import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadCatalogCached, peekCatalogCache, resetCatalogCache } from "./catalog-cache";

const sample = JSON.stringify([
  {
    name: "A",
    models: [{ name: "M", price: 1, description: "", image: "", category: "" }],
    propertyGroups: [],
  },
]);

describe("catalog cache", () => {
  afterEach(() => {
    resetCatalogCache();
  });

  it("reuses the same parse until mtime changes", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "teknotip-cat-"));
    const file = path.join(dir, "product.json");
    await writeFile(file, sample, "utf8");
    const first = await loadCatalogCached(file);
    const second = await loadCatalogCached(file);
    expect(second.lookup).toBe(first.lookup);
    expect(peekCatalogCache(file)?.mtimeMs).toBe(first.mtimeMs);
    await writeFile(file, sample.replace("A", "B"), "utf8");
    const third = await loadCatalogCached(file);
    expect(third.catalog[0]?.name).toBe("B");
    expect(third.lookup).not.toBe(first.lookup);
  });
});
