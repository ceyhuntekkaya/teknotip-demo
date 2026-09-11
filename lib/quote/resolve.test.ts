import { describe, expect, it } from "vitest";
import { indexCatalog } from "@/lib/catalog/rules";
import { emptyDraft } from "./draft";
import { processTurn } from "./turn";
import { resolveIntent, resolveIntents } from "./resolve";
import { matchPendingReply } from "./pending";
import { loadTestCatalog, productByName } from "./test-catalog";
import type { ChatIntent, QuoteDraft } from "./types";

const catalog = loadTestCatalog();
const lookup = indexCatalog(catalog);
const cvd = productByName(catalog, "CVD FIRIN");

function turn(draft: QuoteDraft, intents: ChatIntent[], fromPending = false) {
  return processTurn({
    catalog,
    lookup,
    draft,
    userMessage: "",
    intents,
    fromPending,
  });
}

describe("resolve + apply", () => {
  it("adds CVD with 1400 and 60 mm", () => {
    const result = turn(emptyDraft(), [
      { op: "add_line", productRef: "CVD fırın" },
      { op: "set_value", productRef: "CVD fırın", value: "1400" },
      { op: "set_value", productRef: "CVD fırın", value: "60 mm" },
    ]);
    expect(result.draft.items).toHaveLength(1);
    const line = result.draft.items[0];
    expect(line.productId).toBe(cvd.id);
    const tmax = cvd.propertyGroups[0].properties[0];
    const cap = cvd.propertyGroups[0].properties[1];
    expect(line.selections.find((row) => row.propertyId === tmax.id)?.choiceIds).toEqual([
      tmax.choice![1].id,
    ]);
    expect(line.selections.find((row) => row.propertyId === cap.id)?.choiceIds).toEqual([
      cap.choice![1].id,
    ]);
    expect(result.clarifications).toEqual([]);
  });

  it("does not add CVD twice when the model repeats add_line for diameter", () => {
    const result = turn(emptyDraft(), [
      { op: "add_line", productRef: "CVD fırın" },
      { op: "set_value", productRef: "CVD fırın", value: "1400" },
      { op: "add_line", productRef: "CVD fırın" },
      { op: "set_value", productRef: "CVD fırın", value: "100 mm" },
    ]);
    expect(result.draft.items).toHaveLength(1);
    expect(result.draft.items[0].quantity).toBe(1);
    const eklendi = result.reply
      .split("\n")
      .filter((line) => line.includes("eklendi"));
    expect(eklendi).toHaveLength(1);
    const tmax = cvd.propertyGroups[0].properties[0];
    const cap = cvd.propertyGroups[0].properties[1];
    expect(
      result.draft.items[0].selections.find((row) => row.propertyId === tmax.id)?.choiceIds,
    ).toEqual([tmax.choice![1].id]);
    expect(
      result.draft.items[0].selections.find((row) => row.propertyId === cap.id)?.choiceIds,
    ).toEqual([cap.choice![3].id]);
  });

  it("infers CVD from the utterance when the model omits productRef", () => {
    const result = processTurn({
      catalog,
      lookup,
      draft: emptyDraft(),
      userMessage: "CVD fırın olsun, sıcaklık 1400, çap 60 mm",
      intents: [
        { op: "add_line" },
        { op: "set_value", lineRef: "S1", value: "1400" },
        { op: "set_value", lineRef: "S1", value: "60 mm" },
      ],
    });
    expect(result.draft.items).toHaveLength(1);
    expect(result.draft.items[0].productId).toBe(cvd.id);
    const tmax = cvd.propertyGroups[0].properties[0];
    const cap = cvd.propertyGroups[0].properties[1];
    expect(
      result.draft.items[0].selections.find((row) => row.propertyId === tmax.id)?.choiceIds,
    ).toEqual([tmax.choice![1].id]);
    expect(
      result.draft.items[0].selections.find((row) => row.propertyId === cap.id)?.choiceIds,
    ).toEqual([cap.choice![1].id]);
    expect(result.clarifications).toEqual([]);
  });

  it("applies values with S1 even when the quote is still empty", () => {
    const result = turn(emptyDraft(), [
      { op: "add_line", productRef: "CVD fırın" },
      { op: "set_value", lineRef: "S1", value: "1400" },
      { op: "set_value", lineRef: "S1", value: "60 mm" },
    ]);
    expect(result.clarifications).toEqual([]);
    expect(result.draft.items).toHaveLength(1);
    const tmax = cvd.propertyGroups[0].properties[0];
    const cap = cvd.propertyGroups[0].properties[1];
    expect(
      result.draft.items[0].selections.find((row) => row.propertyId === tmax.id)?.choiceIds,
    ).toEqual([tmax.choice![1].id]);
    expect(
      result.draft.items[0].selections.find((row) => row.propertyId === cap.id)?.choiceIds,
    ).toEqual([cap.choice![1].id]);
  });

  it("asks which product only once when several intents lack a product", () => {
    const result = turn(emptyDraft(), [
      { op: "set_value", value: "1400" },
      { op: "set_value", value: "60 mm" },
    ]);
    expect(result.draft.items).toHaveLength(0);
    expect(result.clarifications.every((item) => item.kind === "which_product")).toBe(true);
    expect(result.reply).toBe("Hangi ürünü kastediyorsunuz?");
  });

  it("keeps a vague fırın ref on the draft line", () => {
    const added = turn(emptyDraft(), [{ op: "add_line", productRef: "CVD fırın" }]);
    const two = turn(added.draft, [{ op: "set_quantity", productRef: "fırın", quantity: 2 }]);
    expect(two.clarifications).toEqual([]);
    expect(two.draft.items).toHaveLength(1);
    expect(two.draft.items[0].productId).toBe(cvd.id);
    expect(two.draft.items[0].quantity).toBe(2);
  });

  it("does not invent missing products", () => {
    const outcome = resolveIntent(
      { op: "add_line", productRef: "plazma kesici" },
      catalog,
      lookup,
      emptyDraft(),
    );
    expect("clarify" in outcome).toBe(true);
    if ("clarify" in outcome) {
      expect(outcome.clarify.kind).toBe("which_product");
    }
  });

  it("clarifies overlapping temperature values", () => {
    const seeded = turn(emptyDraft(), [{ op: "add_line", productRef: "Tüp fırın" }]);
    const outcome = resolveIntent(
      { op: "set_value", value: "1700" },
      catalog,
      lookup,
      seeded.draft,
    );
    expect("clarify" in outcome).toBe(true);
    if ("clarify" in outcome) {
      expect(outcome.clarify.kind).toBe("which_value");
      expect(outcome.clarify.candidates.length).toBeGreaterThan(1);
    }
  });

  it("sets quantity and increment", () => {
    const added = turn(emptyDraft(), [{ op: "add_line", productRef: "cvd" }]);
    const two = turn(added.draft, [{ op: "set_quantity", quantity: 2 }]);
    expect(two.draft.items[0].quantity).toBe(2);
    const three = turn(two.draft, [
      { op: "set_quantity", value: "bir tane daha ekle" },
    ]);
    expect(three.draft.items[0].quantity).toBe(3);
  });

  it("handles flags and gas valueMode", () => {
    const added = turn(emptyDraft(), [{ op: "add_line", productRef: "CVD FIRIN" }]);
    const flagged = turn(added.draft, [
      { op: "set_value", propertyRef: "Dijital gösterge", value: "ekle" },
    ]);
    const gosterge = cvd.propertyGroups[1].properties[1];
    expect(
      flagged.draft.items[0].selections.some((row) => row.propertyId === gosterge.id),
    ).toBe(true);
    const removed = turn(flagged.draft, [
      { op: "set_value", propertyRef: "Dijital gösterge", value: "çıkar" },
    ]);
    expect(
      removed.draft.items[0].selections.some((row) => row.propertyId === gosterge.id),
    ).toBe(false);

    const gases = turn(added.draft, [
      { op: "set_value", propertyRef: "Gaz tipi", values: ["Ar", "H₂"], valueMode: "set" },
    ]);
    const gaz = cvd.propertyGroups[2].properties[0];
    expect(gases.draft.items[0].selections.find((row) => row.propertyId === gaz.id)?.choiceIds).toHaveLength(2);
    const minus = turn(gases.draft, [
      { op: "set_value", propertyRef: "Gaz tipi", values: ["H₂"], valueMode: "remove" },
    ]);
    expect(minus.draft.items[0].selections.find((row) => row.propertyId === gaz.id)?.choiceIds).toHaveLength(1);
    const plus = turn(minus.draft, [
      { op: "set_value", propertyRef: "Gaz tipi", values: ["CO₂"], valueMode: "add" },
    ]);
    expect(plus.draft.items[0].selections.find((row) => row.propertyId === gaz.id)?.choiceIds).toHaveLength(2);
  });

  it("sets model CS 310 M", () => {
    const added = turn(emptyDraft(), [{ op: "add_line", productRef: "potansiyostat" }]);
    const model = turn(added.draft, [{ op: "set_model", modelRef: "CS 310 M" }]);
    const product = productByName(catalog, "POTANSİYOSTAT");
    expect(model.draft.items[0].modelId).toBe(product.models[1].id);
  });

  it("sets customer and product together", () => {
    const result = turn(emptyDraft(), [
      {
        op: "set_customer",
        customer: {
          institution: "Ankara Üniversitesi Tıp Fakültesi",
          title: "Prof. Dr.",
          contactPerson: "Ceyhun Tekkaya",
        },
      },
      { op: "add_line", productRef: "CVD fırın" },
    ]);
    expect(result.draft.items).toHaveLength(1);
    expect(result.draft.quotedTo?.institution).toContain("Ankara");
    expect(result.document.quotedTo.contactPerson).toContain("Ceyhun");
  });

  it("matches product by code", () => {
    const result = turn(emptyDraft(), [{ op: "add_line", productRef: "fx cvd 1" }]);
    expect(result.draft.items[0].productId).toBe(cvd.id);
  });

  it("required_one switches property", () => {
    const added = turn(emptyDraft(), [{ op: "add_line", productRef: "akış kontrol" }]);
    const mfc = productByName(catalog, "AKIŞ KONTROL");
    expect(added.draft.items[0].selections[0].propertyId).toBe(mfc.propertyGroups[0].properties[0].id);
    const switched = turn(added.draft, [{ op: "set_value", propertyRef: "Adet", value: "2" }]);
    expect(switched.draft.items[0].selections).toHaveLength(1);
    expect(switched.draft.items[0].selections[0].propertyId).toBe(
      mfc.propertyGroups[0].properties[1].id,
    );
  });

  it("clarifies which line then resumes", () => {
    const first = turn(emptyDraft(), [
      { op: "add_line", productRef: "CVD fırın" },
      { op: "set_value", value: "1400" },
    ]);
    const second = turn(first.draft, [
      { op: "add_line", productRef: "CVD fırın" },
      { op: "set_value", productRef: "CVD fırın", value: "1700" },
    ]);
    expect(second.draft.items).toHaveLength(2);
    const ask = resolveIntents(
      [{ op: "set_value", value: "80 mm" }],
      catalog,
      lookup,
      second.draft,
    );
    expect(ask.clarifications[0]?.kind).toBe("which_line");
    const picked = matchPendingReply("ikinci", {
      pending: {
        kind: "which_line",
        question: ask.clarifications[0].question,
        candidates: ask.clarifications[0].candidates,
        resume: ask.clarifications[0].resume,
      },
    });
    expect(Array.isArray(picked)).toBe(true);
    if (!Array.isArray(picked)) return;
    const applied = turn(second.draft, picked, true);
    const cap = cvd.propertyGroups[0].properties[1];
    expect(applied.draft.items[1].selections.find((row) => row.propertyId === cap.id)?.choiceIds).toEqual([
      cap.choice![2].id,
    ]);
  });

  it("rejects out of scope via clarify op", () => {
    const result = turn(emptyDraft(), [{ op: "clarify" }]);
    expect(result.draft.items).toHaveLength(0);
    expect(result.reply.toLocaleLowerCase("tr")).toContain("yalnızca teklif");
  });

  it("converts 6 cm to 60 mm", () => {
    const result = turn(emptyDraft(), [
      { op: "add_line", productRef: "CVD fırın" },
      { op: "set_value", value: "6 cm" },
    ]);
    const cap = cvd.propertyGroups[0].properties[1];
    expect(
      result.draft.items[0].selections.find((row) => row.propertyId === cap.id)?.choiceIds,
    ).toEqual([
      cap.choice![1].id,
    ]);
  });

  it("writes a base price from the utterance when the model omits price", () => {
    const added = turn(emptyDraft(), [{ op: "add_line", productRef: "CVD fırın" }]);
    const priced = processTurn({
      catalog,
      lookup,
      draft: added.draft,
      userMessage: "ürün fiyatı 25000 tl olsun",
      intents: [{ op: "set_price", value: "25000 tl" }],
    });
    expect(priced.clarifications).toEqual([]);
    expect(priced.draft.items[0].basePriceOverride).toBe(25000);
    expect(priced.document.products[0].basePrice).toBe(25000);

    const fromMessage = processTurn({
      catalog,
      lookup,
      draft: added.draft,
      userMessage: "ürün fiyatı 25000 tl olsun",
      intents: [{ op: "set_price" }],
    });
    expect(fromMessage.draft.items[0].basePriceOverride).toBe(25000);
  });

  it("does not keep a missing-price question in front of a new request", () => {
    const added = turn(emptyDraft(), [{ op: "add_line", productRef: "CVD fırın" }]);
    const asked = processTurn({
      catalog,
      lookup,
      draft: added.draft,
      userMessage: "",
      intents: [{ op: "set_price" }],
    });
    expect(asked.reply).toContain("Hangi fiyat");
    expect(matchPendingReply("vakum pompası 4 olsun", asked.focus)).toBeNull();

    const pump = processTurn({
      catalog,
      lookup,
      draft: added.draft,
      focus: { lastTouchedLineId: asked.focus.lastTouchedLineId },
      userMessage: "vakum pompası 4 olsun",
      intents: [{ op: "set_value", propertyRef: "Vakum pompası", value: "4" }],
    });
    const vakum = cvd.propertyGroups[1].properties[0];
    expect(pump.clarifications).toEqual([]);
    expect(
      pump.draft.items[0].selections.find((row) => row.propertyId === vakum.id)?.choiceIds,
    ).toEqual([vakum.choice![0].id]);
  });

  it("maps a single size token onto a repeated dimension choice", () => {
    const kul = productByName(catalog, "KÜL FIRIN");
    const result = turn(emptyDraft(), [
      { op: "add_line", productRef: "kül fırın" },
      { op: "set_value", value: "1700" },
      { op: "set_value", value: "300lük" },
    ]);
    const tmax = kul.propertyGroups[0].properties[0];
    const chamber = kul.propertyGroups[0].properties[1];
    expect(
      result.draft.items[0].selections.find((row) => row.propertyId === tmax.id)?.choiceIds,
    ).toEqual([tmax.choice![2].id]);
    expect(
      result.draft.items[0].selections.find((row) => row.propertyId === chamber.id)?.choiceIds,
    ).toEqual([chamber.choice![1].id]);
  });

  it("writes a named group count onto that property, not the line quantity", () => {
    const added = turn(emptyDraft(), [{ op: "add_line", productRef: "akış kontrol" }]);
    const changed = processTurn({
      catalog,
      lookup,
      draft: added.draft,
      userMessage: "mfc adet 2 olsun",
      intents: [{ op: "set_quantity", quantity: 2 }],
    });
    const mfc = productByName(catalog, "AKIŞ KONTROL");
    const adet = mfc.propertyGroups[0].properties[1];
    expect(changed.draft.items[0].quantity).toBe(1);
    expect(
      changed.draft.items[0].selections.find((row) => row.propertyId === adet.id)?.choiceIds,
    ).toEqual([adet.choice![1].id]);
  });

  it("keeps line quantity when the utterance names the quote line", () => {
    const added = turn(emptyDraft(), [
      { op: "add_line", productRef: "CVD fırın" },
      { op: "set_quantity", quantity: 2 },
    ]);
    const one = processTurn({
      catalog,
      lookup,
      draft: added.draft,
      userMessage: "ana ürün adeti 1 olsun",
      intents: [
        {
          op: "set_quantity",
          propertyRef: "S1: CVD FIRIN / CVD 1 x2",
          value: "1",
        },
      ],
    });
    expect(one.clarifications).toEqual([]);
    expect(one.draft.items[0].quantity).toBe(1);
  });
});
