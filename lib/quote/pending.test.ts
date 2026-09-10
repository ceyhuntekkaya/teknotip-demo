import { describe, expect, it } from "vitest";
import { matchPendingReply } from "./pending";
import type { ConversationFocus } from "./types";

const pricePending: ConversationFocus = {
  pending: {
    kind: "which_value",
    question: "Hangi fiyatı yazayım?",
    candidates: [],
    resume: { op: "set_price" },
  },
};

const propertyPending: ConversationFocus = {
  pending: {
    kind: "which_value",
    question: "Hangi özelliği kastediyorsunuz?",
    candidates: [
      { label: "Maksimum sıcaklık", ref: "Maksimum sıcaklık" },
      { label: "Adet", ref: "Adet" },
      { label: "Debi", ref: "Debi" },
    ],
    resume: {
      op: "set_value",
      propertyRef: "S1: Ürün / Model 1 x2",
      value: "1",
    },
  },
};

describe("matchPendingReply", () => {
  it("fills a bare amount onto a waiting set_price", () => {
    const matched = matchPendingReply("25000", pricePending);
    expect(matched).not.toBeNull();
    expect(matched).not.toBe("cancel");
    if (!matched || matched === "cancel") return;
    expect(matched[0]).toMatchObject({ op: "set_price", price: 25000 });
  });

  it("does not treat a new property request as a price answer", () => {
    expect(matchPendingReply("vakum pompası 4 olsun", pricePending)).toBeNull();
  });

  it("does not steal a line-quantity sentence via a property named Adet", () => {
    expect(matchPendingReply("ana ürün adeti 1 olsun", propertyPending)).toBeNull();
    expect(matchPendingReply("teklifte mevcut ürün 1 adet olsun", propertyPending)).toBeNull();
  });

  it("accepts an exact candidate as the property, not the failed resume ref", () => {
    const matched = matchPendingReply("Debi", propertyPending);
    expect(matched).not.toBeNull();
    expect(matched).not.toBe("cancel");
    if (!matched || matched === "cancel") return;
    expect(matched[0].propertyRef).toBe("Debi");
    expect(matched[0].value).toBe("1");
  });

  it("still resumes which_line from a short ordinal", () => {
    const matched = matchPendingReply("ikinci", {
      pending: {
        kind: "which_line",
        question: "Hangi satır?",
        candidates: [
          { label: "S1", ref: "S1" },
          { label: "S2", ref: "S2" },
        ],
        resume: { op: "set_value", value: "80 mm" },
      },
    });
    expect(matched).not.toBeNull();
    expect(matched).not.toBe("cancel");
    if (!matched || matched === "cancel") return;
    expect(matched[0].lineRef).toBe("S2");
  });
});
