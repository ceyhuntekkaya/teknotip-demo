import { describe, expect, it } from "vitest";
import type { ProductResponse, QuoteResponse } from "@/lib/api/generated/model";
import {
  addFreeLine,
  addProductLine,
  greetingName,
  isManualLine,
  moveLine,
  nextFreeCode,
  patchQuotedTo,
} from "@/lib/quote/document-edit";

const emptyQuote: QuoteResponse = { lines: [] };

const catalogProduct: ProductResponse = {
  id: "p1",
  code: "CVDFRN",
  name: "CVD FIRIN",
  price: 19000,
};

describe("document-edit", () => {
  it("nextFreeCode skips used numeric codes", () => {
    expect(nextFreeCode([])).toBe("001");
    expect(nextFreeCode([{ code: "001", name: "A" }, { code: "2", name: "B" }])).toBe("003");
  });

  it("addFreeLine creates a line without productId", () => {
    const next = addFreeLine(emptyQuote, {
      code: "010",
      name: "Özel vakum bağlantısı\nuzun açıklama",
      quantity: 2,
      price: 1500,
    });
    expect(next.lines).toHaveLength(1);
    expect(isManualLine(next.lines![0])).toBe(true);
    expect(next.lines![0].productId).toBeUndefined();
    expect(next.lines![0].name).toContain("uzun açıklama");
    expect(next.lines![0].quantity).toBe(2);
    expect(next.lines![0].price).toBe(1500);
  });

  it("addFreeLine ignores blank names", () => {
    expect(addFreeLine(emptyQuote, { name: "   " }).lines).toEqual([]);
  });

  it("moveLine swaps adjacent rows", () => {
    const quote = addProductLine(
      addFreeLine(emptyQuote, { name: "Elle", code: "001" }),
      catalogProduct,
    );
    const moved = moveLine(quote, 1, -1);
    expect(moved.lines![0].name).toBe("CVD FIRIN");
    expect(moved.lines![1].name).toBe("Elle");
    expect(moved.lines![0].sortOrder).toBe(0);
    expect(moved.lines![1].sortOrder).toBe(1);
  });

  it("moveLine is a no-op at the edges", () => {
    const quote = addFreeLine(emptyQuote, { name: "Tek" });
    expect(moveLine(quote, 0, -1)).toBe(quote);
    expect(moveLine(quote, 0, 1)).toBe(quote);
  });

  it("greetingName joins title and contact person", () => {
    expect(greetingName("Prof.", "Ayşe Yılmaz")).toBe("Prof. Ayşe Yılmaz");
    expect(greetingName(undefined, "Ayşe Yılmaz")).toBe("Ayşe Yılmaz");
    expect(greetingName("  ", "  ")).toBeUndefined();
  });

  it("patchQuotedTo updates institution, person and greeting", () => {
    const next = patchQuotedTo(emptyQuote, {
      institution: "ODTÜ",
      contactPerson: "Ayşe Yılmaz",
      title: "Prof.",
    });
    expect(next.quotedTo?.institution).toBe("ODTÜ");
    expect(next.quotedTo?.contactPerson).toBe("Ayşe Yılmaz");
    expect(next.quotedTo?.greetingName).toBe("Prof. Ayşe Yılmaz");
  });
});
