import { describe, expect, it } from "vitest";
import { normalizeCatalog } from "./normalize";
import {
  canRemoveProperty,
  coerceChoiceIds,
  missingSlots,
  defaultLineSelections,
} from "./rules";

const catalog = normalizeCatalog([
  {
    name: "CVD",
    models: [{ name: "1", price: 1, description: "", image: "", category: "" }],
    propertyGroups: [
      {
        name: "Teknik",
        state: "required",
        type: "single_choice",
        properties: [
          { name: "Sıcaklık", choice: [{ name: "1200°C" }, { name: "1400°C" }] },
          { name: "Çap", choice: [{ name: "50 mm" }, { name: "60 mm" }] },
        ],
      },
      {
        name: "Opsiyonel",
        state: "optional",
        type: "single_choice",
        properties: [
          {
            name: "Vakum pompası",
            choice: [{ name: "4 L/s" }, { name: "5 L/s" }],
          },
        ],
      },
      {
        name: "Gaz",
        state: "required",
        type: "multiple_choice",
        properties: [
          {
            name: "Gaz tipi",
            choice: [{ name: "Ar" }, { name: "O₂" }, { name: "H₂" }],
          },
        ],
      },
      {
        name: "En az biri",
        state: "required_multiple",
        type: "single_choice",
        properties: [{ name: "A" }, { name: "B" }],
      },
    ],
  },
  {
    name: "Tekli gaz",
    models: [{ name: "1", price: 1, description: "", image: "", category: "" }],
    propertyGroups: [
      {
        name: "Gaz",
        state: "required",
        type: "single_choice",
        properties: [
          {
            name: "Gaz tipi",
            choice: [{ name: "Ar" }, { name: "O₂" }, { name: "H₂" }],
          },
        ],
      },
    ],
  },
]);

const cvd = catalog[0];
const teknik = cvd.propertyGroups[0];
const optional = cvd.propertyGroups[1];
const gaz = cvd.propertyGroups[2];
const atLeast = cvd.propertyGroups[3];
const singleGaz = catalog[1].propertyGroups[0].properties[0];

describe("coerceChoiceIds", () => {
  it("keeps three gases on multiple_choice", () => {
    const ids = gaz.properties[0].choice!.map((choice) => choice.id);
    const result = coerceChoiceIds(gaz, gaz.properties[0], ids);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.choiceIds).toEqual(ids);
  });

  it("clips extra gases on single_choice", () => {
    const ids = singleGaz.choice!.map((choice) => choice.id);
    const result = coerceChoiceIds(catalog[1].propertyGroups[0], singleGaz, ids);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.choiceIds).toEqual([ids[0]]);
  });
});

describe("canRemoveProperty", () => {
  it("blocks removing a required technical property", () => {
    const result = canRemoveProperty(teknik, teknik.properties[0], [
      teknik.properties[0].id,
      teknik.properties[1].id,
    ]);
    expect(result.ok).toBe(false);
  });

  it("allows removing an optional property", () => {
    const result = canRemoveProperty(optional, optional.properties[0], [
      optional.properties[0].id,
    ]);
    expect(result.ok).toBe(true);
  });

  it("keeps at least one property in required_multiple", () => {
    const result = canRemoveProperty(atLeast, atLeast.properties[0], [
      atLeast.properties[0].id,
    ]);
    expect(result.ok).toBe(false);
  });
});

describe("missingSlots", () => {
  it("flags an optional property that is on the line without a choice", () => {
    const defaults = defaultLineSelections(cvd);
    const gaps = missingSlots(cvd, [
      ...defaults,
      {
        groupId: optional.id,
        propertyId: optional.properties[0].id,
        choiceIds: [],
      },
    ]);
    expect(gaps.some((slot) => slot.propertyId === optional.properties[0].id)).toBe(
      true,
    );
  });
});
