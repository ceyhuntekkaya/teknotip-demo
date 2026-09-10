import { describe, expect, it } from "vitest";
import { applyQuoteEdit } from "./edit";
import { emptyDraft } from "./draft";
import {
  addPropertyAction,
  groupPreviewFromSelections,
  removePropertyAction,
  setChoiceAction,
  setPriceAction,
} from "./line-preview";
import { linePriceParts } from "./price";
import { applyActions } from "./apply";
import { loadTestCatalog, productByName } from "./test-catalog";

const catalog = loadTestCatalog();
const cvd = productByName(catalog, "CVD FIRIN");
const mfc = productByName(catalog, "AKIŞ KONTROL");
const teknik = cvd.propertyGroups[0];
const optional = cvd.propertyGroups[1];
const tmax = teknik.properties[0];
const vakum = optional.properties[0];
const gosterge = optional.properties[1];
const mfcGroup = mfc.propertyGroups[0];

describe("groupPreviewFromSelections", () => {
  it("marks quote selections and leaves other optionals unselected", () => {
    const added = applyActions(catalog, emptyDraft(), [
      { op: "add_line", productId: cvd.id },
    ]);
    const teknikPreview = groupPreviewFromSelections(
      teknik,
      added.draft.items[0].selections,
    );
    const optionalPreview = groupPreviewFromSelections(
      optional,
      added.draft.items[0].selections,
    );
    expect(teknikPreview.selected).toEqual([0, 1]);
    expect(optionalPreview.selected).toEqual([]);
    expect(optionalPreview.choices).toEqual({});
  });
});

describe("applyQuoteEdit", () => {
  it("adds an optional property and can remove it", () => {
    const added = applyActions(catalog, emptyDraft(), [
      { op: "add_line", productId: cvd.id },
    ]);
    const lineId = added.draft.items[0].lineId;
    const withPump = applyQuoteEdit(catalog, added.draft, [
      addPropertyAction(lineId, vakum),
    ]);
    expect(withPump.warnings).toEqual([]);
    expect(
      withPump.draft.items[0].selections.some((item) => item.propertyId === vakum.id),
    ).toBe(true);

    const removed = applyQuoteEdit(catalog, withPump.draft, [
      removePropertyAction(lineId, vakum),
    ]);
    expect(removed.warnings).toEqual([]);
    expect(
      removed.draft.items[0].selections.some((item) => item.propertyId === vakum.id),
    ).toBe(false);
  });

  it("changes a required choice but refuses to delete it", () => {
    const added = applyActions(catalog, emptyDraft(), [
      { op: "add_line", productId: cvd.id },
    ]);
    const lineId = added.draft.items[0].lineId;
    const hot = tmax.choice![1];
    const changed = applyQuoteEdit(catalog, added.draft, [
      setChoiceAction(lineId, teknik, tmax, [1]),
    ]);
    expect(changed.warnings).toEqual([]);
    expect(
      changed.draft.items[0].selections.find((item) => item.propertyId === tmax.id)
        ?.choiceIds,
    ).toEqual([hot.id]);

    const refused = applyQuoteEdit(catalog, changed.draft, [
      removePropertyAction(lineId, tmax),
    ]);
    expect(refused.warnings.length).toBeGreaterThan(0);
    expect(
      refused.draft.items[0].selections.some((item) => item.propertyId === tmax.id),
    ).toBe(true);
  });

  it("switches required_one by selecting the other property", () => {
    const added = applyActions(catalog, emptyDraft(), [
      { op: "add_line", productId: mfc.id },
    ]);
    const lineId = added.draft.items[0].lineId;
    const adet = mfcGroup.properties[1];
    const switched = applyQuoteEdit(catalog, added.draft, [
      addPropertyAction(lineId, adet),
    ]);
    expect(switched.warnings).toEqual([]);
    expect(switched.draft.items[0].selections).toHaveLength(1);
    expect(switched.draft.items[0].selections[0].propertyId).toBe(adet.id);
  });

  it("adds a flag-style optional property", () => {
    const added = applyActions(catalog, emptyDraft(), [
      { op: "add_line", productId: cvd.id },
    ]);
    const lineId = added.draft.items[0].lineId;
    const withFlag = applyQuoteEdit(catalog, added.draft, [
      addPropertyAction(lineId, gosterge),
    ]);
    expect(withFlag.warnings).toEqual([]);
    expect(
      withFlag.draft.items[0].selections.find((item) => item.propertyId === gosterge.id)
        ?.choiceIds,
    ).toEqual([]);
  });

  it("overrides the quoted base price", () => {
    const added = applyActions(catalog, emptyDraft(), [
      { op: "add_line", productId: cvd.id },
    ]);
    const line = added.draft.items[0];
    const priced = applyQuoteEdit(catalog, added.draft, [
      setPriceAction(line.lineId, 25000),
    ]);
    expect(priced.warnings).toEqual([]);
    expect(priced.draft.items[0].basePriceOverride).toBe(25000);
    expect(linePriceParts(cvd, priced.draft.items[0]).base).toBe(25000);
    expect(priced.document.products[0].basePrice).toBe(25000);
    expect(priced.document.products[0].price).toBe(
      linePriceParts(cvd, priced.draft.items[0]).unit,
    );
    expect(priced.document.products[0].lineTotal).toBe(
      linePriceParts(cvd, priced.draft.items[0]).lineTotal,
    );
  });

  it("overrides a selected add-on price", () => {
    const added = applyActions(catalog, emptyDraft(), [
      { op: "add_line", productId: cvd.id },
    ]);
    const lineId = added.draft.items[0].lineId;
    const withFlag = applyQuoteEdit(catalog, added.draft, [
      addPropertyAction(lineId, gosterge),
    ]);
    const priced = applyQuoteEdit(catalog, withFlag.draft, [
      setPriceAction(lineId, 4500, gosterge),
    ]);
    expect(priced.warnings).toEqual([]);
    expect(
      priced.draft.items[0].selections.find((item) => item.propertyId === gosterge.id)
        ?.priceOverride,
    ).toBe(4500);
    const row = priced.document.products[0].propertyGroups
      .flatMap((group) => group.properties)
      .find((item) => item.id === gosterge.id);
    expect(row?.price).toBe(4500);
  });
});
