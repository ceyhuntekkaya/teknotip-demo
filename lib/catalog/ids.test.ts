import { describe, expect, it } from "vitest";
import { collectIds, slugify } from "./ids";
import { normalizeCatalog } from "./normalize";

const legacy = [
  {
    name: "TÜP FIRIN",
    models: [
      {
        name: "Tüp Fırın 1",
        price: 19000,
        description: "",
        image: "",
        category: "",
      },
    ],
    propertieGroups: [
      {
        name: "Teknik",
        state: "required",
        type: "single_choice",
        properties: [
          {
            name: "Maksimum sıcaklık",
            choice: [{ name: "1200°C", price: 200 }, { name: "1400°C", price: 300 }],
          },
        ],
      },
    ],
  },
  {
    name: "TÜP FIRIN",
    models: [
      {
        name: "Tüp Fırın 1",
        price: 1,
        description: "",
        image: "",
        category: "",
      },
    ],
    propertieGroups: [],
  },
];

describe("slugify", () => {
  it("maps Turkish characters", () => {
    expect(slugify("TÜP FIRIN")).toBe("tup-firin");
    expect(slugify("Isıtma bölgesi")).toBe("isitma-bolgesi");
    expect(slugify("1200°C")).toBe("1200-c");
  });
});

describe("normalizeCatalog", () => {
  it("reads propertieGroups and assigns unique ids", () => {
    const catalog = normalizeCatalog(legacy);
    expect(catalog).toHaveLength(2);
    expect(catalog[0].propertyGroups).toHaveLength(1);
    expect(catalog[0].id).toBe("p_tup-firin");
    expect(catalog[1].id).toBe("p_tup-firin_2");
    const ids = collectIds(catalog);
    expect(ids.size).toBe(8);
    expect(catalog[0].propertyGroups[0].properties[0].choice?.[1].id).toContain("1400-c");
  });

  it("normalizes legacy group state and type aliases", () => {
    const catalog = normalizeCatalog([
      {
        name: "X",
        models: [],
        propertyGroups: [
          { name: "Opsiyonel", state: "non-required", type: "non-single_choice", properties: [] },
          { name: "Tek", state: "required one", type: "single-choice", properties: [] },
          { name: "Çoklu", state: "required multiple", type: "multiple_choice", properties: [] },
        ],
      },
    ]);
    expect(catalog[0].propertyGroups.map((group) => group.state)).toEqual([
      "optional",
      "required_one",
      "required_multiple",
    ]);
    expect(catalog[0].propertyGroups.map((group) => group.type)).toEqual([
      "multiple_choice",
      "single_choice",
      "multiple_choice",
    ]);
  });
});
