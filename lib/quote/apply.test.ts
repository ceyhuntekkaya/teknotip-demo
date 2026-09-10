import { describe, expect, it } from "vitest";
import { initPreview, previewTotal } from "@/lib/catalog/price";
import { normalizeCatalog } from "@/lib/catalog/normalize";
import { applyActions } from "./apply";
import { emptyDraft } from "./draft";
import { hydrateQuote } from "./hydrate";
import { linePriceParts } from "./price";

const fixture = normalizeCatalog([
  {
    name: "CVD FIRIN",
    models: [
      {
        name: "CVD 1",
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
            choice: [
              { name: "1200°C", price: 200 },
              { name: "1400°C", price: 300 },
            ],
          },
          {
            name: "Tüp çapı",
            choice: [{ name: "50 mm" }, { name: "60 mm" }],
          },
        ],
      },
      {
        name: "Opsiyonel",
        state: "optional",
        type: "single_choice",
        properties: [
          {
            name: "Vakum pompası",
            choice: [
              { name: "4 L/s", price: 1000 },
              { name: "5 L/s", price: 1000 },
            ],
          },
          { name: "Dijital gösterge", price: 1000 },
        ],
      },
      {
        name: "Gaz tipi",
        state: "required",
        type: "multiple_choice",
        properties: [
          {
            name: "Gaz tipi",
            choice: [{ name: "Ar" }, { name: "O₂" }, { name: "H₂" }],
          },
        ],
      },
    ],
  },
  {
    name: "KÜL FIRIN",
    models: [
      {
        name: "Kül 1",
        price: 15000,
        description: "",
        image: "",
        category: "",
      },
    ],
    propertyGroups: [
      {
        name: "Teknik",
        state: "required",
        type: "single_choice",
        properties: [
          {
            name: "Maksimum sıcaklık",
            choice: [{ name: "1200°C" }, { name: "1400°C" }],
          },
        ],
      },
    ],
  },
  {
    name: "POTANSİYOSTAT",
    models: [
      {
        name: "CS 100",
        price: 19000,
        description: "",
        image: "",
        category: "",
      },
    ],
    propertyGroups: [
      {
        name: "Aksesuarlar",
        state: "optional",
        type: "single_choice",
        properties: [
          { name: "CS 901 Referans elektrot", price: 1000 },
          { name: "CS 912 Platin elektrot", price: 1000 },
          { name: "CS 945 WE tutucu", price: 1000 },
        ],
      },
    ],
  },
]);

const cvd = fixture[0];
const kul = fixture[1];
const aksesuar = fixture[2];
const tmax = cvd.propertyGroups[0].properties[0];
const cap = cvd.propertyGroups[0].properties[1];
const vakum = cvd.propertyGroups[1].properties[0];
const gosterge = cvd.propertyGroups[1].properties[1];
const gaz = cvd.propertyGroups[2].properties[0];

