import { describe, expect, it } from "vitest";
import type { QuoteResponse } from "@/lib/api/generated/model";
import { isQuoteActionReady } from "@/lib/quote/action-ready";

const readyQuote: QuoteResponse = {
  quotedTo: {
    institution: "ODTÜ",
    contactPerson: "Ayşe Yılmaz",
  },
  lines: [{ name: "CVD FIRIN", productId: "p1" }],
};

describe("isQuoteActionReady", () => {
  it("returns false for missing quote", () => {
    expect(isQuoteActionReady(null)).toBe(false);
    expect(isQuoteActionReady(undefined)).toBe(false);
    expect(isQuoteActionReady({})).toBe(false);
  });

  it("requires institution, contact person and at least one product", () => {
    expect(isQuoteActionReady(readyQuote)).toBe(true);
  });

  it("rejects blank institution", () => {
    expect(
      isQuoteActionReady({
        ...readyQuote,
        quotedTo: { ...readyQuote.quotedTo, institution: "  " },
      }),
    ).toBe(false);
  });

  it("rejects blank contact person", () => {
    expect(
      isQuoteActionReady({
        ...readyQuote,
        quotedTo: { ...readyQuote.quotedTo, contactPerson: "" },
      }),
    ).toBe(false);
  });

  it("rejects quotes without a named product line", () => {
    expect(isQuoteActionReady({ ...readyQuote, lines: [] })).toBe(false);
    expect(
      isQuoteActionReady({ ...readyQuote, lines: [{ name: "   " }] }),
    ).toBe(false);
  });

  it("accepts a free-text line with a name and no productId", () => {
    expect(
      isQuoteActionReady({
        ...readyQuote,
        lines: [{ name: "Özel vakum" }],
      }),
    ).toBe(true);
  });

  it("accepts a catalog line with productId even if name is blank", () => {
    expect(
      isQuoteActionReady({
        ...readyQuote,
        lines: [{ productId: "p1", name: "  " }],
      }),
    ).toBe(true);
  });
});
