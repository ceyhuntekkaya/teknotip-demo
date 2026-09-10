import { describe, expect, it } from "vitest";
import { retrieveProducts } from "./retrieve";
import { emptyDraft } from "./draft";
import { loadTestCatalog, productByName } from "./test-catalog";

const catalog = loadTestCatalog();

describe("retrieveProducts", () => {
  it("always includes draft products", () => {
    const cvd = productByName(catalog, "CVD FIRIN");
    const draft = emptyDraft();
    draft.items = [
      {
        lineId: "ln_1",
        productId: cvd.id,
        modelId: cvd.models[0].id,
        quantity: 1,
        selections: [],
      },
    ];
    const scoped = retrieveProducts(catalog, draft, "potansiyostat");
    expect(scoped.some((item) => item.id === cvd.id)).toBe(true);
    expect(scoped.some((item) => item.name === "POTANSİYOSTAT")).toBe(true);
  });

  it("ranks by code and alias", () => {
    const scoped = retrieveProducts(catalog, emptyDraft(), "fx-cvd-1");
    expect(scoped[0]?.name).toBe("CVD FIRIN");
  });

  it("keeps a named product in scope for a long sentence", () => {
    const scoped = retrieveProducts(
      catalog,
      emptyDraft(),
      "CVD fırın olsun, sıcaklık 1400, çap 60 mm",
    );
    expect(scoped.some((item) => item.name === "CVD FIRIN")).toBe(true);
  });
});