describe("applyActions", () => {
  it("creates a line from set_choice when the quote is empty", () => {
    const hot = tmax.choice?.[1];
    const added = applyActions(fixture, emptyDraft(), [
      { op: "set_choice", propertyId: tmax.id, choiceIds: [hot!.id] },
    ]);
    expect(added.warnings).toEqual([]);
    expect(added.draft.items).toHaveLength(1);
    const selection = added.draft.items[0].selections.find(
      (item) => item.propertyId === tmax.id,
    );
    expect(selection?.choiceIds).toEqual([hot!.id]);
  });

  it("adds a line with defaults and changes a choice", () => {
    const hot = tmax.choice?.[1];
    const added = applyActions(fixture, emptyDraft(), [
      { op: "add_line", productId: cvd.id },
    ]);
    expect(added.warnings).toEqual([]);
    expect(added.draft.items).toHaveLength(1);
    expect(added.draft.items[0].selections).toHaveLength(3);

    const changed = applyActions(fixture, added.draft, [
      { op: "set_choice", propertyId: tmax.id, choiceIds: [hot!.id] },
    ]);
    expect(changed.warnings).toEqual([]);
    const selection = changed.draft.items[0].selections.find(
      (item) => item.propertyId === tmax.id,
    );
    expect(selection?.choiceIds).toEqual([hot!.id]);
  });

  it("applies set_choice after add_line even with a stale lineId", () => {
    const hot = tmax.choice?.[1];
    const added = applyActions(fixture, emptyDraft(), [
      { op: "set_choice", lineId: "ln_deadbeef", propertyId: tmax.id, choiceIds: [hot!.id] },
      { op: "add_line", productId: cvd.id },
    ]);
    expect(added.warnings).toEqual([]);
    const selection = added.draft.items[0].selections.find(
      (item) => item.propertyId === tmax.id,
    );
    expect(selection?.choiceIds).toEqual([hot!.id]);
  });

  it("adds an optional vacuum pump to the existing line", () => {
    const pump = vakum.choice?.[0];
    const added = applyActions(fixture, emptyDraft(), [
      { op: "add_line", productId: cvd.id },
    ]);
    const withPump = applyActions(fixture, added.draft, [
      { op: "set_choice", propertyId: vakum.id, choiceIds: [pump!.id] },
    ]);
    expect(withPump.warnings).toEqual([]);
    expect(withPump.draft.items).toHaveLength(1);
    expect(
      withPump.draft.items[0].selections.some((item) => item.propertyId === vakum.id),
    ).toBe(true);
  });

  it("swallows a spurious add_line when amending an existing product", () => {
    const added = applyActions(fixture, emptyDraft(), [
      { op: "add_line", productId: cvd.id },
    ]);
    const pump = vakum.choice?.[1];
    const amended = applyActions(fixture, added.draft, [
      { op: "add_line", productId: cvd.id },
      { op: "set_choice", propertyId: vakum.id, choiceIds: [pump!.id] },
    ]);
    expect(amended.warnings).toEqual([]);
    expect(amended.draft.items).toHaveLength(1);
    const selection = amended.draft.items[0].selections.find(
      (item) => item.propertyId === vakum.id,
    );
    expect(selection?.choiceIds).toEqual([pump!.id]);
  });

  it("overrides a catalog add-on price with set_price", () => {
    const pump = vakum.choice?.[0];
    const added = applyActions(fixture, emptyDraft(), [
      { op: "add_line", productId: cvd.id },
      { op: "set_choice", propertyId: vakum.id, choiceIds: [pump!.id] },
    ]);
    const priced = applyActions(fixture, added.draft, [
      { op: "add_line", productId: cvd.id },
      { op: "set_price", propertyId: vakum.id, price: 6000 },
    ]);
    expect(priced.draft.items).toHaveLength(1);
    const selection = priced.draft.items[0].selections.find(
      (item) => item.propertyId === vakum.id,
    );
    expect(selection?.priceOverride).toBe(6000);
    const document = hydrateQuote(fixture, priced.draft);
    const row = document.products[0].propertyGroups
      .flatMap((group) => group.properties)
      .find((item) => item.id === vakum.id);
    expect(row?.price).toBe(6000);
    expect(linePriceParts(cvd, priced.draft.items[0]).extras).toBe(6200);
  });

  it("selects multiple gas choices when the group is multiple_choice", () => {
    const added = applyActions(fixture, emptyDraft(), [
      { op: "add_line", productId: cvd.id },
      {
        op: "set_choice",
        propertyId: gaz.id,
        choiceIds: gaz.choice!.map((choice) => choice.id),
      },
    ]);
    const selection = added.draft.items[0].selections.find(
      (item) => item.propertyId === gaz.id,
    );
    expect(selection?.choiceIds).toHaveLength(3);
  });

  it("keeps independent optional accessories on one line", () => {
    const [first, second, third] = aksesuar.propertyGroups[0].properties;
    const added = applyActions(fixture, emptyDraft(), [
      { op: "add_line", productId: aksesuar.id },
      { op: "set_choice", propertyId: first.id },
      { op: "set_choice", propertyId: second.id },
      { op: "set_choice", propertyId: third.id },
    ]);
    expect(added.draft.items).toHaveLength(1);
    expect(added.draft.items[0].selections).toHaveLength(3);
    expect(linePriceParts(aksesuar, added.draft.items[0]).extras).toBe(3000);
  });

  it("rejects removing a required property and allows optional", () => {
    const withLine = applyActions(fixture, emptyDraft(), [
      { op: "add_line", productId: cvd.id },
      { op: "set_choice", propertyId: gosterge.id, choiceIds: [] },
    ]);
    expect(
      withLine.draft.items[0].selections.some((item) => item.propertyId === gosterge.id),
    ).toBe(true);

    const refused = applyActions(fixture, withLine.draft, [
      { op: "remove_property", propertyId: tmax.id },
    ]);
    expect(refused.warnings.length).toBeGreaterThan(0);

    const removed = applyActions(fixture, withLine.draft, [
      { op: "remove_property", propertyId: gosterge.id },
    ]);
    expect(removed.warnings).toEqual([]);
    expect(
      removed.draft.items[0].selections.some((item) => item.propertyId === gosterge.id),
    ).toBe(false);
  });

  it("merges identical lines into quantity", () => {
    const added = applyActions(fixture, emptyDraft(), [
      { op: "add_line", productId: kul.id },
      { op: "add_line", productId: kul.id },
    ]);
    expect(added.draft.items).toHaveLength(1);
    expect(added.draft.items[0].quantity).toBe(2);
    expect(linePriceParts(kul, added.draft.items[0]).lineTotal).toBe(30000);
  });

  it("keeps two lines when temperatures differ", () => {
    const cool = tmax.choice?.[0];
    const hot = tmax.choice?.[1];
    const added = applyActions(fixture, emptyDraft(), [
      { op: "add_line", productId: cvd.id },
      { op: "set_choice", propertyId: tmax.id, choiceIds: [hot!.id] },
      { op: "add_line", productId: cvd.id },
      { op: "set_choice", propertyId: tmax.id, choiceIds: [cool!.id] },
    ]);
    expect(added.warnings).toEqual([]);
    expect(added.draft.items).toHaveLength(2);
    expect(added.draft.items.map((item) => item.quantity)).toEqual([1, 1]);
    const temps = added.draft.items.map(
      (item) => item.selections.find((row) => row.propertyId === tmax.id)?.choiceIds[0],
    );
    expect(temps).toEqual([hot!.id, cool!.id]);
  });

  it("matches hydrate extras to previewTotal defaults", () => {
    const added = applyActions(fixture, emptyDraft(), [
      { op: "add_line", productId: cvd.id },
    ]);
    const line = added.draft.items[0];
    const preview = initPreview(fixture, 0, 0);
    const previewParts = previewTotal(fixture, preview);
    const lineParts = linePriceParts(cvd, line);
    expect(lineParts.base).toBe(previewParts.base);
    expect(lineParts.extras).toBe(previewParts.extras);
    expect(lineParts.unit).toBe(previewParts.total);
  });

  it("increments quantity with set_quantity", () => {
    const added = applyActions(fixture, emptyDraft(), [
      { op: "add_line", productId: kul.id },
      { op: "set_quantity", productId: kul.id, quantity: 2 },
    ]);
    expect(added.draft.items[0].quantity).toBe(2);
  });

  it("still targets diameter on the first line after adding vacuum", () => {
    const wide = cap.choice?.[1];
    const added = applyActions(fixture, emptyDraft(), [
      { op: "add_line", productId: cvd.id },
      { op: "set_choice", propertyId: cap.id, choiceIds: [wide!.id] },
    ]);
    const withPump = applyActions(fixture, added.draft, [
      { op: "set_choice", propertyId: vakum.id },
    ]);
    const selection = withPump.draft.items[0].selections.find(
      (item) => item.propertyId === cap.id,
    );
    expect(withPump.draft.items).toHaveLength(1);
    expect(selection?.choiceIds).toEqual([wide!.id]);
  });
});
