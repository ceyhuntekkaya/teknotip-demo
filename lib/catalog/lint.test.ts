import { describe, expect, it } from "vitest";
import { lintCatalog, lintCatalogRaw } from "./lint";
import { normalizeCatalog } from "./normalize";

describe("catalog lint", () => {
  it("is quiet on a valid catalog", () => {
    const catalog = normalizeCatalog([
      {
        name: "A",
        code: "A-1",
        models: [{ name: "M", price: 1, description: "", image: "", category: "" }],
        propertyGroups: [],
      },
    ]);
    expect(lintCatalog(catalog)).toEqual([]);
  });

  it("reports unknown state and duplicates", () => {
    const raw = [
      {
        name: "Aynı",
        code: "X",
        state: "required",
        models: [],
        propertyGroups: [{ name: "G", state: "maybe", type: "single_choice", properties: [] }],
      },
      {
        name: "Aynı",
        code: "X",
        models: [{ name: "M", price: 1, description: "", image: "", category: "" }],
        propertyGroups: [],
      },
    ];
    const catalog = normalizeCatalog(raw);
    const warnings = [...lintCatalogRaw(raw), ...lintCatalog(catalog)];
    expect(warnings.some((item) => item.code === "unknown_group_state")).toBe(true);
    expect(warnings.some((item) => item.code === "duplicate_product_name")).toBe(true);
    expect(warnings.some((item) => item.code === "duplicate_product_code")).toBe(true);
    expect(warnings.some((item) => item.code === "product_without_models")).toBe(true);
  });
});
